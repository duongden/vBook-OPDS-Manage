# VBook Library / OPDS Gateway — v1.9.5

Giao diện quản lý thư viện Google Drive và các catalog OPDS được chia sẻ dành cho vBook. Web có thể gộp hai loại nguồn vào một link OPDS ngắn, có tài khoản riêng.

**Không lưu nội dung sách, không ghi vào Drive.** D1 chỉ lưu tài khoản, cấu hình thư viện, phiên đăng nhập, metadata chỉnh sửa và danh sách sách OPDS bạn chọn ẩn. Nguồn Drive cần được chia sẻ “Bất kỳ ai có đường liên kết”; mật khẩu Gateway không thay đổi quyền truy cập file trên Google.

## Đã có

- Tạo thư viện bằng một thư mục Drive, danh sách OPDS có sẵn, hoặc cả hai.
- Sau khi đăng nhập, có thể thêm, thay thế hoặc gỡ thư mục Drive trong mục **Nguồn sách**.
- Dán tối đa 99 URL OPDS mỗi lần; bộ đếm báo link trùng và giới hạn, tiến trình thêm hiển thị từng nhóm 10 URL. Có thể kiểm tra lại, bật/tắt và xóa riêng từng nguồn lỗi.
- Gộp sách Drive và các catalog OPDS vào một URL `/o/:short_id`; credential của nguồn được mã hóa trước khi lưu.
- Quét đồng thời Drive và các nguồn OPDS đang bật, đi theo catalog con/phân trang và gom sách vào cùng kết quả tìm/lọc trên web.
- Chọn, tải hoặc loại từng sách OPDS khỏi catalog tổng hợp; thao tác loại không xóa sách ở nguồn của người khác.
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
pnpm audit
```

- `build`: typecheck TypeScript.
- `test`: bộ Gateway cũ, migration/query SQL SQLite thực, API/quyền truy cập và tương tác giao diện DOM.
- `bundle`: build Worker bằng Wrangler dry-run, không publish.
- `test:runtime`: chạy bundle trên Miniflare với D1 cục bộ và Drive metadata giả lập; cần cổng localhost.

Các test không dùng tài khoản/file thật và không thay cho kiểm tra cuối trên app vBook, Drive thật hoặc kiểm tra bố cục trình duyệt.

## Hướng dẫn sử dụng

Người dùng thông thường chỉ cần ứng dụng **vBook** và ít nhất một nguồn: thư mục Google Drive chứa sách hoặc các link OPDS được chia sẻ. Không cần tự tạo API key nếu người quản trị đã triển khai VBook Library.

> Tất cả tên, đường dẫn, mã thư viện và mật khẩu trong phần hướng dẫn và hình minh họa dưới đây đều là dữ liệu giả.

### 1. Chuẩn bị nguồn sách

Nếu đã có link OPDS do người khác chia sẻ, bạn có thể bỏ qua phần Google Drive và dùng link đó ở bước 3.

Nếu dùng Google Drive:

1. Tạo một thư mục và đưa các file EPUB, PDF, CBZ, CBR, MOBI hoặc TXT vào đó. Có thể dùng thư mục con để phân loại.
2. Chọn **Chia sẻ** → **Bất kỳ ai có đường liên kết** → quyền **Người xem**.
3. Sao chép liên kết thư mục.

Ví dụ giả:

```text
https://drive.google.com/drive/folders/THU_MUC_MAU_123
```

### 2. Tạo thư viện

Mở VBook Library, chọn **Tạo thư viện**. Dán **URL OPDS HTTPS thuần**, mỗi dòng một link; không dán cả cú pháp Markdown `[link](URL)` hoặc link trang chat như Discord. Có thể nhập tối đa **99 link OPDS khác nhau** và tùy chọn một link thư mục Drive. Bộ đếm ngay dưới ô nhập cho biết số link hợp lệ về mặt số lượng, dòng trùng và lúc vượt giới hạn; nội dung feed sẽ được kiểm tra khi bấm tạo. Nhập tên thư viện, tên đăng nhập và mật khẩu quản lý dài ít nhất 12 ký tự. Có thể để trống danh sách nguồn và thêm sau ở bước 3. Nếu nhập hơn 10 link, đợi thông báo hoàn tất tất cả nhóm trước khi chuyển trang; hộp thoại lưu mật khẩu OPDS chỉ mở sau bước này.

Bấm **Tạo catalog tổng hợp** và lưu ngay:

- **Mã thư viện ngắn** (12 ký tự) để đăng nhập lại; mã UUID cũ vẫn dùng được.
- **Mã khôi phục** (16 ký tự khi cấp mới) để đặt lại mật khẩu quản lý.
- **Mật khẩu OPDS** (16 ký tự khi cấp mới) để kết nối vBook.

Mã khôi phục và mật khẩu OPDS chỉ hiển thị khi vừa được cấp. Không nhập mật khẩu quản lý vào vBook.

### 3. Quản lý nguồn Drive và OPDS

Trong trang quản lý, bấm **Nguồn sách**. Phần **Google Drive** cho phép thêm thư mục Drive vào catalog hiện tại, thay bằng thư mục khác hoặc gỡ nguồn Drive mà không cần đăng xuất. Khi thay đổi, dán link thư mục hoặc Folder ID; file trên Drive không bị chỉnh sửa hay xóa.

Ở phần **Nguồn OPDS**, dán mỗi URL trên một dòng; mỗi lần có thể dán từ 1 đến 99 link. Dòng trùng chỉ được tính một lần. Khi dán lại danh sách, hệ thống đối chiếu và bỏ qua link đã lưu, chỉ thêm link còn thiếu; URL gốc không được trả lại trong danh sách nguồn. Sau khi bấm **Thêm và kiểm tra nguồn**, hệ thống gửi từng nhóm tối đa 10 link đến API. Nếu một link trong nhóm lỗi, giao diện thử riêng từng link trong nhóm, tiếp tục xử lý các nhóm sau, rồi báo tổng số nguồn đã thêm. Mỗi link lỗi được hiện đầy đủ cùng lý do và nút **Xóa link lỗi**; khi có nhiều link lỗi, nút **Xóa tất cả link lỗi** gỡ chúng khỏi ô nhập một lần. Chỉ các link lỗi hoặc chưa xử lý còn lại trong ô; link đã thêm không cần nhập lại. Nếu thư viện đã được tạo nhưng nhóm sau gặp lỗi, hãy lưu mã thư viện/mã khôi phục đang hiển thị, rồi vào **Nguồn sách** để tiếp tục.

Trong vBook, **Kệ tổng hợp** hiển thị sách từ các nguồn OPDS đang bật trong cùng một kệ. Gateway lần theo các trang kế tiếp và thư mục con của từng feed qua phân trang OPDS; nguồn tắt hoặc sách đã loại khỏi catalog không xuất hiện. Nếu thư viện không có Drive, link OPDS của thư viện mở thẳng kệ này. Nếu có Drive, kệ nằm trong catalog cùng với sách Drive. Link Discord hoặc trang HTML thường không phải feed OPDS và sẽ bị từ chối khi kiểm tra nguồn.

- Nguồn công khai: để trống username và mật khẩu.
- Nguồn có Basic Auth: nhập tài khoản mà chủ nguồn đã cấp. Một lần thêm dùng chung tài khoản cho các URL trong ô.
- Sau khi thêm, dùng công tắc để bật/tắt nguồn, biểu tượng sao chép để lấy link ngắn riêng, hoặc biểu tượng thùng rác để gỡ nguồn khỏi thư viện. Thao tác này không xóa sách ở máy chủ nguồn.
- Để xóa nhiều nguồn bất kỳ, đánh dấu **Chọn** ở từng dòng hoặc **Chọn tất cả nguồn**, rồi bấm **Xóa hàng loạt (N)** phía trên danh sách. Nút luôn hiển thị và chỉ bật khi đã chọn ít nhất một nguồn; hệ thống hỏi xác nhận số nguồn trước khi xóa. Các nguồn không được chọn và sách trên máy chủ nguồn được giữ nguyên.
- Bấm **Kiểm tra link đã lưu** để kiểm tra lại từng nguồn. Giao diện báo số nguồn đã kiểm tra và số lỗi. Dòng không đọc được sẽ hiện lỗi cùng nút **Xóa link lỗi**; sau khi kiểm tra xong, nút **Xóa tất cả N link lỗi** gỡ các nguồn lỗi đã xác định khỏi thư viện sau khi bạn xác nhận. Nút này chỉ xóa nguồn lỗi, giữ nguyên nguồn hoạt động và sách trên máy chủ nguồn. Có thể tắt nguồn lỗi trước nếu chỉ muốn tạm bỏ qua.

Thư viện chỉ có OPDS sẽ tự quét sách khi mở trang quản lý hoặc sau khi thêm nguồn. Sách hiện dần cùng tiến trình **Đang quét**; nếu một nguồn lỗi trong lúc quét, các nguồn khác vẫn được xử lý. Bộ đếm **Nguồn sách** là số nguồn đã lưu, còn **Sách trong kết quả** là số sách đã tải trong lần quét hiện tại. Kệ tổng hợp trên vBook tiếp tục hiển thị sách từ nguồn hoạt động và báo số nguồn lỗi trong tiêu đề.

Nếu **Nguồn sách** vẫn hiển thị `10` sau khi bạn đã dán hơn 10 link ở phiên trước, thư viện hiện chỉ lưu 10 nguồn. Vào **Nguồn sách**, dán lại danh sách OPDS; ứng dụng sẽ bỏ qua 10 link đã lưu và tiếp tục thêm các link còn thiếu. Xem tổng số thêm thành công và danh sách URL lỗi trước khi đóng trang.

| Thông báo | Ý nghĩa và cách xử lý |
| --- | --- |
| `Đã nhập X / 99 URL OPDS` | Đếm link khác nhau trong ô. Nếu báo **Vượt giới hạn**, bớt link hoặc chia lần nhập. |
| `Đã kiểm tra X / Y URL OPDS · đã thêm Z` | Đang xử lý; đợi đến khi kiểm tra đủ `Y` link. |
| `Đã thêm Z / Y nguồn OPDS. Có N link lỗi` | Các nguồn tốt đã được thêm. Xem URL và lý do trong danh sách lỗi, rồi sửa hoặc bấm **Xóa link lỗi**. |
| `N nguồn lỗi` | Các feed đã lưu hiện không đọc được. Mở dòng lỗi để tắt hoặc bấm **Xóa link lỗi**. |

Thông báo và tiến trình nằm trong hộp thoại đang mở, ở phần đầu hộp thoại; chúng không bị lớp nền che. Nếu link gốc đã đổi hoặc tài khoản nguồn hết hạn, hãy gỡ nguồn cũ rồi thêm URL/tài khoản mới.

Tài khoản nguồn không hiển thị lại trên giao diện. Nếu cần thay URL hoặc credential, hãy xóa nguồn cũ và thêm lại. Chỉ dùng URL `https://` công khai; địa chỉ localhost hoặc mạng nội bộ bị từ chối.

### 4. Quản lý sách Drive

![Giao diện quản lý thư viện với dữ liệu giả](docs/images/quan-ly-thu-vien.png)

Bạn có thể duyệt thư mục, đổi giữa kệ và bảng, tìm/lọc sách, sửa metadata, thêm URL bìa HTTPS và gán ngôn ngữ hàng loạt. Bấm **Kiểm tra toàn thư viện** để quét mọi thư mục con; không đóng hoặc tải lại trang khi đang quét.

Nút **Kiểm tra toàn thư viện** cũng quét các nguồn OPDS đang bật. Sách từ OPDS có nhãn **OPDS**, được đưa vào thống kê và bộ lọc chung; metadata này do nguồn bên ngoài cung cấp nên không chỉnh sửa trên trang quản lý.

Khi quét OPDS, nếu nguồn có mã ngôn ngữ thì thư viện dùng mã đó. Nếu nguồn bỏ trống, thư viện thử nhận diện từng sách từ tên và mô tả; kết quả hiện **(ước đoán)** trong kệ và có thể lọc theo ngôn ngữ. Sách không đủ dấu hiệu vẫn ở **Chưa rõ**. Cách này không đọc nội dung file và có thể không xác định được tên ngắn, tên phiên âm hoặc tiếng Việt không dấu. Quét lại để cập nhật kết quả sau khi nguồn đổi metadata.

Mỗi dòng sách có nút tải. Với sách OPDS, nút thùng rác chỉ loại sách khỏi catalog tổng hợp của bạn; file ở nguồn gốc không bị xóa. Có thể dùng checkbox để chọn nhiều sách OPDS rồi bấm **Xóa sách OPDS đã chọn** ở hàng nút phía trên, cạnh **Nguồn sách** và **Kết nối vBook**. Nút chỉ hiện khi đã chọn sách OPDS. Nếu chọn lẫn sách Drive và OPDS, nút gán ngôn ngữ chỉ áp dụng cho sách Drive.

Các thay đổi chỉ tác động đến thông tin hiển thị trong thư viện. Tên và nội dung file trên Drive không bị sửa.

Nếu thư viện chỉ có nguồn OPDS, khu vực sách Drive sẽ trống; đây không phải lỗi.

### 5. Kết nối vBook

Trong trang quản lý, bấm **Kết nối vBook**.

![Hộp kết nối vBook với dữ liệu giả](docs/images/ket-noi-vbook.png)

1. Sao chép link OPDS.
2. Trong vBook, mở **Extension Cloud → OPDS** và tạo nguồn mới.
3. Dán link vào **URL danh mục**.
4. Ở ô **Tên**, nhập `reader`. Ở ô **Mật khẩu**, nhập mật khẩu OPDS trong hộp **Kết nối vBook**. Có nút sao chép riêng cho từng giá trị.
5. Lưu và mở kho sách.

Ví dụ giả, không dùng để đăng nhập:

```text
URL:      https://vbook-opds.example/o/THUVIENMAU12
Username: reader
Password: mat-khau-mau-khong-dung-that
```

Đây là catalog tổng hợp: trang đầu chứa các nguồn OPDS đã bật cùng sách/thư mục Drive. Feed Drive tự bổ sung phần mở rộng thật vào tên hiển thị. Sau khi thay đổi nguồn hoặc metadata, hãy làm mới catalog trong vBook vì ứng dụng có thể giữ cache riêng.

### Đăng nhập lại và khôi phục

Để đăng nhập lại, nhập mã thư viện, tên đăng nhập và mật khẩu quản lý tại tab **Đăng nhập**. Nếu quên mật khẩu, dùng tab **Khôi phục** cùng mã khôi phục đã lưu.

Lỗi `HTTP 404 — not an OPDS catalog at this URL` có thể do gõ nhầm số `0` thay cho chữ `o` trong `/o/`. Hãy sao chép nguyên URL từ **Kết nối vBook**. Khi chưa nhập tài khoản, URL đúng yêu cầu xác thực; mã thư viện và mã khôi phục không dùng trong vBook. Mật khẩu OPDS đã cấp trước bản cập nhật vẫn dùng được; nút **Tạo lại mật khẩu OPDS** sẽ cấp mật khẩu 16 ký tự mới và thu hồi mật khẩu OPDS cũ.

Sau khi khôi phục, mã khôi phục, phiên đăng nhập và mật khẩu OPDS cũ hết hiệu lực. Hãy lưu thông tin mới và cập nhật vBook. Hệ thống không khôi phục qua email.

### Sáng/tối

Bấm biểu tượng mặt trăng hoặc mặt trời trên thanh đầu trang. Lựa chọn được lưu trên thiết bị; nếu chưa chọn, giao diện theo cài đặt hệ thống.

### Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Không đọc được thư mục Drive | Kiểm tra quyền chia sẻ là **Bất kỳ ai có đường liên kết** và **Người xem** |
| vBook báo sai tài khoản | Username OPDS luôn là `reader`; không dùng tên đăng nhập quản lý |
| vBook báo sai mật khẩu | Dùng mật khẩu OPDS, không dùng mật khẩu quản lý |
| Không thấy thông tin vừa sửa | Làm mới hoặc mở lại kho OPDS trong vBook |
| Không thấy nguồn OPDS vừa thêm | Kiểm tra nguồn đang bật, rồi làm mới catalog trong vBook |
| Không thêm được nguồn OPDS | URL phải dùng HTTPS công khai và trả về OPDS XML/JSON hợp lệ; kiểm tra lại tài khoản nguồn |
| Link nguồn ngừng hoạt động | Nguồn bên ngoài có thể đổi URL/credential hoặc tạm ngừng; xóa rồi thêm lại nếu thông tin đã đổi |
| Quên mật khẩu OPDS | Mở **Kết nối vBook** và tạo lại mật khẩu OPDS |
| Quét bị dừng | Chờ khoảng một phút rồi bấm **Tiếp tục / thử lại** |
| Ảnh bìa không hiện | Dùng URL `https://`; máy chủ ảnh có thể chặn truy cập ngoài |
| Không tìm thấy toàn bộ sách | Chạy **Kiểm tra toàn thư viện**; tìm kiếm web chỉ áp dụng trên dữ liệu đã tải |
| Đã loại sách OPDS nhưng nguồn gốc vẫn còn | Đây là hành vi đúng: hệ thống chỉ ẩn sách khỏi catalog tổng hợp, không có quyền xóa ở nguồn của người khác |

Không chia sẻ mã khôi phục hoặc mật khẩu, không chụp màn hình chứa thông tin thật và không đặt API key/secret trong URL OPDS. Xóa thư viện trên web không xóa file trong Google Drive.

## Giới hạn và dữ liệu lưu

- Không có trình đọc online, upload bìa, OAuth Drive hoặc quyền ghi Drive.
- Proxy OPDS chỉ theo link cùng hostname với URL nguồn. Link sang hostname khác được giữ trực tiếp và không nhận credential đã lưu.
- Trình quét web chỉ đi theo catalog con và phân trang cùng hostname với nguồn. Metadata sách OPDS không được lưu vào D1 và không chỉnh sửa trên web; D1 chỉ lưu khóa của sách bạn đã chọn ẩn.
- Mỗi feed nguồn được giới hạn 2 MB và thời gian kết nối 20 giây. Việc đọc sách phụ thuộc vào tình trạng máy chủ OPDS bên ngoài.
- Không lưu database toàn bộ danh mục. Kết quả quét chỉ ở bộ nhớ trang; reload phải quét lại. Kho lớn tiêu tốn quota Drive và bộ nhớ trình duyệt.
- Tìm/lọc **web** áp dụng trên tập đã tải; chỉ đủ toàn kho sau khi quét xong.
- Tìm kiếm **OPDS** giữ thuật toán Gateway: tên file Drive, tối đa 3 cấp/35 thư mục con; chưa tìm theo tên chỉnh sửa.
- D1 lưu token thư mục, URL và credential nguồn OPDS dưới dạng mã hóa, khóa file HMAC, metadata và URL bìa; không gọi đây là hệ thống “không lưu dữ liệu”.
- Ảnh tải trực tiếp từ URL trên trình duyệt/vBook; backend không tải hoặc lưu ảnh. Host ảnh có thể chặn truy cập hoặc URL hết hạn.
- Xóa thư viện xóa dữ liệu hoạt động trong D1; dữ liệu vẫn có thể nằm trong thời hạn backup của nhà cung cấp.
- Giữ `MASK_SECRET` ổn định và sao lưu. Đổi secret làm hỏng token nguồn và ánh xạ metadata hiện có; chưa có migration đổi khóa.

## Triển khai

Yêu cầu Node.js 22.13+, pnpm, tài khoản Cloudflare Workers/D1 và `MASK_SECRET` ngẫu nhiên ổn định dài ít nhất 32 ký tự. `GOOGLE_API_KEY` cần khi dùng nguồn Drive.

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create vbook-library
cp wrangler.production.toml.example wrangler.production.toml
```

Thay `replace-with-your-d1-database-id` trong file local `wrangler.production.toml`, sau đó chạy:

```sh
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.production.toml
pnpm exec wrangler secret put GOOGLE_API_KEY --config wrangler.production.toml
pnpm exec wrangler secret put MASK_SECRET --config wrangler.production.toml
pnpm run precommit
pnpm run bundle
pnpm run test:runtime
pnpm run deploy
```

`wrangler.production.toml` bị Git bỏ qua. Không lưu API key, `MASK_SECRET`, mật khẩu hoặc ID hạ tầng trong repository, URL hay ảnh chụp. Sao lưu D1 trước migration mới và giữ `MASK_SECRET` ổn định; thay hoặc mất secret sẽ làm hỏng token nguồn và ánh xạ metadata hiện có.

Khi **nâng cấp một thư viện đã triển khai**, giữ nguyên `wrangler.production.toml`, D1 và các secret hiện có; không tạo database hoặc tài khoản thư viện mới. Ghi lại bookmark Time Travel của D1 bằng `pnpm exec wrangler d1 time-travel info DB --config wrangler.production.toml`, rồi áp dụng migration `0006_opds_aggregate_states.sql` bằng lệnh `d1 migrations apply` ở trên **trước** khi deploy Worker mới. Cloudflare D1 có [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) và Wrangler ghi backup khi áp dụng migration. Sau deploy, mở trang quản lý, thử nhập hơn 10 feed giả lập hoặc nguồn của bạn, kiểm tra một nguồn lỗi và nút xóa, rồi mở **Kệ tổng hợp** trong vBook để kiểm tra phân trang và tải sách. Các URL OPDS cá nhân chỉ nhập vào giao diện quản lý, không đưa vào mã nguồn hoặc ảnh hướng dẫn.

Sau deploy, dùng một thư mục Drive thử để kiểm tra tạo thư viện, quét thư mục con, sửa metadata, Basic Auth OPDS, phân trang, bìa và tải sách trên vBook thật. Theo dõi lỗi 401/429/5xx và mức sử dụng D1/Drive trên Cloudflare; không ghi credential hoặc URL Drive vào log.

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
| Kiểm tra, mã hóa cấu hình và proxy nguồn OPDS | `src/opds-source.ts` |
| Đọc catalog/phân trang và chuẩn hóa sách OPDS để quét | `src/opds-scan.ts` |
| Tham chiếu mã hóa, password hash, HMAC | `src/library-security.ts` |
| D1, kiểm tra và ghép metadata | `src/library-data.ts` |
| Feed thư viện mới | `src/library-feed.ts` |
| HTML/CSS và tương tác UI | `src/library-ui.ts`, `src/library-client.ts` |
| Đọc metadata Google Drive | `src/drive.ts` |
| Schema D1 | `migrations/` (apply every file in order) |

## Giấy phép

Mã nguồn được phát hành theo [MIT License](LICENSE). Bạn có thể sử dụng, sao chép, sửa đổi và phân phối theo các điều khoản trong file giấy phép.

Giấy phép này chỉ áp dụng cho mã nguồn của project, không cấp quyền đối với sách, ảnh bìa hoặc dữ liệu được người dùng kết nối từ Google Drive.
