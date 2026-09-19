import { LibraryItem } from './library-data';
import { escapeXml as e } from './opds';

export const XML_TYPE = 'application/atom+xml;profile=opds-catalog';
export interface ManagedFeed {
  libraryId: string; title: string; origin: string; self: string; start: string;
  search: string; next?: string; folderKey: string; items: LibraryItem[];
}
export function managedFeed(f: ManagedFeed, json: boolean): string {
  const type = json ? 'application/opds+json' : XML_TYPE;
  const base = `${f.origin}/library/${f.libraryId}`;
  const links = [
    { rel: ['self'], href: f.self, type }, { rel: ['start'], href: f.start, type },
    { rel: ['search'], href: f.search, type },
    ...(f.next ? [{ rel: ['next'], href: f.next, type }] : []),
  ];
  const folderUrl = (i: LibraryItem) => `${base}/opds?folder=${i.ref}`;
  const download = (i: LibraryItem) => `${base}/download?ref=${i.ref}`;
  const identifier = `urn:vbook:library:${f.libraryId}:${f.folderKey}`;
  const now = new Date().toISOString();
  if (json) return JSON.stringify({
    metadata: { identifier, title: f.title, modified: now }, links,
    navigation: f.items.filter(i => i.isFolder).map(i => ({ href: folderUrl(i), title: i.title, type, rel: ['subsection'] })),
    publications: f.items.filter(i => !i.isFolder).map(i => ({
      metadata: {
        identifier: `urn:vbook:book:${f.libraryId}:${i.key}`, title: i.opdsTitle, modified: i.modified,
        ...(i.author ? { author: [{ name: i.author }] } : {}),
        ...(i.language ? { language: [i.language] } : {}),
        ...(i.description ? { description: i.description } : {}),
        ...(i.category ? { subject: [{ name: i.category }] } : {}),
      },
      links: [{ rel: ['http://opds-spec.org/acquisition'], href: download(i), type: i.mimeType, ...(i.size ? { length: Number(i.size) } : {}) }],
      ...(i.coverUrl ? { images: [{ href: i.coverUrl }] } : {}),
    })),
  });
  const entries = f.items.map(i => {
    const title = i.isFolder ? i.title : i.opdsTitle;
    const head = `<entry><id>urn:vbook:${i.isFolder ? 'folder' : 'book'}:${e(f.libraryId)}:${e(i.key)}</id><title>${e(title)}</title><updated>${e(i.modified)}</updated>`;
    if (i.isFolder) return head + `<link rel="subsection" href="${e(folderUrl(i))}" type="${XML_TYPE}"/></entry>`;
    return head + (i.author ? `<author><name>${e(i.author)}</name></author>` : '') +
      (i.language ? `<dc:language>${e(i.language)}</dc:language>` : '') +
      `<summary>${e(i.description || i.name)}</summary><content type="text">${e(i.description || i.name)}</content>` +
      `<category term="${e(i.format)}" label="${e(i.format)}"/>` +
      (i.category ? `<category term="${e(i.category)}" label="${e(i.category)}"/>` : '') +
      (i.coverUrl ? `<link rel="http://opds-spec.org/image" href="${e(i.coverUrl)}"/><link rel="http://opds-spec.org/image/thumbnail" href="${e(i.coverUrl)}"/>` : '') +
      `<link rel="http://opds-spec.org/acquisition" href="${e(download(i))}" type="${e(i.mimeType)}"${i.size ? ` length="${e(i.size)}"` : ''}/></entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/"><id>${e(identifier)}</id><title>${e(f.title)}</title><updated>${now}</updated><author><name>VBook Library</name></author>${links.map(l => `<link rel="${l.rel[0]}" href="${e(l.href)}" type="${type}"/>`).join('')}${entries}</feed>`;
}
