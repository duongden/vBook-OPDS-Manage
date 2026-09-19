# Plan-to-do: Gateway + giao diện quản lý Reading Room

Ngày lập: 2026-09-17.
Trạng thái (2026-09-19): Đã triển khai mã nguồn v1.5.0 và kiểm thử tự động/local. Chưa publish hoặc xác minh bằng Drive/vBook thật.

## 1. Mục tiêu

Dùng **VBook OPDS Gateway v1.4.1 làm nền**, tích hợp giao diện trực quan của **Reading Room v1.0.0**. Web phục vụ kiểm tra và quản lý thông tin thư viện; người dùng tải và đọc sách trên vBook qua OPDS.

Luồng chính: dán link thư mục Drive → tạo thư viện và tài khoản quản lý → kiểm tra, bổ sung metadata → sao chép link OPDS → thêm vào vBook.

## 2. Yêu cầu người dùng đã chốt

- Drive chỉ đọc, không yêu cầu quyền edit/write, không sửa hoặc tải lên file Drive.
- Không lưu nội dung sách, không có trình đọc online.
- Mỗi người dùng có link thư viện riêng; không công khai danh mục hoặc link nguồn.
- Giao diện hiển thị danh sách sách, số lượng sách/file, ngôn ngữ, định dạng và bìa nếu có.
- Cho phép sửa thông tin sách và bổ sung bìa bằng **URL ảnh**, không upload ảnh.
- Chỉnh sửa chỉ lưu trên thư viện và được áp dụng vào feed cho vBook.
- Sử dụng **Cloudflare D1** để lưu dữ liệu quản lý và chỉnh sửa.
- Truy cập trang quản lý bằng **tài khoản thư viện**.
- Ngôn ngữ do người dùng gán; chưa gán thì hiển thị “Chưa rõ”.
- Các định dạng chính: EPUB, CBZ, PDF, MOBI, CBR, TXT.

Mô tả quyền riêng tư cần dùng: **Không lưu nội dung sách, không ghi vào Drive; chỉ lưu dữ liệu quản lý thư viện và các chỉnh sửa của người dùng.** Không tiếp tục tuyên bố dự án hoàn toàn không lưu dữ liệu.

## 3. Mặc định của kế hoạch, chưa phải yêu cầu người dùng xác nhận riêng

- Một thư mục Drive gốc cùng các thư mục con cho mỗi thư viện.
- Giữ cách đọc danh mục trực tiếp từ Drive; D1 không lưu bản sao danh mục file lâu dài.
- Quét toàn thư viện khi người dùng yêu cầu; kết quả nằm trong bộ nhớ phiên trang web, reload phải quét lại.
- Giao diện tiếng Việt, kế thừa bố cục, màu sắc và kiểu chữ Reading Room; có chế độ kệ và bảng như ảnh người dùng cung cấp.
- Tài khoản quản lý web và thông tin xác thực OPDS được tách riêng; OPDS chỉ có quyền đọc.
- Dùng mã khôi phục một lần, chưa có khôi phục qua email.
- Giữ hỗ trợ các định dạng khác đã có trong Gateway.

Nếu cần thay đổi phạm vi, trao đổi các mặc định này trước khi thực hiện phần phụ thuộc. Không xem việc tạo file kế hoạch là cho phép triển khai hoặc publish.

## 4. Hiện trạng lúc lập kế hoạch (2026-09-17)

- `src/`: Gateway TypeScript + Hono, Cloudflare Worker; OPDS XML/JSON, Google Drive API, masking Folder ID, Basic Auth, redirect tải sách.
- `reading-room/`: ứng dụng mẫu độc lập, 8 sách mẫu, UI HTML/CSS/JavaScript, backend và build riêng; chưa nối Drive.
- Gateway duyệt Drive theo trang, mặc định 50 mục; chưa có database, tài khoản quản lý hoặc tổng số file toàn kho.
- Tìm kiếm hiện quét tối đa 3 cấp và 35 thư mục con; không thể dùng giới hạn này để đếm toàn thư viện.
- Cache feed công khai 60 giây, tìm kiếm và cây thư mục 300 giây.
- Auth hiện lấy `?auth=` do client cung cấp làm giá trị kiểm tra, ưu tiên hơn cấu hình server; không sử dụng cơ chế này để bảo vệ thư viện mới.
- Tài liệu ghi PBKDF2 nhưng `src/crypto.ts` hiện dẫn xuất khóa masking bằng SHA-256.
- Thư mục làm việc hiện không có Git repository theo lần kiểm tra ban đầu.
- Chưa chạy kiểm thử hoặc sửa mã ứng dụng trong phiên lập kế hoạch.

Đọc `.agents/context.md`, `.agents/decisions.md`, `docs/vbook-contract.md` trước khi triển khai. Các thay đổi code cần vượt qua build và test của project.

## 5. Kiến trúc dự kiến

### 5.1 Gateway và giao diện

Giữ TypeScript, Hono, pnpm và Cloudflare Workers của project gốc. Tích hợp giao diện Reading Room vào ứng dụng gốc, bỏ nội dung mẫu khỏi luồng sản phẩm. Không cần duy trì hai backend cho bản ghép.

Tách logic dùng chung: truy vấn Drive → ghép chỉnh sửa D1 → biểu diễn dữ liệu cho web hoặc OPDS.

### 5.2 Dữ liệu D1

| Nhóm | Nội dung |
|---|---|
| Thư viện | Mã thư viện, tên, token thư mục mã hóa, thời điểm tạo |
| Xác thực | Username, password hash có salt, phiên đăng nhập, thông tin xác thực OPDS đã băm, mã khôi phục đã băm |
| Chỉnh sửa sách | Mã thư viện, khóa file, tên hiển thị, tác giả, ngôn ngữ, thể loại, mô tả, URL bìa |

- Khóa file dùng HMAC từ mã thư viện và Drive File ID; không cần lưu File ID thô hoặc URL tải trong bảng chỉnh sửa.
- Mọi chỉnh sửa được phân tách theo thư viện, kể cả khi hai thư viện trỏ cùng một file Drive.
- Ưu tiên dữ liệu: chỉnh sửa D1 → metadata Drive → trạng thái chưa có thông tin.
- Có thao tác xóa chỉnh sửa để trở về dữ liệu nguồn.
- Xóa thư viện chỉ xóa dữ liệu quản lý trong D1; không xóa gì trên Drive.

### 5.3 Xác thực

- Tạo tài khoản cùng lúc tạo thư viện; đăng nhập bằng mã thư viện, username và password.
- Web dùng cookie phiên HttpOnly, Secure, SameSite; kiểm tra quyền thư viện và chống CSRF cho thao tác ghi.
- OPDS dùng Basic Auth riêng, chỉ đọc; cấp khi tạo thư viện và có thể tạo lại.
- Không lưu password rõ; chọn password hashing có salt phù hợp ngân sách CPU Workers và kiểm chứng trước khi triển khai.
- Giới hạn thử đăng nhập; không ghi credential hoặc URL nguồn nhạy cảm vào log.
- Con trỏ và tham chiếu tài nguyên do server cấp phải được ký hoặc mã hóa, ràng buộc với thư viện.

### 5.4 API dự kiến

- `/api/libraries`: tạo thư viện.
- `/api/session`: đăng nhập, kiểm tra phiên và đăng xuất.
- `/api/libraries/:id/items`: duyệt thư mục Drive, phân trang.
- `/api/libraries/:id/scan`: quét từng bước, trả tiến độ và con trỏ tiếp tục.
- `/api/libraries/:id/books/:bookKey`: lưu/xóa chỉnh sửa; bổ sung thao tác gán ngôn ngữ hàng loạt.
- `/library/:id/opds`: feed XML/JSON đã ghép metadata; liên kết tìm kiếm, thư mục con và tải sách thuộc thư viện.

Các API quản lý luôn xác thực và kiểm tra quyền thư viện. Không cho phép đổi File ID hoặc Folder ID để truy cập tài nguyên ngoài phạm vi được cấp.

## 6. Hành vi sản phẩm

### Duyệt, đếm và lọc

- Kệ bìa và bảng danh sách: tên, tác giả, ngôn ngữ, định dạng, dung lượng, bìa.
- Breadcrumb thư mục, phân trang, trạng thái tải/rỗng/lỗi.
- Thống kê luôn ghi phạm vi; số file một trang không phải tổng kho.
- Nút “Kiểm tra toàn thư viện” quét mọi trang và thư mục con, không giới hạn 35 thư mục hoặc 3 cấp như tìm kiếm hiện tại.
- Quét theo request nhỏ, có tiến độ, hủy, thử lại và xử lý quota. Chỉ báo tổng hoàn chỉnh sau khi quét đủ.
- Đếm file sách theo File ID duy nhất; thư mục không tính là sách. Hai file khác ID được tính riêng dù cùng tên.
- Tìm kiếm và lọc web áp dụng vào dữ liệu đã tải; muốn áp dụng toàn thư viện phải quét hoàn tất. Hiển thị rõ phạm vi.
- Thống kê thiếu bìa nghĩa là chưa có URL bìa bổ sung hoặc thumbnail nguồn, không phải kiểm chứng mọi ảnh từ xa đều truy cập được.

### Chỉnh sửa và bìa

- Sửa tên hiển thị, tác giả, ngôn ngữ, thể loại, mô tả, URL bìa.
- Không cho sửa định dạng và dung lượng vì đây là thuộc tính file nguồn.
- Cho phép chọn nhiều sách để gán ngôn ngữ.
- Bìa ưu tiên URL do người dùng đặt, sau đó thumbnail Drive; ảnh thiếu hoặc tải lỗi dùng ô thay thế có nhãn định dạng.
- Chỉ chấp nhận URL bìa HTTPS; không để backend tùy ý fetch URL từ người dùng, không lưu ảnh.
- Không tự đoán ngôn ngữ hoặc tác giả từ tên file.

### OPDS và tương thích

- Web và feed dùng chung logic ghép metadata.
- XML/JSON bổ sung tác giả, ngôn ngữ, mô tả, thể loại, bìa khi có dữ liệu.
- Tiêu đề OPDS luôn giữ phần mở rộng thật dù người dùng sửa tên hiển thị.
- Giữ MIME type, phân trang và HTTP 302 tải trực tiếp từ Drive.
- Feed thư viện mới dùng `private, no-store` để tránh cache công khai và dữ liệu chỉnh sửa cũ ở Gateway; vBook vẫn có thể cần refresh cache của ứng dụng.
- Tìm kiếm OPDS bản đầu giữ phạm vi tìm kiếm Drive của Gateway; chưa tìm theo tên chỉnh sửa và không quảng bá là tìm toàn kho.
- Route Gateway cũ là luồng riêng; không tự chuyển quyền từ `?auth=` sang tài khoản mới. Thư viện quản lý dùng link OPDS mới.

## 7. Checklist triển khai

### Giai đoạn 1 — Chuẩn bị

- [x] Tạo file kế hoạch để tiếp tục vào phiên sau.
- [x] Chạy test và typecheck hiện tại, ghi nhận kết quả nền.
- [x] Kiểm tra trạng thái version control trước khi sửa; không giả định workspace đã có `.git`.
- [x] Tách logic đọc Drive, ghép metadata và sinh feed.
- [x] Chốt build giao diện trong Worker gốc; loại dữ liệu mẫu khỏi luồng sản phẩm.
- [x] Cập nhật mô tả quyền riêng tư và phạm vi tính năng.

### Giai đoạn 2 — D1 và xác thực

- [x] Viết migration cho thư viện, tài khoản, phiên, mã khôi phục và chỉnh sửa sách.
- [x] Xây tạo thư viện, đăng nhập, đăng xuất, khôi phục và đổi mật khẩu.
- [x] Tách quyền quản lý web và quyền đọc OPDS.
- [x] Thêm giới hạn đăng nhập, chống CSRF, kiểm tra quyền thư viện.
- [x] Xây xóa thư viện và tạo lại credential OPDS.

### Giai đoạn 3 — Drive và thống kê

- [x] Xây API duyệt thư mục và phân trang.
- [x] Xây quét toàn thư viện theo từng bước với con trỏ được bảo vệ.
- [x] Xử lý mất quyền chia sẻ, file bị xóa, lỗi mạng, quota và hủy quét.
- [x] Thêm thống kê tổng file sách, định dạng, thiếu ngôn ngữ và thiếu bìa.
- [x] Phân biệt kết quả tạm thời, hoàn tất và lỗi chưa quét đủ.

### Giai đoạn 4 — Giao diện

- [x] Tích hợp bố cục Reading Room và nội dung tiếng Việt.
- [x] Xây kệ, bảng, breadcrumb, tìm kiếm và bộ lọc.
- [x] Xây form metadata, xem trước URL bìa, reset dữ liệu nguồn.
- [x] Thêm gán ngôn ngữ hàng loạt.
- [x] Thêm trang hướng dẫn lấy link OPDS và nhập thông tin vào vBook.
- [x] Đảm bảo thao tác bàn phím, nhãn form và bố cục trên điện thoại.

### Giai đoạn 5 — Feed và tương thích

- [x] Ghép metadata cho OPDS 1.2 và 2.0.
- [x] Kiểm tra liên kết con, tìm kiếm, phân trang và download giữ đúng quyền thư viện.
- [x] Giữ route cũ tách biệt; không kế thừa cơ chế `?auth=` vào thư viện mới.
- [x] Cho phép tạo thư viện quản lý từ link Drive hiện có và cấp link OPDS mới.
- [x] Sửa tài liệu về phiên bản, masking, giới hạn tìm kiếm và thống kê.

### Giai đoạn 6 — Kiểm thử và phát hành

- [x] Test sáu định dạng, XML/JSON, Unicode, MIME và bảo toàn phần mở rộng.
- [x] Test hai thư viện cùng nguồn Drive vẫn có chỉnh sửa độc lập.
- [x] Test người có credential OPDS không sửa được metadata.
- [x] Test thiếu/sai auth, sửa tham chiếu tài nguyên, CSRF và hết hạn phiên.
- [x] Test quét trên 35 thư mục, sâu hơn 3 cấp, nhiều trang, file trùng ID và lỗi giữa chừng.
- [x] Test lưu, reset, bìa lỗi, ngôn ngữ chưa rõ và gán hàng loạt.
- [x] Test feed nhận đúng dữ liệu sau chỉnh sửa và giữ được phân trang.
- [x] Chạy build và bộ test phù hợp của project.
- [ ] Kiểm tra thực tế bằng vBook trên thư viện thử nghiệm trước khi tuyên bố tương thích hoàn tất.
- [x] Chuẩn bị migration bổ sung, bundle và kiểm thử D1/Worker cục bộ.
- [ ] Cấu hình D1 thật, secrets và staging trên tài khoản Cloudflare triển khai.
- [ ] Kiểm tra bố cục desktop/mobile bằng trình duyệt thật; hiện đã kiểm thử tương tác DOM, chưa kiểm tra hình ảnh.
- [ ] Triển khai production chỉ khi được yêu cầu; không ghi đè bản đang chạy trong bước lập kế hoạch.


## 8. Hosting và giới hạn bản đầu

- Production dự kiến dùng Cloudflare Worker của Gateway để vBook truy cập bằng Basic Auth.
- Reading Room có `.openai/hosting.json` của Sites; giữ nguyên cấu hình gốc. Sites riêng tư có thể dùng preview nếu cần nhưng lớp đăng nhập ChatGPT không phù hợp cho vBook.
- Không đưa R2, upload ảnh, đồng bộ nền, database danh mục toàn kho, đọc EPUB/PDF online hoặc ghi Drive vào bản đầu.
- Drive cần chia sẻ “Bất kỳ ai có đường liên kết”; không hỗ trợ Drive chỉ chia sẻ riêng cho một tài khoản.
- Thống kê phản ánh lần quét, không phải snapshot giao dịch: file thay đổi trong lúc quét có thể cần kiểm tra lại.
- Khả năng ảnh bìa từ URL bên ngoài hiển thị trên vBook cần kiểm tra thực tế; không cam kết mọi host ảnh đều hỗ trợ.

## 9. Tiêu chí hoàn thành và bàn giao

Người dùng tạo thư viện từ link Drive, đăng nhập quản lý, xem tổng file sau quét hoàn tất, sửa metadata/URL bìa và nhận thông tin tương ứng qua OPDS trên vBook. Không thao tác nào ghi Drive, lưu nội dung sách hoặc cho thư viện khác đọc/sửa dữ liệu quản lý của họ.

## 10. Bàn giao triển khai 2026-09-19

- Version package: 1.5.0. Project vẫn chưa có Git repository; chưa commit hoặc push.
- Giao diện chính ở `/`; tạo link cũ ở `/legacy`. Không thay đổi source hoặc hosting identity của `reading-room/`.
- D1 schema: `migrations/0001_libraries.sql`; config `wrangler.toml` chứa ID giả cho local. Hướng dẫn cấu hình thật ở `docs/deployment.md`.
- Mã nguồn mới: `library.ts`, `library-security.ts`, `library-data.ts`, `library-feed.ts`, `library-ui.ts`, `library-client.ts` trong `src/`.
- API thực tế bổ sung `/api/recovery`, `/api/libraries/:id/password`, `/opds-credentials`, `/delete`, `/language`. Xóa thư viện dùng POST `/delete` với password xác nhận.
- Đã kiểm thử 12 bộ Gateway cũ, 10 bài thư viện (bao gồm DOM qua jsdom), và bundle Worker trên Miniflare với D1 thực cục bộ. Các truy vấn Drive trong test đều giả lập và chỉ GET metadata.
- Typecheck và bundle đã chạy thành công. Suite dùng Node SQLite để chạy migration/query thật, không giả lập kết quả SQL; runtime test kiểm tra thêm môi trường D1/workerd.
- Chưa có Google API Key/nguồn Drive thật được cấu hình cho bản mới; chưa kiểm tra trên app vBook và trình duyệt thật. Không có bản production mới được publish.
- Kết quả quét chỉ ở bộ nhớ trang theo mặc định kế hoạch; không thêm database danh mục hoặc lưu file sách.
- Chạy tiếp: làm các mục còn trống ở Giai đoạn 6; không cần triển khai lại từ đầu.
