export const libraryHtml = String.raw`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>VBook Library — Thư viện của bạn</title><link rel="stylesheet" href="/assets/library.css"><script src="/assets/library.js" defer></script></head>
<body><header><div class="wrap header"><a href="/" class="brand"><span class="mark">V</span><span>VBook Library<small>GOOGLE DRIVE TO OPDS</small></span></a><nav aria-label="Điều hướng"><a href="/legacy">Tạo link nhanh</a><button class="icon-button" id="theme-toggle" type="button" aria-label="Chuyển sang giao diện tối" aria-pressed="false">☾</button><button class="icon-button" id="account-button" aria-label="Tài khoản" title="Tài khoản" hidden><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></button><button class="icon-button" id="logout" aria-label="Đăng xuất" title="Đăng xuất" hidden><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/></svg></button></nav></div></header>
<main class="wrap"><div id="notice" role="status" aria-live="polite" hidden></div>
<section id="welcome"><div class="hero"><div><p class="eyebrow">DRIVE VÀ OPDS CỦA BẠN</p><h1>Một góc nhìn mới<br>cho <em>thư viện riêng.</em></h1><p class="intro">Kết nối Drive và các catalog OPDS được chia sẻ.<br>Đọc theo cách bạn thích — trên vBook qua một link.</p><div class="tags"><span>EPUB</span><span>CBZ</span><span>PDF</span><span>MOBI</span><span>CBR</span><span>TXT</span></div></div><div class="intro-note"><span class="eyebrow">NGUỒN DO BẠN KIỂM SOÁT</span><h2>Bạn giữ nguồn.<br>Chúng tôi nối thư viện.</h2><p>Không lưu nội dung sách, không ghi vào Drive. Chỉ lưu tài khoản, cấu hình nguồn mã hóa và các chỉnh sửa của bạn.</p></div></div>
<div class="entry-panel"><div class="tabs" role="group" aria-label="Truy cập thư viện"><button data-tab="create" class="active">Tạo thư viện</button><button data-tab="login">Đăng nhập</button><button data-tab="recovery">Khôi phục</button></div>
<form id="create" class="access-form"><h2>Tạo thư viện của bạn</h2><p class="muted">Gộp nhiều nguồn thành một catalog duy nhất cho vBook.</p><label>Danh sách link Google Drive / OPDS <small>Mỗi dòng một link; tối đa 10 OPDS và một thư mục Drive.</small><textarea name="drive" rows="4" maxlength="12000" placeholder="https://catalog-one.example/opds&#10;https://catalog-two.example/feed.xml"></textarea></label><div class="form-grid"><label>Tên thư viện<input name="name" required maxlength="120" placeholder="Góc sách của tôi"></label><label>Tên đăng nhập quản lý<input name="username" required maxlength="80" autocomplete="username"></label></div><label>Mật khẩu quản lý<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"><small>Ít nhất 12 ký tự. vBook sẽ dùng mật khẩu OPDS riêng.</small></label><button class="primary" type="submit">Tạo catalog tổng hợp</button></form>
<form id="login" class="access-form" hidden><h2>Trở lại thư viện</h2><label>Mã thư viện<input name="libraryId" required maxlength="80" autocomplete="off"></label><label>Tên đăng nhập<input name="username" required maxlength="80" autocomplete="username"></label><label>Mật khẩu<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><button class="primary">Đăng nhập</button></form>
<form id="recovery" class="access-form" hidden><h2>Khôi phục tài khoản</h2><p class="muted">Mã khôi phục chỉ dùng một lần. Các phiên cũ và mật khẩu OPDS cũ sẽ bị thu hồi.</p><label>Mã thư viện<input name="libraryId" required maxlength="80"></label><label>Mã khôi phục<input name="code" required maxlength="100" autocomplete="off"></label><label>Mật khẩu mới<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button class="primary">Khôi phục</button></form></div></section>
<section id="dashboard" hidden><div class="section-head"><div><p class="eyebrow">THƯ VIỆN CỦA BẠN</p><h1 id="library-name">Thư viện</h1><p class="muted">Quản lý sách Drive và các nguồn OPDS được chia sẻ.</p></div><div class="section-actions"><button id="sources-button"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>Nguồn OPDS <span id="source-count" class="button-count">0</span></button><button id="opds-button" class="primary">Kết nối vBook</button></div></div>
<div id="stats" class="stats" aria-live="polite"></div><p id="formats" class="muted"></p>
<div class="scanbar"><div><button id="scan-start">Kiểm tra toàn thư viện</button><button id="scan-pause" hidden>Tạm dừng</button><button id="scan-resume" hidden>Tiếp tục / thử lại</button><button id="scan-results" hidden>Xem kết quả quét</button></div><p id="scan-status" class="muted">Chưa quét toàn thư viện. Số liệu hiện chỉ thuộc dữ liệu đã tải.</p></div>
<div class="tools"><label class="search">Tìm trong dữ liệu đã tải<input id="search" type="search" placeholder="Tên sách, tên file, tác giả…"></label><label>Ngôn ngữ<select id="language"><option value="">Tất cả</option><option value="unknown">Chưa rõ</option></select></label><label>Định dạng<select id="format"><option value="">Tất cả</option></select></label><label>Sắp xếp<select id="sort"><option value="title">Tên sách</option><option value="author">Tác giả</option><option value="size">Dung lượng giảm dần</option></select></label><div class="view-toggle" role="group" aria-label="Chế độ hiển thị"><button class="icon-button" id="view-grid" aria-label="Hiển thị dạng kệ" title="Dạng kệ" aria-pressed="true"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button><button class="icon-button" id="view-table" aria-label="Hiển thị dạng bảng" title="Dạng bảng" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg></button></div></div>
<div class="shelf-head"><nav id="breadcrumbs" aria-label="Đường dẫn thư mục"></nav><span id="result-count" class="muted"></span></div>
<div class="bulk"><label class="check"><input id="select-all" type="checkbox"> Chọn kết quả đang hiển thị</label><span id="selected-count">0 đã chọn</span><label>Ngôn ngữ <input id="bulk-language" list="languages" placeholder="vi, en, fr…" maxlength="35"></label><button id="bulk-apply">Gán cho sách Drive</button><button id="bulk-delete-opds" class="danger" hidden>Xóa sách OPDS đã chọn</button></div>
<div id="items" aria-live="polite"></div><div class="more"><button id="load-more" hidden>Tải trang tiếp</button><button id="reload-folder">Tải lại thư mục gốc</button></div></section>
<footer>VBook Library · Metadata riêng cho từng thư viện · Nguồn sách do bạn kiểm soát</footer></main>
<dialog id="editor"><form id="edit-form"><div class="dialog-head"><h2>Thông tin sách</h2><button class="icon-button" type="button" data-close="editor" aria-label="Đóng" title="Đóng"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><p id="edit-source" class="muted"></p><div class="editor-grid"><div><div class="cover-preview" id="cover-preview"></div><p class="muted">Bìa lấy từ URL ảnh của bạn hoặc thumbnail Drive.</p></div><div><label>Tên hiển thị<input name="title" maxlength="240"></label><label>Tác giả<input name="author" maxlength="240"></label><div class="form-grid"><label>Ngôn ngữ<input name="language" list="languages" maxlength="35" placeholder="Chưa rõ"></label><label>Thể loại<input name="category" maxlength="120"></label></div><label>Mô tả<textarea name="description" maxlength="5000" rows="4"></textarea></label><label>URL bìa HTTPS<input name="coverUrl" type="url" maxlength="2048" placeholder="https://…"></label></div></div><p class="muted">Để trống một trường để dùng dữ liệu nguồn. Chỉnh sửa chỉ áp dụng trong thư viện này, không thay đổi file Drive.</p><p id="edit-error" class="error" role="alert"></p><div class="dialog-actions"><button type="button" id="reset-book">Khôi phục dữ liệu nguồn</button><button class="primary">Lưu thông tin</button></div></form></dialog>
<dialog id="connection"><div class="dialog-head"><h2>Kết nối vBook</h2><button class="icon-button" data-close="connection" aria-label="Đóng" title="Đóng"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><label>URL danh mục<input id="opds-url" readonly></label><button id="copy-opds">Sao chép link OPDS</button><div id="secret-values"></div><p class="muted">Mật khẩu OPDS chỉ hiển thị khi cấp mới. Nếu quên, tạo lại và cập nhật trong vBook.</p><button id="rotate-opds">Tạo lại mật khẩu OPDS</button><ol><li>Mở vBook → Extension Cloud → OPDS.</li><li>Dán link vào URL danh mục.</li><li>Nhập tên <strong>reader</strong> và mật khẩu OPDS được cấp, rồi lưu.</li></ol><p class="muted">OPDS chỉ có quyền đọc. Tìm kiếm trên vBook dùng tên file Drive, tối đa 3 cấp và 35 thư mục con. Sau khi sửa thông tin, làm mới thư viện trong vBook.</p></dialog>
<dialog id="sources"><div class="dialog-head"><div><p class="eyebrow">CATALOG TỔNG HỢP</p><h2>Nguồn OPDS</h2></div><button class="icon-button" data-close="sources" aria-label="Đóng" title="Đóng"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><p class="muted">Mỗi URL nằm trên một dòng. Tài khoản bên dưới được dùng chung cho các URL trong lần thêm này và được mã hóa trước khi lưu.</p><form id="source-form"><label>Danh sách URL OPDS<textarea name="urls" rows="4" maxlength="12000" required placeholder="https://catalog.example/opds&#10;https://books.example/feed.xml"></textarea></label><p class="source-auth-help muted">Để trống cả hai ô nếu nguồn công khai.</p><div class="form-grid source-credentials"><label>Username nguồn<input name="username" maxlength="256" autocomplete="off"></label><label>Mật khẩu nguồn<input name="password" type="password" maxlength="512" autocomplete="new-password"></label></div><button class="primary">Thêm và kiểm tra nguồn</button></form><hr><div id="source-list" class="source-list" aria-live="polite"><p class="muted">Chưa có nguồn OPDS.</p></div></dialog>
<dialog id="account"><div class="dialog-head"><h2>Tài khoản thư viện</h2><button class="icon-button" data-close="account" aria-label="Đóng" title="Đóng"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><p id="account-info"></p><p class="muted">Lưu mã thư viện và mã khôi phục ở nơi an toàn. Không có khôi phục qua email.</p><form id="password-form"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required maxlength="256" autocomplete="current-password"></label><label>Mật khẩu mới<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password"></label><button>Đổi mật khẩu</button></form><hr><form id="delete-form"><h3>Xóa thư viện</h3><p class="muted">Xóa tài khoản và các chỉnh sửa đã lưu. File Drive được giữ nguyên.</p><label>Nhập mật khẩu để xác nhận<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><button class="danger">Xóa thư viện</button></form></dialog>
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
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --control-height: 44px;
  --radius-control: 10px;
  --radius-panel: 16px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
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
  font: 15px/1.6 var(--sans);
  font-kerning: normal;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
button, input, select, textarea { font: inherit; color: inherit; }
button, a, input, select, textarea { touch-action: manipulation; }
button {
  min-height: var(--control-height);
  padding: 10px 14px;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: .005em;
  transition: background-color .18s ease, border-color .18s ease, transform .18s ease;
}
button:hover { background: var(--soft); }
button:active { transform: translateY(1px); }
button:disabled { opacity: .52; cursor: wait; transform: none; }
.icon-button { display: inline-grid; place-items: center; width: var(--control-height); min-width: var(--control-height); padding: 0; }
.action-button { min-height: var(--control-height); color: inherit; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-control); text-decoration: none; }
.icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
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
.header { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-2); padding-block: 10px; }
.brand { display: flex; gap: var(--space-3); align-items: center; width: fit-content; text-decoration: none; font: 21px var(--serif); }
.brand small { display: block; font: 7px/1.8 var(--sans); letter-spacing: .2em; color: var(--muted); }
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
nav { display: flex; gap: var(--space-2); align-items: center; justify-content: flex-end; overflow-x: auto; scrollbar-width: none; }
nav::-webkit-scrollbar { display: none; }
nav a { flex: 0 0 auto; padding: 8px 2px; font-size: 12px; }
nav button { flex: 0 0 auto; min-height: 40px; padding: 8px 12px; font-size: 12px; }
#theme-toggle { width: 40px; min-width: 40px; padding: 0; font-size: 19px; line-height: 1; }

.hero { display: grid; gap: var(--space-5); padding: clamp(24px, 7vw, 36px) 0 var(--space-5); }
.eyebrow { margin: 0; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .18em; }
h1 { margin: 9px 0; font: normal clamp(31px, 10vw, 58px)/1.1 var(--serif); letter-spacing: -.025em; }
h1 em { color: color-mix(in srgb, var(--green) 72%, var(--muted)); font-weight: 400; }
h2 { margin: 0 0 var(--space-4); font: normal 25px/1.3 var(--serif); letter-spacing: -.015em; }
h3 { font-size: 18px; }
.intro, .muted, small { color: var(--muted); }
.intro { margin: 0 0 var(--space-4); }
.intro-note {
  padding: clamp(16px, 5vw, 22px);
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow);
}
.intro-note p { margin-bottom: 0; }
.tags { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.tags span, .badge { padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 10px; letter-spacing: .04em; }

.entry-panel {
  width: 100%;
  max-width: 720px;
  margin: 0 auto 36px;
  padding: clamp(14px, 4vw, 20px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow);
}
.tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-5); }
.tabs button { width: 100%; }
.tabs .active, .view-toggle [aria-pressed='true'] { background: var(--green); color: var(--paper); border-color: var(--green); }
label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13px; font-weight: 600; line-height: 1.35; letter-spacing: .01em; }
input, select, textarea {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height);
  padding: 9px 12px;
  background: var(--surface-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.35;
  letter-spacing: 0;
}
textarea { min-height: 110px; resize: vertical; }
input[type='checkbox'] { width: 19px; min-height: 19px; height: 19px; accent-color: var(--green); }
input[readonly] { background: var(--soft); }
.form-grid { display: grid; gap: 0; }

.section-head { display: grid; gap: var(--space-3); padding: var(--space-5) 0 var(--space-4); }
.section-head h1 { margin-block: 8px; font-size: clamp(30px, 9vw, 42px); overflow-wrap: anywhere; }
.section-head .primary { width: 100%; }
.section-actions { display: grid; gap: var(--space-2); }
.section-actions button { width: 100%; }
.section-actions .icon { margin-right: 7px; vertical-align: -5px; }
.button-count { display: inline-grid; min-width: 21px; height: 21px; margin-left: 5px; padding-inline: 5px; place-items: center; background: var(--soft); border-radius: 999px; font-size: 11px; }
.primary .button-count { color: var(--ink); }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; overflow: hidden; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius-panel); }
.stat { min-width: 0; padding: 11px 10px; background: var(--surface); }
.stat strong { display: block; font: 25px var(--serif); }
.stat span { color: var(--muted); font-size: 11px; }
.scanbar { padding: var(--space-3) 0 var(--space-4); border-bottom: 1px solid var(--line); }
.scanbar > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.scanbar button { width: 100%; padding-inline: 8px; }
.scanbar p { margin-bottom: 0; font-size: 13px; }
.tools { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin: var(--space-5) 0 var(--space-4); }
.tools label { margin: 0; }
.tools .search, .tools .view-toggle { grid-column: 1 / -1; }
.view-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); height: var(--control-height); align-self: end; }
.view-toggle button { width: 100%; height: var(--control-height); min-height: var(--control-height); padding: 0; }
.shelf-head { display: grid; gap: var(--space-3); margin: var(--space-5) 0; }
.shelf-head nav { flex-wrap: wrap; justify-content: flex-start; overflow: visible; }
.shelf-head button { min-height: 40px; font-size: 12px; }
.bulk { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 76px; padding: var(--space-4); background: var(--soft); border: 1px solid var(--line); border-radius: var(--radius-panel); font-size: 13px; }
.bulk label { margin: 0; }
.bulk > label:not(.check) { grid-column: 1; }
.bulk > button { grid-column: 2; align-self: end; }
#selected-count { justify-self: end; }
.check { display: flex !important; flex-direction: row !important; align-items: center; font-weight: 400; }

.books { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(135px, 43vw), 1fr)); gap: var(--space-5) var(--space-3); margin: var(--space-5) 0; }
.book { min-width: 0; position: relative; }
.book .check { min-height: 28px; margin-bottom: 6px; font-size: 11px; }
.external-label { display: inline-flex; min-height: 28px; align-items: center; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .08em; }
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
  border-radius: var(--radius-control);
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

.table-wrap { width: calc(100vw - 32px); max-width: 100%; margin-top: 18px; overflow: auto; border: 1px solid var(--line); border-radius: var(--radius-panel); }
table { width: 100%; min-width: 730px; border-collapse: collapse; background: var(--surface); }
th { color: var(--muted); background: var(--soft); font-size: 10px; letter-spacing: .14em; text-align: left; text-transform: uppercase; }
td, th { padding: 14px 12px; border-bottom: 1px solid var(--line); }
td small { display: block; max-width: 380px; overflow-wrap: anywhere; }
.thumb { width: 42px; height: 60px; object-fit: contain; }
.table-title { display: flex; gap: 12px; align-items: center; }
.table-title button { min-height: 36px; padding: 0; background: none; border: 0; text-align: left; }
.row-actions { display: flex; gap: var(--space-2); align-items: center; justify-content: flex-end; }
.empty { margin: 16px 0; padding: clamp(28px, 9vw, 45px) 16px; color: var(--muted); background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius-panel); text-align: center; }
.more { display: grid; gap: var(--space-2); margin: var(--space-5) 0; }
footer { margin-top: 42px; padding: 28px 0; color: var(--muted); border-top: 1px solid var(--line); font-size: 11px; text-align: center; }

#notice { margin: var(--space-4) 0; padding: 13px 15px; white-space: pre-wrap; background: var(--notice); border: 1px solid var(--notice-line); border-radius: var(--radius-control); }
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
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  box-shadow: var(--shadow);
}
dialog::backdrop { background: var(--backdrop); backdrop-filter: blur(3px); }
.dialog-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-5); }
.dialog-head h2 { margin: 0; }
.dialog-head button { width: 44px; padding: 0; }
.dialog-actions { display: grid; gap: 9px; }
.editor-grid { display: grid; gap: 22px; }
.cover-preview { width: min(180px, 60vw); margin: auto; }
.cover-preview .cover { aspect-ratio: 2 / 3; }
.editor-grid p { font-size: 12px; }
.secret { margin: var(--space-4) 0; padding: var(--space-4); overflow-wrap: anywhere; background: var(--soft); border-radius: var(--radius-control); }
.secret code { display: block; user-select: all; font-size: 13px; }
.source-list { display: grid; gap: var(--space-3); }
.source-auth-help { margin: -5px 0 var(--space-2); font-size: 12px; }
.source-credentials label { justify-content: flex-end; }
.source-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); align-items: center; padding: var(--space-4); background: var(--soft); border: 1px solid var(--line); border-radius: var(--radius-panel); }
.source-row h3 { margin: 0; font: 600 16px/1.35 var(--sans); overflow-wrap: anywhere; }
.source-row p { margin: 3px 0 0; font-size: 12px; overflow-wrap: anywhere; }
.source-actions { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: var(--space-2); align-items: center; }
.source-enabled { display: flex; flex-direction: row; align-items: center; gap: 7px; margin: 0; font-size: 12px; font-weight: 500; }
.source-actions .danger { width: var(--control-height); padding: 0; }
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

@media (max-width: 759px) {
  .bulk { grid-template-columns: minmax(0, 1fr) auto; overflow: hidden; }
  .bulk > label:not(.check), .bulk > button { grid-column: 1 / -1; width: 100%; }
  .table-wrap { width: 100%; overflow: visible; }
  table { min-width: 0; }
  thead { display: none; }
  tbody, tr { display: block; }
  tr { position: relative; min-height: 92px; padding: var(--space-4) 116px var(--space-4) 54px; border-bottom: 1px solid var(--line); }
  tr:last-child { border-bottom: 0; }
  td { display: none; padding: 0; border: 0; }
  td:first-child { display: block; position: absolute; top: var(--space-4); left: var(--space-4); }
  td:nth-child(2) { display: block; min-width: 0; }
  td:last-child { display: block; position: absolute; top: var(--space-4); right: var(--space-4); }
  .table-title { align-items: flex-start; }
  .table-title > div { min-width: 0; }
  .table-title button, .table-title small { overflow-wrap: anywhere; }
  .thumb { display: none; }
  .row-actions { gap: 6px; }
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
  .section-actions { display: flex; }
  .section-actions button { width: auto; }
  .source-row { grid-template-columns: minmax(0, 1fr) auto; }
  .source-actions { justify-content: flex-end; }
  .stats { grid-template-columns: repeat(4, 1fr); }
  .stat { padding: 18px; }
  .stat strong { font-size: 32px; }
  .tools { grid-template-columns: minmax(280px, 1fr) repeat(3, minmax(132px, auto)) auto; align-items: end; }
  .tools .search, .tools .view-toggle { grid-column: auto; }
  .shelf-head { grid-template-columns: 1fr auto; align-items: center; }
  .bulk { grid-template-columns: minmax(230px, 1fr) auto minmax(190px, auto) auto; }
  .bulk > label:not(.check), .bulk > button { grid-column: auto; }
  .bulk > label:not(.check) { justify-self: end; }
  .bulk input:not([type='checkbox']) { width: 160px; }
  .books { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 30px 22px; }
  dialog { width: min(850px, calc(100vw - 48px)); max-height: 90vh; margin: auto; padding: 28px; border-radius: var(--radius-panel); }
  #account { width: min(600px, calc(100vw - 48px)); }
  #sources { width: min(920px, calc(100vw - 48px)); }
  .editor-grid { grid-template-columns: 190px 1fr; gap: 28px; }
  .cover-preview { width: auto; }
  .dialog-actions { grid-template-columns: 1fr auto; align-items: center; }
}

@media (min-width: 1100px) {
  .wrap { max-width: none; padding-inline: clamp(40px, 4vw, 72px); }
  .hero { gap: 72px; }
  .entry-panel { max-width: none; padding: 32px; }
  .books { grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 34px 24px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}
`;
