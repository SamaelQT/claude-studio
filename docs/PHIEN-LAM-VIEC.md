# PHIEN-LAM-VIEC — claude-studio
Sao lưu việc của các phiên Claude làm trong repo này (quy tắc trong `~/.claude/CLAUDE.md`). Mất phiên → đọc file này rồi làm tiếp.
Nhật ký chung 2 acc: `D:\Claude-chung\nhat-ky\NHAT-KY-CHUNG.md`. Mới nhất ở trên.

## Mục tiêu
Studio làm video bằng code của Quang (repo cá nhân `SamaelQT/claude-studio`). Phần đang chạy nhiều nhất: `tips-video/` — video dọc
"mẹo dùng AI" cho cuộc thi AI Tips (SAP Jam), kế hoạch 6 tuần ở `D:\Web\AI workspace\ai-sharing-tips\KE-HOACH-MEO-AI.md`.

## Nhật ký
- 2026-10-29 · acc 2 · Clip #9 (Weekly Challenge #2 — thử tip "đưa schema" của anh Hoàng Mạnh Hùng), phong cách "bản vẽ sơ đồ dữ liệu" (look blueprint + cảnh k-schema). Giọng chuyển sang VieNeu bản mới 3.8.3 (model v4, fp32) ở venv `D:cheenv-vieneu4`, mặc định "Ngọc Huyền" (Quang chọn Ngọc Huyền / Hải Đăng). #6–#8 vẫn giọng Mai Anh cũ.
- 2026-10-28 · acc 2 · Dựng 3 clip tuần 2: #6 cài hồ sơ (phong cách "thẻ nhân viên"), #7 dọn bộ nhớ AI ("bảng ghim giấy nhớ"),
  #8 5 câu lệnh lõi ("khối màu Thuỵ Sĩ") — Quang muốn mỗi clip một phong cách. Bộ cảnh mới `src/kit.tsx` (k-*, 3 look + 3 cảnh đặc trưng:
  k-split, k-cleanup, k-versions, k-library). Mỗi clip 64–67 s, ~−15,4 LUFS. Kịch bản/treatment: `tips-video/treatments/tuan2-clip-6-7-8.md`;
  bài đăng: `D:\Web\AI workspace\ai-sharing-tips\Bai-tuan2-06-07-08.md`. Số RESULT là dự kiến — chờ Quang bấm giờ thật.
- 2026-10-28 · acc 2 · Giọng mới cho tips-video: VieNeu-TTS "Mai Anh" chạy local, nhanh ×1.08 (Quang chọn sau 2 vòng nghe mẫu;
  đọc đúng từ tiếng Anh, Edge thì không). `tts.mjs` thêm engine VieNeu (kịch bản không ghi `voice` → VieNeu), `vieneu_tts.py` đọc
  từng câu + whisper lấy mốc từng chữ. Thử với kịch bản #5: 9 cảnh / 74 s, đọc ~2,5 phút, render ra MP4 + phụ đề khớp. Đã dọn file thử.
- 2026-10-26 · acc 2 · Video #5 "Bản bàn giao + chat mới" (đen + cam, phụ đề tô từng chữ qua Edge WordBoundary, msedge-tts 2.1.1).

## Đang dở / việc kế tiếp
- Clip #6–#8 đã dựng (28/10), chờ Quang xem + thay số đo thật rồi đăng. Tuần 3 (3–9/11, chống AI bịa) cần 4 clip, mỗi clip một phong cách mới.
- Kiểm trước khi giao: mỗi clip ≥ 60 s (thể lệ 1–3 phút); phông có dấu tiếng Việt (Georgia vỡ dấu → dùng Cambria); Cascadia Mono không có số khoanh tròn ②.
- Quang muốn: lời viết kiểu văn nói, có thể chèn `[cười]`; nhạc nền dùng `"music": "pad"` (tự tổng hợp, không bản quyền).

## Quyết định đã chốt
- Giọng: VieNeu "Mai Anh" ×1.08, temperature 0.6 (28/10). Kịch bản cũ (01–05) giữ `voice` Edge để render lại không đổi giọng.
- Mỗi tuần một bộ hình, mỗi video một hiệu ứng chính; ý tưởng chốt trước khi dựng; không cảnh "dùng AI an toàn" cuối video.

## Kiến thức riêng
- Chạy: `cd tips-video` → `node tts.mjs scripts/<id>.json` → `node render.mjs scripts/<id>.json` → `output/ai-tips/<id>/`.
- VieNeu chạy bằng `py -3.12 -I -S` (tránh lỗi SSL đệ quy khi tải model); model ở `D:\cache\huggingface\hub`; whisper `D:\cache\huggingface\fw-small`.
- Kiến thức chung về giọng / video: skill `giong-noi-ai`, `lam-video-bang-code`.
