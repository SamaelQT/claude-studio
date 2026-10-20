# Kênh AI Tips — video dọc kiểu motion graphics

Thêm vào claude-studio ngày 20/10/2026, dùng cho cuộc thi AI Sharing Tips (loạt "Hỏi IT không bằng hỏi AI").
Khác các kênh cũ: không dùng ảnh AI + lia máy quay, mà **dựng slide động bằng Remotion** (thẻ bước, khung chat,
bảng Excel, số đếm, phụ đề chạy theo giọng). Thư mục tách riêng, có `package.json` riêng — không đụng app Next.js.

## Làm một video

```
cd tips-video
node tts.mjs scripts/01-zalo-don-hang.json        # 1. giọng đọc (Edge TTS, nữ Hoài My) → public/<id>/
node render.mjs scripts/01-zalo-don-hang.json --still   # 2a. xem nhanh: 1 khung/cảnh → output/ai-tips/<id>/khung-*.png
node render.mjs scripts/01-zalo-don-hang.json     # 2b. xuất MP4 1080×1920 → output/ai-tips/<id>/<id>.mp4
npm run studio                                     # (tuỳ chọn) xem trước/tua trong trình duyệt
```

- Sửa lời thoại → chạy lại `tts.mjs` (câu không đổi được lấy từ cache `.cache/tts`, chỉ đọc lại câu mới).
- Sửa chữ trên màn hình → chỉ chạy lại `render.mjs`.
- Cần ffmpeg + ffprobe trong PATH (đã có bản winget). Trình duyệt dựng hình nằm trong `node_modules/.remotion`.

## Kịch bản (`scripts/*.json`)

`id`, `series`, `title`, `author`, `voice`, `rate`, `tips` (danh sách 4 mẹo cho cảnh `tips`) và `scenes[]`.
Mỗi cảnh có `type` + `vo` (lời đọc, tự chia thành câu phụ đề ≤ 14 từ) + trường riêng:

| type | trường | hiện gì |
|---|---|---|
| `hook` | kicker, big, sub | mở đầu: vấn đề + "Dán 1 lần" |
| `chat` | heading, messages[{from,text}] | bong bóng tin nhắn, tự tô vàng chữ khó (mai, thứ 6, mã sai…) |
| `typing` | heading, notes[] | bảng Excel gõ tay chậm + danh sách cái khổ |
| `tips` | heading, active (-1 = hiện cả 4, 0..3 = làm nổi mẹo đó) | 4 thẻ mẹo |
| `prompt` | heading, lines[] | câu lệnh mẫu gõ dần, đánh số màu |
| `table` | heading, columns, rows, total | bảng AI trả về, ô `[?]` nhấp nháy vàng, dòng TỔNG |
| `total` | heading, parts[], total | cộng dồn → số tổng đếm lên → "✓ Khớp" |
| `paste` | heading | Ctrl+V → bảng Excel đổ dữ liệu |
| `result` | heading, pairs[[nhãn, trước, sau]] | so sánh trước / sau |
| `safety` | heading, items[] | lưu ý dùng AI an toàn |
| `outro` | cta | tên loạt + tác giả + lời mời |

Cảnh mới: thêm component vào `src/scenes.tsx` và đăng ký trong `SCENES`.
Màu / font: `src/theme.ts` (nền sáng xanh lá + vàng — cố ý khác clip mẫu).

## Còn dở

- Chưa có nút trên giao diện studio (đang chạy bằng lệnh). Nối vào UI sau khi Quang duyệt video đầu.
- Chưa có nhạc nền (nhạc trong `music/` có bản quyền — không dùng cho video công ty).
- Giọng dự phòng khi Edge TTS lỗi: FPT / VieNeu (`lib/tools/voice.ts`) — chưa nối.
