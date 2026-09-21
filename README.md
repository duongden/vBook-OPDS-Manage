# VBook Library / OPDS Gateway — v1.5.1

Giao diện quản lý thư viện Google Drive, xây trên Gateway v1.4.1 và bố cục Reading Room. Web dùng để kiểm tra sách và chỉnh sửa thông tin; vBook dùng để tải và đọc qua OPDS 1.2 hoặc 2.0.

**Không lưu nội dung sách, không ghi vào Drive.** D1 chỉ lưu tài khoản, cấu hình thư viện, phiên đăng nhập và metadata chỉnh sửa. Nguồn Drive cần được chia sẻ “Bất kỳ ai có đường liên kết”; mật khẩu Gateway không thay đổi quyền truy cập file trên Google.

## Đã có

- Tạo thư viện với một thư mục Drive gốc và tài khoản quản lý riêng.
- Kệ bìa / bảng danh sách, duyệt thư mục và phân trang.
- Tìm/lọc trong dữ liệu đã tải theo tên, tác giả, ngôn ngữ, định dạng.
- Quét toàn thư viện theo từng trang, không giới hạn 35 thư mục hoặc 3 cấp; tạm dừng/thử lại, đếm file duy nhất và hiển thị tiến độ.
- Sửa tên hiển thị, tác giả, ngôn ngữ, thể loại, mô tả, URL bìa HTTPS; gán ngôn ngữ hàng loạt và khôi phục dữ liệu nguồn.
- OPDS nhận metadata đã sửa, giữ đuôi file và MIME type. Download HTTP 302 sang Drive với `confirm=t`.
- Tài khoản OPDS chỉ đọc, độc lập với tài khoản quản lý. Đổi mật khẩu, mã khôi phục một lần, tạo lại credential OPDS, xóa thư viện.
- EPUB, CBZ, PDF, MOBI, CBR, TXT và các định dạng vốn có: AZW/AZW3, PRC, FB2/FB2.ZIP, DOC/DOCX, ZIP.

## Chạy cục bộ

Yêu cầu Node.js **22.13+** (bộ test dùng `node:sqlite`), pnpm.

```sh
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Điền GOOGLE_API_KEY và MASK_SECRET thật vào .dev.vars.
pnpm run db:migrate:local
pnpm dev
```

Mở URL localhost do Wrangler hiển thị. Cookie có `Secure`; localhost được các trình duyệt hiện đại xử lý như ngữ cảnh tin cậy. Nếu dùng tên miền dev khác, cấu hình HTTPS.

`wrangler.toml` chứa ID D1 giả chỉ dùng local. Không deploy ID này lên Cloudflare.

## Kiểm tra

```sh
pnpm run build
pnpm test
pnpm run bundle
pnpm run test:runtime
pnpm run test:reference
pnpm audit
```

- `build`: typecheck TypeScript.
- `test`: bộ Gateway cũ, migration/query SQL SQLite thực, API/quyền truy cập và tương tác giao diện DOM.
- `bundle`: build Worker bằng Wrangler dry-run, không publish.
- `test:runtime`: chạy bundle trên Miniflare với D1 cục bộ và Drive metadata giả lập; cần cổng localhost.

Các test không dùng tài khoản/file thật và không thay cho kiểm tra cuối trên app vBook, Drive thật hoặc kiểm tra bố cục trình duyệt.

## Cách dùng

1. Chia sẻ thư mục Drive bằng link, dán link vào trang chủ, đặt tên thư viện và tài khoản quản lý.
2. Lưu **mã thư viện**, **mã khôi phục**, **mật khẩu OPDS** được cấp. Mã khôi phục chỉ hiện khi cấp mới; không có khôi phục qua email.
3. Duyệt thư mục hoặc bấm **Kiểm tra toàn thư viện**. Tổng kho chỉ hoàn chỉnh khi quét báo hoàn tất.
4. Bấm sách để sửa thông tin. Ô trống khôi phục giá trị nguồn. Ngôn ngữ chưa nhập là “Chưa rõ”.
5. Bấm **Kết nối vBook**, sao chép URL, nhập vào Extension Cloud → OPDS với username `reader` và mật khẩu OPDS.

Feed tự bổ sung phần mở rộng thật vào tên hiển thị. Sau khi sửa, làm mới catalog trong vBook vì ứng dụng có thể giữ cache riêng.

## Giới hạn và dữ liệu lưu

- Không có trình đọc online, upload bìa, OAuth Drive hoặc quyền ghi Drive.
- Không lưu database toàn bộ danh mục. Kết quả quét chỉ ở bộ nhớ trang; reload phải quét lại. Kho lớn tiêu tốn quota Drive và bộ nhớ trình duyệt.
- Tìm/lọc **web** áp dụng trên tập đã tải; chỉ đủ toàn kho sau khi quét xong.
- Tìm kiếm **OPDS** giữ thuật toán Gateway: tên file Drive, tối đa 3 cấp/35 thư mục con; chưa tìm theo tên chỉnh sửa.
- D1 lưu token thư mục mã hóa, khóa file HMAC, metadata, URL bìa; không gọi đây là hệ thống “không lưu dữ liệu”.
- Ảnh tải trực tiếp từ URL trên trình duyệt/vBook; backend không tải hoặc lưu ảnh. Host ảnh có thể chặn truy cập hoặc URL hết hạn.
- Xóa thư viện xóa dữ liệu hoạt động trong D1; dữ liệu vẫn có thể nằm trong thời hạn backup của nhà cung cấp.
- Giữ `MASK_SECRET` ổn định và sao lưu. Đổi secret làm hỏng token nguồn và ánh xạ metadata hiện có; chưa có migration đổi khóa.

## Triển khai

Xem [hướng dẫn triển khai](docs/deployment.md). Production cần D1 thật, migration và secrets trên Worker. Sites riêng tư của `reading-room/` dùng đăng nhập ChatGPT, không phù hợp làm endpoint OPDS cho vBook.

## Tương thích bản cũ

**Từ v1.5.1:** route legacy mặc định tắt. Chỉ bật `ENABLE_LEGACY_ROUTES=true` khi cần; tài khoản cấu hình trên server áp dụng cho toàn bộ route legacy. Link `?auth=` trả về 410. Xem [báo cáo bảo mật](docs/security-audit.md).

- Khi bật legacy: `/legacy` là giao diện tạo link nhanh cũ; có thêm `/api/mask`, `/feed/:folderId`, `/download/:fileId`.
- Link cũ không tự nhận chỉnh sửa D1. Tạo thư viện mới từ Drive để nhận URL ngắn `/o/:shortId`; route `/library/:id/opds` vẫn được giữ để tương thích.
- Link `?auth=` cũ phải được thay bằng URL OPDS thư viện mới; cơ chế cũ không bảo vệ khi người giữ link xóa/thay tham số.

## Mã nguồn

| Thành phần | File |
|---|---|
| Router Gateway và giao diện gốc | `src/index.ts` |
| API quản lý, OPDS có tài khoản | `src/library.ts` |
| Tham chiếu mã hóa, password hash, HMAC | `src/library-security.ts` |
| D1, kiểm tra và ghép metadata | `src/library-data.ts` |
| Feed thư viện mới | `src/library-feed.ts` |
| HTML/CSS và tương tác UI | `src/library-ui.ts`, `src/library-client.ts` |
| Đọc metadata Google Drive | `src/drive.ts` |
| Schema D1 | `migrations/` (apply every file in order) |

`reading-room/` giữ làm bản tham chiếu, không phải backend thứ hai của sản phẩm mới.
