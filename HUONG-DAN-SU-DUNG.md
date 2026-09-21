# Hướng dẫn sử dụng VBook Library

VBook Library giúp bạn biến một thư mục sách trên Google Drive thành kho sách có thể thêm vào ứng dụng vBook qua OPDS.

Bạn không cần cài máy chủ, không cần biết lập trình và không cần tự tạo Google API key. Người quản trị trang web đã chuẩn bị những phần đó.

> **Lưu ý về hình minh họa:** Tất cả tên, đường dẫn, mã thư viện và mật khẩu trong tài liệu này đều là dữ liệu giả. Không nhập lại các giá trị trong hình.

## Bạn cần chuẩn bị gì?

- Ứng dụng **vBook** đã được cài trên thiết bị.
- Một thư mục Google Drive chứa sách của bạn.
- Các file sách như EPUB, PDF, CBZ, CBR, MOBI hoặc TXT.
- Địa chỉ trang VBook Library do người quản trị cung cấp.

VBook Library không tải sách lên máy chủ riêng và không thay đổi file trong Drive. File sách vẫn nằm trong Google Drive của bạn.

## Bước 1: Chuẩn bị thư mục Google Drive

1. Mở Google Drive.
2. Tạo một thư mục, ví dụ **Góc sách của tôi**.
3. Đưa các file sách vào thư mục. Bạn có thể tạo thêm thư mục con để phân loại.
4. Chọn **Chia sẻ**.
5. Ở phần quyền truy cập chung, chọn **Bất kỳ ai có đường liên kết**.
6. Giữ quyền là **Người xem**, sau đó sao chép liên kết thư mục.

Ví dụ minh họa, không phải link thật:

```text
https://drive.google.com/drive/folders/THU_MUC_MAU_123
```

Nếu thư mục không được chia sẻ bằng liên kết, VBook Library sẽ không thể đọc danh sách sách.

## Bước 2: Tạo thư viện

Mở trang VBook Library và chọn tab **Tạo thư viện**.

![Giao diện tạo thư viện với dữ liệu giả](docs/images/tao-thu-vien.png)

Điền các ô:

- **Link thư mục Google Drive:** dán liên kết đã sao chép ở bước 1.
- **Tên thư viện:** tên dễ nhớ, ví dụ “Góc sách của tôi”.
- **Tên đăng nhập quản lý:** dùng để đăng nhập lại trang quản lý.
- **Mật khẩu quản lý:** ít nhất 12 ký tự và chỉ mình bạn biết.

Sau đó bấm **Tạo thư viện & link OPDS**.

## Bước 3: Lưu thông tin quan trọng

Sau khi tạo thư viện, trang web sẽ cấp cho bạn:

1. **Mã thư viện** — dùng cùng tên đăng nhập để vào lại trang quản lý.
2. **Mã khôi phục** — dùng khi quên mật khẩu quản lý.
3. **Mật khẩu OPDS** — dùng để thêm kho sách vào vBook.

Hãy lưu ba thông tin này trong trình quản lý mật khẩu hoặc nơi riêng tư. Mã khôi phục và mật khẩu OPDS chỉ hiện khi vừa được cấp.

### Hai loại mật khẩu khác nhau

| Thông tin | Dùng ở đâu? | Có quyền gì? |
|---|---|---|
| Mật khẩu quản lý | Trang VBook Library | Xem và sửa thông tin thư viện |
| Mật khẩu OPDS | Ứng dụng vBook | Chỉ đọc và tải sách |

Không nhập mật khẩu quản lý vào vBook.

## Bước 4: Kiểm tra và quản lý sách

Sau khi tạo hoặc đăng nhập, bạn sẽ thấy màn hình quản lý thư viện.

![Giao diện quản lý thư viện với sách và số liệu giả](docs/images/quan-ly-thu-vien.png)

Bạn có thể:

- Mở từng thư mục con.
- Chuyển giữa chế độ **Kệ** và **Bảng**.
- Tìm sách trong dữ liệu đã tải.
- Lọc theo ngôn ngữ hoặc định dạng.
- Sửa tên hiển thị, tác giả, ngôn ngữ, thể loại và mô tả.
- Thêm URL ảnh bìa HTTPS.
- Gán ngôn ngữ cho nhiều sách cùng lúc.

### Kiểm tra toàn thư viện

Bấm **Kiểm tra toàn thư viện** nếu bạn muốn biết tổng số sách trong tất cả thư mục con.

- Có thể tạm dừng và tiếp tục khi cần.
- Không đóng hoặc tải lại trang khi đang quét.
- Với kho lớn, quá trình này có thể mất một lúc.
- Kết quả quét chỉ được giữ trong phiên trang hiện tại.

VBook Library chỉ sửa thông tin hiển thị của thư viện. Tên và nội dung file trong Google Drive không bị thay đổi.

## Bước 5: Thêm thư viện vào vBook

Trong trang quản lý, bấm **Kết nối vBook**.

![Hộp kết nối vBook với toàn bộ thông tin đều là giả](docs/images/ket-noi-vbook.png)

Thực hiện theo thứ tự:

1. Bấm **Sao chép link OPDS**.
2. Mở vBook.
3. Vào **Extension Cloud → OPDS**.
4. Tạo một nguồn OPDS mới.
5. Dán link vào ô **URL danh mục**.
6. Nhập tên đăng nhập OPDS là `reader`.
7. Nhập **mật khẩu OPDS của chính thư viện bạn**.
8. Lưu và mở kho sách.

Ví dụ minh họa, không dùng để đăng nhập:

```text
URL:      https://vbook-opds.example/o/THUVIENMAU12
Username: reader
Password: mat-khau-mau-khong-dung-that
```

Nếu bạn vừa sửa tên, tác giả hoặc bìa trên trang quản lý, hãy làm mới kho sách trong vBook để nhận thông tin mới.

## Đăng nhập lại trang quản lý

1. Mở VBook Library.
2. Chọn tab **Đăng nhập**.
3. Nhập **Mã thư viện**.
4. Nhập **Tên đăng nhập quản lý**.
5. Nhập **Mật khẩu quản lý**.

Đây là thông tin quản lý web, không phải tài khoản `reader` của OPDS.

## Khi quên mật khẩu

1. Chọn tab **Khôi phục**.
2. Nhập mã thư viện.
3. Nhập mã khôi phục đã lưu.
4. Đặt mật khẩu quản lý mới.

Sau khi khôi phục:

- Mã khôi phục cũ hết hiệu lực.
- Phiên đăng nhập cũ bị đăng xuất.
- Mật khẩu OPDS cũ bị thu hồi.
- Bạn cần cập nhật mật khẩu OPDS mới trong vBook.

Không có chức năng khôi phục qua email.

## Đổi giao diện sáng hoặc tối

Bấm biểu tượng mặt trăng hoặc mặt trời trên thanh đầu trang. Lựa chọn được lưu trên thiết bị đang dùng. Nếu chưa chọn, trang web sẽ theo chế độ sáng/tối của hệ thống.

## Các lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Không đọc được thư mục Drive | Kiểm tra quyền chia sẻ là **Bất kỳ ai có đường liên kết** và quyền **Người xem** |
| vBook báo sai tài khoản | Username OPDS luôn là `reader`; không dùng tên đăng nhập quản lý |
| vBook báo sai mật khẩu | Dùng mật khẩu OPDS, không dùng mật khẩu quản lý |
| Không thấy thông tin vừa sửa | Làm mới hoặc mở lại kho OPDS trong vBook |
| Quên mật khẩu OPDS | Đăng nhập trang quản lý → **Kết nối vBook** → **Tạo lại mật khẩu OPDS** |
| Quét bị dừng hoặc Drive giới hạn | Chờ khoảng một phút rồi bấm **Tiếp tục / thử lại** |
| Ảnh bìa không hiện | Dùng URL ảnh bắt đầu bằng `https://`; máy chủ ảnh có thể chặn truy cập ngoài |
| Không tìm thấy toàn bộ sách | Chạy **Kiểm tra toàn thư viện**; tìm kiếm web chỉ áp dụng trên dữ liệu đã tải |

## An toàn và riêng tư

- Không chia sẻ mã khôi phục hoặc mật khẩu cho người khác.
- Không chụp màn hình có mật khẩu OPDS thật.
- Không dán API key, secret hoặc mật khẩu vào link OPDS.
- Chỉ nhập thông tin vào đúng địa chỉ VBook Library do người quản trị cung cấp.
- Người có mật khẩu OPDS có thể đọc và tải sách trong thư viện.
- Xóa thư viện trên VBook Library không xóa file trong Google Drive.

## Dành cho người tự vận hành máy chủ

Người dùng thông thường không cần phần này. Nếu bạn là quản trị viên muốn tự triển khai VBook Library trên Cloudflare Workers, xem [hướng dẫn triển khai kỹ thuật](docs/deployment.md).
