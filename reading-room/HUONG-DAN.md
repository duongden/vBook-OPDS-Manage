# Reading Room — Hướng dẫn chạy source code

Đây là source của website Reading Room đã dựng, gồm frontend, backend OPDS, dữ liệu mẫu, bản build và các bài kiểm tra.

## Yêu cầu

- Node.js 22 trở lên (kèm npm).
- Python 3, có lệnh `python3`.
- Backend không cần cài thêm thư viện npm để chạy.

## Chạy trên macOS / Linux

Giải nén, mở Terminal tại thư mục `reading-room`, rồi chạy:

```sh
npm run build
OPDS_USERNAME=reader OPDS_PASSWORD='thay-bang-mat-khau-cua-ban' npm start
```

Mở http://localhost:4173 và đăng nhập bằng tài khoản đã đặt ở lệnh trên.
Feed OPDS: http://localhost:4173/opds

Máy chủ chạy ở cổng 4173 mặc định. Có thể thêm `PORT=8080` trước `npm start` để đổi cổng. Khi đưa lên Internet, sử dụng HTTPS và giữ xác thực cho các đường dẫn sách, API và OPDS.

## Các file chính

- `src/index.html`: toàn bộ giao diện HTML, CSS, JavaScript.
- `src/worker.js`: backend, xác thực, tìm kiếm, OPDS và tải sách.
- `src/books.json`: 8 sách mẫu, nội dung và metadata.
- `scripts/build.py`: tạo các EPUB mẫu và đóng gói backend.
- `dist/index.js`: bản build sẵn, chạy trên Worker.
- `server.mjs`: chạy backend bằng Node.js.
- `wrangler.jsonc`: cấu hình Cloudflare Worker.
- `.openai/hosting.json`: ID của website Sites gốc, không phải thông tin đăng nhập.
- `test/`: các bài kiểm tra backend, XML/EPUB và giao diện.

Sửa các file trong `src/`, sau đó chạy lại `npm run build` và khởi động lại server.

## Kiểm tra

```sh
npm test
```

Bài kiểm tra giao diện `test/browser.cjs` cần Playwright và Chromium; nó không phải điều kiện để chạy website. `test/validate.py` kiểm tra XML và EPUB tại máy chủ thử nghiệm cổng 4173, mặc định không gửi thông tin đăng nhập.

## Tình trạng tính năng

Đã có thư viện, bộ lọc, tìm kiếm, xem chi tiết, đọc sách mẫu, tải EPUB, OPDS 1.2 và giao diện kiểm tra feed.

Chưa có kết nối Google Drive, database D1, nhập EPUB thật, trang quản trị hoặc bản triển khai Pages.dev. Những phần đó mới được thảo luận, không nằm trong source hiện tại.

Bản Sites đã triển khai dùng lớp đăng nhập ChatGPT của hosting. Khi tự triển khai, dùng chế độ mặc định `basic` với `OPDS_USERNAME` và `OPDS_PASSWORD`. Không đặt `AUTH_MODE=platform` trên một host không có lớp kiểm soát truy cập riêng.

Xem `README.md` để biết thêm chi tiết kỹ thuật.

Source commit: d20b87a7e98f346aed7f8ee90f014bc3ca02011c
