# PHIEN-LAM-VIEC — claude-studio
Sao lưu việc của các phiên Claude làm trong repo này (quy tắc trong `~/.claude/CLAUDE.md`). Mất phiên → đọc file này rồi làm tiếp.
Nhật ký chung 2 acc: `D:\Claude-chung\nhat-ky\NHAT-KY-CHUNG.md`. Mới nhất ở trên.

## Mục tiêu
Studio làm video bằng code của Quang (repo cá nhân `SamaelQT/claude-studio`). Phần đang chạy nhiều nhất: `tips-video/` — video dọc
"mẹo dùng AI" cho cuộc thi AI Tips (SAP Jam), kế hoạch 6 tuần ở `D:\Web\AI workspace\ai-sharing-tips\KE-HOACH-MEO-AI.md`.

## Nhật ký
- 2026-10-28 · acc 2 · Giọng mới cho tips-video: VieNeu-TTS "Mai Anh" chạy local, nhanh ×1.08 (Quang chọn sau 2 vòng nghe mẫu;
  đọc đúng từ tiếng Anh, Edge thì không). `tts.mjs` thêm engine VieNeu (kịch bản không ghi `voice` → VieNeu), `vieneu_tts.py` đọc
  từng câu + whisper lấy mốc từng chữ. Thử với kịch bản #5: 9 cảnh / 74 s, đọc ~2,5 phút, render ra MP4 + phụ đề khớp. Đã dọn file thử.
- 2026-10-26 · acc 2 · Video #5 "Bản bàn giao + chat mới" (đen + cam, phụ đề tô từng chữ qua Edge WordBoundary, msedge-tts 2.1.1).

## Đang dở / việc kế tiếp
- Video tuần 2 còn #6 (cài hồ sơ), #7 (dọn bộ nhớ AI), #8 (thư viện câu lệnh) — Quang chọn đề tài, duyệt kịch bản rồi mới dựng.
- Quang muốn: lời viết kiểu văn nói, có thể chèn `[cười]`; nhạc nền dùng `"music": "pad"` (tự tổng hợp, không bản quyền).

## Quyết định đã chốt
- Giọng: VieNeu "Mai Anh" ×1.08, temperature 0.6 (28/10). Kịch bản cũ (01–05) giữ `voice` Edge để render lại không đổi giọng.
- Mỗi tuần một bộ hình, mỗi video một hiệu ứng chính; ý tưởng chốt trước khi dựng; không cảnh "dùng AI an toàn" cuối video.

## Kiến thức riêng
- Chạy: `cd tips-video` → `node tts.mjs scripts/<id>.json` → `node render.mjs scripts/<id>.json` → `output/ai-tips/<id>/`.
- VieNeu chạy bằng `py -3.12 -I -S` (tránh lỗi SSL đệ quy khi tải model); model ở `D:\cache\huggingface\hub`; whisper `D:\cache\huggingface\fw-small`.
- Kiến thức chung về giọng / video: skill `giong-noi-ai`, `lam-video-bang-code`.
