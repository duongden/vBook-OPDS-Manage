import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { libraryCss, libraryHtml } from '../src/library-ui';

const output = process.argv[2];
if (!output) throw new Error('Usage: tsx scripts/build-user-guide-screenshots.mts OUTPUT_DIRECTORY');
mkdirSync(output, { recursive: true });

function base(theme: 'light' | 'dark'): string {
  return libraryHtml
    .replace('<html lang="vi">', `<html lang="vi" data-theme="${theme}">`)
    .replace('<link rel="stylesheet" href="/assets/library.css"><script src="/assets/library.js" defer></script>', `<style>${libraryCss}</style>`)
    .replace('<a href="/legacy">Tạo link nhanh</a>', '')
    .replace('<body>', '<body class="guide-shot">')
    .replace('</head>', `<style>
      .guide-shot #notice { display:block; margin-block:12px; padding-block:9px; font-size:12px }
      .guide-shot header { position:static }
      .guide-shot footer { display:none }
    </style></head>`);
}

function notice(html: string, text: string): string {
  return html.replace('<div id="notice" role="status" aria-live="polite" hidden></div>', `<div id="notice" role="status" aria-live="polite">${text}</div>`);
}

let create = notice(base('light'), 'Dữ liệu minh họa — tất cả đường dẫn, tên và tài khoản trong hình đều là giả.');
create = create
  .replace('<textarea name="drive" rows="4" maxlength="12000" placeholder="https://catalog-one.example/opds&#10;https://catalog-two.example/feed.xml"></textarea>', '<textarea name="drive" rows="4" maxlength="12000">https://catalog-one.example/opds\nhttps://catalog-two.example/feed.xml</textarea>')
  .replace('<input name="name"', '<input name="name" value="Góc sách mẫu"')
  .replace('<input name="username"', '<input name="username" value="nguoidung_mau"')
  .replace('<input name="password" type="password"', '<input name="password" type="password" value="MatKhauMau-1234"');
create = create.replace('</head>', '<style>body { zoom:.82 }</style></head>');
writeFileSync(join(output, 'create-library.html'), create);

const fakeBooks = [
  ['Dế Mèn Phiêu Lưu Ký.epub', 'EPUB', 'Tô Hoài', 'vi', '1.8 MB'],
  ['Truyện Kiều.pdf', 'PDF', 'Nguyễn Du', 'vi', '3.2 MB'],
  ['Sách học tiếng Anh.epub', 'EPUB', 'Tác giả mẫu', 'en', '2.1 MB'],
  ['Manga mẫu.cbz', 'CBZ', 'Tác giả mẫu', 'ja', '48 MB'],
  ['Tài liệu mẫu.pdf', 'PDF', 'Chưa có tác giả', 'Chưa rõ', '5.4 MB'],
];
const bookCards = fakeBooks.map(([title, format, author, language, size]) => `<article class="book"><label class="check"><input type="checkbox"> Chọn sách</label><button class="book-open"><div class="cover"><div class="fallback"><strong>${format}</strong><small>Chưa có bìa</small></div></div><span class="book-title">${title}</span></button><div class="book-author">${author}</div><div class="book-meta"><span class="badge">${format}</span><span>${language}</span><span>${size}</span></div></article>`).join('');
const folderCard = '<article class="book folder"><button class="book-open"><div class="cover"><div class="fallback"><strong>Thư mục</strong><small>Văn học Việt Nam</small></div></div><span class="book-title">Văn học Việt Nam</span></button><div class="book-author">Mở thư mục</div></article>';

function dashboard(theme: 'light' | 'dark', zoom = true): string {
  let html = notice(base(theme), 'Dữ liệu minh họa — không chứa mã thư viện, mật khẩu hoặc dữ liệu Drive thật.');
  if (zoom) html = html.replace('</head>', '<style>body { zoom:.78 }</style></head>');
  return html
    .replace('<section id="welcome">', '<section id="welcome" hidden>')
    .replace('<section id="dashboard" hidden>', '<section id="dashboard">')
    .replace('title="Tài khoản" hidden', 'title="Tài khoản"')
    .replace('title="Đăng xuất" hidden', 'title="Đăng xuất"')
    .replace('<h1 id="library-name">Thư viện</h1>', '<h1 id="library-name">Góc sách mẫu</h1>')
    .replace('<span id="source-count" class="button-count">0</span>', '<span id="source-count" class="button-count">2</span>')
    .replace('<div id="stats" class="stats" aria-live="polite"></div>', '<div id="stats" class="stats" aria-live="polite"><div class="stat"><strong>12</strong><span>File sách đã tải</span></div><div class="stat"><strong>4</strong><span>Định dạng</span></div><div class="stat"><strong>3</strong><span>Chưa có ngôn ngữ</span></div><div class="stat"><strong>2</strong><span>Chưa có nguồn bìa</span></div></div>')
    .replace('<p id="formats" class="muted"></p>', '<p id="formats" class="muted">EPUB: 5 · PDF: 4 · CBZ: 2 · MOBI: 1</p>')
    .replace('Chưa quét toàn thư viện. Số liệu hiện chỉ thuộc dữ liệu đã tải.', 'Hoàn tất — 6 trang, 12 file sách. Số liệu theo lần quét minh họa.')
    .replace('<nav id="breadcrumbs" aria-label="Đường dẫn thư mục"></nav>', '<nav id="breadcrumbs" aria-label="Đường dẫn thư mục"><button>Thư viện</button></nav>')
    .replace('<span id="result-count" class="muted"></span>', '<span id="result-count" class="muted">6 mục hiển thị · Thư mục hiện tại</span>')
    .replace('<div id="items" aria-live="polite"></div>', `<div id="items" aria-live="polite"><div class="books">${bookCards}${folderCard}</div></div>`);
}

writeFileSync(join(output, 'library-dashboard.html'), dashboard('dark'));

let connect = dashboard('light', false)
  .replace('</head>', `<style>
    body::after { content:''; position:fixed; inset:0; z-index:90; background:var(--backdrop); backdrop-filter:blur(3px) }
    #connection[open] { position:fixed; inset:0; z-index:100; display:block; width:min(760px,calc(100vw - 80px)); max-height:820px; margin:auto; border-radius:14px }
  </style></head>`)
  .replace('<dialog id="connection">', '<dialog id="connection" open>')
  .replace('<input id="opds-url" readonly>', '<input id="opds-url" readonly value="https://vbook-opds.example/o/THUVIENMAU12">')
  .replace('<div id="secret-values"></div>', '<div id="secret-values"><div class="secret">Mã thư viện (giả)<code>00000000-0000-4000-8000-000000000000</code></div><div class="secret">Tài khoản OPDS: <strong>reader</strong><br>Mật khẩu OPDS minh họa<code>mat-khau-mau-khong-dung-that</code></div></div>');
writeFileSync(join(output, 'connect-vbook.html'), connect);

let sources = dashboard('light', false)
  .replace('</head>', `<style>
    body::after { content:''; position:fixed; inset:0; z-index:90; background:var(--backdrop); backdrop-filter:blur(3px) }
    #sources[open] { position:fixed; inset:0; z-index:100; display:block; width:min(920px,calc(100vw - 80px)); max-height:860px; margin:auto; border-radius:16px }
  </style></head>`)
  .replace('<dialog id="sources">', '<dialog id="sources" open>')
  .replace('<textarea name="urls" rows="4" maxlength="12000" required placeholder="https://catalog.example/opds&#10;https://books.example/feed.xml"></textarea>', '<textarea name="urls" rows="4" maxlength="12000" required>https://catalog.example/opds\nhttps://books.example/feed.xml</textarea>')
  .replace('<div id="source-list" class="source-list" aria-live="polite"><p class="muted">Chưa có nguồn OPDS.</p></div>', `<div id="source-list" class="source-list" aria-live="polite">
    <article class="source-row"><div><h3>Kho sách cộng đồng</h3><p>catalog.example · Có tài khoản nguồn</p><p>https://vbook-opds.example/o/THUVIENMAU12/s/NGUONMAU001</p></div><div class="source-actions"><label class="source-enabled"><input type="checkbox" checked> Đang bật</label><button class="icon-button" aria-label="Sao chép link"><svg class="icon" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><button class="danger icon-button" aria-label="Xóa"><svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button></div></article>
    <article class="source-row"><div><h3>Catalog sách mẫu</h3><p>books.example · Nguồn công khai</p><p>https://vbook-opds.example/o/THUVIENMAU12/s/NGUONMAU002</p></div><div class="source-actions"><label class="source-enabled"><input type="checkbox" checked> Đang bật</label><button class="icon-button" aria-label="Sao chép link"><svg class="icon" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><button class="danger icon-button" aria-label="Xóa"><svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button></div></article>
  </div>`);
writeFileSync(join(output, 'opds-sources.html'), sources);

console.log(join(output, 'create-library.html'));
console.log(join(output, 'library-dashboard.html'));
console.log(join(output, 'connect-vbook.html'));
console.log(join(output, 'opds-sources.html'));
