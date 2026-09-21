> Historical Gateway design notes. For v1.5.1 authentication and deployment, follow README.md, SECURITY.md and docs/security-audit.md. Query credentials (`?auth=`) described below are retired.

# Kiến trúc VBook Library v1.5.0

## Kiến trúc hiện tại

Ứng dụng là Hono + TypeScript trên Cloudflare Workers. Giao diện quản lý tích hợp ở `/`; giao diện tạo link cũ chuyển sang `/legacy`.

Luồng quản lý: cookie phiên → xác thực thư viện → Drive API chỉ đọc metadata → ghép chỉnh sửa D1 → JSON cho web. Luồng OPDS: Basic Auth riêng → cùng bước đọc/ghép dữ liệu → Atom XML hoặc OPDS JSON → HTTP 302 tải file từ Drive.

D1 lưu thư viện (nguồn mã hóa), password hash, recovery hash, OPDS hash, phiên, rate limit và chỉnh sửa theo khóa `(library_id, book_key)`. `book_key` là HMAC phân tách theo thư viện. Không lưu danh mục toàn kho hoặc nội dung file; URL bìa là dữ liệu chỉnh sửa, ảnh tải trực tiếp ở client.

Web quét toàn kho bằng hàng đợi BFS trong bộ nhớ trang: mỗi request `/scan` lấy một trang Drive; thư mục/con trỏ được mã hóa và ràng buộc thư viện. Không giới hạn chiều sâu hoặc số thư mục như deep search cũ. Kết quả mất khi reload; có trạng thái chưa đủ, lỗi, tạm dừng và hoàn tất.

Tham chiếu quản lý dùng AES-GCM với miền khóa riêng. Masking Folder ID cũ dẫn xuất khóa bằng SHA-256; password quản lý mới dùng PBKDF2-SHA256 có salt. Không dùng `?auth=` làm quyền cho thư viện mới.

Feed/API thư viện mới dùng `private, no-store`; cache legacy và giới hạn tìm kiếm OPDS cũ giữ nguyên. Chi phí phụ thuộc mức sử dụng, không đảm bảo $0 vô hạn. Masking không biến file Drive công khai thành file riêng tư.

Xem hướng dẫn sử dụng và triển khai trong [README](../README.md).

---

## Tài liệu lịch sử v1.3.0

Phần dưới mô tả thiết kế cũ. Các tuyên bố tuyệt đối về quyền riêng tư, chi phí, tương thích và pháp lý không phải bảo đảm của v1.5.0; dùng phần hiện tại và README làm nguồn chính.

## 1. Bối Cảnh & Mục Tiêu

- **Vấn đề cốt lõi:** vBook hỗ trợ chuẩn OPDS để người dùng thêm kho tài nguyên sách cá nhân mà không phụ thuộc vào cơ chế backup dữ liệu. Tuy nhiên, người dùng phổ thông chỉ có link thư mục Google Drive (chứa file `.epub`, `.cbz`, `.pdf`), không có khả năng tự dựng và duy trì máy chủ Calibre/Kavita/Komga phức tạp.
- **Bảo vệ danh tính (Privacy-First từ v1.1.0):** Khi chia sẻ công khai hoặc lộ link feed chứa `folderId` gốc của Google Drive, kẻ xấu có thể dán ID vào trình duyệt để truy ra Avatar, Họ tên và Email tài khoản Google của chủ sở hữu. Do đó, hệ thống tích hợp tầng Stateless URL Masking (AES-256-GCM) để mã hóa `folderId` thành chuỗi `m_...` vô danh.
- **Mục tiêu v1.3.0:** Đạt 100% Full Contract với ứng dụng vBook:
  - Hỗ trợ song song cả **OPDS 1.2 (Atom XML)** và **OPDS 2.0 (`application/opds+json`)** thông qua Content Negotiation (`Accept` header).
  - Tích hợp Rich Metadata (`<category>` format tag, `<content>` fallback).
  - Chạy hoàn toàn trên Cloudflare Workers (chi phí hạ tầng $0): Không lưu trữ nội dung sách, không lưu index cơ sở dữ liệu nặng, miễn nhiễm bản quyền (DMCA-free) và hoàn toàn riêng tư.

---

## 2. Mô Hình Kiến Trúc Tổng Thể (System Architecture)

```
+------------------+         +-----------------------------------------+         +-----------------------+
|                  |  (1)    |   VBook OPDS Gateway (CF Worker)        |  (2)    |                       |
|   vBook App      | ------->|   - Stateless Crypto Layer (AES-256-GCM)| ------->|   Google Drive API    |
| (Mobile / E-ink) |         |     (Giải mã m_... -> folderId gốc)     |         | (Folder & File Data)  |
|                  | <-------|   - Content Negotiation (OPDS 1.2/2.0)  | <-------|                       |
|                  |  (3)    |   - Atom XML Builder / JSON 2.0 Builder |         |                       |
|                  |         |   - Basic Auth Verifier                 |         +-----------------------+
+------------------+         |   - Subfolder Masking Transformer       |
        |                    |   - Native OpenSearch Engine ({search}) |
        |                    |   - 302 Redirect Handler                |
        |                    +-----------------------------------------+
        |
        | (4) Direct Stream Download (HTTP 302 / Google Direct URL)
        +----------------------------------------------------------> Google Servers
```

### Luồng Vận Hành (Data Flow):
1. **Duyệt mục lục (Browse / Infinite Scroll):**
   - vBook gửi request `GET https://opds.domain.com/feed/:folderId?page=...` (với `folderId` là chuỗi đã mã hóa `m_...` hoặc ID gốc) kèm Header `Accept: application/atom+xml` và `Authorization: Basic ...` (nếu có mật khẩu).
2. **Gateway xử lý:**
   - **Tầng mã hóa (Stateless Crypto Layer):** Nếu `folderId` bắt đầu bằng tiền tố `m_`, Gateway dùng Web Crypto native giải mã AES-256-GCM bằng bí mật `MASK_SECRET` của Worker để lấy `folderId` thật. Nếu không hợp lệ hoặc bị can thiệp (tamper), Gateway trả về HTTP 400 Bad Request.
   - Xác thực HTTP Basic Auth: So khớp Header `Authorization: Basic` với token từ query parameter hoặc biến môi trường Worker.
   - Gateway truy vấn Google Drive API v3 (`files.list` với query `'<folderId>' in parents and trashed = false`).
   - Gateway chuyển đổi danh sách file thành cấu trúc XML Atom OPDS:
     + Mã hóa tất cả ID của thư mục con thành `m_...` trong các thẻ link `rel="subsection"` để ngăn chặn rò rỉ ID qua cây thư mục.
     + Bảo toàn 100% phần mở rộng định dạng file trong `<title>` để vBook nhận diện vẽ bìa sách SVG và hiển thị huy hiệu (badge).
     + Nhận diện MIME type chính xác cho các liên kết acquisition.
     + Kế thừa tham số `authParam` qua tất cả các liên kết con (subfolder, acquisition) để bảo vệ toàn vẹn thư mục con.
3. **vBook hiển thị:**
   - vBook nhận XML, bóc tách ra các thư mục con (Sub-catalog) và danh sách sách có đủ định dạng nhãn (`EPUB`, `CBZ`, `PDF`), mô tả tóm tắt.
4. **Tải sách (Acquisition):**
   - Khi người dùng bấm Tải sách, vBook gọi `GET /download/:fileId`.
   - Gateway kiểm tra Regex an toàn cho `fileId` chống Injection / Open Redirect.
   - Gateway trả về mã `HTTP 302 Found` (Redirect) trỏ thẳng sang URL tải trực tiếp của Google (`https://drive.google.com/uc?export=download&id=:fileId`).
   - Băng thông tải sách đi trực tiếp giữa Google và thiết bị người dùng. Gateway tiêu tốn 0 MB băng thông lưu trữ và không làm lộ Google API Key.
5. **Tìm kiếm sách (vBook Native OpenSearch Protocol):**
   - *Trạng thái v1.2.0:* Kích hoạt chính thức theo chuẩn giao tiếp tìm kiếm của vBook.
   - Gateway nhúng trực tiếp URL template vào feed: `<link rel="search" href="/feed/{folderId}/search?q={searchTerms}" .../>`.
   - vBook client thay `{searchTerms}` bằng từ khóa encode RFC-3986 và gửi request tới `/feed/:folderId/search`.
   - Gateway giải mã `folderId` (hỗ trợ cả ID ẩn `m_...`), truy vấn Google Drive API (`name contains '...'`), bảo toàn token xác thực `authParam` và phân trang kết quả `rel="next"`.

---

## 3. Các Thành Phần Hệ Thống

| Thành phần | Công nghệ | Nhiệm vụ | Chi phí |
|---|---|---|---|
| **Edge Runtime** | Cloudflare Workers | Xử lý request, sinh feed XML, redirect tải sách | $0 (Free-tier: 100,000 req/ngày) |
| **Web Framework** | Hono (TypeScript) | Router siêu nhẹ (< 15KB), độ trễ < 10ms | $0 (Open Source) |
| **Crypto Layer** | Web Crypto API (AES-256-GCM) | Mã hóa / giải mã Folder ID không trạng thái (Stateless URL Masking) | $0 (Native Runtime) |
| **Giao diện Web** | HTML/CSS tĩnh tối giản (Embed trong Worker) | Nhận link Google Drive $\rightarrow$ Tự động sinh URL OPDS ẩn ID (`/feed/m_...`) | $0 (Không cần hosting ngoài) |
| **Data Provider** | Google Drive API v3 | Lấy danh sách file và metadata của thư mục | $0 (Hạn mức API miễn phí của Google) |
| **Xác thực** | HTTP Basic Auth (Stateless) | Kế thừa token qua toàn bộ sub-resource, so khớp timing-safe | $0 |
