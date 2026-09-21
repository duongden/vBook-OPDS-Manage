import { Hono, Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { extractFolderId, fetchDriveFolder, searchDriveFolder } from './drive';
import { maskFolderId, unmaskFolderId } from './crypto';
import { Library, getLibrary, presentItems, saveOverride, validateOverrides } from './library-data';
import { base64url, bookKey, checkPassword, digest, equal, fail, hashPassword, passwordInput, randomToken, revealData, seal, stringInput, unseal } from './library-security';
import { managedFeed, XML_TYPE } from './library-feed';
import { fetchOpds, OpdsSourceConfig, OpdsSourceRow, rewriteOpdsBody, safeOpdsUrl, sourceConfig, sourceToken, validateOpds } from './opds-source';

export interface LibraryEnv { DB: D1Database; MASK_SECRET: string; GOOGLE_API_KEY: string }
interface Session { library_id: string; csrf: string; expires_at: number }
type Bindings = { Bindings: LibraryEnv; Variables: { session: Session; library: Library } };
type C = Context<Bindings>;
export const libraryApp = new Hono<Bindings>();
const COOKIE = '__Host-vbook_session';
const api = libraryApp;

api.use('*', async (c, next) => {
  if (!/^\/(?:api\/(?:libraries|session|recovery)(?:\/|$)|library\/|o\/)/.test(c.req.path)) { await next(); return; }
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  if (!c.env?.DB || !c.env?.MASK_SECRET) return c.json({ error: 'Thư viện chưa được cấu hình. Cần D1 và MASK_SECRET trên máy chủ.' }, 503);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    if (c.req.header('Origin') !== new URL(c.req.url).origin) return c.json({ error: 'Yêu cầu phải đến từ trang quản lý cùng tên miền.' }, 403);
    if (!c.req.header('Content-Type')?.startsWith('application/json')) return c.json({ error: 'Yêu cầu cần JSON.' }, 400);
  }
  await next();
});
api.use('*', bodyLimit({ maxSize: 65536, onError: c => c.json({ error: 'Dữ liệu quá lớn; hãy chia nhỏ thao tác.' }, 413) }));
api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err instanceof SyntaxError) return c.json({ error: 'JSON không hợp lệ.' }, 400);
  // Never log Drive API responses/URLs, request tokens or database rows.
  const msg = err.message || '';
  if (msg === 'DriveIncompleteSearch') return c.json({ error: 'Drive chưa trả đủ dữ liệu. Kết quả quét chưa hoàn tất; hãy thử lại.' }, 503);
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return c.json({ error: 'Drive phản hồi quá lâu. Vui lòng thử lại để tiếp tục.' }, 503);
  if (/429|rateLimitExceeded|quotaExceeded|userRateLimitExceeded/.test(msg)) {
    c.header('Retry-After', '60'); return c.json({ error: 'Drive đang giới hạn truy vấn. Chờ 60 giây rồi thử lại.' }, 429);
  }
  if (/404|File not found/.test(msg)) return c.json({ error: 'Không tìm thấy thư mục/file hoặc quyền chia sẻ đã thay đổi.' }, 404);
  if (/Google Drive API error/.test(msg)) return c.json({ error: 'Không đọc được Drive. Kiểm tra quyền chia sẻ và API Key máy chủ.' }, 503);
  return c.json({ error: 'Không xử lý được yêu cầu. Vui lòng thử lại hoặc kiểm tra cấu hình máy chủ.' }, 500);
});

async function jsonBody(c: C): Promise<Record<string, unknown>> {
  const body = await c.req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Nội dung JSON không hợp lệ.');
  return body;
}
function googleKey(c: C): string {
  if (!c.env.GOOGLE_API_KEY) fail(503, 'Chưa cấu hình Google Drive API Key trên máy chủ.');
  return c.env.GOOGLE_API_KEY;
}
async function rateLimit(c: C, scope: string, limit = 12): Promise<void> {
  const now = Date.now();
  const key = await bookKey(c.env.MASK_SECRET, 'rate-limit', `${scope}:${c.req.header('CF-Connecting-IP') || 'local'}`);
  await c.env.DB.prepare('DELETE FROM auth_limits WHERE expires_at < ?').bind(now).run();
  const row = await c.env.DB.prepare('INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, now + 900000).first<{count: number}>();
  if (!row || row.count > limit) { c.header('Retry-After', '900'); fail(429, 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.'); }
}
async function startSession(c: C, id: string, version: number): Promise<string> {
  const token = randomToken(), csrf = randomToken(), expires = Date.now() + 7 * 86400000;
  const results = await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    c.env.DB.prepare('INSERT INTO sessions (token_hash, library_id, csrf, expires_at, auth_version) SELECT ?, id, ?, ?, auth_version FROM libraries WHERE id = ? AND auth_version = ?').bind(await digest(token), csrf, expires, id, version),
  ]);
  if (results[1].meta.changes !== 1) fail(401, 'Thông tin đăng nhập vừa thay đổi. Vui lòng đăng nhập lại.');
  setCookie(c, COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 7 * 86400 });
  return csrf;
}
async function session(c: C): Promise<Session> {
  const token = getCookie(c, COOKIE);
  if (!token || !/^[\w-]{43}$/.test(token)) return fail(401, 'Vui lòng đăng nhập thư viện.');
  const row = await c.env.DB.prepare('SELECT s.library_id, s.csrf, s.expires_at FROM sessions s JOIN libraries l ON l.id = s.library_id AND l.auth_version = s.auth_version WHERE s.token_hash = ?').bind(await digest(token)).first<Session>();
  if (!row || row.expires_at < Date.now()) return fail(401, 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
  if (!['GET', 'HEAD'].includes(c.req.method) && !equal(c.req.header('X-CSRF-Token') || '', row.csrf)) fail(403, 'Phiên thao tác không hợp lệ. Hãy tải lại trang.');
  return row;
}
function publicLibrary(l: Library) { return { id: l.id, shortId: l.short_id, name: l.name, username: l.username, createdAt: l.created_at }; }
function credentials(c: C, library: Pick<Library, 'id' | 'short_id'>, password: string) {
  const path = library.short_id ? `/o/${library.short_id}` : `/library/${library.id}/opds`;
  return { url: `${new URL(c.req.url).origin}${path}`, username: 'reader', password };
}
const newShortId = () => base64url(crypto.getRandomValues(new Uint8Array(9)));
type PreparedSource = { id: string; shortId: string; name: string; token: string };
async function prepareSource(secret: string, libraryId: string, raw: Record<string, unknown>): Promise<PreparedSource> {
  const enteredUrl = stringInput(raw.url, 2048, 'URL OPDS', true);
  const username = stringInput(raw.username ?? '', 256, 'Tên đăng nhập nguồn');
  const password = stringInput(raw.password ?? '', 512, 'Mật khẩu nguồn');
  const config: OpdsSourceConfig = { url: safeOpdsUrl(enteredUrl).href, username, password };
  let checked: Awaited<ReturnType<typeof validateOpds>>;
  try { checked = await validateOpds(config); }
  catch (error) {
    if (error instanceof HTTPException) throw error;
    return fail(503, 'Không kết nối được nguồn OPDS. Hãy kiểm tra URL và thử lại.');
  }
  config.url = safeOpdsUrl(checked.url || config.url).href;
  const id = crypto.randomUUID(), shortId = newShortId();
  const name = stringInput(raw.name ?? '', 120, 'Tên nguồn') || checked.title || safeOpdsUrl(config.url).hostname;
  return { id, shortId, name, token: await sourceToken(secret, libraryId, id, config) };
}

api.post('/api/libraries', async c => {
  await rateLimit(c, 'create', 5);
  const body = await jsonBody(c);
  const name = stringInput(body.name, 120, 'Tên thư viện', true);
  const username = stringInput(body.username, 80, 'Tên đăng nhập', true);
  const password = passwordInput(body.password);
  const input = stringInput(body.drive ?? '', 2048, 'Link Drive');
  let folder = '', initialOpds: Record<string, unknown> | null = null;
  if (input?.includes('://')) {
    let parsed: URL; try { parsed = new URL(input); } catch { return fail(400, 'Link Drive hoặc OPDS không hợp lệ.'); }
    if (parsed.hostname === 'drive.google.com') folder = extractFolderId(input) || '';
    else initialOpds = { url: input };
  } else if (input) folder = extractFolderId(input) || '';
  if (input && !initialOpds && (!folder || !/^[\w-]{10,60}$/.test(folder))) return fail(400, 'Link thư mục Drive không hợp lệ.');
  if (folder) {
    // Confirm the supplied resource really is a readable folder (including empty ones).
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${folder}`);
    url.searchParams.set('key', googleKey(c)); url.searchParams.set('fields', 'id,mimeType'); url.searchParams.set('supportsAllDrives', 'true');
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) fail(400, 'Không đọc được thư mục. Kiểm tra chia sẻ “Bất kỳ ai có đường liên kết”.');
    const meta = await res.json() as { mimeType?: string };
    if (meta.mimeType !== 'application/vnd.google-apps.folder') fail(400, 'Link phải trỏ tới thư mục Drive.');
  }
  const id = crypto.randomUUID(), shortId = newShortId(), recovery = randomToken(), opds = randomToken();
  const source = initialOpds ? await prepareSource(c.env.MASK_SECRET, id, initialOpds) : null;
  const now = Date.now();
  const statements = [c.env.DB.prepare('INSERT INTO libraries (id, short_id, name, root_token, username, password_hash, recovery_hash, opds_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, shortId, name, folder ? await maskFolderId(folder, c.env.MASK_SECRET) : '', username, await hashPassword(password, undefined, c.env.MASK_SECRET), await digest(recovery), await digest(`reader:${opds}`), now)];
  if (source) statements.push(c.env.DB.prepare('INSERT INTO opds_sources (id, library_id, short_id, name, config_token, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
    .bind(source.id, id, source.shortId, source.name, source.token, now, now));
  await c.env.DB.batch(statements);
  const csrf = await startSession(c, id, 0);
  const library = { id, short_id: shortId };
  return c.json({ library: { id, shortId, name, username }, csrf, recoveryCode: recovery, opds: credentials(c, library, opds) }, 201);
});
api.post('/api/session', async c => {
  await rateLimit(c, 'login');
  const body = await jsonBody(c);
  const id = stringInput(body.libraryId, 80, 'Mã thư viện', true);
  const username = stringInput(body.username, 80, 'Tên đăng nhập', true);
  const password = passwordInput(body.password);
  const lib = await c.env.DB.prepare('SELECT * FROM libraries WHERE id = ?').bind(id).first<Library>();
  const valid = await checkPassword(password, lib?.password_hash || 'dummy.invalid', c.env.MASK_SECRET);
  if (!lib || !valid || !equal(username, lib.username)) return fail(401, 'Mã thư viện, tài khoản hoặc mật khẩu không đúng.');
  if (!lib.password_hash.startsWith('p1.')) {
    await c.env.DB.prepare('UPDATE libraries SET password_hash = ? WHERE id = ? AND password_hash = ? AND auth_version = ?')
      .bind(await hashPassword(password, undefined, c.env.MASK_SECRET), lib.id, lib.password_hash, lib.auth_version).run();
  }
  return c.json({ library: publicLibrary(lib), csrf: await startSession(c, lib.id, lib.auth_version) });
});
api.get('/api/session', async c => {
  const s = await session(c); return c.json({ library: publicLibrary(await getLibrary(c.env.DB, s.library_id)), csrf: s.csrf });
});
api.delete('/api/session', async c => {
  await session(c);
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(getCookie(c, COOKIE)!)).run();
  deleteCookie(c, COOKIE, { path: '/', secure: true }); return c.json({ success: true });
});
api.post('/api/recovery', async c => {
  await rateLimit(c, 'recovery', 8);
  const body = await jsonBody(c), id = stringInput(body.libraryId, 80, 'Mã thư viện', true);
  const code = stringInput(body.code, 100, 'Mã khôi phục', true), password = passwordInput(body.password);
  const lib = await c.env.DB.prepare('SELECT * FROM libraries WHERE id = ?').bind(id).first<Library>();
  const hashed = await digest(code);
  if (!lib || !equal(lib.recovery_hash, hashed)) return fail(401, 'Mã khôi phục không đúng hoặc đã sử dụng.');
  const next = randomToken(), opds = randomToken();
  const updated = await c.env.DB.prepare('UPDATE libraries SET password_hash = ?, recovery_hash = ?, opds_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND recovery_hash = ? AND auth_version = ?')
    .bind(await hashPassword(password, undefined, c.env.MASK_SECRET), await digest(next), await digest(`reader:${opds}`), id, hashed, lib.auth_version).run();
  if (updated.meta.changes !== 1) fail(409, 'Mã khôi phục đã được sử dụng.');
  await c.env.DB.prepare('DELETE FROM sessions WHERE library_id = ? AND auth_version < ?').bind(id, lib.auth_version + 1).run();
  return c.json({ library: publicLibrary(lib), csrf: await startSession(c, id, lib.auth_version + 1), recoveryCode: next, opds: credentials(c, lib, opds) });
});

api.use('/api/libraries/:id/*', async (c, next) => {
  const s = await session(c);
  if (s.library_id !== c.req.param('id')) return c.json({ error: 'Không có quyền truy cập thư viện này.' }, 403);
  c.set('session', s); c.set('library', await getLibrary(c.env.DB, s.library_id));
  await next();
});
api.post('/api/libraries/:id/password', async c => {
  await rateLimit(c, 'change-password');
  const body = await jsonBody(c), lib = c.get('library');
  if (!await checkPassword(passwordInput(body.currentPassword), lib.password_hash, c.env.MASK_SECRET)) fail(401, 'Mật khẩu hiện tại không đúng.');
  const changed = await c.env.DB.prepare('UPDATE libraries SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND auth_version = ?')
    .bind(await hashPassword(passwordInput(body.password), undefined, c.env.MASK_SECRET), lib.id, lib.auth_version).run();
  if (changed.meta.changes !== 1) fail(409, 'Tài khoản vừa thay đổi. Hãy đăng nhập lại.');
  await c.env.DB.prepare('DELETE FROM sessions WHERE library_id = ? AND auth_version < ?').bind(lib.id, lib.auth_version + 1).run();
  return c.json({ csrf: await startSession(c, lib.id, lib.auth_version + 1) });
});
api.post('/api/libraries/:id/opds-credentials', async c => {
  const password = randomToken(), lib = c.get('library');
  await c.env.DB.prepare('UPDATE libraries SET opds_hash = ? WHERE id = ?').bind(await digest(`reader:${password}`), lib.id).run();
  return c.json({ opds: credentials(c, lib, password) });
});
api.post('/api/libraries/:id/delete', async c => {
  const body = await jsonBody(c), lib = c.get('library');
  await rateLimit(c, 'delete');
  if (!await checkPassword(passwordInput(body.password), lib.password_hash, c.env.MASK_SECRET)) fail(401, 'Mật khẩu không đúng.');
  const removed = await c.env.DB.prepare('DELETE FROM libraries WHERE id = ? AND auth_version = ?').bind(lib.id, lib.auth_version).run();
  if (removed.meta.changes !== 1) fail(409, 'Tài khoản vừa thay đổi. Hãy đăng nhập lại.');
  deleteCookie(c, COOKIE, { path: '/', secure: true }); return c.json({ success: true });
});

async function readPage(c: C, lib: Library, params: {folder?: string; cursor?: string; q?: string}) {
  const secret = c.env.MASK_SECRET;
  if (!lib.root_token) return { items: [], folderKey: await bookKey(secret, lib.id, 'external-opds-only'), nextCursor: null };
  const root = await unmaskFolderId(lib.root_token, secret);
  if (!root) return fail(503, 'Không giải mã được nguồn Drive. Kiểm tra MASK_SECRET.');
  let folder = root, page: string | undefined;
  const q = params.q || '';
  if (params.folder) folder = (await unseal(secret, params.folder, lib.id, 'folder')).id;
  if (params.cursor) {
    const token = await unseal(secret, params.cursor, lib.id, 'page');
    if (token.id !== folder || (token.q || '') !== q) fail(400, 'Con trỏ không thuộc thư mục hoặc truy vấn này.');
    page = token.page;
  }
  const data = q
    ? await searchDriveFolder({ folderId: folder, apiKey: googleKey(c), pageToken: page, pageSize: 50, searchTerm: q })
    : await fetchDriveFolder({ folderId: folder, apiKey: googleKey(c), pageToken: page, pageSize: 50 });
  return {
    items: await presentItems(c.env.DB, secret, lib.id, data.items, folder),
    folderKey: await bookKey(secret, lib.id, folder),
    nextCursor: data.nextPageToken ? await seal(secret, { lib: lib.id, kind: 'page', id: folder, page: data.nextPageToken, q, exp: Date.now() + 86400000 }) : null,
  };
}
api.get('/api/libraries/:id/items', async c => c.json(await readPage(c, c.get('library'), { folder: c.req.query('folder'), cursor: c.req.query('cursor') })));
// Client owns BFS queue and deduplication. One request reads one Drive page; no tree-size cap.
api.post('/api/libraries/:id/scan', async c => {
  const body = await jsonBody(c);
  const folder = body.folder === undefined ? undefined : stringInput(body.folder, 16000, 'Thư mục');
  const cursor = body.cursor === undefined ? undefined : stringInput(body.cursor, 16000, 'Con trỏ');
  return c.json(await readPage(c, c.get('library'), { folder, cursor }));
});
async function editableKey(c: C, ref: unknown): Promise<string> {
  const lib = c.get('library');
  const item = await unseal(c.env.MASK_SECRET, stringInput(ref, 16000, 'Tham chiếu sách', true), lib.id, 'book');
  return bookKey(c.env.MASK_SECRET, lib.id, item.id);
}
api.put('/api/libraries/:id/books/:key', async c => {
  const body = await jsonBody(c), key = await editableKey(c, body.ref);
  if (key !== c.req.param('key')) fail(403, 'Tham chiếu không khớp sách.');
  const overrides = validateOverrides(body);
  await saveOverride(c.env.DB, c.get('library').id, key, overrides).run();
  return c.json({ overrides });
});
api.delete('/api/libraries/:id/books/:key', async c => {
  const body = await jsonBody(c), key = await editableKey(c, body.ref);
  if (key !== c.req.param('key')) fail(403, 'Tham chiếu không khớp sách.');
  await c.env.DB.prepare('DELETE FROM book_overrides WHERE library_id = ? AND book_key = ?').bind(c.get('library').id, key).run();
  return c.json({ overrides: {} });
});
api.post('/api/libraries/:id/language', async c => {
  const body = await jsonBody(c), lib = c.get('library');
  if (!Array.isArray(body.refs) || !body.refs.length || body.refs.length > 50) fail(400, 'Chọn từ 1 đến 50 sách mỗi lần.');
  const language = validateOverrides({ language: body.language }).language;
  const keys = await Promise.all((body.refs as unknown[]).map(ref => editableKey(c, ref)));
  // JSON patch updates only language, retaining concurrent edits to other fields.
  await c.env.DB.batch(keys.map(key => c.env.DB.prepare('INSERT INTO book_overrides (library_id, book_key, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(library_id, book_key) DO UPDATE SET data = json_patch(book_overrides.data, ?), updated_at = excluded.updated_at')
    .bind(lib.id, key, JSON.stringify(language ? { language } : {}), Date.now(), JSON.stringify({ language: language || null }))));
  return c.json({ language: language || '', count: keys.length });
});

async function listSources(c: C) {
  const lib = c.get('library');
  const rows = (await c.env.DB.prepare('SELECT * FROM opds_sources WHERE library_id = ? ORDER BY created_at, name').bind(lib.id).all<OpdsSourceRow>()).results;
  return Promise.all(rows.map(async row => {
    const config = await sourceConfig(c.env.MASK_SECRET, row);
    return {
      id: row.id, shortId: row.short_id, name: row.name, host: safeOpdsUrl(config.url).host,
      enabled: Boolean(row.enabled), hasCredentials: Boolean(config.username || config.password),
      url: `${new URL(c.req.url).origin}/o/${lib.short_id}/s/${row.short_id}`,
    };
  }));
}

api.get('/api/libraries/:id/sources', async c => c.json({ sources: await listSources(c) }));
api.post('/api/libraries/:id/sources', async c => {
  const body = await jsonBody(c), lib = c.get('library');
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 10) fail(400, 'Mỗi lần thêm từ 1 đến 10 nguồn OPDS.');
  const prepared: PreparedSource[] = [];
  for (const raw of body.sources as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'Danh sách nguồn OPDS không hợp lệ.');
    prepared.push(await prepareSource(c.env.MASK_SECRET, lib.id, raw as Record<string, unknown>));
  }
  const now = Date.now();
  await c.env.DB.batch(prepared.map(source => c.env.DB.prepare('INSERT INTO opds_sources (id, library_id, short_id, name, config_token, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
    .bind(source.id, lib.id, source.shortId, source.name, source.token, now, now)));
  return c.json({ sources: await listSources(c) }, 201);
});
api.patch('/api/libraries/:id/sources/:sourceId', async c => {
  const body = await jsonBody(c), lib = c.get('library');
  if (typeof body.enabled !== 'boolean') fail(400, 'Trạng thái nguồn không hợp lệ.');
  const result = await c.env.DB.prepare('UPDATE opds_sources SET enabled = ?, updated_at = ? WHERE id = ? AND library_id = ?')
    .bind(body.enabled ? 1 : 0, Date.now(), c.req.param('sourceId'), lib.id).run();
  if (result.meta.changes !== 1) fail(404, 'Không tìm thấy nguồn OPDS.');
  return c.json({ sources: await listSources(c) });
});
api.delete('/api/libraries/:id/sources/:sourceId', async c => {
  const lib = c.get('library');
  const result = await c.env.DB.prepare('DELETE FROM opds_sources WHERE id = ? AND library_id = ?').bind(c.req.param('sourceId'), lib.id).run();
  if (result.meta.changes !== 1) fail(404, 'Không tìm thấy nguồn OPDS.');
  return c.json({ sources: await listSources(c) });
});

async function requireOpds(c: C, next: () => Promise<void>, field: 'id' | 'short_id', value: string) {
  const lib = await c.env.DB.prepare(`SELECT * FROM libraries WHERE ${field} = ?`).bind(value).first<Library>();
  let supplied = '';
  try { const h = c.req.header('Authorization') || ''; if (/^Basic /i.test(h)) supplied = atob(h.slice(6)); } catch {}
  const valid = equal(await digest(supplied), lib?.opds_hash || 'invalid');
  if (!lib || !valid) {
    await rateLimit(c, 'opds-auth', 40);
    c.header('WWW-Authenticate', 'Basic realm="VBook Library", charset="UTF-8"');
    return c.json({ error: 'Cần tài khoản OPDS của thư viện.' }, 401);
  }
  c.set('library', lib); await next();
}
api.use('/library/:id/*', (c, next) => requireOpds(c, next, 'id', c.req.param('id')));
api.use('/o/:shortId', (c, next) => requireOpds(c, next, 'short_id', c.req.param('shortId')));
api.use('/o/:shortId/*', (c, next) => requireOpds(c, next, 'short_id', c.req.param('shortId')));

async function serveOpds(c: C, feedPath: string, downloadPath: string) {
  const lib = c.get('library'), url = new URL(c.req.url), q = (c.req.query('q') || '').trim();
  if (q.length > 200) fail(400, 'Từ khóa tối đa 200 ký tự.');
  const data = await readPage(c, lib, { folder: c.req.query('folder'), cursor: c.req.query('cursor'), q });
  // Construct canonical links from known parameters; discard injected auth/key parameters.
  const start = `${url.origin}${feedPath}`;
  const self = new URL(start);
  if (c.req.query('folder')) self.searchParams.set('folder', c.req.query('folder')!);
  if (q) self.searchParams.set('q', q);
  if (c.req.query('cursor')) self.searchParams.set('cursor', c.req.query('cursor')!);
  const search = new URL(self); search.searchParams.delete('cursor'); search.searchParams.delete('q');
  const searchTemplate = search.href + (search.search ? '&' : '?') + 'q={searchTerms}';
  const next = new URL(self); if (data.nextCursor) next.searchParams.set('cursor', data.nextCursor);
  const json = (c.req.header('Accept') || '').includes('application/opds+json');
  const sourceRows = !q && !c.req.query('folder') && !c.req.query('cursor')
    ? (await c.env.DB.prepare('SELECT id, short_id, name FROM opds_sources WHERE library_id = ? AND enabled = 1 ORDER BY created_at, name').bind(lib.id).all<{id:string;short_id:string;name:string}>()).results
    : [];
  const sources = sourceRows.map(source => ({ id: source.id, title: source.name, href: `${url.origin}/o/${lib.short_id}/s/${source.short_id}` }));
  return c.body(managedFeed({ libraryId: lib.id, title: q ? `Tìm kiếm: ${q}` : lib.name, feedUrl: start, downloadUrl: `${url.origin}${downloadPath}`, self: self.href, start, search: searchTemplate, next: data.nextCursor ? next.href : undefined, sources, ...data }, json), 200,
    { 'Content-Type': `${json ? 'application/opds+json' : XML_TYPE};charset=utf-8`, Vary: 'Accept, Authorization' });
}
async function downloadBook(c: C) {
  const lib = c.get('library');
  const item = await unseal(c.env.MASK_SECRET, c.req.query('ref') || '', lib.id, 'book');
  return c.redirect(`https://drive.google.com/uc?export=download&id=${item.id}&confirm=t`, 302);
}
api.get('/library/:id/opds', c => serveOpds(c, `/library/${c.get('library').id}/opds`, `/library/${c.get('library').id}/download`));
api.get('/library/:id/download', downloadBook);
api.get('/o/:shortId', c => serveOpds(c, `/o/${c.get('library').short_id}`, `/o/${c.get('library').short_id}/d`));
api.get('/o/:shortId/d', downloadBook);
api.get('/o/:shortId/s/:sourceShortId', async c => {
  const lib = c.get('library');
  const found = await c.env.DB.prepare('SELECT * FROM opds_sources WHERE library_id = ? AND short_id = ? AND enabled = 1').bind(lib.id, c.req.param('sourceShortId')).first<OpdsSourceRow>();
  if (!found) return fail(404, 'Không tìm thấy nguồn OPDS hoặc nguồn đang tắt.');
  const row = found;
  const config = await sourceConfig(c.env.MASK_SECRET, row);
  let target = safeOpdsUrl(config.url);
  const targetToken = c.req.query('target');
  if (targetToken) {
    const value = await revealData<{url:string}>(c.env.MASK_SECRET, `opds-target:${row.library_id}:${row.id}`, targetToken);
    target = safeOpdsUrl(String(value.url || ''));
  }
  if (target.origin !== safeOpdsUrl(config.url).origin) fail(403, 'Tài nguyên không thuộc nguồn OPDS này.');
  let upstream: Response;
  try { upstream = await fetchOpds(config, target); }
  catch { return fail(503, 'Không kết nối được nguồn OPDS.'); }
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const isFeed = !targetToken || /(?:atom|opds|xml|json)/i.test(contentType);
  if (isFeed) {
    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
    const body = new TextDecoder().decode(bytes);
    let rewritten = body;
    if (upstream.ok) {
      try { rewritten = await rewriteOpdsBody(c.env.MASK_SECRET, lib.short_id, row, new URL(upstream.url || target.href), body, contentType); }
      catch { fail(503, 'Không đọc được dữ liệu từ nguồn OPDS.'); }
    }
    return new Response(rewritten, { status: upstream.status, headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', Vary: 'Authorization' } });
  }
  const headers = new Headers({ 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const name of ['content-disposition','content-length','etag','last-modified','location']) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
  return new Response(upstream.body, { status: upstream.status, headers });
});
