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
**Chủ yếu KHÔNG phải chat UI** — là pipeline tạo video: JSON script → ảnh → voice → ghép video ffmpeg.
Có thêm 1 trang chat phụ (`/chat`) chạy agent tool-use tự động cho use case "clone video" (xem mục CHAT AGENT bên dưới).

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
| **YouTube Data API** | Lấy transcript/mô tả video tham khảo (chat agent + nút "URL tham khảo") | `YOUTUBE_API_KEY` |
| **ffmpeg-static** | Ghép video local | *(bundled)* |

---

## KÊNH TUỲ CHỈNH (ngoài 3 kênh mặc định)

Nút "+ Kênh mới" trên UI cho tạo thêm kênh động, lưu ở `data/channels.json` (không phải hardcode trong `page.tsx`):
- Mỗi kênh custom có: `name`, `icon`, `accent`, `genreDescription` (mô tả thể loại/phong cách — dùng để build prompt AI), `hasVoice`, `sceneCountHint`, `formats`.
- Tạo kênh → tự động tạo `styles/{id}/default.json` (1 style DNA cơ bản từ `genreDescription`).
- `generateScript()` trong `page.tsx` dùng `buildCustomPrompt()` (generic) cho các kênh này, khác với 3 hàm build riêng của Wansee/Hướng Nội/Psych2Go.
- `has_voice` được nhúng vào JSON script (`ScriptJSON.has_voice`) — `runner-types.ts` đọc field này để quyết định có tạo voice hay không (thay vì chỉ check `channel === "huong-noi"` như cũ).
- Xoá kênh: 3 kênh mặc định (`wansee`, `huong-noi`, `psych2go`) KHÔNG thể xoá (chặn ở API). Xoá kênh custom chỉ xoá config + folder `styles/{id}/`, KHÔNG xoá video đã tạo trong `output/{id}/`.
- UI xác nhận xoá dùng state 2-bước trong app (✕ → ✓/✕), KHÔNG dùng `window.confirm()` — dialog native từng làm treo tab khi test tự động.

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
  chat/page.tsx          ← UI chat phụ — gọi agent tool-use qua /api/chat (xem CHAT AGENT)
  api/
    tools/route.ts      ← Gateway tất cả tool calls từ client
    chat/route.ts        ← Server-side agent loop (giữ ANTHROPIC_API_KEY), stream NDJSON cho /chat
    channels/route.ts    ← CRUD kênh tuỳ chỉnh (data/channels.json) — GET/POST/DELETE
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
    browser-agent.ts    ← Client transport: POST /api/chat, đọc NDJSON stream → onEvent
    tools-definition.ts ← Tool schema dùng chung cho agent chat (Anthropic.Tool[])
  tools/
    image.ts            ← generateImage() — 4 providers, auto fallback
    voice.ts            ← generateVoice() + preprocessText() — FPT AI TTS
    video.ts            ← assembleVideo() — ffmpeg, hỗ trợ youtube/shorts/tiktok
    motion.ts           ← buildSceneVideoFilter() — chuyển động CAMERA trên ảnh tĩnh (ffmpeg zoompan)
    animate.ts          ← animateScene() — chuyển động NHÂN VẬT (i2v qua ComfyUI/Fal)
    videoclip.ts        ← generateVideoClip() — Fal.ai Wan image-to-video
    music-sync.ts       ← parseLyricSync(), detectBeatSync(), detectWhisperSync()
    transcript.ts        ← getYoutubeTranscript() — cần YOUTUBE_API_KEY, fallback title+description

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

## CHUYỂN ĐỘNG — 2 TẦNG, ĐỪNG NHẦM

| | `motion.ts` | `animate.ts` |
|---|---|---|
| Làm gì | di chuyển khung hình trên ảnh chết (Ken Burns) | sinh lại từng khung hình |
| Nhân vật cử động? | **KHÔNG** | **CÓ** |
| Cần GPU | không | có (ComfyUI) |
| Trạng thái | xong, đã test bằng ffmpeg thật | code xong, chờ GPU test thật |

Cả hai đọc chung field `motion` trong mỗi scene (`SceneMotion`: `type`, `intensity`, `anchor`, `shake`).
AI tự sinh field này khi viết kịch bản — xem `motionSection()` trong `app/page.tsx`, đó là tầng
"đạo diễn": nó chọn chuyển động theo Ý NGHĨA của lời thoại chứ không ngẫu nhiên.

**Quy tắc bất biến:**
1. Scene không có `motion` → render y hệt hành vi cũ. Không được phá video đã có.
2. `animateScene()` KHÔNG BAO GIỜ ném lỗi lên trên — mọi thất bại trả `null` và scene
   rơi về ảnh tĩnh + Ken Burns. Bật `animate: true` khi chưa có ComfyUI là vô hại.
3. Scene đã có clip i2v thì KHÔNG áp Ken Burns nữa (`isClip` trong `createSceneClip`) —
   nếu không sẽ chồng 2 lớp chuyển động.
4. Mọi clip phải xuất `-r 30`. `concatClips()` dùng `-c copy`, lệch fps là hỏng ghép.

Dựng ComfyUI trên PC có GPU: xem [ANIMATE_SETUP.md](ANIMATE_SETUP.md).

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
HF_TOKEN=...          # optional fallback
CF_ACCOUNT_ID=...     # optional fallback
CF_API_TOKEN=...      # optional fallback
YOUTUBE_API_KEY=...   # optional — cần cho tính năng "URL tham khảo" + chat agent clone video
```

---

## CHAT AGENT (`/chat`) — "clone video"

Trang phụ dùng agent tool-use (Claude + `get_youtube_transcript` + các tool tạo ảnh/voice/video) để tự động hoá quy trình "làm video kiểu Wansee lấy cảm hứng từ video X".

**QUAN TRỌNG — ranh giới bản quyền (đã cố ý thiết kế lại so với bản gốc):**
- `get_youtube_transcript` chỉ được dùng để bắt **tone/nhịp kể/format**, KHÔNG bao giờ để dịch nguyên văn hay giữ nguyên plot/tình tiết của video gốc.
- System prompt trong `app/api/chat/route.ts` bắt buộc AI tự sáng tác plot, nhân vật, tình huống hoàn toàn mới — chỉ giữ chung thể loại horror + văn phong.
- Nút "URL YouTube tham khảo" trong pipeline JSON chính (`app/page.tsx`) hoạt động theo nguyên tắc tương tự — transcript được nhét vào prompt kèm cảnh báo rõ ràng không được sao chép plot.
- KHÔNG nới lỏng ràng buộc này khi sửa prompt — đây là để tránh Content ID / copyright strike cho kênh, không phải giới hạn kỹ thuật.

**Kiến trúc:** `ANTHROPIC_API_KEY` chỉ nằm server-side trong `app/api/chat/route.ts` (không expose ra client như bản gốc dùng `NEXT_PUBLIC_ANTHROPIC_API_KEY`). Route stream kết quả dạng NDJSON; `lib/agent/browser-agent.ts` chỉ là transport đọc stream, không gọi Anthropic trực tiếp.
