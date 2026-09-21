import { LibraryItem, fileExtension } from './library-data';
import { bookKey, fail, protectData, revealData } from './library-security';
import { fetchOpds, OpdsSourceRow, safeOpdsUrl, sourceConfig } from './opds-source';

interface ParsedLink { href: string; rel: string[]; type: string; length?: string }
interface ParsedBook { id: string; title: string; author: string; language: string; category: string; description: string; modified: string; links: ParsedLink[]; cover: string }
interface ParsedFeed { navigation: { title: string; href: string }[]; books: ParsedBook[]; next: string }
export interface ScannedOpdsItem extends LibraryItem { external?: boolean; sourceId?: string; sourceName?: string }

const decodeXml = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (xml: string, tag: string): string => decodeXml(xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i'))?.[1]?.replace(/<[^>]+>/g, '').trim() || '');
const attrs = (tag: string): Record<string, string> => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(['"])(.*?)\2/g)].map(match => [match[1].toLowerCase(), decodeXml(match[3])]));
const rels = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : String(value || '').split(/\s+/).filter(Boolean);
const linkTags = (xml: string): ParsedLink[] => [...xml.matchAll(/<(?:[\w-]+:)?link\b[^>]*>/gi)].map(match => {
  const a = attrs(match[0]); return { href: a.href || '', rel: rels(a.rel), type: a.type || '', length: a.length };
});
const isAcquisition = (link: ParsedLink) => link.rel.some(rel => rel.includes('acquisition'));
const isNavigation = (link: ParsedLink) => link.rel.some(rel => ['subsection','collection','http://opds-spec.org/shelf'].includes(rel));
const safeDate = (value: string): string => new Date(Date.parse(value) || Date.now()).toISOString();
const plainText = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, '').trim();
  if (value && typeof value === 'object') return plainText((value as Record<string, unknown>).value || (value as Record<string, unknown>).name);
  return '';
};

function parseXml(body: string): ParsedFeed {
  const entries = [...body.matchAll(/<(?:[\w-]+:)?entry\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?entry>/gi)].map(match => match[1]);
  const navigation: ParsedFeed['navigation'] = [], books: ParsedBook[] = [];
  for (const entry of entries) {
    const links = linkTags(entry), acquisition = links.find(isAcquisition), navigationLink = links.find(isNavigation);
    if (acquisition) books.push({
      id: text(entry, 'id') || acquisition.href, title: text(entry, 'title') || 'Sách chưa có tên',
      author: text(entry, 'name'), language: text(entry, 'language'),
      category: attrs(entry.match(/<(?:[\w-]+:)?category\b[^>]*>/i)?.[0] || '').label || '',
      description: text(entry, 'summary') || text(entry, 'content'), modified: text(entry, 'updated'), links,
      cover: links.find(link => link.rel.some(rel => /image|thumbnail/.test(rel)))?.href || '',
    });
    else if (navigationLink?.href) navigation.push({ title: text(entry, 'title') || 'Danh mục OPDS', href: navigationLink.href });
  }
  const withoutEntries = body.replace(/<(?:[\w-]+:)?entry\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?entry>/gi, '');
  const feedLinks = linkTags(withoutEntries);
  for (const link of feedLinks.filter(isNavigation)) if (link.href) navigation.push({ title: 'Danh mục OPDS', href: link.href });
  return { navigation, books, next: feedLinks.find(link => link.rel.includes('next'))?.href || '' };
}

function parseJson(body: string): ParsedFeed {
  const data = JSON.parse(body) as Record<string, any>;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const navigation = [...(Array.isArray(data.navigation) ? data.navigation : []), ...groups.flatMap(group => Array.isArray(group.navigation) ? group.navigation : [])]
    .filter(item => item?.href).map(item => ({ title: plainText(item.title) || 'Danh mục OPDS', href: String(item.href) }));
  const publications = [...(Array.isArray(data.publications) ? data.publications : []), ...groups.flatMap(group => Array.isArray(group.publications) ? group.publications : [])];
  const books = publications.map(publication => {
    const metadata = publication?.metadata || {};
    const links: ParsedLink[] = (Array.isArray(publication?.links) ? publication.links : []).map((link: any) => ({ href: String(link?.href || ''), rel: rels(link?.rel), type: String(link?.type || ''), length: link?.length === undefined ? undefined : String(link.length) }));
    const images = Array.isArray(publication?.images) ? publication.images : [];
    const author = Array.isArray(metadata.author) ? metadata.author.map(plainText).filter(Boolean).join(', ') : plainText(metadata.author);
    const language = Array.isArray(metadata.language) ? String(metadata.language[0] || '') : String(metadata.language || '');
    const category = Array.isArray(metadata.subject) ? plainText(metadata.subject[0]) : plainText(metadata.subject);
    return { id: String(metadata.identifier || links.find(isAcquisition)?.href || metadata.title || ''), title: plainText(metadata.title) || 'Sách chưa có tên', author, language, category, description: plainText(metadata.description), modified: String(metadata.modified || ''), links, cover: String(images[0]?.href || '') };
  }).filter(book => book.links.some(isAcquisition));
  const topLinks: ParsedLink[] = (Array.isArray(data.links) ? data.links : []).map((link: any) => ({ href: String(link?.href || ''), rel: rels(link?.rel), type: String(link?.type || '') }));
  return { navigation, books, next: topLinks.find(link => link.rel.includes('next'))?.href || '' };
}

const formatOf = (link: ParsedLink): string => {
  let ext = ''; try { ext = fileExtension(new URL(link.href, 'https://invalid.example').pathname).slice(1).toUpperCase(); } catch {}
  if (ext) return ext === 'ZIP' && /comic|cbz/i.test(link.type) ? 'CBZ' : ext;
  if (/epub/i.test(link.type)) return 'EPUB'; if (/pdf/i.test(link.type)) return 'PDF'; if (/mobi/i.test(link.type)) return 'MOBI';
  return 'BOOK';
};
const resolved = (href: string, base: URL): URL | null => { if (!href) return null; try { return safeOpdsUrl(new URL(href, base).href); } catch { return null; } };

export async function scanOpdsSource(secret: string, libraryId: string, row: OpdsSourceRow, targetToken = '') {
  const config = await sourceConfig(secret, row), root = safeOpdsUrl(config.url);
  let target = root;
  if (targetToken) {
    const value = await revealData<{url:string}>(secret, `opds-scan:${libraryId}:${row.id}`, targetToken);
    target = safeOpdsUrl(String(value.url || ''));
  }
  if (target.origin !== root.origin) fail(403, 'Trang OPDS không thuộc nguồn đã chọn.');
  const response = await fetchOpds(config, target);
  if (!response.ok) fail(503, `Nguồn OPDS phản hồi HTTP ${response.status}.`);
  const length = Number(response.headers.get('content-length') || 0); if (length > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
  const bytes = await response.arrayBuffer(); if (bytes.byteLength > 2_000_000) fail(413, 'Feed OPDS lớn hơn 2 MB.');
  const body = new TextDecoder().decode(bytes), contentType = response.headers.get('content-type') || '';
  let feed: ParsedFeed;
  try { feed = contentType.includes('json') || body.trimStart().startsWith('{') ? parseJson(body) : parseXml(body); }
  catch { return fail(503, 'Không đọc được danh sách sách từ nguồn OPDS.'); }
  const base = new URL(response.url || target.href);
  const navigation: ScannedOpdsItem[] = [];
  for (const item of feed.navigation) {
    const url = resolved(item.href, base); if (!url || url.origin !== root.origin) continue;
    const key = await bookKey(secret, libraryId, `opds-page:${row.id}:${url.href}`);
    navigation.push({ key, ref: await protectData(secret, `opds-scan:${libraryId}:${row.id}`, { url: url.href }), name: item.title, title: item.title, opdsTitle: item.title, isFolder: true, format: 'OPDS', mimeType: 'application/atom+xml', modified: new Date().toISOString(), author: row.name, language: '', category: '', description: '', coverUrl: '', overrides: {}, sourceCoverUrl: '', external: true, sourceId: row.id, sourceName: row.name });
  }
  const books: ScannedOpdsItem[] = [];
  for (const book of feed.books) {
    const acquisition = book.links.find(isAcquisition)!;
    const key = await bookKey(secret, libraryId, `opds-book:${row.id}:${book.id || acquisition.href}`);
    const cover = resolved(book.cover, base)?.href || '';
    books.push({ key, ref: '', name: book.title, title: book.title, opdsTitle: book.title, isFolder: false, format: formatOf(acquisition), mimeType: acquisition.type || 'application/octet-stream', size: acquisition.length, modified: safeDate(book.modified), author: book.author, language: book.language, category: book.category, description: book.description, coverUrl: cover, overrides: {}, sourceCoverUrl: cover, external: true, sourceId: row.id, sourceName: row.name });
  }
  const next = resolved(feed.next, base);
  return {
    items: [...navigation, ...books], folderKey: await bookKey(secret, libraryId, `opds-page:${row.id}:${base.href}`),
    nextCursor: next && next.origin === root.origin ? await protectData(secret, `opds-scan:${libraryId}:${row.id}`, { url: next.href }) : null,
  };
}
