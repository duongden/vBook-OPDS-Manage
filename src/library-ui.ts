export const libraryHtml = String.raw`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>VBook Library — Thư viện của bạn</title><link rel="stylesheet" href="/assets/library.css"><script src="/assets/library.js" defer></script></head>
<body><header><div class="wrap header"><a href="/" class="brand"><span class="mark">V</span><span>VBook Library<small>DRIVE TO OPDS · READING ROOM</small></span></a><nav aria-label="Điều hướng"><a href="/legacy">Tạo link nhanh</a><button id="theme-toggle" type="button" aria-label="Chuyển sang giao diện tối" aria-pressed="false">☾</button><button id="account-button" hidden>Tài khoản</button><button id="logout" hidden>Đăng xuất</button></nav></div></header>
<main class="wrap"><div id="notice" role="status" aria-live="polite" hidden></div>
<section id="welcome"><div class="hero"><div><p class="eyebrow">KHO SÁCH TRÊN DRIVE CỦA BẠN</p><h1>Một góc nhìn mới<br>cho <em>thư viện riêng.</em></h1><p class="intro">Kiểm tra kho sách, bổ sung thông tin và bìa.<br>Đọc theo cách bạn thích — trên vBook qua OPDS.</p><div class="tags"><span>EPUB</span><span>CBZ</span><span>PDF</span><span>MOBI</span><span>CBR</span><span>TXT</span></div></div><div class="intro-note"><span class="eyebrow">SÁCH VẪN Ở TRÊN DRIVE</span><h2>Bạn giữ sách.<br>Chúng tôi nối thư viện.</h2><p>Không lưu nội dung sách, không ghi vào Drive. Chỉ lưu tài khoản, thông tin quản lý và các chỉnh sửa của bạn.</p></div></div>
<div class="entry-panel"><div class="tabs" role="group" aria-label="Truy cập thư viện"><button data-tab="create" class="active">Tạo thư viện</button><button data-tab="login">Đăng nhập</button><button data-tab="recovery">Khôi phục</button></div>
<form id="create" class="access-form"><h2>Bắt đầu từ một thư mục Drive</h2><p class="muted">Đặt quyền chia sẻ thư mục thành “Bất kỳ ai có đường liên kết”.</p><label>Link thư mục Google Drive<input name="drive" type="text" required maxlength="2048" placeholder="https://drive.google.com/drive/folders/…"></label><div class="form-grid"><label>Tên thư viện<input name="name" required maxlength="120" placeholder="Góc sách của tôi"></label><label>Tên đăng nhập quản lý<input name="username" required maxlength="80" autocomplete="username"></label></div><label>Mật khẩu quản lý<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"><small>Ít nhất 12 ký tự. vBook sẽ dùng mật khẩu OPDS riêng.</small></label><button class="primary" type="submit">Tạo thư viện & link OPDS</button></form>
<form id="login" class="access-form" hidden><h2>Trở lại thư viện</h2><label>Mã thư viện<input name="libraryId" required maxlength="80" autocomplete="off"></label><label>Tên đăng nhập<input name="username" required maxlength="80" autocomplete="username"></label><label>Mật khẩu<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><button class="primary">Đăng nhập</button></form>
<form id="recovery" class="access-form" hidden><h2>Khôi phục tài khoản</h2><p class="muted">Mã khôi phục chỉ dùng một lần. Các phiên cũ và mật khẩu OPDS cũ sẽ bị thu hồi.</p><label>Mã thư viện<input name="libraryId" required maxlength="80"></label><label>Mã khôi phục<input name="code" required maxlength="100" autocomplete="off"></label><label>Mật khẩu mới<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button class="primary">Khôi phục</button></form></div></section>
<section id="dashboard" hidden><div class="section-head"><div><p class="eyebrow">THƯ VIỆN CỦA BẠN</p><h1 id="library-name">Thư viện</h1><p class="muted">Xem và quản lý tại đây. Tải và đọc bằng vBook.</p></div><button id="opds-button" class="primary">Kết nối vBook</button></div>
<div id="stats" class="stats" aria-live="polite"></div><p id="formats" class="muted"></p>
<div class="scanbar"><div><button id="scan-start">Kiểm tra toàn thư viện</button><button id="scan-pause" hidden>Tạm dừng</button><button id="scan-resume" hidden>Tiếp tục / thử lại</button><button id="scan-results" hidden>Xem kết quả quét</button></div><p id="scan-status" class="muted">Chưa quét toàn thư viện. Số liệu hiện chỉ thuộc dữ liệu đã tải.</p></div>
<div class="tools"><label class="search">Tìm trong dữ liệu đã tải<input id="search" type="search" placeholder="Tên sách, tên file, tác giả…"></label><label>Ngôn ngữ<select id="language"><option value="">Tất cả</option><option value="unknown">Chưa rõ</option></select></label><label>Định dạng<select id="format"><option value="">Tất cả</option></select></label><label>Sắp xếp<select id="sort"><option value="title">Tên sách</option><option value="author">Tác giả</option><option value="size">Dung lượng giảm dần</option></select></label><div class="view-toggle" role="group" aria-label="Chế độ hiển thị"><button id="view-grid" aria-pressed="true">Kệ</button><button id="view-table" aria-pressed="false">Bảng</button></div></div>
<div class="shelf-head"><nav id="breadcrumbs" aria-label="Đường dẫn thư mục"></nav><span id="result-count" class="muted"></span></div>
<div class="bulk"><label class="check"><input id="select-all" type="checkbox"> Chọn kết quả đang hiển thị</label><span id="selected-count">0 đã chọn</span><label>Ngôn ngữ <input id="bulk-language" list="languages" placeholder="vi, en, fr…" maxlength="35"></label><button id="bulk-apply">Gán cho sách đã chọn</button></div>
<div id="items" aria-live="polite"></div><div class="more"><button id="load-more" hidden>Tải trang tiếp</button><button id="reload-folder">Tải lại thư mục gốc</button></div></section>
<footer>VBook Library · Metadata riêng cho từng thư viện · File luôn ở Drive</footer></main>
<dialog id="editor"><form id="edit-form"><div class="dialog-head"><h2>Thông tin sách</h2><button type="button" data-close="editor" aria-label="Đóng">✕</button></div><p id="edit-source" class="muted"></p><div class="editor-grid"><div><div class="cover-preview" id="cover-preview"></div><p class="muted">Bìa lấy từ URL ảnh của bạn hoặc thumbnail Drive.</p></div><div><label>Tên hiển thị<input name="title" maxlength="240"></label><label>Tác giả<input name="author" maxlength="240"></label><div class="form-grid"><label>Ngôn ngữ<input name="language" list="languages" maxlength="35" placeholder="Chưa rõ"></label><label>Thể loại<input name="category" maxlength="120"></label></div><label>Mô tả<textarea name="description" maxlength="5000" rows="4"></textarea></label><label>URL bìa HTTPS<input name="coverUrl" type="url" maxlength="2048" placeholder="https://…"></label></div></div><p class="muted">Để trống một trường để dùng dữ liệu nguồn. Chỉnh sửa chỉ áp dụng trong thư viện này, không thay đổi file Drive.</p><p id="edit-error" class="error" role="alert"></p><div class="dialog-actions"><button type="button" id="reset-book">Khôi phục dữ liệu nguồn</button><button class="primary">Lưu thông tin</button></div></form></dialog>
<dialog id="connection"><div class="dialog-head"><h2>Kết nối vBook</h2><button data-close="connection" aria-label="Đóng">✕</button></div><label>URL danh mục<input id="opds-url" readonly></label><button id="copy-opds">Sao chép link OPDS</button><div id="secret-values"></div><p class="muted">Mật khẩu OPDS chỉ hiển thị khi cấp mới. Nếu quên, tạo lại và cập nhật trong vBook.</p><button id="rotate-opds">Tạo lại mật khẩu OPDS</button><ol><li>Mở vBook → Extension Cloud → OPDS.</li><li>Dán link vào URL danh mục.</li><li>Nhập tên <strong>reader</strong> và mật khẩu OPDS được cấp, rồi lưu.</li></ol><p class="muted">OPDS chỉ có quyền đọc. Tìm kiếm trên vBook dùng tên file Drive, tối đa 3 cấp và 35 thư mục con. Sau khi sửa thông tin, làm mới thư viện trong vBook.</p></dialog>
<dialog id="account"><div class="dialog-head"><h2>Tài khoản thư viện</h2><button data-close="account" aria-label="Đóng">✕</button></div><p id="account-info"></p><p class="muted">Lưu mã thư viện và mã khôi phục ở nơi an toàn. Không có khôi phục qua email.</p><form id="password-form"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required maxlength="256" autocomplete="current-password"></label><label>Mật khẩu mới<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button>Đổi mật khẩu</button></form><hr><form id="delete-form"><h3>Xóa thư viện</h3><p class="muted">Xóa tài khoản và các chỉnh sửa đã lưu. File Drive được giữ nguyên.</p><label>Nhập mật khẩu để xác nhận<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><button class="danger">Xóa thư viện</button></form></dialog>
<datalist id="languages"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="fr">Français</option><option value="zh-Hans">中文</option><option value="ja">日本語</option><option value="ko">한국어</option></datalist></body></html>`;

export const libraryCss = String.raw`
:root {
  color-scheme: light;
  --paper: #f7f6f1;
  --surface: #fffefa;
  --surface-raised: #ffffff;
  --soft: #ecefe7;
  --soft-strong: #e1e6da;
  --ink: #263b31;
  --muted: #6f776e;
  --line: #d9ddd3;
  --green: #304f3f;
  --green-hover: #213b2e;
  --accent: #9b7543;
  --danger: #a33c2e;
  --danger-line: #cf9387;
  --notice: #e9eddf;
  --notice-line: #c7d2b9;
  --error-bg: #fff0e9;
  --error-line: #d7b5a7;
  --backdrop: #14291e99;
  --shadow: 0 16px 45px #24372f12;
  --cover: #e7eadf;
  --cover-line: #dce2d3;
  --folder: #e8e2d1;
  --serif: Georgia, 'Times New Roman', serif;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --paper: #101713;
  --surface: #17211b;
  --surface-raised: #1c2821;
  --soft: #202d25;
  --soft-strong: #29382f;
  --ink: #edf2ec;
  --muted: #a8b2aa;
  --line: #35443b;
  --green: #8eae96;
  --green-hover: #a8c2ae;
  --accent: #d5ad72;
  --danger: #f19a8d;
  --danger-line: #975d54;
  --notice: #243326;
  --notice-line: #48604c;
  --error-bg: #39221f;
  --error-line: #7d5048;
  --backdrop: #050806cc;
  --shadow: 0 18px 50px #00000033;
  --cover: #26342b;
  --cover-line: #34483a;
  --folder: #3b382d;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
    --paper: #101713;
    --surface: #17211b;
    --surface-raised: #1c2821;
    --soft: #202d25;
    --soft-strong: #29382f;
    --ink: #edf2ec;
    --muted: #a8b2aa;
    --line: #35443b;
    --green: #8eae96;
    --green-hover: #a8c2ae;
    --accent: #d5ad72;
    --danger: #f19a8d;
    --danger-line: #975d54;
    --notice: #243326;
    --notice-line: #48604c;
    --error-bg: #39221f;
    --error-line: #7d5048;
    --backdrop: #050806cc;
    --shadow: 0 18px 50px #00000033;
    --cover: #26342b;
    --cover-line: #34483a;
    --folder: #3b382d;
  }
}

* { box-sizing: border-box; }
html { background: var(--paper); scroll-behavior: smooth; }
body {
  margin: 0;
  min-width: 280px;
  background: var(--paper);
  color: var(--ink);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { font: inherit; color: inherit; }
button, a, input, select, textarea { touch-action: manipulation; }
button {
  min-height: 44px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  transition: background-color .18s ease, border-color .18s ease, transform .18s ease;
}
button:hover { background: var(--soft); }
button:active { transform: translateY(1px); }
button:disabled { opacity: .52; cursor: wait; transform: none; }
.primary { background: var(--green); color: var(--paper); border-color: var(--green); font-weight: 650; }
.primary:hover { background: var(--green-hover); border-color: var(--green-hover); }
.danger, .error { color: var(--danger); }
.danger { border-color: var(--danger-line); }
a { color: inherit; text-underline-offset: 3px; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}
[hidden] { display: none !important; }
.wrap { width: 100%; max-width: 1280px; margin: auto; padding-inline: 16px; }

header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(14px);
}
.header { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; padding-block: 10px; }
.brand { display: flex; gap: 10px; align-items: center; width: fit-content; text-decoration: none; font: 21px var(--serif); }
.brand small { display: block; font: 7px/1.8 sans-serif; letter-spacing: 1.4px; color: var(--muted); }
.mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 36px;
  height: 41px;
  color: var(--paper);
  background: var(--green);
  border-radius: 6px;
}
nav { display: flex; gap: 6px; align-items: center; justify-content: flex-end; overflow-x: auto; scrollbar-width: none; }
nav::-webkit-scrollbar { display: none; }
nav a { flex: 0 0 auto; padding: 8px 2px; font-size: 12px; }
nav button { flex: 0 0 auto; min-height: 38px; padding: 7px 10px; font-size: 12px; }
#theme-toggle { width: 38px; min-width: 38px; padding: 0; font-size: 19px; line-height: 1; }

.hero { display: grid; gap: 18px; padding: clamp(22px, 7vw, 34px) 0 22px; }
.eyebrow { margin: 0; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: 1.8px; }
h1 { margin: 9px 0; font: normal clamp(31px, 10vw, 58px)/1.1 var(--serif); letter-spacing: -1.2px; }
h1 em { color: color-mix(in srgb, var(--green) 72%, var(--muted)); font-weight: 400; }
h2 { margin: 0 0 16px; font: normal 25px/1.3 var(--serif); }
h3 { font-size: 18px; }
.intro, .muted, small { color: var(--muted); }
.intro { margin: 0 0 17px; }
.intro-note {
  padding: clamp(16px, 5vw, 22px);
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.intro-note p { margin-bottom: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 7px; }
.tags span, .badge { padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 10px; letter-spacing: .4px; }

.entry-panel {
  width: 100%;
  max-width: 720px;
  margin: 0 auto 36px;
  padding: clamp(14px, 4vw, 20px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-bottom: 18px; }
.tabs button { width: 100%; }
.tabs .active, .view-toggle [aria-pressed='true'] { background: var(--green); color: var(--paper); border-color: var(--green); }
label { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 12px; font-weight: 600; }
input, select, textarea {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 8px 11px;
  background: var(--surface-raised);
  border: 1px solid var(--line);
  border-radius: 8px;
}
textarea { min-height: 110px; resize: vertical; }
input[type='checkbox'] { width: 19px; min-height: 19px; height: 19px; accent-color: var(--green); }
input[readonly] { background: var(--soft); }
.form-grid { display: grid; gap: 0; }

.section-head { display: grid; gap: 12px; padding: 22px 0 14px; }
.section-head h1 { margin-block: 8px; font-size: clamp(30px, 9vw, 42px); overflow-wrap: anywhere; }
.section-head .primary { width: 100%; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; overflow: hidden; background: var(--line); border: 1px solid var(--line); border-radius: 12px; }
.stat { min-width: 0; padding: 11px 10px; background: var(--surface); }
.stat strong { display: block; font: 25px var(--serif); }
.stat span { color: var(--muted); font-size: 11px; }
.scanbar { padding: 12px 0 14px; border-bottom: 1px solid var(--line); }
.scanbar > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.scanbar button { width: 100%; padding-inline: 8px; }
.scanbar p { margin-bottom: 0; font-size: 13px; }
.tools { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0 14px; }
.tools label { margin: 0; }
.tools .search, .tools .view-toggle { grid-column: 1 / -1; }
.view-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.shelf-head { display: grid; gap: 9px; margin: 18px 0; }
.shelf-head nav { flex-wrap: wrap; overflow: visible; }
.shelf-head button { min-height: 38px; font-size: 12px; }
.bulk { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px; background: var(--soft); border: 1px solid var(--line); border-radius: 10px; font-size: 12px; }
.bulk label { margin: 0; }
.bulk > label:not(.check) { grid-column: 1; }
.bulk > button { grid-column: 2; align-self: end; }
#selected-count { justify-self: end; }
.check { display: flex !important; flex-direction: row !important; align-items: center; font-weight: 400; }

.books { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(135px, 43vw), 1fr)); gap: 20px 12px; margin: 20px 0; }
.book { min-width: 0; position: relative; }
.book .check { min-height: 28px; margin-bottom: 6px; font-size: 11px; }
.book-open { width: 100%; min-height: 0; padding: 0; border: 0; background: none; text-align: left; }
.book-open:hover { background: none; }
.cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4;
  margin-bottom: 10px;
  overflow: hidden;
  background: var(--cover);
  border-radius: 6px;
  box-shadow: var(--shadow);
}
.cover img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; background: var(--soft); }
.fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; text-align: center; border: 8px solid var(--cover-line); }
.fallback strong { color: var(--muted); font: 20px var(--serif); }
.fallback small { margin-top: 10px; overflow-wrap: anywhere; }
.book-title { display: block; font-weight: 650; line-height: 1.4; overflow-wrap: anywhere; }
.book-author { margin: 4px 0; color: var(--muted); font-size: 12px; }
.book-meta { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; color: var(--muted); font-size: 10px; }
.folder .cover { aspect-ratio: 4 / 2.3; background: var(--folder); }

.table-wrap { width: calc(100vw - 32px); max-width: 100%; margin-top: 18px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; }
table { width: 100%; min-width: 730px; border-collapse: collapse; background: var(--surface); }
th { color: var(--muted); background: var(--soft); font-size: 10px; letter-spacing: 1.4px; text-align: left; text-transform: uppercase; }
td, th { padding: 14px 12px; border-bottom: 1px solid var(--line); }
td small { display: block; max-width: 380px; overflow-wrap: anywhere; }
.thumb { width: 42px; height: 60px; object-fit: contain; }
.table-title { display: flex; gap: 12px; align-items: center; }
.table-title button { min-height: 36px; padding: 0; background: none; border: 0; text-align: left; }
.empty { margin: 16px 0; padding: clamp(28px, 9vw, 45px) 16px; color: var(--muted); background: var(--surface); border: 1px dashed var(--line); border-radius: 12px; text-align: center; }
.more { display: grid; gap: 9px; margin: 24px 0; }
footer { margin-top: 42px; padding: 28px 0; color: var(--muted); border-top: 1px solid var(--line); font-size: 11px; text-align: center; }

#notice { margin: 16px 0; padding: 13px 15px; white-space: pre-wrap; background: var(--notice); border: 1px solid var(--notice-line); border-radius: 9px; }
#notice.error { background: var(--error-bg); border-color: var(--error-line); }
dialog {
  width: 100%;
  max-width: none;
  max-height: 92dvh;
  margin: auto 0 0;
  padding: 16px 14px calc(16px + env(safe-area-inset-bottom));
  overflow: auto;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px 18px 0 0;
  box-shadow: var(--shadow);
}
dialog::backdrop { background: var(--backdrop); backdrop-filter: blur(3px); }
.dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.dialog-head h2 { margin: 0; }
.dialog-head button { width: 44px; padding: 0; }
.dialog-actions { display: grid; gap: 9px; }
.editor-grid { display: grid; gap: 22px; }
.cover-preview { width: min(180px, 60vw); margin: auto; }
.cover-preview .cover { aspect-ratio: 2 / 3; }
.editor-grid p { font-size: 12px; }
.secret { margin: 14px 0; padding: 14px; overflow-wrap: anywhere; background: var(--soft); border-radius: 8px; }
.secret code { display: block; user-select: all; font-size: 13px; }
#account-info { overflow-wrap: anywhere; }
hr { margin: 24px 0; border: 0; border-top: 1px solid var(--line); }

@media (min-width: 480px) {
  .wrap { padding-inline: 22px; }
  .scanbar > div { display: flex; flex-wrap: wrap; }
  .scanbar button { width: auto; }
  .more { grid-template-columns: repeat(2, auto); justify-content: center; }
}

@media (max-width: 359px) {
  .brand { font-size: 18px; }
  .brand small { display: none; }
  .mark { width: 32px; height: 36px; }
  nav button { padding-inline: 8px; }
  .tabs button { padding-inline: 5px; font-size: 11px; }
}

@media (min-width: 760px) {
  .wrap { padding-inline: 32px; }
  .header { min-height: 86px; }
  .brand { font-size: 24px; }
  .brand small { font-size: 8px; letter-spacing: 1.8px; }
  nav { gap: 10px; }
  nav button { min-height: 42px; padding: 9px 13px; font-size: 13px; }
  .hero { grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr); gap: 50px; align-items: center; padding: 52px 0; }
  .intro-note { padding: 32px; }
  .entry-panel { padding: 28px; }
  .form-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
  .section-head { grid-template-columns: 1fr auto; align-items: center; padding-top: 36px; }
  .section-head .primary { width: auto; }
  .stats { grid-template-columns: repeat(4, 1fr); }
  .stat { padding: 18px; }
  .stat strong { font-size: 32px; }
  .tools { grid-template-columns: minmax(230px, 1fr) repeat(3, minmax(120px, auto)) auto; align-items: end; }
  .tools .search, .tools .view-toggle { grid-column: auto; }
  .shelf-head { grid-template-columns: 1fr auto; align-items: center; }
  .bulk { grid-template-columns: auto auto 1fr auto; }
  .bulk > label:not(.check), .bulk > button { grid-column: auto; }
  .bulk > label:not(.check) { justify-self: end; }
  .bulk input:not([type='checkbox']) { width: 130px; }
  .books { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 30px 22px; }
  dialog { width: min(850px, calc(100vw - 48px)); max-height: 90vh; margin: auto; padding: 28px; border-radius: 14px; }
  #account { width: min(600px, calc(100vw - 48px)); }
  .editor-grid { grid-template-columns: 190px 1fr; gap: 28px; }
  .cover-preview { width: auto; }
  .dialog-actions { grid-template-columns: 1fr auto; align-items: center; }
}

@media (min-width: 1100px) {
  .wrap { padding-inline: 40px; }
  .hero { gap: 72px; }
  .books { grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 34px 24px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}
`;
