"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { runFromJSON, ScriptJSON, RunEvent, MusicConfig, StyleDNA, SpeakerDef } from "@/lib/agent/runner-types";

// Trích video ID từ URL YouTube (watch?v=, youtu.be/, /shorts/, /embed/)
function extractVideoId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Channel = { id: string; name: string; accent: string; icon: string };
type CustomChannel = Channel & {
  genreDescription: string;
  hasVoice: boolean;
  sceneCountHint: string;
  formats: string[];
  createdAt: number;
};
type SceneState = { n: number; img: "idle"|"ok"|"err"; voice: "idle"|"ok"|"err"|"skip"|"silent" };
type ProviderInfo = {
  key: string; name: string; model: string; quality: string;
  free: boolean; unlimited?: boolean; hasKey?: boolean;
  balance?: number | null; balanceLabel?: string | null;
  quota?: { used: number; limit: number; pct: number; resetIn: string } | null;
  status: { ok: boolean; lastError?: string };
};
type SyncMode = "fill" | "lyric" | "beat" | "whisper";
type VoiceOption = {
  id: string; name: string; gender: string; region: string; premium: boolean;
  note: string; provider: "fpt" | "edge" | "vieneu"; limited: boolean;
};

const BUILTIN_CHANNELS: Channel[] = [
  { id: "wansee",    name: "Wansee",      accent: "#d0453a", icon: "💀" },
  { id: "huong-noi", name: "Hướng Nội",  accent: "#5b8fd0", icon: "🌙" },
  { id: "psych2go",  name: "Tâm Lý Trẻ", accent: "#9a5fd6", icon: "🧠" },
];

const ACCENT_PRESETS = ["#e67e22", "#16a085", "#2980b9", "#c0392b", "#8e44ad", "#f39c12"];

// ── Design tokens ─────────────────────────────────────────────────────────────
// Neutral lệch xanh nhẹ — chọn có chủ đích, không phải xám mặc định
const T = {
  bg:       "#0b0c10",
  surface:  "#111318",
  raised:   "#171a21",
  sunken:   "#0c0e12",
  line:     "#232733",
  lineSoft: "#1a1d26",
  hi:       "#eef1f7",
  text:     "#c5ccd9",
  dim:      "#8790a1",
  faint:    "#59616f",
  ok:       "#3fb950",
  warn:     "#d29922",
  err:      "#f85149",
};

const MONO = `"SF Mono", SFMono-Regular, ui-monospace, Consolas, "Liberation Mono", monospace`;
const UI = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

const sx = {
  input: {
    background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 6,
    color: T.hi, padding: "9px 12px", fontSize: 13, width: "100%",
    outline: "none", boxSizing: "border-box", fontFamily: UI,
  } as React.CSSProperties,
  label: {
    fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase",
    letterSpacing: "0.1em", marginBottom: 7, display: "block",
  } as React.CSSProperties,
  chip: (active: boolean, accent: string): React.CSSProperties => ({
    background: active ? accent : "transparent",
    border: `1px solid ${active ? accent : T.line}`,
    color: active ? "#fff" : T.dim,
    borderRadius: 5, padding: "6px 12px", fontSize: 12,
    fontWeight: active ? 700 : 500, cursor: "pointer",
    transition: "all .14s", fontFamily: UI, whiteSpace: "nowrap",
  }),
};

// ── Prompt builders (giữ nguyên logic) ────────────────────────────────────────
function referenceSection(referenceContext?: string): string {
  if (!referenceContext) return "";
  return `

## THAM KHẢO TONE (từ video gốc — KHÔNG dịch nguyên văn, KHÔNG giữ plot/tình tiết cụ thể)
Chỉ dùng đoạn dưới đây để cảm nhận tone kể chuyện, nhịp câu, độ dài, kiểu hook mở đầu.
Câu chuyện bạn viết PHẢI là plot hoàn toàn mới, nhân vật mới, tình huống mới — chỉ giữ chung không khí/thể loại.
"""
${referenceContext.slice(0, 3000)}
"""`;
}

// ── Motion director ───────────────────────────────────────────────────────────
// Dạy AI chọn chuyển động camera theo Ý NGHĨA của scene chứ không ngẫu nhiên.
// Đây là tầng "đạo diễn" của pipeline — thực thi hoàn toàn bằng ffmpeg, không tốn API.
// Luật viết image_prompt — áp cho MỌI kênh.
// Quan trọng vì runner đã đảo thứ tự: image_prompt giờ đứng ĐẦU prompt gửi cho FLUX,
// nên chất lượng câu mô tả này quyết định ảnh có bám kịch bản hay không.
function imagePromptRules(): string {
  return `

## CÁCH VIẾT "image_prompt" (quyết định ảnh có đúng cảnh hay không)

VIẾT BẰNG TIẾNG ANH. Mỗi image_prompt là MỘT câu tả cảnh, 25-45 từ, theo đúng thứ tự:
1. Cỡ cảnh + chủ thể — mở đầu bằng: "wide shot of…", "medium shot of…", "close-up of…",
   "extreme close-up of…", "over-the-shoulder shot of…", "low angle shot of…"
2. Chủ thể đang LÀM GÌ (hành động cụ thể, không phải trạng thái mơ hồ)
3. Nguồn sáng + hướng sáng: "lit only by a desk lamp from the left",
   "backlit by a doorway", "single fluorescent tube overhead"
4. 1-2 đồ vật cụ thể trong khung giúp nhận ra bối cảnh
5. Không khí chung bằng 2-3 từ

KHÔNG ĐƯỢC:
- KHÔNG nhắc lại từ khóa phong cách (art style, màu sắc chủ đạo, tên hoạ sĩ, "cinematic",
  "digital painting"…). Hệ thống TỰ ĐỘNG nối phần phong cách vào sau — bạn viết lại là
  thừa và làm loãng phần mô tả cảnh.
- KHÔNG viết chữ/text/logo/watermark xuất hiện trong ảnh (model vẽ chữ rất xấu).
- KHÔNG viết mơ hồ kiểu "a scary scene", "beautiful atmosphere", "something is wrong".
  Phải NÓI RÕ cái gì, ở đâu trong khung hình.

VÍ DỤ ĐÚNG:
"medium shot of a young woman sitting on the edge of a hospital bed, looking down at her
own hands, IV stand beside her, lit only by a corridor light through the half-open door,
a second pair of wet footprints leading out from under the bed, still and airless"

VÍ DỤ SAI (mơ hồ + lặp phong cách):
"a girl in a hospital, horror atmosphere, Junji Ito style, black and white ink, very scary"`;
}

function motionSection(kind: "wansee" | "huong-noi" | "psych2go" | "custom"): string {
  const tone =
    kind === "wansee"
      ? `- Mặc định: push_in intensity 0.2-0.35, chậm và lì. Horror sợ ở sự CHẬM, không ở sự nhanh.
- shake chỉ cho scene cao trào thật sự (tối đa 2-3 scene cả video), intensity 0.5-0.8.
- none dùng đúng 1-2 lần: khoảnh khắc nhân vật thấy thứ không nên thấy — hình đứng phắt lại.
- pull_out cho scene kết: lùi ra tới khi nhân vật chỉ còn là một chấm nhỏ.`
      : kind === "huong-noi"
      ? `- Mặc định: drift hoặc push_in intensity 0.15-0.28 — RẤT nhẹ, như hơi thở.
- TUYỆT ĐỐI không dùng shake. Kênh này êm, không giật.
- pan_left/pan_right cho cảnh ngoài trời, đường phố, quán café.
- pulse cho scene chờ đợi, tin nhắn chưa được trả lời, ngồi im một mình.`
      : kind === "psych2go"
      ? `- Mặc định: push_in intensity 0.2-0.3 cho scene giải thích, pulse cho scene đặt câu hỏi.
- Scene hook mở đầu: pull_out hoặc push_in intensity 0.4 cho có lực.
- Không dùng shake — kênh giáo dục cần cảm giác an toàn.
- anchor "face" khi scene có nhân vật đang thể hiện cảm xúc.`
      : `- Mặc định: push_in hoặc drift intensity 0.2-0.35.
- Chọn type bám theo thể loại/phong cách kênh đã mô tả ở trên.`;

  return `

## CHUYỂN ĐỘNG CAMERA — field "motion" (BẮT BUỘC cho MỌI scene)
Mỗi scene chỉ là một ảnh tĩnh; chuyển động camera mới làm nó sống. Chọn type theo Ý NGHĨA của scene, KHÔNG chọn ngẫu nhiên, KHÔNG lặp máy móc.

"motion": { "type": "...", "intensity": 0.0-1.0, "anchor": "center|face|top|bottom|left|right", "shake": 0.0-1.0 }

type — phải khớp với nội dung ${kind === "huong-noi" ? "main_text" : "voice_text"} của chính scene đó:
- push_in   : dồn nén, phát hiện ra điều gì, tập trung vào một chi tiết, câu văn căng dần
- pull_out  : hé lộ bối cảnh rộng, nhân vật nhỏ bé, hụt hẫng, chốt cảnh
- pan_left / pan_right : mắt đảo qua không gian, đi dọc hành lang, dò tìm, di chuyển
- tilt_up   : ngước lên — choáng ngợp, có thứ gì đó ở trên cao
- tilt_down : cúi xuống — nhìn sàn hoặc vật dưới đất, đè nén, chán nản
- drift     : trôi chéo rất nhẹ — cảnh nền, cảnh chuyển, lời kể trung tính
- shake     : rung — hoảng loạn, chạy, va đập, tim đập mạnh
- pulse     : phập phồng như nhịp thở — chờ đợi, hồi hộp mà đứng yên
- none      : đứng hình tuyệt đối — dùng làm CÚ SỐC, khoảnh khắc đóng băng

intensity: 0.2-0.35 cho phần lớn scene. Trên 0.6 chỉ dành cho cao trào.
anchor: dùng "face" khi khung hình có mặt người và lời thoại nói về cảm xúc hoặc ánh nhìn.
shake: để 0 ở hầu hết scene. 0.2-0.35 là rung nhẹ bồn chồn; trên 0.6 là hoảng loạn.

NHỊP: không dùng cùng một type quá 2 scene liên tiếp. Xen kẽ đẩy vào / lùi ra / trôi ngang để video có nhịp thở.

Riêng kênh này:
${tone}`;
}


function buildWanseePrompt(topic: string, styleId: string, referenceContext?: string): string {
  const styleNote = styleId === "manga-horror"
    ? "Junji Ito manga style — B&W ink, hidden wrong details, spiral motifs, dense crosshatch"
    : styleId === "webtoon-horror"
    ? "Korean webtoon horror — clean lines, muted cold palette, horror through context and expression"
    : "Psychological horror — liminal space, hidden faces in textures, impossible geometry, institutional palette";

  return `Bạn là AI viết kịch bản horror YouTube tiếng Việt theo style Wansee Entertainment.
Style ảnh: ${styleNote}

Tạo JSON kịch bản cho video: "${topic}"

Trả về JSON THUẦN (không markdown, không giải thích):
{
  "project_name": "ten_a_z_0_9_gach_duoi",
  "channel": "wansee",
  "style_id": "${styleId}",
  "character_sheet": "mô tả nhân vật chính ngắn gọn — ngoại hình, trang phục, để giữ visual consistency",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "mô tả cảnh + BẮT BUỘC 2-3 chi tiết SAI ẩn (shadow wrong direction, reflection shows different, extra fingers, figure in background, object placed impossibly)",
      "motion": { "type": "push_in", "intensity": 0.3, "anchor": "center", "shake": 0 },
      "voice_text": "60-80 chữ, ngôi thứ nhất, dùng '...' ngắt nhịp, KHÔNG dùng '!', bình thản nhưng ám ảnh"
    }
  ],
  "formats": ["youtube"]
}

CẤU TRÚC 20-22 scenes: Scene 1-3 bình thường → 4-7 dấu hiệu bất thường đầu tiên → 8-13 leo thang căng thẳng → 14-18 cao trào → 19-22 kết thúc ám ảnh không giải thích.
image_prompt: luôn có chi tiết sai CỤ THỂ, không mơ hồ.${imagePromptRules()}${motionSection("wansee")}${referenceSection(referenceContext)}`;
}

function buildPsych2GoPrompt(topic: string, styleId: string, referenceContext?: string): string {
  return `Bạn là AI viết kịch bản video tâm lý học tiếng Việt theo style Psych2Go — súc tích, dễ hiểu, relatable.
Style ảnh: ${styleId === "motion-graphic" ? "flat 2D motion graphic, bold colors, simple icons, minimalist infographic style" : "flat 2D animated character, simple round face, Korean webtoon style, expressive body language, clean background with accent color"}.

Chủ đề: "${topic}"

Trả về JSON THUẦN (không markdown, không giải thích):
{
  "project_name": "ten_a_z_0_9_gach_duoi",
  "channel": "psych2go",
  "style_id": "${styleId}",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "mô tả visual cụ thể — nhân vật/biểu tượng, hành động, màu sắc, mood. Ví dụ: flat 2D character ngồi một mình ở góc phòng, ánh đèn xanh lạnh, bong bóng suy nghĩ rỗng",
      "motion": { "type": "push_in", "intensity": 0.3, "anchor": "center", "shake": 0 },
      "voice_text": "lời dẫn 25-40 chữ — tự nhiên, không quá formal, dùng 'bạn' xưng hô thân mật",
      "main_text": "keyword hoặc tiêu đề con — 3-6 chữ, in đậm trên màn hình",
      "duration": 5
    }
  ],
  "formats": ["youtube", "shorts"]
}

CẤU TRÚC 8-12 scenes:
- Scene 1: Hook — câu hỏi rhetorical hoặc fact gây tò mò
- Scene 2: Giới thiệu chủ đề
- Scene 3-9: Từng điểm/dấu hiệu (mỗi scene = 1 điểm)
- Scene 10-12: Kết luận + CTA nhẹ ("Bạn thấy mình có những điểm này không?")

QUY TẮC:
- voice_text: ngắn gọn, conversational, dùng "bạn" — như nói chuyện với bạn bè
- main_text: label cho điểm đó, VD "Bạn thích ở một mình", "Nghe nhiều hơn nói"
- image_prompt: CHỈ mô tả visual, không kể chuyện — màu sắc, nhân vật, biểu tượng, mood${imagePromptRules()}${motionSection("psych2go")}${referenceSection(referenceContext)}`;
}

function buildHuongNoiPrompt(topic: string, styleId: string, referenceContext?: string): string {
  const styleHint =
    styleId === "night-city"   ? "setting: đêm khuya, ngoài trời, thành phố, ánh đèn, mưa, một mình" :
    styleId === "quiet-room"   ? "setting: trong phòng, cozy, đồ vật quen thuộc, ánh đèn ấm" :
                                 "setting: linh hoạt — café, nhà, công ty, ngoài đường — mood nhẹ nhàng";

  return `Bạn là AI viết kịch bản video "Chuyện Người Hướng Nội" — webtoon slice-of-life, cảm xúc relatable.
${styleHint}

Chủ đề: "${topic}"

Trả về JSON THUẦN (không markdown, không giải thích):
{
  "project_name": "ten_a_z_0_9_gach_duoi",
  "channel": "huong-noi",
  "style_id": "${styleId}",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "flat 2D webtoon — mô tả cảnh CỤ THỂ: góc máy, lighting, character action, 1-2 đồ vật đặc trưng, không có người cũng OK",
      "motion": { "type": "push_in", "intensity": 0.3, "anchor": "center", "shake": 0 },
      "main_text": "câu chính — 5-12 chữ, NGẮN, relatable, tự nhiên như status FB/tweet",
      "punchline": "câu phản ứng hoặc sub-text nhỏ bên dưới — optional, dùng khi cần twist/humor nhẹ",
      "duration": 6
    }
  ],
  "formats": ["youtube", "shorts"]
}

QUY TẮC QUAN TRỌNG:
- 12-15 scenes, mỗi scene = 1 khoảnh khắc / 1 cảm xúc nhỏ (không nhồi nhiều ý)
- main_text: NGẮN và HIT — như caption mạng xã hội, không phải văn xuôi
- punchline: twist nhỏ, self-aware humor, hoặc sự thật đau lòng thứ 2 — dùng tối đa 60% scenes
- image_prompt: aesthetic và cụ thể — góc máy rõ, ánh sáng rõ, mood rõ. KHÔNG chung chung.
- Cấu trúc: Scene 1-2 setup context → 3-10 chuỗi khoảnh khắc relatable (peak ở giữa) → 11-13 kết thúc ấm hoặc bittersweet
- duration: 6 cho scene thường, 8 cho scene có chữ dài, 4 cho scene punchline nhanh${imagePromptRules()}${motionSection("huong-noi")}${referenceSection(referenceContext)}`;
}

// Hướng dẫn AI về lồng tiếng — áp cho mọi kênh, không phụ thuộc kênh nào
function castSection(enabled: boolean, speakers: SpeakerDef[]): string {
  if (!enabled) {
    return `

## VIDEO NÀY KHÔNG LỒNG TIẾNG
BỎ HẲN field "voice_text" trong mọi scene. Chỉ dùng "main_text" (và "punchline" nếu hợp) làm chữ hiển thị trên ảnh.`;
  }
  if (speakers.length <= 1) {
    return `

## VIDEO NÀY CÓ LỒNG TIẾNG
Mỗi scene BẮT BUỘC có "voice_text" — lời kể tiếng Việt tự nhiên, đúng nhịp của thể loại.`;
  }
  return `

## VIDEO NÀY CÓ ${speakers.length} GIỌNG KHÁC NHAU
Mỗi scene BẮT BUỘC có "voice_text" và thêm field "speaker" nhận đúng MỘT trong các id sau:
${speakers.map(s => `- "${s.id}" = ${s.name}`).join("\n")}

QUY TẮC PHÂN VAI:
- Lời dẫn chuyện, mô tả bối cảnh, chuyển cảnh → "${speakers[0].id}"
- Lời thoại trực tiếp của nhân vật nào → dùng đúng id của nhân vật đó
- Một scene chỉ có MỘT speaker. Nếu một cảnh có hai người nói, tách thành hai scene liên tiếp.

NGÔI KỂ (RẤT QUAN TRỌNG — đây là chỗ hay sai nhất):
- "${speakers[0].id}" là NGƯỜI ĐỨNG NGOÀI câu chuyện, KHÔNG phải nhân vật.
  → BẮT BUỘC dùng ngôi thứ BA: gọi nhân vật bằng TÊN hoặc "anh ấy" / "cô ấy".
  → TUYỆT ĐỐI KHÔNG xưng "tôi", "em", "anh" ở lời người kể.
  → Đúng: "Đêm đó anh ở lại văn phòng một mình. Anh nghe thấy tiếng gõ cửa."
  → Sai:  "Tôi ở lại văn phòng một mình. Tôi nghe thấy tiếng gõ cửa."

TÊN NHÂN VẬT — TRÁNH TRÙNG ÂM VỚI ĐẠI TỪ (lỗi chỉ lộ ra khi NGHE, không thấy khi đọc):
- KHÔNG đặt tên trùng/gần âm với đại từ tiếng Việt, vì đọc lên sẽ mất nghĩa ngôi thứ ba.
  Cấm: Minh (nghe thành "mình"), Ta, Tôi, Em, Anh, Chị, Cô, Ông, Bà, Bạn, Ai, Người.
  → "Minh ở lại một mình" nghe thành "mình ở lại một mình" — hỏng hẳn câu.
  Nên dùng: Khoa, Đạt, Tuấn, Hải, Sơn, Duy, Nghĩa, Lâm, Trâm, Hà, Vy, Thảo, Ngân, Yến.
- Trong lời người kể, ƯU TIÊN "anh" / "cô ấy" thay vì lặp tên liên tục.
  Chỉ nhắc tên khi cần phân biệt hai người cùng giới trong một cảnh.
- Các vai nhân vật thì ngược lại: nói ngôi thứ NHẤT, như đang thoại thật,
  không kèm "anh ấy nói rằng". Đúng: "Em có nghe thấy gì không?"

SẮC THÁI — thêm field "emotion" cho mỗi scene, chọn 1 trong:
- "narration" → BẮT BUỘC dùng cho mọi scene của "${speakers[0].id}"
- Nhân vật chọn theo tình huống: "tense" (căng thẳng) | "whisper" (thì thầm)
  | "fear" (sợ hãi) | "panic" (hoảng loạn) | "sad" (nghẹn ngào)
  | "angry" (gằn giọng) | "warm" (ấm áp)`;
}

function buildCustomPrompt(topic: string, ch: CustomChannel, styleId: string, referenceContext?: string): string {
  return `Bạn là AI viết kịch bản video YouTube tiếng Việt cho kênh "${ch.name}".
Thể loại / phong cách kênh: ${ch.genreDescription || "tự do sáng tạo theo chủ đề"}

Chủ đề video: "${topic}"

Trả về JSON THUẦN (không markdown, không giải thích):
{
  "project_name": "ten_a_z_0_9_gach_duoi",
  "channel": "${ch.id}",
  "style_id": "${styleId}",
  "has_voice": ${ch.hasVoice},
  "scenes": [
    {
      "n": 1,
      "image_prompt": "mô tả cảnh cụ thể (tiếng Anh) đúng phong cách/thể loại đã mô tả ở trên",${ch.hasVoice ? `
      "motion": { "type": "push_in", "intensity": 0.3, "anchor": "center", "shake": 0 },
      "voice_text": "lời dẫn tiếng Việt, độ dài phù hợp với thời lượng scene",` : ""}
      "main_text": "chữ hiển thị trên màn hình (tuỳ chọn, để trống nếu không cần)",
      "duration": 6
    }
  ],
  "formats": ${JSON.stringify(ch.formats)}
}

Viết khoảng ${ch.sceneCountHint} scenes, bám đúng phong cách/thể loại đã mô tả ở trên.${imagePromptRules()}${motionSection("custom")}${referenceSection(referenceContext)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Stage({ step, title, hint, accent, right, children }: {
  step: number; title: string; hint?: string; accent: string;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={{ borderBottom: `1px solid ${T.lineSoft}`, padding: "22px 28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 700, color: accent,
          border: `1px solid ${accent}55`, borderRadius: 4, padding: "2px 6px",
          background: `${accent}12`, flexShrink: 0,
        }}>
          {String(step).padStart(2, "0")}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 650, color: T.hi, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
        {hint && <span style={{ fontSize: 11.5, color: T.faint, flex: 1 }}>{hint}</span>}
        {right}
      </div>
      {children}
    </section>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  // Channel & style
  const [channelId, setChannelId]     = useState("wansee");
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newCh, setNewCh] = useState({
    name: "", icon: "✨", accent: ACCENT_PRESETS[0],
    genreDescription: "", hasVoice: true, sceneCountHint: "10-15",
    formats: ["youtube"] as string[],
  });
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [styles, setStyles]           = useState<StyleDNA[]>([]);
  const [styleId, setStyleId]         = useState("manga-horror");
  const [previewUrl, setPreviewUrl]   = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});

  // Script
  const [topic, setTopic]         = useState("");
  const [refUrl, setRefUrl]       = useState("");
  const [jsonScript, setJsonScript] = useState("");
  const [generating, setGenerating] = useState(false);

  // Research kênh cùng thể loại
  const [channelQuery, setChannelQuery] = useState("");
  const [channelResults, setChannelResults] = useState<{ title: string; url: string; content: string }[]>([]);
  const [searchingChannels, setSearchingChannels] = useState(false);

  // Voice — dàn giọng nhiều vai
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakers, setSpeakers] = useState<SpeakerDef[]>([]);
  const [voicePreviewing, setVoicePreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Music
  const [syncMode, setSyncMode]     = useState<SyncMode>("fill");
  const [musicFile, setMusicFile]   = useState<{ name: string; path: string } | null>(null);
  const [musicDuration, setMusicDuration] = useState<number | null>(null);
  const [lrcText, setLrcText]       = useState("");
  const [syncResult, setSyncResult] = useState<{ points: { time: number; label?: string }[]; sceneDurations: number[] } | null>(null);
  const [analyzingMusic, setAnalyzingMusic] = useState(false);
  const [sceneDuration, setSceneDuration] = useState(6);

  // Formats
  const [formats, setFormats] = useState<string[]>(["youtube"]);

  // Run state
  const [running, setRunning]   = useState(false);
  const [scenes, setScenes]     = useState<SceneState[]>([]);
  const [log, setLog]           = useState<string[]>([]);
  const [outputFiles, setOutputFiles] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const logRef   = useRef<HTMLDivElement>(null);

  // Providers
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProviderState] = useState<string>("auto");
  const [inspectorTab, setInspectorTab] = useState<"run" | "providers">("run");

  // Xem ảnh phóng to
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  const channels = [...BUILTIN_CHANNELS, ...customChannels];
  const channel = channels.find(c => c.id === channelId) ?? BUILTIN_CHANNELS[0];
  const activeCustomChannel = customChannels.find(c => c.id === channelId);
  const accent = channel.accent;

  // Gợi ý mặc định của kênh — chỉ là gợi ý, người dùng bật/tắt được cho từng video
  const channelVoiceDefault = channelId === "huong-noi"
    ? false
    : activeCustomChannel ? activeCustomChannel.hasVoice : true;

  // ── Load custom channels ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/channels").then(r => r.json()).then(d => setCustomChannels(d.channels ?? [])).catch(() => {});
  }, []);

  // ── Load voices + preset theo channel ────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/voices?channel=${channelId}`)
      .then(r => r.json())
      .then(d => {
        setVoices(d.voices ?? []);
        const v = d.preset?.voice ?? "vi-VN-HoaiMyNeural";
        const s = d.preset?.speed ?? 0;
        // Mỗi lần đổi kênh: reset về 1 vai người kể chuyện với giọng gợi ý của kênh
        setSpeakers([{ id: "narrator", name: "Người kể chuyện", voice: v, speed: s }]);
        setVoiceEnabled(channelVoiceDefault);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // ── Thao tác dàn giọng ───────────────────────────────────────────────────────
  // Giọng "tự nhiên" của VieNeu hợp nhân vật trẻ (~20-25 tuổi) hơn giọng "kể chuyện"
  const CAST_PRESETS = [
    { id: "male",   name: "Nam chính", prefer: "vieneu:Phạm Tuyên" },
    { id: "female", name: "Nữ chính",  prefer: "vieneu:Trúc Ly" },
  ];

  function addSpeaker(preset?: { id: string; name: string; prefer: string }) {
    setSpeakers(prev => {
      const base = preset ?? { id: `vai${prev.length + 1}`, name: `Vai ${prev.length + 1}`, prefer: voices[0]?.id ?? "vi-VN-HoaiMyNeural" };
      let id = base.id;
      let i = 2;
      while (prev.some(s => s.id === id)) id = `${base.id}${i++}`;
      return [...prev, { id, name: base.name, voice: base.prefer, speed: 0 }];
    });
  }

  function updateSpeaker(id: string, patch: Partial<SpeakerDef>) {
    setSpeakers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSpeaker(id: string) {
    setSpeakers(prev => (prev.length <= 1 ? prev : prev.filter(s => s.id !== id)));
  }

  const addLog = useCallback((msg: string) => setLog(prev => [...prev.slice(-200), msg]), []);

  async function createChannel() {
    if (!newCh.name.trim()) return;
    setCreatingChannel(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCh),
      }).then(r => r.json());
      if (res.ok) {
        setCustomChannels(prev => [...prev, res.channel]);
        setChannelId(res.channel.id);
        setShowNewChannel(false);
        setNewCh({ name: "", icon: "✨", accent: ACCENT_PRESETS[0], genreDescription: "", hasVoice: true, sceneCountHint: "10-15", formats: ["youtube"] });
      } else {
        addLog(`⚠ Tạo kênh lỗi: ${res.error}`);
      }
    } catch (e) {
      addLog(`⚠ Tạo kênh lỗi: ${e}`);
    }
    setCreatingChannel(false);
  }

  async function deleteChannel(id: string) {
    const res = await fetch(`/api/channels?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(r => r.json());
    if (res.ok) {
      setCustomChannels(prev => prev.filter(c => c.id !== id));
      if (channelId === id) setChannelId("wansee");
    } else {
      addLog(`⚠ Xoá kênh lỗi: ${res.error}`);
    }
    setConfirmDeleteId(null);
  }

  // ── Load styles ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/styles?channel=${channelId}`)
      .then(r => r.json())
      .then(d => {
        setStyles(d.styles ?? []);
        if (d.styles?.length > 0) setStyleId(d.styles[0].id);
      })
      .catch(() => setStyles([]));
  }, [channelId]);

  // ── Load providers ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/providers").then(r => r.json()).then(d => {
      setProviders(d.providers ?? []);
      setActiveProviderState(d.active ?? "auto");
    }).catch(() => {});
  }, []);

  async function selectProvider(key: string) {
    setActiveProviderState(key);
    await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: key }),
    });
  }

  // ── Auto-scroll log ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ── Nghe thử giọng ───────────────────────────────────────────────────────────
  async function previewVoice(v: string, speed = 0, tag = v) {
    if (voicePreviewing) return;
    setVoicePreviewing(tag);
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: v, speed }),
      }).then(r => r.json());
      if (res.ok) {
        audioRef.current?.pause();
        const audio = new Audio(`/api/file?path=${encodeURIComponent(res.filePath)}`);
        audioRef.current = audio;
        await audio.play();
        audio.onended = () => setVoicePreviewing(null);
        return;
      }
      addLog(`⚠ Nghe thử giọng lỗi: ${res.error}`);
    } catch (e) {
      addLog(`⚠ Nghe thử giọng lỗi: ${e}`);
    }
    setVoicePreviewing(null);
  }

  // ── Style preview ────────────────────────────────────────────────────────────
  async function loadPreview(style: StyleDNA) {
    const key = `${channelId}/${style.id}`;
    if (previewUrl[key] || previewLoading[key]) return;
    setPreviewLoading(p => ({ ...p, [key]: true }));
    try {
      const previewPrompt = style.preview_prompt ?? `${style.prompt_prefix}. Example establishing shot.`;
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "generate_image",
          input: { prompt: previewPrompt, filename: `preview_${channelId}_${style.id}`, style: channelId },
        }),
      }).then(r => r.json());
      if (res.success) {
        setPreviewUrl(p => ({ ...p, [key]: `/api/file?path=${encodeURIComponent(res.data.filePath)}` }));
      }
    } catch {}
    setPreviewLoading(p => ({ ...p, [key]: false }));
  }

  // ── Generate script ──────────────────────────────────────────────────────────
  async function generateScript() {
    if (!topic.trim()) return;
    setGenerating(true);
    setJsonScript("Đang tạo kịch bản...");
    try {
      let referenceContext: string | undefined;
      const videoId = refUrl.trim() ? extractVideoId(refUrl.trim()) : null;
      if (refUrl.trim() && !videoId) {
        setJsonScript(`// Lỗi: URL YouTube không hợp lệ: ${refUrl}\n// Xoá URL tham khảo hoặc sửa lại rồi thử lại`);
        setGenerating(false);
        return;
      }
      if (videoId) {
        setJsonScript("Đang lấy transcript video tham khảo...");
        const tRes = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: "get_youtube_transcript", input: { video_id: videoId } }),
        }).then(r => r.json());
        if (tRes.success) referenceContext = tRes.data.transcript as string;
        else addLog(`⚠ Không lấy được transcript (${tRes.error}) — tạo kịch bản không có tham khảo`);
        setJsonScript("Đang tạo kịch bản...");
      }

      const basePrompt = channelId === "wansee"   ? buildWanseePrompt(topic, styleId, referenceContext)
               : channelId === "psych2go" ? buildPsych2GoPrompt(topic, styleId, referenceContext)
               : channelId === "huong-noi" ? buildHuongNoiPrompt(topic, styleId, referenceContext)
               : activeCustomChannel ? buildCustomPrompt(topic, activeCustomChannel, styleId, referenceContext)
               : buildHuongNoiPrompt(topic, styleId, referenceContext);
      // Cấu hình giọng của video này ghi đè mặc định trong prompt của kênh
      const prompt = basePrompt + castSection(voiceEnabled, speakers);
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "generate_script", input: { prompt } }),
      }).then(r => r.json());
      if (res.success) setJsonScript(res.data.script ?? "");
      else setJsonScript(`// Lỗi: ${res.error}\n// Paste JSON script thủ công vào đây`);
    } catch (e) {
      setJsonScript(`// Lỗi: ${e}\n// Paste JSON script thủ công`);
    }
    setGenerating(false);
  }

  // ── Research kênh cùng thể loại ──────────────────────────────────────────────
  function defaultChannelQuery(): string {
    return channelId === "wansee"
      ? "kênh youtube kể chuyện kinh dị animation phong cách giống Wansee Entertainment"
      : channelId === "psych2go"
      ? "kênh youtube giải thích tâm lý học animation phong cách giống Psych2Go"
      : "kênh youtube webtoon slice of life hướng nội introvert";
  }

  async function searchSimilarChannels() {
    setSearchingChannels(true);
    try {
      const query = channelQuery.trim() || defaultChannelQuery();
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "search_web", input: { query, max_results: 8 } }),
      }).then(r => r.json());
      if (res.success) setChannelResults(res.data ?? []);
      else addLog(`⚠ Tìm kênh lỗi: ${res.error}`);
    } catch (e) {
      addLog(`⚠ Tìm kênh lỗi: ${e}`);
    }
    setSearchingChannels(false);
  }

  // ── Upload music ─────────────────────────────────────────────────────────────
  async function handleMusicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/music", { method: "POST", body: formData }).then(r => r.json()).catch(() => null);
    if (res?.path) {
      setMusicFile({ name: file.name, path: res.path });
      const dur = await fetch(`/api/music-analyze?path=${encodeURIComponent(res.path)}`).then(r => r.json()).catch(() => null);
      if (dur?.duration) setMusicDuration(Math.round(dur.duration));
      setSyncResult(null);
    }
  }

  // ── Analyze music sync ───────────────────────────────────────────────────────
  async function analyzeSync() {
    if (!musicFile || syncMode === "fill") return;
    const numScenesLocal = parseScript()?.scenes.length ?? 15;
    setAnalyzingMusic(true);
    try {
      const res = await fetch("/api/music-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: syncMode, musicPath: musicFile.path, numScenes: numScenesLocal, lrcText }),
      }).then(r => r.json());
      if (res.result) setSyncResult(res.result);
      else addLog(`⚠ Phân tích nhạc lỗi: ${res.error}`);
    } catch {}
    setAnalyzingMusic(false);
  }

  // ── Parse script JSON ─────────────────────────────────────────────────────────
  function parseScript(): ScriptJSON | null {
    try {
      const cleaned = jsonScript.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
      return JSON.parse(cleaned) as ScriptJSON;
    } catch { return null; }
  }

  // ── Build music config ────────────────────────────────────────────────────────
  function buildMusicConfig(): MusicConfig | undefined {
    if (!musicFile) return undefined;
    if (syncMode === "fill" || !syncResult) {
      return { mode: "auto", auto: { musicPath: musicFile.path, startOffset: 0, volume: 0.4, fadeIn: 2, fadeOut: 3 } };
    }
    const cues = syncResult.points.map((pt, i) => ({
      musicPath: musicFile.path,
      musicStart: pt.time,
      videoStart: syncResult.points[i]?.time ?? 0,
      videoEnd: syncResult.points[i + 1]?.time ?? (syncResult.points[i]?.time ?? 0) + (syncResult.sceneDurations[i] ?? 5),
      volume: 0.5,
    }));
    return { mode: "manual", manual: cues };
  }

  function getSceneDuration(): number {
    if (syncMode === "fill" && musicDuration) {
      const n = parseScript()?.scenes.length ?? 15;
      return parseFloat((musicDuration / n).toFixed(1));
    }
    return sceneDuration;
  }

  // ── Run pipeline ──────────────────────────────────────────────────────────────
  async function handleRun() {
    const script = parseScript();
    if (!script) { addLog("❌ JSON script không hợp lệ"); setInspectorTab("run"); return; }
    if (!script.channel) script.channel = channelId;
    if (!script.style_id) script.style_id = styleId;

    script.formats = formats.length > 0 ? formats : ["youtube"];

    // Giọng chọn từ UI — chỉ áp khi kênh có voice
    // Giọng: bật/tắt theo lựa chọn của video này, không theo kênh
    script.has_voice = voiceEnabled;
    if (voiceEnabled && speakers.length > 0) {
      script.speakers = speakers;
      script.voice = speakers[0].voice;          // giọng mặc định cho scene không ghi speaker
      script.voice_speed = speakers[0].speed;
    }

    if (syncResult?.sceneDurations) {
      script.scenes.forEach((scene, i) => {
        scene.duration = syncResult.sceneDurations[i] ?? sceneDuration;
      });
    }

    setRunning(true);
    setLog([]);
    setOutputFiles({});
    setInspectorTab("run");
    setScenes(script.scenes.map(s => ({ n: s.n, img: "idle", voice: "idle" })));
    abortRef.current = new AbortController();

    const onEvent = (e: RunEvent) => {
      switch (e.type) {
        case "scene_start":  addLog(`▶ Scene ${e.n}/${e.total}`); break;
        case "image_done":   setScenes(p => p.map(s => s.n === e.n ? { ...s, img: "ok" } : s)); break;
        case "image_error":  setScenes(p => p.map(s => s.n === e.n ? { ...s, img: "err" } : s)); addLog(`✗ Scene ${e.n} ảnh lỗi: ${e.error}`); break;
        case "voice_done":   setScenes(p => p.map(s => s.n === e.n ? { ...s, voice: e.path ? "ok" : "skip" } : s)); break;
        case "voice_error":  setScenes(p => p.map(s => s.n === e.n ? { ...s, voice: "silent" } : s)); addLog(`⚠ Scene ${e.n} voice lỗi → dùng silent`); break;
        case "assemble_start": addLog("🎬 Đang ghép video..."); break;
        case "assemble_done":  setOutputFiles(e.files); addLog("✅ Hoàn thành!"); break;
        case "assemble_error": addLog(`❌ Ghép video lỗi: ${e.error}`); break;
        case "done": setRunning(false); break;
      }
    };

    try {
      await runFromJSON(
        script, onEvent, abortRef.current.signal,
        buildMusicConfig(), styleId, undefined, getSceneDuration(),
      );
    } catch (e) {
      addLog(`❌ ${e}`);
    }
    setRunning(false);
  }

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
    addLog("⏹ Đã dừng");
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const scriptObj = parseScript();
  const numScenes = scriptObj?.scenes.length ?? 0;
  const projectName = scriptObj?.project_name ?? "";
  const fillDuration = syncMode === "fill" && musicDuration && numScenes > 0
    ? parseFloat((musicDuration / numScenes).toFixed(1))
    : null;
  const doneCount = scenes.filter(s => s.img === "ok").length;
  const jsonValid = jsonScript.trim().length > 0 && scriptObj !== null;
  const castSummary = speakers
    .map(s => voices.find(v => v.id === s.voice)?.name ?? s.voice)
    .join(", ");
  const estSeconds = numScenes > 0 ? Math.round(numScenes * (fillDuration ?? sceneDuration)) : 0;

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: T.bg, color: T.text, fontFamily: UI, overflow: "hidden",
    }}>
      {/* Inline style không làm được :hover/:focus/scrollbar — cần CSS thật */}
      <style>{`
        *::-webkit-scrollbar { width: 10px; height: 10px; }
        *::-webkit-scrollbar-track { background: ${T.sunken}; }
        *::-webkit-scrollbar-thumb {
          background: ${T.line}; border-radius: 5px;
          border: 2px solid ${T.sunken};
        }
        *::-webkit-scrollbar-thumb:hover { background: #333947; }

        button { font-family: inherit; transition: filter .14s, background .14s, border-color .14s, transform .1s; }
        button:not(:disabled):hover { filter: brightness(1.18); }
        button:not(:disabled):active { transform: translateY(1px); }
        button:disabled { cursor: not-allowed; }

        input, textarea { transition: border-color .14s, box-shadow .14s; }
        input:focus, textarea:focus {
          border-color: ${accent} !important;
          box-shadow: 0 0 0 3px ${accent}22;
        }
        input[type="range"] { height: 4px; border-radius: 2px; background: ${T.line}; }

        a { transition: filter .14s; }
        a:hover { filter: brightness(1.2); }

        :focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

        .ch-item:hover  { background: ${T.raised} !important; }
        .card-hov       { transition: transform .16s, border-color .16s, box-shadow .16s; }
        .card-hov:hover { transform: translateY(-2px); border-color: ${accent}99 !important; }
        .res-row:hover  { border-color: ${T.line} !important; background: ${T.raised} !important; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { transition: none !important; animation: none !important; }
          .card-hov:hover { transform: none; }
        }
      `}</style>

      {/* ══ TOPBAR ══ */}
      <header style={{
        height: 52, flexShrink: 0, borderBottom: `1px solid ${T.line}`,
        display: "flex", alignItems: "center", gap: 18, padding: "0 18px",
        background: T.surface,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: T.hi }}>
            ◆ STUDIO
          </span>
          <span style={{ fontSize: 10, color: T.faint, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            content pipeline
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: T.line }} />

        {/* Project chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: T.faint }}>Dự án</span>
          <span style={{
            fontFamily: MONO, fontSize: 12, color: projectName ? T.hi : T.faint,
            background: T.sunken, border: `1px solid ${T.line}`, borderRadius: 5,
            padding: "3px 9px", maxWidth: 280, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {projectName || "— chưa có kịch bản —"}
          </span>
          {numScenes > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: accent, fontVariantNumeric: "tabular-nums" }}>
              {numScenes} scenes · ~{Math.floor(estSeconds / 60)}:{String(estSeconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Balances */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5 }}>
          {providers.filter(p => p.balanceLabel && p.hasKey).map(p => (
            <span key={p.key} style={{ color: T.faint, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: p.status.ok ? T.ok : T.warn, display: "inline-block",
              }} />
              {p.name}
              <span style={{
                fontFamily: MONO, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                color: p.unlimited ? T.ok : p.balance != null && p.balance <= 0 ? T.err : T.ok,
              }}>{p.balanceLabel}</span>
            </span>
          ))}
          <Link href="/chat" style={{
            color: T.dim, textDecoration: "none", border: `1px solid ${T.line}`,
            borderRadius: 5, padding: "5px 11px", fontSize: 12,
          }}>💬 Chat Agent</Link>
        </div>
      </header>

      {/* ══ BODY: rail | stage | inspector ══ */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* ── SIDEBAR: kênh ── */}
        <nav style={{
          width: 218, flexShrink: 0, borderRight: `1px solid ${T.line}`,
          background: T.sunken, display: "flex", flexDirection: "column",
          padding: "14px 10px", gap: 2, overflowY: "auto",
        }}>
          <div style={{ ...sx.label, padding: "0 8px", marginBottom: 9 }}>Kênh</div>

          {channels.map(ch => {
            const isCustom = customChannels.some(c => c.id === ch.id);
            const active = channelId === ch.id;
            const confirming = confirmDeleteId === ch.id;
            const chVoice = ch.id === "huong-noi" ? false
              : customChannels.find(c => c.id === ch.id)?.hasVoice ?? true;
            return (
              <div key={ch.id} className="ch-item"
                onClick={() => { setChannelId(ch.id); if (confirming) setConfirmDeleteId(null); }}
                style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                  background: active ? `${ch.accent}18` : "transparent",
                  border: `1px solid ${active ? `${ch.accent}66` : "transparent"}`,
                  transition: "background .14s",
                }}>
                {active && (
                  <span style={{
                    position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)",
                    width: 3, height: 22, borderRadius: "0 3px 3px 0", background: ch.accent,
                  }} />
                )}
                <span style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0, fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? `${ch.accent}2a` : T.raised,
                  border: `1px solid ${active ? ch.accent : T.line}`,
                }}>{ch.icon}</span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: active ? 750 : 550,
                    color: active ? T.hi : T.text, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>{ch.name}</div>
                  <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>
                    {chVoice ? "có giọng đọc" : "chữ overlay"}
                  </div>
                </div>

                {isCustom && !confirming && (
                  <span onClick={e => { e.stopPropagation(); setConfirmDeleteId(ch.id); }}
                    title="Xoá kênh"
                    style={{ fontSize: 11, color: T.faint, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>✕</span>
                )}
                {isCustom && confirming && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <span onClick={e => { e.stopPropagation(); deleteChannel(ch.id); }}
                      title="Xác nhận xoá" style={{ fontSize: 12, color: T.ok, cursor: "pointer", fontWeight: 700 }}>✓</span>
                    <span onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      title="Huỷ" style={{ fontSize: 12, color: T.err, cursor: "pointer", fontWeight: 700 }}>✕</span>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => setShowNewChannel(true)}
            style={{
              marginTop: 6, padding: "9px 10px", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: `1px dashed ${T.line}`, color: T.faint,
              fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 10,
            }}>
            <span style={{
              width: 30, height: 30, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
            }}>+</span>
            Kênh mới
          </button>
        </nav>

        {/* ── STAGE ── */}
        <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>

          {/* ── Banner kênh đang chọn ── */}
          <div style={{
            padding: "20px 28px 18px",
            borderBottom: `1px solid ${T.lineSoft}`,
            background: `linear-gradient(100deg, ${accent}1c 0%, ${accent}08 32%, transparent 62%)`,
            display: "flex", alignItems: "center", gap: 15,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 13, flexShrink: 0, fontSize: 25,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${accent}26`, border: `1px solid ${accent}88`,
              boxShadow: `0 4px 20px ${accent}33`,
            }}>{channel.icon}</div>

            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: 23, fontWeight: 800, color: T.hi, margin: 0,
                letterSpacing: "-0.025em", lineHeight: 1.15,
              }}>{channel.name}</h1>
              <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                {[
                  `${styles.length} style`,
                  voiceEnabled ? `${speakers.length} vai giọng` : "không lồng tiếng",
                  activeCustomChannel ? `${activeCustomChannel.sceneCountHint} scenes` : null,
                  activeCustomChannel ? "kênh tự tạo" : "kênh mặc định",
                ].filter(Boolean).map((t, i) => (
                  <span key={i} style={{
                    fontSize: 10.5, color: T.dim, background: T.raised,
                    border: `1px solid ${T.line}`, borderRadius: 4, padding: "2px 8px",
                  }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 01 — STYLE */}
          <Stage step={1} title="Style hình ảnh" accent={accent}
            hint={`${styles.length} style khả dụng · bấm ảnh để xem lớn`}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {styles.map(style => {
                const key = `${channelId}/${style.id}`;
                const active = style.id === styleId;
                return (
                  <div key={style.id} className="card-hov"
                    onClick={() => { setStyleId(style.id); loadPreview(style); }}
                    style={{
                      width: 154, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                      border: `1px solid ${active ? accent : T.line}`,
                      background: T.raised,
                      boxShadow: active ? `0 0 0 1px ${accent}, 0 4px 16px ${accent}22` : "none",
                      transition: "all .15s",
                    }}>
                    <div style={{
                      height: 96, background: T.sunken, display: "flex",
                      alignItems: "center", justifyContent: "center", position: "relative",
                    }}>
                      {previewUrl[key]
                        ? <>
                            <img src={previewUrl[key]} alt={style.name}
                              onClick={e => { e.stopPropagation(); setLightbox({ url: previewUrl[key], title: style.name }); }}
                              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                            <span
                              onClick={e => { e.stopPropagation(); setLightbox({ url: previewUrl[key], title: style.name }); }}
                              title="Xem ảnh lớn"
                              style={{
                                position: "absolute", bottom: 6, right: 6, cursor: "zoom-in",
                                background: "rgba(0,0,0,.66)", border: `1px solid ${T.line}`,
                                borderRadius: 5, padding: "2px 7px", fontSize: 11, color: T.hi,
                              }}>⤢</span>
                          </>
                        : <button onClick={e => { e.stopPropagation(); loadPreview(style); }}
                            style={{
                              background: T.raised, border: `1px solid ${T.line}`, color: T.dim,
                              borderRadius: 5, padding: "5px 12px", fontSize: 11, cursor: "pointer",
                            }}>
                            {previewLoading[key] ? "⏳ đang vẽ…" : "Xem thử"}
                          </button>
                      }
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? accent : T.hi }}>{style.name}</div>
                      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3, lineHeight: 1.4 }}>{style.description}</div>
                    </div>
                  </div>
                );
              })}
              {styles.length === 0 && (
                <div style={{ fontSize: 12.5, color: T.faint, padding: "16px 0" }}>
                  Kênh này chưa có style nào.
                </div>
              )}
            </div>
          </Stage>

          {/* 02 — KỊCH BẢN */}
          <Stage step={2} title="Kịch bản" accent={accent}
            hint="Nhập chủ đề để AI viết, hoặc dán JSON có sẵn"
            right={
              <span style={{
                fontFamily: MONO, fontSize: 11, padding: "3px 8px", borderRadius: 4,
                border: `1px solid ${jsonValid ? T.ok + "55" : jsonScript.trim() ? T.err + "55" : T.line}`,
                color: jsonValid ? T.ok : jsonScript.trim() ? T.err : T.faint,
                background: jsonValid ? T.ok + "12" : jsonScript.trim() ? T.err + "12" : "transparent",
              }}>
                {jsonValid ? `✓ hợp lệ · ${numScenes} scenes` : jsonScript.trim() ? "✕ JSON lỗi" : "chưa có"}
              </span>
            }>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder={
                  channelId === "wansee"    ? "VD: Tôi làm thêm giờ ở toà nhà bỏ hoang..." :
                  channelId === "psych2go"  ? "VD: 7 dấu hiệu bạn là người hướng nội thực sự" :
                  channelId === "huong-noi" ? "VD: Khi hướng nội phải đi tiệc sinh nhật..." :
                                              "VD: chủ đề video cho kênh này..."
                }
                style={{ ...sx.input, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && generateScript()} />
              <button onClick={generateScript} disabled={generating || !topic.trim()}
                style={{
                  background: accent, color: "#fff", border: "none", borderRadius: 6,
                  padding: "0 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: generating || !topic.trim() ? 0.45 : 1, whiteSpace: "nowrap",
                }}>
                {generating ? "⏳ Đang viết…" : "✦ Tạo kịch bản"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={sx.label}>URL tham khảo (chỉ lấy tone — plot luôn viết mới)</label>
                <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  style={sx.input} onKeyDown={e => e.key === "Enter" && generateScript()} />
              </div>
              <div>
                <label style={sx.label}>Tìm kênh cùng thể loại</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={channelQuery} onChange={e => setChannelQuery(e.target.value)}
                    placeholder={defaultChannelQuery()}
                    style={sx.input} onKeyDown={e => e.key === "Enter" && searchSimilarChannels()} />
                  <button onClick={searchSimilarChannels} disabled={searchingChannels}
                    style={{
                      background: T.raised, border: `1px solid ${T.line}`, color: T.dim,
                      borderRadius: 6, padding: "0 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {searchingChannels ? "⏳" : "🔎"}
                  </button>
                </div>
              </div>
            </div>

            {channelResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 190, overflowY: "auto" }}>
                {channelResults.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="res-row"
                    style={{
                      background: T.sunken, border: `1px solid ${T.lineSoft}`, borderRadius: 6,
                      padding: "8px 11px", textDecoration: "none", display: "block",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 650, color: accent }}>{r.title}</div>
                    <div style={{ fontSize: 10, color: T.faint, margin: "2px 0" }}>{r.url}</div>
                    <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.45 }}>
                      {r.content?.slice(0, 160)}{(r.content?.length ?? 0) > 160 ? "…" : ""}
                    </div>
                  </a>
                ))}
              </div>
            )}

            <textarea value={jsonScript} onChange={e => setJsonScript(e.target.value)}
              placeholder={`Dán JSON kịch bản, hoặc nhấn "Tạo kịch bản" ở trên`}
              spellCheck={false}
              style={{
                ...sx.input, minHeight: 180, resize: "vertical",
                fontFamily: MONO, fontSize: 12, lineHeight: 1.65, color: T.text,
              }} />
          </Stage>

          {/* 03 — GIỌNG ĐỌC */}
          <Stage step={3} title="Giọng đọc" accent={accent}
            hint={voiceEnabled ? `${speakers.length} vai · mỗi vai một giọng riêng` : "đang tắt cho video này"}
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {!channelVoiceDefault && voiceEnabled && (
                  <span style={{ fontSize: 10.5, color: T.warn }}>khác mặc định của kênh</span>
                )}
                <button onClick={() => setVoiceEnabled(v => !v)} style={sx.chip(voiceEnabled, accent)}>
                  {voiceEnabled ? "● Bật" : "○ Tắt"}
                </button>
              </div>
            }>
            {!voiceEnabled ? (
              <div style={{
                background: T.sunken, border: `1px dashed ${T.line}`, borderRadius: 7,
                padding: "14px 16px", fontSize: 12.5, color: T.dim,
              }}>
                Video này không lồng tiếng — chỉ hiển thị chữ overlay (<code style={{ fontFamily: MONO, color: accent }}>main_text</code> / <code style={{ fontFamily: MONO, color: accent }}>punchline</code>) trên ảnh.
                Bấm <strong style={{ color: T.hi }}>Bật</strong> ở trên nếu muốn kênh này có giọng đọc.
              </div>
            ) : (
              <>
                {/* ── Dàn giọng ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {speakers.map((sp, idx) => {
                    const v = voices.find(x => x.id === sp.voice);
                    return (
                      <div key={sp.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: T.raised, border: `1px solid ${T.line}`,
                        borderRadius: 8, padding: "10px 12px",
                      }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 10, color: accent, flexShrink: 0,
                          border: `1px solid ${accent}55`, background: `${accent}12`,
                          borderRadius: 4, padding: "2px 6px",
                        }}>{sp.id}</span>

                        <input value={sp.name}
                          onChange={e => updateSpeaker(sp.id, { name: e.target.value })}
                          placeholder="Tên vai"
                          style={{ ...sx.input, width: 150, padding: "6px 10px", fontSize: 12.5 }} />

                        <select value={sp.voice}
                          onChange={e => updateSpeaker(sp.id, { voice: e.target.value })}
                          style={{ ...sx.input, width: 220, padding: "6px 9px", fontSize: 12.5, cursor: "pointer" }}>
                          <optgroup label="VieNeu 48kHz — chạy trên máy (cần bật server)">
                            {voices.filter(x => x.provider === "vieneu").map(x => (
                              <option key={x.id} value={x.id}>
                                {x.name} ({x.gender}, {x.region}) — {x.note.replace("48kHz — phong cách ", "")}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Edge — free, không giới hạn">
                            {voices.filter(x => x.provider === "edge").map(x => (
                              <option key={x.id} value={x.id}>{x.name} ({x.gender})</option>
                            ))}
                          </optgroup>
                          <optgroup label="FPT.AI — free tier giới hạn lượt">
                            {voices.filter(x => x.provider === "fpt").map(x => (
                              <option key={x.id} value={x.id}>{x.name} ({x.gender}, {x.region})</option>
                            ))}
                          </optgroup>
                        </select>

                        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 120 }}>
                          <span style={{ fontSize: 10.5, color: T.faint, whiteSpace: "nowrap" }}>tốc độ</span>
                          <input type="range" min={-3} max={3} step={1} value={sp.speed}
                            onChange={e => updateSpeaker(sp.id, { speed: Number(e.target.value) })}
                            style={{ flex: 1, accentColor: accent, cursor: "pointer", minWidth: 60 }} />
                          <span style={{
                            fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: accent,
                            minWidth: 24, textAlign: "center", fontVariantNumeric: "tabular-nums",
                          }}>{sp.speed > 0 ? `+${sp.speed}` : sp.speed}</span>
                        </div>

                        <button onClick={() => previewVoice(sp.voice, sp.speed, sp.id)}
                          disabled={!!voicePreviewing} title="Nghe thử vai này"
                          style={{
                            background: voicePreviewing === sp.id ? `${accent}22` : "transparent",
                            border: `1px solid ${voicePreviewing === sp.id ? accent : T.line}`,
                            color: voicePreviewing === sp.id ? accent : T.dim,
                            borderRadius: 5, width: 26, height: 26, fontSize: 10, flexShrink: 0,
                            cursor: voicePreviewing ? "wait" : "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          {voicePreviewing === sp.id ? "◼" : "▶"}
                        </button>

                        <button onClick={() => removeSpeaker(sp.id)}
                          disabled={speakers.length <= 1} title="Xoá vai"
                          style={{
                            background: "transparent", border: `1px solid ${T.line}`,
                            color: speakers.length <= 1 ? T.faint : T.err,
                            borderRadius: 5, width: 26, height: 26, fontSize: 11, flexShrink: 0,
                            cursor: speakers.length <= 1 ? "not-allowed" : "pointer", padding: 0,
                            opacity: speakers.length <= 1 ? 0.35 : 1,
                          }}>✕</button>
                      </div>
                    );
                  })}
                </div>

                {/* Thêm vai */}
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                  {CAST_PRESETS.filter(p => !speakers.some(s => s.id === p.id)).map(p => (
                    <button key={p.id} onClick={() => addSpeaker(p)}
                      style={{
                        background: "transparent", border: `1px dashed ${T.line}`, color: T.dim,
                        borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer",
                      }}>+ {p.name}</button>
                  ))}
                  <button onClick={() => addSpeaker()}
                    style={{
                      background: "transparent", border: `1px dashed ${T.line}`, color: T.dim,
                      borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer",
                    }}>+ Vai khác</button>
                </div>

                {speakers.length > 1 && (
                  <div style={{
                    fontSize: 11.5, color: T.dim, background: T.sunken,
                    border: `1px solid ${T.lineSoft}`, borderRadius: 7, padding: "11px 13px",
                  }}>
                    Nhiều vai đang bật. Trong JSON, mỗi scene thêm{" "}
                    <code style={{ fontFamily: MONO, color: accent }}>&quot;speaker&quot;</code> để chỉ định ai đọc — ví dụ{" "}
                    {speakers.map((s, i) => (
                      <span key={s.id}>
                        <code style={{ fontFamily: MONO, color: T.hi }}>&quot;speaker&quot;: &quot;{s.id}&quot;</code>
                        {i < speakers.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    . Scene không ghi <code style={{ fontFamily: MONO, color: accent }}>speaker</code> sẽ dùng giọng của vai đầu tiên.
                  </div>
                )}
              </>
            )}
          </Stage>


          {/* 04 — NHẠC NỀN */}
          <Stage step={4} title="Nhạc nền" accent={accent} hint="Tuỳ chọn"
            right={musicFile ? (
              <span style={{ fontSize: 11.5, color: T.dim }}>
                {musicFile.name}
                {musicDuration && (
                  <span style={{ fontFamily: MONO, color: T.ok, marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
                    {Math.floor(musicDuration / 60)}:{String(musicDuration % 60).padStart(2, "0")}
                  </span>
                )}
              </span>
            ) : undefined}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <label style={{
                background: T.raised, border: `1px solid ${T.line}`, color: T.text,
                borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer",
              }}>
                📁 Chọn file nhạc
                <input type="file" accept="audio/*" onChange={handleMusicUpload} style={{ display: "none" }} />
              </label>

              <div style={{ width: 1, height: 22, background: T.line, margin: "0 4px" }} />

              {(["fill", "lyric", "beat", "whisper"] as SyncMode[]).map(m => (
                <button key={m} onClick={() => setSyncMode(m)} style={sx.chip(syncMode === m, accent)}>
                  {m === "fill" ? "⏱ Trải đều" : m === "lyric" ? "📝 Theo lời" : m === "beat" ? "🥁 Theo nhịp" : "🤖 Whisper"}
                </button>
              ))}
            </div>

            {syncMode === "fill" && musicDuration && numScenes > 0 && (
              <div style={{
                fontSize: 12, color: T.ok, background: `${T.ok}0f`,
                border: `1px solid ${T.ok}33`, padding: "9px 12px", borderRadius: 6,
              }}>
                ✓ {numScenes} scenes × <span style={{ fontFamily: MONO }}>{fillDuration}s</span> khớp trọn bài nhạc{" "}
                <span style={{ fontFamily: MONO }}>{Math.floor(musicDuration / 60)}:{String(musicDuration % 60).padStart(2, "0")}</span>
              </div>
            )}

            {syncMode === "fill" && !musicDuration && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 12, color: T.dim }}>Giây mỗi scene</label>
                <input type="number" min={2} max={30} value={sceneDuration}
                  onChange={e => setSceneDuration(Number(e.target.value))}
                  style={{ ...sx.input, width: 76, fontFamily: MONO }} />
              </div>
            )}

            {syncMode === "lyric" && (
              <div>
                <label style={sx.label}>LRC hoặc timestamp thủ công</label>
                <textarea value={lrcText} onChange={e => setLrcText(e.target.value)}
                  placeholder={"[00:10.50]Và em đã biết\n[00:15.20]Rằng anh không còn\n\nHoặc: 10 - Mô tả scene"}
                  style={{ ...sx.input, minHeight: 96, fontFamily: MONO, fontSize: 12 }} />
              </div>
            )}

            {syncMode === "whisper" && (
              <div style={{ fontSize: 12, color: T.dim, padding: "9px 12px", background: T.sunken, borderRadius: 6, border: `1px solid ${T.lineSoft}` }}>
                🤖 Dùng HuggingFace Whisper nhận diện lời hát để lấy điểm sync — cần <code style={{ fontFamily: MONO, color: T.warn }}>HF_TOKEN</code>.
              </div>
            )}

            {syncMode !== "fill" && musicFile && (
              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={analyzeSync} disabled={analyzingMusic}
                  style={{
                    background: T.raised, border: `1px solid ${T.line}`, color: T.hi,
                    borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer",
                    opacity: analyzingMusic ? 0.5 : 1,
                  }}>
                  {analyzingMusic ? "⏳ Đang phân tích…" : "🔍 Phân tích nhạc"}
                </button>
                {syncResult && (
                  <span style={{ fontSize: 12, color: T.ok }}>✓ {syncResult.points.length} điểm sync</span>
                )}
              </div>
            )}

            {syncResult && syncResult.points.length > 0 && (
              <div style={{
                marginTop: 10, maxHeight: 96, overflowY: "auto", fontSize: 11,
                color: T.faint, fontFamily: MONO, background: T.sunken,
                padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.lineSoft}`,
              }}>
                {syncResult.points.slice(0, 20).map((pt, i) => (
                  <div key={i}>[{pt.time.toFixed(1)}s → {syncResult.sceneDurations[i]?.toFixed(1)}s] {pt.label ?? `Scene ${i + 1}`}</div>
                ))}
                {syncResult.points.length > 20 && <div>…+{syncResult.points.length - 20} điểm nữa</div>}
              </div>
            )}
          </Stage>

          <div style={{ height: 28 }} />
        </main>

        {/* ── INSPECTOR ── */}
        <aside style={{
          width: 320, flexShrink: 0, borderLeft: `1px solid ${T.line}`,
          background: T.surface, display: "flex", flexDirection: "column", minHeight: 0,
        }}>
          {/* tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
            {([["run", "Tiến độ"], ["providers", "Nguồn ảnh"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setInspectorTab(k)}
                style={{
                  flex: 1, background: "none", border: "none", cursor: "pointer",
                  padding: "11px 0", fontSize: 12, fontWeight: inspectorTab === k ? 700 : 500,
                  color: inspectorTab === k ? T.hi : T.faint,
                  borderBottom: `2px solid ${inspectorTab === k ? accent : "transparent"}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {inspectorTab === "run" ? (
              <>
                {scenes.length === 0 && log.length === 0 && (
                  <div style={{ fontSize: 12.5, color: T.faint, lineHeight: 1.7, paddingTop: 8 }}>
                    Chưa chạy lần nào.<br />
                    Chuẩn bị xong kịch bản rồi nhấn <strong style={{ color: T.hi }}>Render</strong> ở thanh dưới.
                  </div>
                )}

                {scenes.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
                      <span style={{ ...sx.label, marginBottom: 0 }}>Ảnh đã tạo</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: T.hi, fontVariantNumeric: "tabular-nums" }}>
                        {doneCount}/{scenes.length}
                      </span>
                    </div>
                    <div style={{ height: 4, background: T.sunken, borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{
                        height: "100%", width: `${(doneCount / scenes.length) * 100}%`,
                        background: accent, borderRadius: 2, transition: "width .3s",
                      }} />
                    </div>
                  </div>
                )}

                {log.length > 0 && (
                  <>
                    <span style={sx.label}>Nhật ký</span>
                    <div ref={logRef} style={{
                      maxHeight: 260, overflowY: "auto", fontSize: 11, fontFamily: MONO,
                      lineHeight: 1.75, background: T.sunken, borderRadius: 6,
                      border: `1px solid ${T.lineSoft}`, padding: "9px 11px", marginBottom: 18,
                    }}>
                      {log.map((l, i) => (
                        <div key={i} style={{
                          color: l.startsWith("✅") ? T.ok : l.startsWith("❌") || l.startsWith("✗") ? T.err
                               : l.startsWith("⚠") ? T.warn : T.faint,
                        }}>{l}</div>
                      ))}
                    </div>
                  </>
                )}

                {Object.keys(outputFiles).length > 0 && (
                  <>
                    <span style={sx.label}>Video hoàn thành</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(outputFiles).map(([fmt, filePath]) => (
                        <div key={fmt} style={{
                          background: T.raised, border: `1px solid ${T.line}`,
                          borderRadius: 7, padding: "11px 12px",
                        }}>
                          <div style={{ fontSize: 12, color: accent, fontWeight: 700, marginBottom: 5 }}>
                            {fmt === "youtube" ? "▶ YouTube 16:9" : fmt === "shorts" ? "📱 Shorts 9:16" : "🎵 TikTok 9:16"}
                          </div>
                          <div style={{
                            fontSize: 10, color: T.faint, wordBreak: "break-all",
                            marginBottom: 8, fontFamily: MONO,
                          }}>{filePath}</div>
                          <a href={`/api/file?path=${encodeURIComponent(filePath)}`} download
                            style={{
                              background: accent, color: "#fff", borderRadius: 5,
                              padding: "5px 11px", fontSize: 11.5, fontWeight: 700,
                              textDecoration: "none", display: "inline-block",
                            }}>⬇ Tải xuống</a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ ...sx.label, marginBottom: 0 }}>Nguồn tạo ảnh</span>
                  <button onClick={() => fetch("/api/providers").then(r => r.json()).then(d => {
                    setProviders(d.providers ?? []); setActiveProviderState(d.active ?? "auto");
                  })}
                    style={{ background: "none", border: "none", color: T.faint, cursor: "pointer", fontSize: 11 }}>
                    ↺ Làm mới
                  </button>
                </div>

                <div onClick={() => selectProvider("auto")}
                  style={{
                    padding: "10px 12px", borderRadius: 7, marginBottom: 7, cursor: "pointer",
                    border: `1px solid ${activeProvider === "auto" ? accent : T.line}`,
                    background: activeProvider === "auto" ? `${accent}12` : T.raised,
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: activeProvider === "auto" ? accent : T.hi }}>
                    🤖 Tự động
                  </div>
                  <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3 }}>
                    Fal → Pollinations → HuggingFace → Cloudflare
                  </div>
                </div>

                {providers.map(p => {
                  const isActive = activeProvider === p.key;
                  const disabled = !p.hasKey;
                  const qColor = p.quality === "S" ? T.warn : p.quality === "A" ? "#58a6ff" : T.faint;
                  return (
                    <div key={p.key} onClick={() => !disabled && selectProvider(p.key)}
                      style={{
                        padding: "10px 12px", borderRadius: 7, marginBottom: 7,
                        cursor: disabled ? "not-allowed" : "pointer",
                        border: `1px solid ${isActive ? accent : T.line}`,
                        background: isActive ? `${accent}12` : T.raised,
                        opacity: disabled ? 0.42 : 1,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: !p.hasKey ? T.faint : p.status.ok ? T.ok : T.warn,
                        }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: isActive ? accent : T.hi }}>{p.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: qColor,
                          background: `${qColor}1c`, padding: "1px 5px", borderRadius: 3,
                        }}>{p.quality}</span>
                        <span style={{ flex: 1 }} />
                        {p.balanceLabel && (
                          <span style={{
                            fontFamily: MONO, fontSize: 11, fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color: p.unlimited ? T.ok : p.balance != null && p.balance <= 0 ? T.err : T.ok,
                          }}>{p.balanceLabel}</span>
                        )}
                        {!p.hasKey && <span style={{ fontSize: 10.5, color: T.faint }}>chưa có key</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4, fontFamily: MONO }}>{p.model}</div>
                      {p.quota && (
                        <div style={{ marginTop: 7 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: T.faint, marginBottom: 3 }}>
                            <span style={{ fontFamily: MONO }}>{p.quota.used.toLocaleString()} / {p.quota.limit.toLocaleString()}</span>
                            <span>reset {p.quota.resetIn}</span>
                          </div>
                          <div style={{ height: 3, background: T.sunken, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${p.quota.pct}%`, borderRadius: 2,
                              background: p.quota.pct > 80 ? T.err : p.quota.pct > 50 ? T.warn : T.ok,
                            }} />
                          </div>
                        </div>
                      )}
                      {p.status.lastError && (
                        <div style={{ fontSize: 9.5, color: T.warn, marginTop: 5, fontFamily: MONO }}>
                          {p.status.lastError.slice(0, 64)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ══ FILMSTRIP ══ */}
      {scenes.length > 0 && (
        <div style={{
          flexShrink: 0, borderTop: `1px solid ${T.line}`, background: T.sunken,
          padding: "10px 18px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ ...sx.label, marginBottom: 0, flexShrink: 0 }}>Scenes</span>
          <div style={{ display: "flex", gap: 3, overflowX: "auto", flex: 1, paddingBottom: 2 }}>
            {scenes.map(sc => {
              const c = sc.img === "ok" ? T.ok : sc.img === "err" ? T.err : T.line;
              return (
                <div key={sc.n} title={`Scene ${sc.n}${sc.voice === "silent" ? " — voice lỗi, dùng silent" : ""}`}
                  style={{
                    width: 34, height: 30, borderRadius: 4, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10.5, fontFamily: MONO, fontWeight: 700,
                    background: sc.img === "ok" ? `${T.ok}1a` : sc.img === "err" ? `${T.err}1a` : T.raised,
                    border: `1px solid ${c}`,
                    color: sc.img === "ok" ? T.ok : sc.img === "err" ? T.err : T.faint,
                    position: "relative",
                  }}>
                  {sc.n}
                  {sc.voice === "silent" && (
                    <span style={{
                      position: "absolute", top: -3, right: -3, fontSize: 8, color: T.warn,
                    }}>⚠</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TRANSPORT ══ */}
      <footer style={{
        height: 60, flexShrink: 0, borderTop: `1px solid ${T.line}`,
        background: T.surface, display: "flex", alignItems: "center",
        gap: 16, padding: "0 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...sx.label, marginBottom: 0 }}>Xuất</span>
          {["youtube", "shorts", "tiktok"].map(fmt => (
            <button key={fmt}
              onClick={() => setFormats(f => f.includes(fmt) ? f.filter(x => x !== fmt) : [...f, fmt])}
              style={sx.chip(formats.includes(fmt), accent)}>
              {fmt === "youtube" ? "▶ YouTube" : fmt === "shorts" ? "📱 Shorts" : "🎵 TikTok"}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: T.line }} />

        {/* Trạng thái sẵn sàng */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5, color: T.faint }}>
          <span>{jsonValid ? <span style={{ color: T.ok }}>✓</span> : <span style={{ color: T.err }}>✕</span>} kịch bản</span>
          <span>
            {voiceEnabled
              ? <><span style={{ color: T.ok }}>✓</span> {speakers.length > 1 ? `${speakers.length} giọng` : `giọng ${castSummary}`}</>
              : <>– không lồng tiếng</>}
          </span>
          <span>{musicFile ? <span style={{ color: T.ok }}>✓</span> : "–"} nhạc</span>
        </div>

        <div style={{ flex: 1 }} />

        {running ? (
          <>
            <span style={{ fontSize: 12, color: T.dim, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
              {doneCount}/{scenes.length} scenes
            </span>
            <button onClick={handleStop}
              style={{
                background: `${T.err}1a`, color: T.err, border: `1px solid ${T.err}66`,
                borderRadius: 7, padding: "10px 26px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              }}>⏹ Dừng</button>
          </>
        ) : (
          <button onClick={handleRun} disabled={!jsonValid}
            style={{
              background: jsonValid ? accent : T.raised,
              color: jsonValid ? "#fff" : T.faint,
              border: `1px solid ${jsonValid ? accent : T.line}`,
              borderRadius: 7, padding: "10px 30px", fontSize: 13.5, fontWeight: 800,
              cursor: jsonValid ? "pointer" : "not-allowed",
              letterSpacing: "0.02em",
              boxShadow: jsonValid ? `0 3px 16px ${accent}44` : "none",
            }}>
            ▶ Render
          </button>
        )}
      </footer>

      {/* ══ LIGHTBOX: xem ảnh lớn ══ */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 200,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: 32, cursor: "zoom-out",
            backdropFilter: "blur(3px)",
          }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
            color: T.hi, fontSize: 13, fontWeight: 650,
          }}>
            <span>{lightbox.title}</span>
            <span style={{ color: T.faint, fontSize: 11.5 }}>bấm bất kỳ đâu để đóng</span>
          </div>
          <img src={lightbox.url} alt={lightbox.title}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "100%", maxHeight: "calc(100vh - 150px)", objectFit: "contain",
              borderRadius: 10, border: `1px solid ${T.line}`, cursor: "default",
              boxShadow: "0 24px 70px rgba(0,0,0,.7)",
            }} />
          <a href={lightbox.url} download onClick={e => e.stopPropagation()}
            style={{
              marginTop: 14, background: T.raised, border: `1px solid ${T.line}`,
              color: T.text, borderRadius: 6, padding: "7px 15px",
              fontSize: 12, textDecoration: "none",
            }}>⬇ Tải ảnh</a>
        </div>
      )}

      {/* ══ MODAL: kênh mới ══ */}
      {showNewChannel && (
        <div onClick={() => setShowNewChannel(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
            backdropFilter: "blur(2px)",
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width: 480, maxHeight: "86vh", overflowY: "auto", background: T.surface,
              border: `1px solid ${T.line}`, borderRadius: 12, padding: "22px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,.6)",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 750, fontSize: 16, color: T.hi }}>Tạo kênh mới</span>
              <span onClick={() => setShowNewChannel(false)} style={{ cursor: "pointer", color: T.faint, fontSize: 16 }}>✕</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={sx.label}>Tên kênh</label>
                <input value={newCh.name} onChange={e => setNewCh({ ...newCh, name: e.target.value })}
                  placeholder="VD: VIRUS — Giấc Mơ Có Thật" style={sx.input} />
              </div>
              <div style={{ width: 66 }}>
                <label style={sx.label}>Icon</label>
                <input value={newCh.icon} onChange={e => setNewCh({ ...newCh, icon: e.target.value })}
                  style={{ ...sx.input, textAlign: "center", fontSize: 17 }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={sx.label}>Màu nhận diện</label>
              <div style={{ display: "flex", gap: 9 }}>
                {ACCENT_PRESETS.map(c => (
                  <div key={c} onClick={() => setNewCh({ ...newCh, accent: c })}
                    style={{
                      width: 28, height: 28, borderRadius: 8, background: c, cursor: "pointer",
                      border: newCh.accent === c ? `2px solid ${T.hi}` : "2px solid transparent",
                      boxShadow: newCh.accent === c ? `0 0 0 1px ${c}` : "none",
                    }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={sx.label}>Thể loại / phong cách — AI dùng để viết kịch bản + ảnh</label>
              <textarea value={newCh.genreDescription}
                onChange={e => setNewCh({ ...newCh, genreDescription: e.target.value })}
                placeholder="VD: dream narrative tiếng Việt, cinematic dark realism, POV ngôi thứ nhất, ánh sáng đơn nguồn"
                style={{ ...sx.input, minHeight: 78, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={sx.label}>Số scene gợi ý</label>
                <input value={newCh.sceneCountHint} onChange={e => setNewCh({ ...newCh, sceneCountHint: e.target.value })}
                  placeholder="10-15" style={{ ...sx.input, fontFamily: MONO }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={sx.label}>Giọng đọc</label>
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => setNewCh({ ...newCh, hasVoice: true })}
                    style={sx.chip(newCh.hasVoice, newCh.accent)}>Có voice</button>
                  <button onClick={() => setNewCh({ ...newCh, hasVoice: false })}
                    style={sx.chip(!newCh.hasVoice, newCh.accent)}>Chỉ chữ</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={sx.label}>Format mặc định</label>
              <div style={{ display: "flex", gap: 7 }}>
                {["youtube", "shorts", "tiktok"].map(f => (
                  <button key={f}
                    onClick={() => setNewCh({ ...newCh, formats: newCh.formats.includes(f) ? newCh.formats.filter(x => x !== f) : [...newCh.formats, f] })}
                    style={sx.chip(newCh.formats.includes(f), newCh.accent)}>{f}</button>
                ))}
              </div>
            </div>

            <button onClick={createChannel} disabled={creatingChannel || !newCh.name.trim()}
              style={{
                width: "100%", background: newCh.accent, color: "#fff", border: "none",
                borderRadius: 7, padding: "11px 0", fontSize: 13.5, fontWeight: 750,
                cursor: "pointer", opacity: creatingChannel || !newCh.name.trim() ? 0.5 : 1,
              }}>
              {creatingChannel ? "⏳ Đang tạo…" : "✦ Tạo kênh"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
