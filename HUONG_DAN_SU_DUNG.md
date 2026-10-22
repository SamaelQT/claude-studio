# Hướng dẫn sử dụng Claude Content Studio
> Dành cho Samael hoặc Claude instance hỗ trợ Samael.
> App chạy tại: http://localhost:3000 (sau khi `npm run dev`)

---

## APP LÀM GÌ

Tự động tạo video YouTube từ đầu đến cuối:
1. Bạn nhập chủ đề → AI tạo kịch bản JSON
2. Bạn xem/sửa kịch bản → nhấn Chạy
3. App tự tạo ảnh (Fal.ai) + giọng đọc (FPT AI) + ghép video (FFmpeg)
4. Tải xuống file `.mp4`

---

## BƯỚC 1 — CHỌN KÊNH

Có 3 kênh mặc định + kênh tự tạo:

| Kênh | Dùng khi | Voice | Format |
|------|---------|-------|--------|
| 💀 **Wansee** | Clone horror animation kiểu Wansee Entertainment | `leminh` giọng Bắc nam, chậm ám ảnh | YouTube |
| 🌙 **Hướng Nội** | Webtoon slice-of-life người hướng nội | Không voice — chữ overlay trên ảnh | YouTube + Shorts |
| 🧠 **Tâm Lý Trẻ** | Clone Psych2Go — "X dấu hiệu bạn là..." | `banmai` giọng Bắc nữ, thân mật | YouTube + Shorts |
| ✨ **Kênh tự tạo** | Thể loại khác (drama, ASMR, giấc mơ...) | Tùy cấu hình | Tùy cấu hình |

**Tạo kênh mới:** Nút `+ Kênh mới` → điền tên, icon, màu sắc, mô tả thể loại → lưu. Kênh sẽ xuất hiện ngay trên thanh tab.

---

## BƯỚC 2 — CHỌN STYLE

Mỗi kênh có vài style ảnh khác nhau (ví dụ Wansee có `manga-horror`, `webtoon-horror`, `psychological`). Click vào card style để chọn. Nút **Preview** để xem thử ảnh mẫu của style đó (mất ~10-20s, tốn credit Fal.ai).

---

## BƯỚC 3 — NHẬP CHỦ ĐỀ + TẠO KỊCH BẢN

**Nhập chủ đề** vào ô "Chủ đề / Ý tưởng", ví dụ:
- Wansee: `"Tôi làm thêm giờ một mình trong toà nhà cũ vào ban đêm"`
- Hướng Nội: `"Khi phải tham dự tiệc sinh nhật mà không muốn đi"`
- Tâm Lý Trẻ: `"7 dấu hiệu bạn là người hướng nội thực sự"`
- Kênh tự tạo (VIRUS): `"Giấc mơ về virus làm con người mất lý trí — Tập 1"`

**Tùy chọn — URL tham khảo:** Paste link YouTube của video gốc muốn clone. App lấy transcript → AI chỉ học tone/nhịp kể, KHÔNG copy nội dung.

Nhấn **✦ Tạo kịch bản** → đợi 10-30s → JSON hiện ra trong ô bên dưới.

---

## BƯỚC 4 — XEM VÀ SỬA KỊCH BẢN

JSON script hiện ra trong textarea. Bạn có thể sửa trực tiếp trước khi chạy.

**Cấu trúc JSON:**
```json
{
  "project_name": "ten_khong_dau_gach_duoi",
  "channel": "wansee",
  "style_id": "manga-horror",
  "character_sheet": "mô tả nhân vật để giữ visual nhất quán",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "mô tả ảnh bằng tiếng Anh, chi tiết",
      "voice_text": "lời đọc tiếng Việt cho scene này",
      "main_text": "chữ overlay lớn (optional)",
      "punchline": "chữ nhỏ bên dưới (optional)",
      "duration": 6
    }
  ],
  "formats": ["youtube", "shorts"]
}
```

**Lưu ý khi sửa tay:**
- `project_name`: chỉ dùng `a-z`, `0-9`, `_` — không dấu, không khoảng trắng
- `image_prompt`: viết tiếng Anh, càng chi tiết càng tốt
- `voice_text`: để trống nếu không cần giọng đọc (kênh Hướng Nội)
- `duration`: số giây hiển thị scene (chỉ dùng khi không có voice)
- `formats`: chọn `["youtube"]`, `["shorts"]`, hoặc `["youtube", "shorts"]`

---

## BƯỚC 5 — NHẠC NỀN (tùy chọn)

Upload file nhạc (mp3/wav) → chọn **Sync mode**:

| Mode | Khi nào dùng |
|------|-------------|
| **⏱ Fill** | Nhạc tự kéo dài đều đặn theo độ dài video. Đơn giản nhất. |
| **📝 Lyric** | Paste LRC hoặc timestamp thủ công → scene đổi theo lời bài hát |
| **🥁 Beat** | App tự phân tích beat nhạc → scene đổi theo nhịp |
| **🤖 Whisper** | App nhận diện lời hát bằng AI → dùng lời làm sync point |

Sau khi upload: nếu dùng Fill thì không cần làm gì thêm. Nếu dùng Lyric/Beat/Whisper → nhấn **🔍 Phân tích nhạc** trước.

---

## BƯỚC 6 — CHỌN FORMAT VÀ CHẠY

**Format** (tích chọn một hoặc nhiều):
- ▶ **YouTube** — 1920×1080, landscape
- 📱 **Shorts** — 1080×1920, dọc, ảnh có blur background
- 🎵 **TikTok** — như Shorts nhưng chỉ lấy 3 scene đầu

Nhấn **▶ Chạy** → theo dõi tiến độ ở cột phải:
- Ô scene xanh = ảnh xong ✓
- Ô scene đỏ = ảnh lỗi ✗
- ⚠ = voice lỗi, dùng silent thay thế
- Log bên dưới hiện chi tiết từng bước

Nhấn **⏹ Dừng** để cancel giữa chừng. File đã tạo sẽ được giữ lại (cache).

---

## BƯỚC 7 — TẢI VIDEO

Khi xong, xuất hiện panel **✅ Output**:
- Path file đầy đủ
- Nút **⬇ Tải xuống** cho từng format

File lưu tại: `output/{channel}/{project_name}/`

---

## QUẢN LÝ IMAGE PROVIDER

Panel **🔌 Image Provider** (cột phải dưới cùng):

| Provider | Chất lượng | Chi phí |
|---------|-----------|--------|
| 🤖 **Auto** (khuyến nghị) | Tự động fallback | — |
| **Fal.ai** FLUX/dev | S — tốt nhất | Trả phí theo usage |
| **Pollinations.ai** | A — tốt | Miễn phí, không giới hạn |
| **HuggingFace** | B | Miễn phí, có giới hạn |
| **Cloudflare AI** | B | Miễn phí 10,000 neurons/ngày |

**Khi nào chọn thủ công:** Fal.ai hết tiền → chọn Pollinations để tiết kiệm. Muốn test nhanh → chọn Pollinations. Muốn chất lượng tốt nhất → chọn Fal.ai.

Số dư Fal.ai và neurons Cloudflare hiện ngay trên topbar.

---

## CACHE — TÁI SỬ DỤNG

App **không tạo lại** file đã có. Nếu muốn regenerate:
- Xóa file ảnh trong `output/{channel}/{project_name}/images/`
- Xóa file voice trong `output/{channel}/{project_name}/voices/`
- Xóa file video để ghép lại

Lợi dụng cache: chỉnh sửa 1-2 scene trong JSON → chạy lại → chỉ scene mới sẽ được tạo.

---

## TẠO KÊNH TÙY CHỈNH (ví dụ: VIRUS)

1. Nhấn `+ Kênh mới`
2. Điền:
   - **Tên kênh:** `VIRUS — Giấc Mơ Có Thật`
   - **Icon:** `🦠`
   - **Màu:** chọn tối (ví dụ `#1a1a2e`)
   - **Có giọng đọc:** ✓ (series VIRUS có voice narration)
   - **Mô tả thể loại:** *(xem bên dưới)*
3. Nhấn Lưu

**Mô tả thể loại cho VIRUS:**
```
Series dream narrative tiếng Việt. Người kể chuyện (Samael) đang kể lại giấc mơ có thật của mình.
Style ảnh: cinematic dark realism, first-person POV (camera = mắt nhân vật), không thấy mặt người rõ, ánh sáng đơn nguồn tối tăm, màu desaturated lạnh.
Giọng kể: ngôi thứ nhất, thủ thỉ chậm rãi, mô tả giác quan cụ thể (mùi, xúc giác, nhiệt độ), dùng "..." ngắt nhịp.
Số scene: 15-20. Kết mỗi tập: màn hình tối dần, gợi ý người xem nhắm mắt tưởng tượng.
Không cartoon, không anime, không vẽ tay, không mặt người rõ.
```

Sau khi tạo kênh → thêm `character_sheet` vào JSON tay:
```json
"character_sheet": "Camera = mắt Samael. Không bao giờ thấy mặt anh. Tay xuất hiện trong frame khi cần: tay nam, áo polo navy. Bối cảnh: farm tôm miền Tây, hành lang tối, phòng bị nhốt."
```

---

## JSON MẪU — KÊNH VIRUS TẬP 1

```json
{
  "project_name": "virus_tap_1_diem_bao",
  "channel": "virus",
  "style_id": "default",
  "character_sheet": "Camera = mắt Samael. Không bao giờ thấy mặt. Tay nam trong frame khi cần, áo polo navy. Farm tôm miền Tây, đêm tối, ánh đèn đường xa.",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "cinematic dark, first-person POV standing on farm road at dusk, shrimp ponds both sides, humid air, distant single fluorescent light, no people visible, desaturated teal-green, heavy atmosphere",
      "voice_text": "Lần đầu tôi xuống chi nhánh Cà Mau là vào mùa mưa. Cái nóng dưới đó khác — không phải nóng thẳng, mà là nóng ẩm, bám chặt vào da.",
      "duration": 8
    },
    {
      "n": 2,
      "image_prompt": "cinematic dark, first-person POV inside farm office, fluorescent light flickering, workers at desks not looking up, backs turned or faces obscured, cold blue-grey tones, papers scattered",
      "voice_text": "Mọi người lần này khác. Bình thường họ hay hỏi thăm, mời cơm. Lần này... im lặng. Mắt không nhìn tôi.",
      "duration": 7
    }
  ],
  "formats": ["youtube"]
}
```

---

## LỖI THƯỜNG GẶP

| Lỗi | Nguyên nhân | Xử lý |
|-----|-----------|-------|
| Ảnh lỗi đỏ, log "Tất cả providers thất bại" | Fal.ai hết tiền, HF/CF hết quota | Chuyển sang Pollinations ở panel Provider |
| Voice lỗi ⚠ nhưng video vẫn tạo | FPT AI timeout | Scene đó dùng silent — có thể chạy lại riêng scene đó |
| JSON không hợp lệ | AI tạo kịch bản bị lỗi format | Xóa text thừa trước `{` và sau `}` trong textarea |
| Video không có chữ overlay | `main_text` bị bỏ qua | Kiểm tra JSON có field `main_text` không, font path `C:/Windows/Fonts/Arial.ttf` phải tồn tại |
| Shorts chữ nhỏ | Lỗi cũ — đã fix | Cập nhật code mới nhất từ GitHub |

---

## PHÍM TẮT WORKFLOW

```
Chủ đề → Enter         Tạo kịch bản ngay (không cần click nút)
JSON sửa xong → Chạy   Không cần generate lại từ đầu
Dừng giữa chừng        ⏹ Dừng → file đã tạo được giữ nguyên → chạy lại sẽ bỏ qua cache
```
