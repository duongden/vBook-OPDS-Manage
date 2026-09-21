import { fail, protectData, revealData } from './library-security';

export interface OpdsSourceConfig extends Record<string, unknown> {
  url: string;
  username: string;
  password: string;
}

export interface OpdsSourceRow {
  id: string;
  library_id: string;
  short_id: string;
  name: string;
  config_token: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

const privateIpv4 = (host: string): boolean => {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a,b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
};

export function safeOpdsUrl(input: string): URL {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) throw new Error();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) throw new Error();
    if (host.includes(':') || privateIpv4(host)) throw new Error();
    return url;
  } catch { return fail(400, 'Nguồn OPDS cần URL HTTPS công khai, không chứa tài khoản, fragment hoặc địa chỉ mạng nội bộ.'); }
}

export async function sourceConfig(secret: string, row: OpdsSourceRow): Promise<OpdsSourceConfig> {
  const value = await revealData<OpdsSourceConfig>(secret, `opds-source:${row.library_id}:${row.id}`, row.config_token);
  safeOpdsUrl(value.url);
  return { url: value.url, username: String(value.username || ''), password: String(value.password || '') };
}

export async function sourceToken(secret: string, libraryId: string, sourceId: string, config: OpdsSourceConfig): Promise<string> {
  return protectData(secret, `opds-source:${libraryId}:${sourceId}`, config);
}

export function upstreamHeaders(config: OpdsSourceConfig, accept = 'application/atom+xml, application/opds+json;q=0.9, application/xml;q=0.8'): Headers {
  const headers = new Headers({ Accept: accept, 'User-Agent': 'VBook-OPDS-Aggregator/1.0' });
  if (config.username || config.password) headers.set('Authorization', `Basic ${btoa(`${config.username}:${config.password}`)}`);
  return headers;
}

export async function fetchOpds(config: OpdsSourceConfig, target: URL, signal?: AbortSignal): Promise<Response> {
  const root = safeOpdsUrl(config.url);
  if (target.origin !== root.origin) return fail(403, 'Proxy chỉ truy cập tài nguyên cùng máy chủ với nguồn OPDS.');
  let current = target;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(current, { headers: upstreamHeaders(config), redirect: 'manual', signal: signal || AbortSignal.timeout(20000) });
    if (![301,302,303,307,308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    const next = safeOpdsUrl(new URL(location, current).href);
    if (next.origin !== root.origin) return new Response(null, { status: 302, headers: { Location: next.href, 'Cache-Control': 'private, no-store' } });
    current = next;
  }
  return fail(503, 'Nguồn OPDS chuyển hướng quá nhiều lần.');
}

const xmlUnescape = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function validateOpds(config: OpdsSourceConfig): Promise<{ url: string; title: string }> {
  const response = await fetchOpds(config, safeOpdsUrl(config.url));
  if (!response.ok) fail(400, `Nguồn OPDS phản hồi HTTP ${response.status}.`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
  const text = new TextDecoder().decode(bytes);
  const type = response.headers.get('content-type') || '';
  let title = '';
  if (type.includes('json') || text.trimStart().startsWith('{')) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || (!data.metadata && !Array.isArray(data.navigation) && !Array.isArray(data.publications) && !Array.isArray(data.groups))) throw new Error();
      title = String(data.metadata?.title || data.title || '');
    }
    catch { fail(400, 'Nguồn không trả về OPDS JSON hợp lệ.'); }
  } else {
    if (!/<(?:[\w-]+:)?(?:feed|entry)\b/i.test(text)) fail(400, 'Nguồn không trả về Atom/OPDS XML hợp lệ.');
    title = xmlUnescape(text.match(/<(?:[\w-]+:)?title(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || '');
  }
  return { url: response.url || config.url, title: title.slice(0, 120) };
}

export async function proxyHref(secret: string, libraryShortId: string, row: OpdsSourceRow, base: URL, root: URL, href: string): Promise<string> {
  if (!href || href.includes('{')) return href;
  let target: URL;
  try { target = safeOpdsUrl(new URL(xmlUnescape(href), base).href); } catch { return href; }
  if (target.origin !== root.origin) return target.href;
  const token = await protectData(secret, `opds-target:${row.library_id}:${row.id}`, { url: target.href });
  return `/o/${libraryShortId}/s/${row.short_id}?target=${encodeURIComponent(token)}`;
}

export async function rewriteOpdsBody(secret: string, libraryShortId: string, row: OpdsSourceRow, base: URL, body: string, contentType: string): Promise<string> {
  const root = safeOpdsUrl((await sourceConfig(secret, row)).url);
  if (contentType.includes('json') || body.trimStart().startsWith('{')) {
    const data = JSON.parse(body);
    const visit = async (value: unknown): Promise<void> => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'href' && typeof child === 'string') (value as Record<string, unknown>)[key] = await proxyHref(secret, libraryShortId, row, base, root, child);
        else await visit(child);
      }
    };
    await visit(data); return JSON.stringify(data);
  }
  const matches = [...body.matchAll(/\b(href|src)=(['"])(.*?)\2/gi)];
  if (!matches.length) return body;
  let result = '', offset = 0;
  for (const match of matches) {
    result += body.slice(offset, match.index) + `${match[1]}=${match[2]}${xmlEscape(await proxyHref(secret, libraryShortId, row, base, root, match[3]))}${match[2]}`;
    offset = match.index! + match[0].length;
  }
  return result + body.slice(offset);
}
