<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Claude Content Studio — Project Guide

> Đọc toàn bộ section này trước khi làm bất cứ điều gì. Không đoán mò.

---

## DỰ ÁN LÀ GÌ

Next.js 15 localhost app (App Router, TypeScript) để tự động tạo video YouTube.
**Không phải chat UI** — là pipeline tạo video: JSON script → ảnh → voice → ghép video ffmpeg.

**Owner:** Samael QT (Hồ Hữu Quang) — IT tại Đồng Nai, VN.
**Ngân sách:** Âm — **KHÔNG thêm bất kỳ service trả phí nào**. Chỉ dùng những gì đã có.

---

## STACK & APIs (FREE/PREPAID — KHÔNG thêm mới)

| Service | Dùng cho | Env var |
|---------|---------|---------|
| **Anthropic Claude** | Tạo kịch bản JSON | `ANTHROPIC_API_KEY` |
| **Fal.ai** FLUX/dev | Generate ảnh (chất lượng cao) | `FAL_KEY` |
| **Pollinations.ai** | Fallback ảnh — free unlimited | *(không cần key)* |
| **HuggingFace** | Fallback ảnh | `HF_TOKEN` |
| **Cloudflare AI** | Fallback ảnh | `CF_ACCOUNT_ID`, `CF_API_TOKEN` |
| **FPT.AI TTS v5** | Text-to-speech tiếng Việt | `FPT_API_KEY` |
| **ffmpeg-static** | Ghép video local | *(bundled)* |

---

## 3 CHANNELS

### Wansee (`id: "wansee"`, `#c0392b` đỏ, icon 💀)
Clone Wansee Entertainment — horror animation YouTube.
- Style: Junji Ito manga, black & white ink, **bắt buộc có chi tiết SAI ẩn** trong image_prompt
- Voice: `leminh` speed `-2` (giọng nam Bắc, chậm ám ảnh)
- 20-22 scenes, format: `["youtube"]`
- Có `character_sheet` để giữ visual consistency

### Hướng Nội (`id: "huong-noi"`, `#4a7fb5` xanh, icon 🌙)
Clone introvert slice-of-life channels (Korean webtoon style).
- **KHÔNG có voice** — dùng `main_text` + `punchline` text overlay
- Style: flat 2D webtoon, soft linework, muted palette
- 12-15 scenes, duration 4-8s/scene, format: `["youtube", "shorts"]`
- 3 styles: `soft-light` / `night-city` / `quiet-room`

### Tâm Lý Trẻ (`id: "psych2go"`, `#8a4bc7` tím, icon 🧠)
Clone Psych2Go (13M subs) — psychology explainer animation.
- Format: "X dấu hiệu bạn là người hướng nội..."
- **CÓ voice** + `main_text`: `banmai` AceSound speed `0`
- 8-12 scenes, format: `["youtube", "shorts"]`
- 2 styles: `webtoon-explainer` / `motion-graphic`

---

## ARCHITECTURE

```
User nhập topic → generateScript() → /api/tools {generate_script} → Claude API tạo JSON
→ User xem/sửa JSON script trong textarea
→ handleRun() → runFromJSON() [lib/agent/runner-types.ts — client-safe]
    Concurrency=3 per batch:
    → /api/tools {generate_image} → executor → generateImage() (auto fallback providers)
    → /api/tools {generate_voice} → executor → generateVoice() [nếu có voice_text]
→ /api/tools {assemble_video} → executor → assembleVideo() → ffmpeg
→ Output: {project_name}_youtube.mp4, {project_name}_shorts.mp4
```

---

## CẤU TRÚC FILE QUAN TRỌNG

```
app/
  page.tsx              ← UI chính — CSS-in-JS (KHÔNG dùng Tailwind), 3 channel
  api/
    tools/route.ts      ← Gateway tất cả tool calls từ client
    styles/route.ts     ← CRUD style DNA JSON files
    providers/route.ts  ← Image provider list + balance check
    music/route.ts      ← Upload nhạc nền
    music-analyze/      ← Sync nhạc: fill/lyric/beat/whisper modes
    file/route.ts       ← Serve local output files để download

lib/
  agent/
    runner-types.ts     ← Types + runFromJSON() — import ở CLIENT (không dùng fs/path)
    executor.ts         ← Server-side: thực thi từng tool
    json-runner.ts      ← listStyles(), loadStyle() — server only
  tools/
    image.ts            ← generateImage() — 4 providers, auto fallback
    voice.ts            ← generateVoice() + preprocessText() — FPT AI TTS
    video.ts            ← assembleVideo() — ffmpeg, hỗ trợ youtube/shorts/tiktok
    videoclip.ts        ← generateVideoClip() — Fal.ai Wan image-to-video
    music-sync.ts       ← parseLyricSync(), detectBeatSync(), detectWhisperSync()

styles/
  wansee/               ← Style DNA JSON per channel
  huong-noi/
  psych2go/
```

---

## SCRIPT JSON FORMAT

**Wansee** (voice, 20-22 scenes):
```json
{
  "project_name": "ten_a_z_0_9",
  "channel": "wansee",
  "style_id": "manga-horror",
  "character_sheet": "mô tả nhân vật giữ visual consistency",
  "scenes": [{ "n": 1, "image_prompt": "cảnh + CHI TIẾT SAI ẩn", "voice_text": "60-80 chữ..." }],
  "formats": ["youtube"]
}
```

**Hướng Nội** (no voice, 12-15 scenes):
```json
{
  "project_name": "ten_a_z_0_9",
  "channel": "huong-noi",
  "style_id": "soft-light",
  "scenes": [{ "n": 1, "image_prompt": "...", "main_text": "5-12 chữ", "punchline": "optional", "duration": 6 }],
  "formats": ["youtube", "shorts"]
}
```

**Tâm Lý Trẻ** (voice + text, 8-12 scenes):
```json
{
  "project_name": "ten_a_z_0_9",
  "channel": "psych2go",
  "style_id": "webtoon-explainer",
  "scenes": [{ "n": 1, "image_prompt": "...", "voice_text": "25-40 chữ", "main_text": "3-6 chữ", "duration": 5 }],
  "formats": ["youtube", "shorts"]
}
```

---

## OUTPUT

```
output/{channel}/{project_name}/
  images/{project_name}__scene_01.png
  voices/{project_name}__voice_01.mp3
  {project_name}_youtube.mp4
  {project_name}_shorts.mp4
```

**Cache logic:** File đã có → skip regenerate. Xóa file trong output/ để re-gen.

---

## VOICE (FPT AI TTS v5)

```
banmai   — nữ Bắc, AceSound (chất lượng cao) ← DÙNG cho huong-noi + psych2go
thuminh  — nữ Bắc, AceSound, giọng MC
leminh   — nam Bắc ← wansee/horror
lannhi   — nữ Nam (cũ, chất lượng thấp)
giahuy   — nam Trung ← gaming
myan     — nữ Trung
linhsan  — nữ Nam
Speed: -3 chậm nhất → 0 bình thường → +3 nhanh nhất
```

---

## LƯU Ý KỸ THUẬT (QUAN TRỌNG)

1. **Formats UI override JSON**: Nút YouTube/Shorts trong UI áp vào `script.formats` trước khi chạy — JSON formats bị ignore.
2. **Shorts font size**: Detect bằng `h >= 1920` (không phải `w`) → mainText=80px, punchline=54px.
3. **Text readability**: Tất cả text overlay có `box=1:boxcolor=black@0.55` nền mờ.
4. **huong-noi = no voice**: `isNoVoice = channel === "huong-noi"` trong runner-types.ts.
5. **Fonts hardcoded Windows**: `C:/Windows/Fonts/Arial.ttf` — chỉ chạy trên Windows.
6. **NODE_TLS_REJECT_UNAUTHORIZED=0**: trong `.env.local` — bỏ SSL check cho Tavily.
7. **Music sync**: upload nhạc → chọn fill/lyric/beat/whisper → scenes tự adjust duration theo nhạc.
8. **Psych2Go clone**: channel `psych2go` có cả voice_text lẫn main_text — runner tự xử lý cả 2.

---

## CHẠY APP

```bash
cd D:\Web\claude-studio
npm run dev
# → http://localhost:3000
```

`.env.local` cần có:
```env
ANTHROPIC_API_KEY=...
FAL_KEY=...
FPT_API_KEY=...
NODE_TLS_REJECT_UNAUTHORIZED=0
HF_TOKEN=...       # optional fallback
CF_ACCOUNT_ID=...  # optional fallback
CF_API_TOKEN=...   # optional fallback
```
