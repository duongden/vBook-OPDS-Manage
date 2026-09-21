# Triển khai VBook Library v1.5.1

## Chuẩn bị

- Node.js 22.13+, pnpm, tài khoản Cloudflare có Workers và D1.
- Google Drive API Key cho Drive API v3; không cần OAuth hoặc quyền ghi Drive.
- MASK_SECRET ngẫu nhiên ổn định ít nhất 32 ký tự. Sao lưu an toàn; mất khóa sẽ không giải mã được nguồn hoặc ánh xạ chỉnh sửa.
- Kho Drive nhỏ để kiểm tra bằng vBook trước khi chuyển người dùng thật.

## Tạo database và cấu hình

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create vbook-library
```

Tạo cấu hình production cục bộ và thay placeholder bằng ID vừa tạo:

```sh
cp wrangler.production.toml.example wrangler.production.toml
# Sửa replace-with-your-d1-database-id trong wrangler.production.toml.
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.production.toml
pnpm exec wrangler secret put GOOGLE_API_KEY --config wrangler.production.toml
pnpm exec wrangler secret put MASK_SECRET --config wrangler.production.toml
```

`wrangler.production.toml` bị Git bỏ qua để ID hạ tầng không xuất hiện trong repository. Không đặt secrets trong file cấu hình, source, URL feed hoặc ảnh chụp. Chỉ dùng `.dev.vars` cho local.

## Kiểm tra và phát hành

```sh
pnpm run precommit
pnpm run bundle
pnpm run test:runtime
# Chỉ sau khi đã sẵn sàng xuất bản:
pnpm run deploy
```

Wrangler dùng Worker `vbook-opds`; deploy thay phiên bản hiện tại của Worker này. Nếu cần staging, dùng cấu hình/Worker/D1 riêng; không dùng dữ liệu production để thử xóa/khôi phục tài khoản.

Sau deploy:

1. Tạo thư viện với Drive thử, kiểm tra thư mục rỗng và có sách.
2. Quét hết, so số file với Drive; kiểm tra tiếp tục sau khi tạm dừng.
3. Sửa tên, ngôn ngữ, URL bìa và mở OPDS bằng Basic Auth được cấp.
4. Thêm vào vBook, kiểm tra thư mục con, phân trang, thumbnail, tải các định dạng có trong kho thử.
5. Đổi credential OPDS, xác minh credential cũ bị từ chối.

Không tuyên bố kiểm thử vBook thật nếu chỉ chạy test giả lập.

## Vận hành và rollback

- Migrations add tables/columns without deleting library data. Keep the security fixes when planning a rollback.
- Sao lưu D1 trước migration tiếp theo; chưa có migration đổi MASK_SECRET.
- Theo dõi 401/429/5xx và D1 usage bằng Cloudflare; không ghi request URL, credential hoặc nguồn Drive vào log ứng dụng mới.
- Password hashing dùng PBKDF2-SHA256 100.000 vòng, salt riêng. Test runtime xác nhận workerd chạy được; cần đo CPU/latency trên gói Cloudflare thật. Không cam kết miễn phí ở mọi quy mô.
- Quét kho lớn chạy từng request do trang điều phối, phụ thuộc quota và bộ nhớ trình duyệt; không có job nền.
- Phiên hết hạn sau 7 ngày, được dọn khi tạo phiên. Bucket giới hạn đăng nhập hết hạn sau 15 phút, được dọn khi kiểm tra giới hạn.

## Security update v1.5.1

Áp dụng mọi migration trước khi deploy. Giữ `MASK_SECRET` ổn định và sao lưu an toàn. Legacy endpoints mặc định bị tắt; link `?auth=` cũ không còn được hỗ trợ. Xem [báo cáo bảo mật](security-audit.md).
