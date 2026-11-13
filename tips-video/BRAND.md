# BRAND — kênh "AI Tips" của Quang (đọc TRƯỚC khi viết kịch bản hay dựng bất kỳ video nào)

Quang chốt 13/11/2026 (học từ bài Charlie Hills, mục 21 Đã lưu FB): Claude đọc file quy tắc thương hiệu trước mỗi lần dựng.
"Quang là đầu bếp, AI là phụ bếp": Quang chốt ý tưởng / phong cách / số liệu, Claude dựng và tự soát.
Phần nào lệch file này phải hỏi Quang, hoặc ghi lý do vào kịch bản.

## Người xem và cách nói
- Đồng nghiệp C.P. Vietnam, **phần lớn không phải dân IT**. Mỗi video một vấn đề công việc thật, giải bằng AI, có con số trước / sau.
- Cấu trúc bắt buộc của bài thi: **PROBLEM → AI TIPS → RESULT**, 1–3 phút (**≥ 60 s**), video dọc 1080×1920.
- Lời đọc: câu ngắn, phụ đề ≤ 14 từ, không thuật ngữ IT; bắt buộc dùng từ chuyên môn thì giải nghĩa luôn trong câu.
  Kiểm bằng "người không làm IT nghe 1 lần có hiểu không" (subagent đọc như người ngoài, xem `lam-video-bang-code/references/kich-ban-de-hieu.md`).
- Tác giả hiện trên video: `Quang · IT Application`. Tên loạt: `AI TIPS TUẦN N` (trước đó "Hỏi IT không bằng hỏi AI").

## Giọng
- **VieNeu-TTS chạy local, giọng "Quỳnh Anh", temperature 0.3, không tăng tốc** (config A, Quang chốt tuần 4).
  Kịch bản ghi `"vieneuVoice": "Quỳnh Anh"`. Không dùng lại Edge TTS cho video mới (Quang chê "đọc chả ra đọc").
- Âm lượng: ~−14 đến −15,5 LUFS, true peak ≤ −1 dBTP. Nhạc nền chỉ dùng nhạc có giấy phép (thư mục `nhac/`, mixkit); không dùng `music/` có bản quyền.

## Hai bộ hình đang dùng (mỗi clip MỘT phong cách)
| Bộ | Khi nào | Màu | Phông |
|---|---|---|---|
| `theme` mặc định (`src/theme.ts`) | slide động: chat, bảng Excel, prompt gõ dần | nền `#F4F8F3`/`#E6F1E8`, chữ `#12261A`, xanh lá `#0B8A4A` (đúng / AI), vàng `#FFC83A` (nhấn / ô cần chú ý), đỏ `#E0484C` (lỗi / trước) | Segoe UI |
| `board` — bảng trắng viết tay (`src/board.tsx`, tuần 4) | giải thích quy trình, so sánh trước / sau | nền giấy `#FBFAF5`, mực `#1E2A36`, xanh `#1F5FBF` (ý chính), đỏ `#E0482D` (vấn đề), dạ quang `#FFD43B` (con số) | Segoe Print (chữ tay) + Segoe UI (số) |

- **Một màu nhấn = một nghĩa** trong cả clip; không thêm màu ngoài bảng.
- Phông phải đủ dấu tiếng Việt: Georgia vỡ dấu → dùng Cambria; Cascadia không có số khoanh tròn → viết "#2".
- Chữ chính nằm trong vùng an toàn 900×1400, 40% phía trên; đáy 300 px để trống (thanh nút của app).
- Look khác đã ghi lại để dùng sau: `split-step`, `hinh-hoc-toi-gian`, `hud-du-lieu`, `ban-tin-so-do` (`lam-video-bang-code/references/mau-tham-chieu.md`).

## Ảnh bằng chứng (Quang dặn 10/11)
- Ảnh **nổi bật, làm rõ vấn đề**, người không phải IT nhìn vẫn hiểu. Không ảnh dày chữ, code, SQL. Cắt sát vùng cần nói, một ảnh một ý.
- Ảnh từ việc thật thì **che** tên người, nội dung họp, số liệu nhạy cảm trước khi dựng (hỏi Quang khi không chắc che tới đâu).

## Bắt buộc trước khi render bản cuối: kiểm số liệu + chữ trên hình
1. Lập bảng **mọi con số / khẳng định** trong lời đọc và trên hình. Mỗi số ghi nguồn (file, ảnh, phép tính) và đối chiếu lại với nguồn.
2. Số xuất hiện ở nhiều nơi (lời đọc, thẻ số, cột, ảnh) phải **khớp nhau**. Bài học #17 tuần 4: lời nói 16 việc, cột đỏ chỉ có 15.
3. Đọc lại **mọi chữ trên khung tĩnh** (`render.mjs --still`): chính tả, dấu, tên riêng, đơn vị (giờ / ngày / triệu).
4. Số chưa kiểm được thì bỏ, hoặc ghi rõ "ước tính", không để số đẹp mà sai.
5. Ghi kết quả kiểm vào thư mục output của video (`kiem-so-lieu.md`) rồi mới render MP4.

## Trước khi gửi Quang
Đủ checklist ở `lam-video-bang-code/references/phong-cach-tuan4.md` (khung tĩnh 3 mốc / cảnh, ảnh ghép 360 px xem trên điện thoại, đo thời lượng + LUFS,
một phiên sạch chấm khung) **+ bảng kiểm số liệu ở trên**.
