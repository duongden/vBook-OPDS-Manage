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
  .replace('<input name="drive" type="text"', '<input name="drive" type="text" value="https://drive.google.com/drive/folders/THU_MUC_MAU_123"')
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
    .replace('id="account-button" hidden', 'id="account-button"')
    .replace('id="logout" hidden', 'id="logout"')
    .replace('<h1 id="library-name">Thư viện</h1>', '<h1 id="library-name">Góc sách mẫu</h1>')
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

console.log(join(output, 'create-library.html'));
console.log(join(output, 'library-dashboard.html'));
console.log(join(output, 'connect-vbook.html'));
