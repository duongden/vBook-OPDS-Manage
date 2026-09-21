import { DriveItem } from './drive';
import { bookKey, seal, stringInput, fail } from './library-security';
import { cleanBookTitle } from './opds';

export interface Library {
  id: string; short_id: string; name: string; root_token: string; username: string;
  password_hash: string; recovery_hash: string; opds_hash: string; created_at: number; auth_version: number;
}
export interface Override {
  title?: string; author?: string; language?: string; category?: string; description?: string; coverUrl?: string;
}
export interface LibraryItem {
  key: string; ref: string; name: string; title: string; opdsTitle: string; isFolder: boolean;
  format: string; mimeType: string; size?: string; modified: string;
  author: string; language: string; category: string; description: string; coverUrl: string;
  overrides: Override; sourceCoverUrl: string;
}
export async function getLibrary(db: D1Database, id: string): Promise<Library> {
  const row = await db.prepare('SELECT * FROM libraries WHERE id = ?').bind(id).first<Library>();
  if (!row) return fail(404, 'Không tìm thấy thư viện.');
  return row;
}
export function validateOverrides(body: Record<string, unknown>): Override {
  const result: Override = {};
  const limits = { title: 240, author: 240, language: 35, category: 120, description: 5000, coverUrl: 2048 };
  for (const field of Object.keys(limits) as (keyof Override)[]) {
    if (body[field] === undefined) continue;
    let value = stringInput(body[field], limits[field], field);
    if (!value) continue; // Blank removes the override and restores source data.
    if (field === 'language' && !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value)) fail(400, 'Ngôn ngữ cần mã như vi, en, fr hoặc zh-Hans.');
    if (field === 'coverUrl') {
      try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); value = url.href; }
      catch { fail(400, 'Bìa cần URL HTTPS hợp lệ, không chứa thông tin đăng nhập.'); }
    }
    result[field] = value;
  }
  return result;
}
export function fileExtension(name: string): string {
  return name.toLowerCase().endsWith('.fb2.zip') ? '.fb2.zip' : (name.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
}
export function displayTitle(original: string, override?: string): string {
  const ext = fileExtension(original);
  let title = override || original;
  if (ext && !title.toLowerCase().endsWith(ext)) title += ext;
  return cleanBookTitle(title);
}
export async function presentItems(db: D1Database, secret: string, lib: string, items: DriveItem[], parent: string): Promise<LibraryItem[]> {
  const keys = await Promise.all(items.map(item => bookKey(secret, lib, item.id)));
  const overrides = new Map<string, Override>();
  const editedAt = new Map<string, number>();
  // Stay below D1's bound-parameter limit, independent of page size.
  for (let i = 0; i < keys.length; i += 80) {
    const chunk = keys.slice(i, i + 80);
    const rows = await db.prepare(`SELECT book_key, data, updated_at FROM book_overrides WHERE library_id = ? AND book_key IN (${chunk.map(() => '?').join(',')})`).bind(lib, ...chunk).all<{book_key: string; data: string; updated_at: number}>();
    for (const row of rows.results) { overrides.set(row.book_key, JSON.parse(row.data)); editedAt.set(row.book_key, row.updated_at); }
  }
  return Promise.all(items.map(async (item, i) => {
    const o = item.isFolder ? {} : overrides.get(keys[i]) || {};
    let cover = o.coverUrl || item.thumbnailLink || '';
    if (!cover.startsWith('https://')) cover = '';
    return {
      key: keys[i], ref: await seal(secret, { lib, kind: item.isFolder ? 'folder' : 'book', id: item.id, parent }),
      name: item.name, title: o.title || item.name, opdsTitle: displayTitle(item.name, o.title),
      isFolder: item.isFolder, format: fileExtension(item.name).slice(1).toUpperCase() || 'FILE',
      mimeType: item.bookMimeType || item.mimeType, size: item.size,
      modified: new Date(Math.max(Date.parse(item.modifiedTime || '') || 0, editedAt.get(keys[i]) || 0) || Date.now()).toISOString(), author: o.author || '', language: o.language || '',
      category: o.category || '', description: o.description || '', coverUrl: cover, overrides: o,
      sourceCoverUrl: item.thumbnailLink?.startsWith('https://') ? item.thumbnailLink : '',
    };
  }));
}
export function saveOverride(db: D1Database, lib: string, key: string, data: Override): D1PreparedStatement {
  return db.prepare('INSERT INTO book_overrides (library_id, book_key, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(library_id, book_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(lib, key, JSON.stringify(data), Date.now());
}
