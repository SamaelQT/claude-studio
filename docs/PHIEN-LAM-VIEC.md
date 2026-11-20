# PHIEN-LAM-VIEC — claude-studio
Sao lưu việc của các phiên Claude làm trong repo này (quy tắc trong `~/.claude/CLAUDE.md`). Mất phiên → đọc file này rồi làm tiếp.
Nhật ký chung 2 acc: `D:\Claude-chung\nhat-ky\NHAT-KY-CHUNG.md`. Mới nhất ở trên.

## Mục tiêu
Studio làm video bằng code của Quang (repo cá nhân `SamaelQT/claude-studio`). Phần đang chạy nhiều nhất: `tips-video/` — video dọc
"mẹo dùng AI" cho cuộc thi AI Tips (SAP Jam), kế hoạch 6 tuần ở `D:\Web\AI workspace\ai-sharing-tips\KE-HOACH-MEO-AI.md`.

## Nhật ký
- 2026-11-19 · main acc 2 · **QUANG CHỐT cách lấy minh chứng tuần 5: "Claude tự chạy, chụp"** — chạy lại câu lệnh trên claude.ai trong trình duyệt của app, CHỈ dữ liệu mẫu, chụp / quay màn hình; chỉ làm khi Quang ngồi máy, không chạy nền; chưa đăng nhập thì nhờ Quang. Xong gửi Quang bìa + 5 s đầu + 5 s cuối từng clip duyệt trước khi render. Skill: `lam-video-bang-code/references/mo-bai-ket-bai-minh-chung.md` (đã có).
- 2026-11-18 · acc 1 (phiên con) · Tuần 5 LÀM LẠI qua 3 cửa duyệt (Quang chọn tip B/C/D, style 1 "Bản tin sơ đồ", duyệt bìa):
  #18 `18-doan-van-ra-luu-do` (đoạn văn → lưu đồ Mermaid), #19 `19-gop-5-luot-thanh-1-lenh`, #20 `20-ban-mau-giong-cong-ty`.
  Theme mới `bantin` (`tips-video/src/bantin.tsx`, cảnh `n-*`), giọng Quỳnh Anh, ~76–80 s. Nguồn số: thử mù Sonnet 5.5 ở
  `output/ai-tips/_tuan5b-thu`. Mỗi clip có `kiem-so-lieu.md` (có bảng Đo bản nộp) + `bai-dang-sap-jam.md` + `dinh-kem/`.
  Bản #18–#20 cũ (`18-anh-phieu-ra-bang`, `19-so-2-ban-quy-dinh`, `20-che-thong-tin`) vẫn giữ, chờ Quang quyết.
  Bẫy: `tts.mjs` (whisper) chạy song song render / Edge headless → `mkl_malloc` hết RAM; chạy một mình + `HF_HUB_OFFLINE=1`.
- 2026-11-18 · acc 2 · Tuần 5: 3 clip AI Tips #18 chụp phiếu viết tay → bảng, #19 so 2 bản quy định, #20 che thông tin bằng mã
  (dùng lại bộ cảnh `board` tuần 4, giọng Quỳnh Anh, 81–87 s). Số RESULT từ thử mù trên tài liệu mẫu tự làm (`output/ai-tips/_tuan5-thu`),
  mỗi clip có `kiem-so-lieu.md` + `bai-dang-sap-jam.md` + `dinh-kem/`. Quang trả về (18/11): làm lại theo 3 cửa duyệt, chờ Quang chọn ý tưởng.
- 2026-10-29 · acc 2 · Clip #9 (Weekly Challenge #2 — thử tip "đưa schema" của anh Hoàng Mạnh Hùng), phong cách "bản vẽ sơ đồ dữ liệu" (look blueprint + cảnh k-schema). Giọng chuyển sang VieNeu bản mới 3.8.3 (model v4, fp32) ở venv `D:\cache\venv-vieneu4`, mặc định "Ngọc Huyền" (Quang chọn Ngọc Huyền / Hải Đăng). #6–#8 vẫn giọng Mai Anh cũ.
- 2026-10-28 · acc 2 · Dựng 3 clip tuần 2: #6 cài hồ sơ (phong cách "thẻ nhân viên"), #7 dọn bộ nhớ AI ("bảng ghim giấy nhớ"),
  #8 5 câu lệnh lõi ("khối màu Thuỵ Sĩ") — Quang muốn mỗi clip một phong cách. Bộ cảnh mới `src/kit.tsx` (k-*, 3 look + 3 cảnh đặc trưng:
  k-split, k-cleanup, k-versions, k-library). Mỗi clip 64–67 s, ~−15,4 LUFS. Kịch bản/treatment: `tips-video/treatments/tuan2-clip-6-7-8.md`;
  bài đăng: `D:\Web\AI workspace\ai-sharing-tips\Bai-tuan2-06-07-08.md`. Số RESULT là dự kiến — chờ Quang bấm giờ thật.
- 2026-10-28 · acc 2 · Giọng mới cho tips-video: VieNeu-TTS "Mai Anh" chạy local, nhanh ×1.08 (Quang chọn sau 2 vòng nghe mẫu;
  đọc đúng từ tiếng Anh, Edge thì không). `tts.mjs` thêm engine VieNeu (kịch bản không ghi `voice` → VieNeu), `vieneu_tts.py` đọc
  từng câu + whisper lấy mốc từng chữ. Thử với kịch bản #5: 9 cảnh / 74 s, đọc ~2,5 phút, render ra MP4 + phụ đề khớp. Đã dọn file thử.
- 2026-10-26 · acc 2 · Video #5 "Bản bàn giao + chat mới" (đen + cam, phụ đề tô từng chữ qua Edge WordBoundary, msedge-tts 2.1.1).

## Đang dở / việc kế tiếp
- 19/11 (tối): ĐÃ LÀM LẠI 3 kịch bản #18–#20 theo 4 điểm, minh chứng thật chụp từ claude.ai (dữ liệu mẫu) ở `output/ai-tips/<id>/minh-chung/`
  (+ `DO-THAT.md`). Bìa số trước→sau (6 câu→17 ô · 2/7→7/7 · 0/8→8/8), cảnh `n-shot` ảnh thật có khoanh + che tên, kết `n-end` "Lần tới…".
  20/11: Quang cần ngay → giọng làm luôn trên laptop (VieNeu Quỳnh Anh, cấu hình A: t=0.3, đọc từng câu, `HF_HUB_OFFLINE=1`, chạy riêng không song song render)
  → render cả bài: #18 70,2 s · #19 93,5 s · #20 82,0 s, −15,4…−15,6 LUFS, peak ≤ −0,8 dBFS. Đã gửi Quang 3 MP4, **chờ Quang xem / đăng**.
  20/11: Quang duyệt xoá bản #18–#20 cũ (anh-phieu-ra-bang, so-2-ban-quy-dinh, che-thong-tin) → output + public vào Thùng rác, kịch bản git rm (còn trong lịch sử git 5152230).
- Clip #6–#8 đã dựng (28/10), chờ Quang xem + thay số đo thật rồi đăng. Tuần 3 (3–9/11, chống AI bịa) cần 4 clip, mỗi clip một phong cách mới.
- Kiểm trước khi giao: mỗi clip ≥ 60 s (thể lệ 1–3 phút); phông có dấu tiếng Việt (Georgia vỡ dấu → dùng Cambria); Cascadia Mono không có số khoanh tròn ②.
- **Backlog từ mục Đã lưu FB (Quang chốt 12/11/2026, chi tiết `D:\Claude-chung\du-lieu-chung\fb-da-luu\kiem-tung-muc.md` mục 0, 3):**
  lệnh `hoc-phong-cach <3–5 link>` gộp với `nghien-cuu-viral <từ khoá>`: yt-dlp tìm / tải clip YouTube + TikTok (lọc lượt xem, thời lượng) →
  cắt khung + chép lời (faster-whisper) → Claude bóc cấu trúc (móc 3 s đầu, nhịp, CTA, bảng màu, chữ) → ghi `STYLE.md` + kịch bản nháp; storyboard
  duyệt trước khi render. Chỉ học cách dựng, không chép hình / nhạc / lời. Kèm 3 look mới (skill `lam-video-bang-code/references/mau-tham-chieu.md`).
- Quang muốn: lời viết kiểu văn nói, có thể chèn `[cười]`; nhạc nền dùng `"music": "pad"` (tự tổng hợp, không bản quyền).

## Quyết định đã chốt
- Giọng: VieNeu "Mai Anh" ×1.08, temperature 0.6 (28/10). Kịch bản cũ (01–05) giữ `voice` Edge để render lại không đổi giọng.
- Mỗi tuần một bộ hình, mỗi video một hiệu ứng chính; ý tưởng chốt trước khi dựng; không cảnh "dùng AI an toàn" cuối video.
- 18/11: 3 cửa duyệt bắt buộc trước khi dựng — chốt ý tưởng (tip ít người biết) → chốt style mới → chốt ảnh bìa (là khung đầu video).
  Tuần 5 (#18–#20) bị trả về vì dùng lại `board`, chưa duyệt ý tưởng, không có bìa, tip quá phổ thông.

## Kiến thức riêng
- Chạy: `cd tips-video` → `node tts.mjs scripts/<id>.json` → `node render.mjs scripts/<id>.json` → `output/ai-tips/<id>/`.
- VieNeu chạy bằng `py -3.12 -I -S` (tránh lỗi SSL đệ quy khi tải model); model ở `D:\cache\huggingface\hub`; whisper `D:\cache\huggingface\fw-small`.
- Kiến thức chung về giọng / video: skill `giong-noi-ai`, `lam-video-bang-code`.
