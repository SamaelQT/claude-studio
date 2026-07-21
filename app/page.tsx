"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { runFromJSON, ScriptJSON, RunEvent, MusicConfig, StyleDNA } from "@/lib/agent/runner-types";

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

const BUILTIN_CHANNELS: Channel[] = [
  { id: "wansee",    name: "Wansee",      accent: "#c0392b", icon: "💀" },
  { id: "huong-noi", name: "Hướng Nội",  accent: "#4a7fb5", icon: "🌙" },
  { id: "psych2go",  name: "Tâm Lý Trẻ", accent: "#8a4bc7", icon: "🧠" },
];

const ACCENT_PRESETS = ["#e67e22", "#16a085", "#2980b9", "#c0392b", "#8e44ad", "#f39c12"];

// ── CSS-in-JS tokens ──────────────────────────────────────────────────────────
const C = {
  bg:      "#0a0a0a",
  panel:   "#141414",
  card:    "#1a1a1a",
  border:  "#2a2a2a",
  muted:   "#555",
  text:    "#e8e8e8",
  sub:     "#888",
};

const s = {
  panel: { background: C.panel, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 20px" } as React.CSSProperties,
  input: { background: "#111", border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "9px 13px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  btn: (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }),
  label: { fontSize: 11, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" } as React.CSSProperties,
  section: { marginBottom: 20 } as React.CSSProperties,
};

// ── Prompt builders ───────────────────────────────────────────────────────────
// referenceContext: trích từ transcript video tham khảo — CHỈ dùng để bắt tone/nhịp kể,
// AI phải tự sáng tác plot mới hoàn toàn, không dịch/sao chép tình tiết gốc.
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
      "voice_text": "60-80 chữ, ngôi thứ nhất, dùng '...' ngắt nhịp, KHÔNG dùng '!', bình thản nhưng ám ảnh"
    }
  ],
  "formats": ["youtube"]
}

CẤU TRÚC 20-22 scenes: Scene 1-3 bình thường → 4-7 dấu hiệu bất thường đầu tiên → 8-13 leo thang căng thẳng → 14-18 cao trào → 19-22 kết thúc ám ảnh không giải thích.
image_prompt: luôn có chi tiết sai CỤ THỂ, không mơ hồ.${referenceSection(referenceContext)}`;
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
- image_prompt: CHỈ mô tả visual, không kể chuyện — màu sắc, nhân vật, biểu tượng, mood${referenceSection(referenceContext)}`;
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
- duration: 6 cho scene thường, 8 cho scene có chữ dài, 4 cho scene punchline nhanh${referenceSection(referenceContext)}`;
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
      "voice_text": "lời dẫn tiếng Việt, độ dài phù hợp với thời lượng scene",` : ""}
      "main_text": "chữ hiển thị trên màn hình (tuỳ chọn, để trống nếu không cần)",
      "duration": 6
    }
  ],
  "formats": ${JSON.stringify(ch.formats)}
}

Viết khoảng ${ch.sceneCountHint} scenes, bám đúng phong cách/thể loại đã mô tả ở trên.${referenceSection(referenceContext)}`;
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

  const channels = [...BUILTIN_CHANNELS, ...customChannels];
  const channel = channels.find(c => c.id === channelId) ?? BUILTIN_CHANNELS[0];
  const activeCustomChannel = customChannels.find(c => c.id === channelId);

  // ── Load custom channels ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/channels").then(r => r.json()).then(d => setCustomChannels(d.channels ?? [])).catch(() => {});
  }, []);

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

  const addLog = useCallback((msg: string) => setLog(prev => [...prev.slice(-200), msg]), []);

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
        const fileName = res.data.filePath.split(/[\\/]/).pop();
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

      const prompt = channelId === "wansee"   ? buildWanseePrompt(topic, styleId, referenceContext)
               : channelId === "psych2go" ? buildPsych2GoPrompt(topic, styleId, referenceContext)
               : channelId === "huong-noi" ? buildHuongNoiPrompt(topic, styleId, referenceContext)
               : activeCustomChannel ? buildCustomPrompt(topic, activeCustomChannel, styleId, referenceContext)
               : buildHuongNoiPrompt(topic, styleId, referenceContext);
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
    const numScenes = parseScript()?.scenes.length ?? 15;
    setAnalyzingMusic(true);
    try {
      const res = await fetch("/api/music-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: syncMode, musicPath: musicFile.path, numScenes, lrcText }),
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
    // Convert sync points to manual cues
    const cues = syncResult.points.map((pt, i) => ({
      musicPath: musicFile.path,
      musicStart: pt.time,
      videoStart: syncResult.points[i]?.time ?? 0,
      videoEnd: syncResult.points[i + 1]?.time ?? (syncResult.points[i]?.time ?? 0) + (syncResult.sceneDurations[i] ?? 5),
      volume: 0.5,
    }));
    return { mode: "manual", manual: cues };
  }

  // ── Calculate scene duration for fill mode ────────────────────────────────────
  function getSceneDuration(): number {
    if (syncMode === "fill" && musicDuration) {
      const numScenes = parseScript()?.scenes.length ?? 15;
      return parseFloat((musicDuration / numScenes).toFixed(1));
    }
    return sceneDuration;
  }

  // ── Run pipeline ──────────────────────────────────────────────────────────────
  async function handleRun() {
    const script = parseScript();
    if (!script) { addLog("❌ JSON script không hợp lệ"); return; }
    if (!script.channel) script.channel = channelId;
    if (!script.style_id) script.style_id = styleId;

    // Luôn dùng formats từ UI — override JSON (nút Shorts/TikTok mới có tác dụng)
    script.formats = formats.length > 0 ? formats : ["youtube"];

    // Apply sync durations if available
    if (syncResult?.sceneDurations) {
      script.scenes.forEach((scene, i) => {
        scene.duration = syncResult.sceneDurations[i] ?? sceneDuration;
      });
    }

    setRunning(true);
    setLog([]);
    setOutputFiles({});
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
        script,
        onEvent,
        abortRef.current.signal,
        buildMusicConfig(),
        styleId,
        undefined,
        getSceneDuration(),
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

  // ── Render ────────────────────────────────────────────────────────────────────
  const scriptObj = parseScript();
  const numScenes = scriptObj?.scenes.length ?? 0;
  const fillDuration = syncMode === "fill" && musicDuration && numScenes > 0
    ? parseFloat((musicDuration / numScenes).toFixed(1))
    : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", height: 52, gap: 20 }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>◆ Claude Studio</span>

        {/* Channel tabs */}
        <div style={{ display: "flex", gap: 4, flex: 1, alignItems: "center", flexWrap: "wrap" }}>
          {channels.map(ch => {
            const isCustom = customChannels.some(c => c.id === ch.id);
            const confirming = confirmDeleteId === ch.id;
            return (
              <div key={ch.id} style={{ position: "relative", display: "inline-flex" }}>
                <button onClick={() => { setChannelId(ch.id); if (confirming) setConfirmDeleteId(null); }}
                  style={{ ...s.btn(channelId === ch.id ? ch.accent : "#222"), padding: isCustom ? "5px 26px 5px 14px" : "5px 14px", fontSize: 13, fontWeight: channelId === ch.id ? 700 : 400 }}>
                  {ch.icon} {ch.name}
                </button>
                {isCustom && !confirming && (
                  <span onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(ch.id); }}
                    title="Xoá kênh"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#ccc", cursor: "pointer", opacity: 0.8 }}>
                    ✕
                  </span>
                )}
                {isCustom && confirming && (
                  <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
                    <span onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }}
                      title="Xác nhận xoá" style={{ fontSize: 11, color: "#4ade80", cursor: "pointer", fontWeight: 700 }}>✓</span>
                    <span onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      title="Huỷ" style={{ fontSize: 11, color: "#f0a0a0", cursor: "pointer", fontWeight: 700 }}>✕</span>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => setShowNewChannel(true)}
            style={{ ...s.btn("#222"), padding: "5px 12px", fontSize: 13 }}>
            + Kênh mới
          </button>
        </div>

        {/* Active provider + balances */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <Link href="/chat" style={{ color: C.sub, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px" }}>
            💬 Chat Agent
          </Link>
          <span style={{ color: C.sub }}>
            Provider: <span style={{ color: channel.accent, fontWeight: 700 }}>
              {activeProvider === "auto" ? "🤖 Auto" : providers.find(p=>p.key===activeProvider)?.name ?? activeProvider}
            </span>
          </span>
          {providers.filter(p => p.balanceLabel && p.hasKey).map(p => (
            <span key={p.key} style={{ color: C.sub }}>
              {p.name}: <span style={{ fontWeight: 700,
                color: p.unlimited ? "#3d8c40"
                  : p.balance != null && p.balance <= 0 ? "#ef5350"
                  : "#3d8c40" }}>
                {p.balanceLabel}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

          {/* Left column */}
          <div>

            {/* Style selector */}
            <div style={{ ...s.section }}>
              <div style={{ ...s.panel }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>🎨 Style</span>
                  <button style={{ ...s.btn("#222"), padding: "4px 10px", fontSize: 12 }}
                    onClick={() => { /* TODO: create style modal */ }}>
                    + Thêm style
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {styles.map(style => {
                    const key = `${channelId}/${style.id}`;
                    const active = style.id === styleId;
                    return (
                      <div key={style.id}
                        onClick={() => { setStyleId(style.id); loadPreview(style); }}
                        style={{
                          width: 140, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                          border: `2px solid ${active ? channel.accent : C.border}`,
                          transition: "border-color 0.15s",
                        }}>
                        <div style={{ height: 80, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          {previewUrl[key]
                            ? <img src={previewUrl[key]} alt={style.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <button onClick={e => { e.stopPropagation(); loadPreview(style); }}
                                style={{ ...s.btn("#333"), padding: "4px 8px", fontSize: 11 }}>
                                {previewLoading[key] ? "..." : "Preview"}
                              </button>
                          }
                        </div>
                        <div style={{ padding: "7px 10px", background: active ? "#1e1e1e" : C.card }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: active ? channel.accent : C.text }}>{style.name}</div>
                          <div style={{ fontSize: 10, color: C.sub, marginTop: 2, lineHeight: 1.3 }}>{style.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Script */}
            <div style={{ ...s.section }}>
              <div style={{ ...s.panel }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Chủ đề / Ý tưởng</label>
                    <input value={topic} onChange={e => setTopic(e.target.value)}
                      placeholder={
                        channelId === "wansee"    ? "VD: Tôi làm thêm giờ ở toà nhà bỏ hoang..." :
                        channelId === "psych2go"  ? "VD: 7 dấu hiệu bạn là người hướng nội thực sự" :
                        channelId === "huong-noi" ? "VD: Khi hướng nội phải đi tiệc sinh nhật..." :
                                                    "VD: chủ đề video cho kênh này..."
                      }
                      style={s.input} onKeyDown={e => e.key === "Enter" && generateScript()} />
                  </div>
                  <button onClick={generateScript} disabled={generating || !topic.trim()}
                    style={{ ...s.btn(channel.accent), opacity: generating ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {generating ? "⏳ Tạo..." : "✦ Tạo kịch bản"}
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>URL YouTube tham khảo (tuỳ chọn — chỉ lấy tone/nhịp kể, plot luôn viết mới)</label>
                  <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    style={s.input} onKeyDown={e => e.key === "Enter" && generateScript()} />
                </div>

                {/* Research kênh cùng thể loại */}
                <div style={{ marginBottom: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <label style={s.label}>🔎 Tìm kênh cùng thể loại (kết quả tìm kiếm web trực tiếp — không phải bảng xếp hạng cố định)</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input value={channelQuery} onChange={e => setChannelQuery(e.target.value)}
                      placeholder={defaultChannelQuery()}
                      style={s.input} onKeyDown={e => e.key === "Enter" && searchSimilarChannels()} />
                    <button onClick={searchSimilarChannels} disabled={searchingChannels}
                      style={{ ...s.btn("#333"), opacity: searchingChannels ? 0.6 : 1, whiteSpace: "nowrap" }}>
                      {searchingChannels ? "⏳ Đang tìm..." : "🔎 Tìm"}
                    </button>
                  </div>
                  {channelResults.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {channelResults.map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", background: "#111", border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px", textDecoration: "none" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: channel.accent }}>{i + 1}. {r.title}</div>
                          <div style={{ fontSize: 10, color: C.sub, margin: "2px 0" }}>{r.url}</div>
                          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.4 }}>{r.content?.slice(0, 180)}{(r.content?.length ?? 0) > 180 ? "…" : ""}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <label style={s.label}>JSON Script {numScenes > 0 && <span style={{ color: channel.accent, fontWeight: 700 }}>— {numScenes} scenes</span>}</label>
                <textarea value={jsonScript} onChange={e => setJsonScript(e.target.value)}
                  placeholder={`Paste JSON hoặc nhấn "Tạo kịch bản" ở trên`}
                  style={{ ...s.input, minHeight: 200, resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }} />
              </div>
            </div>

            {/* Music */}
            <div style={{ ...s.section }}>
              <div style={{ ...s.panel }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>🎵 Nhạc nền</div>

                {/* Upload */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                  <label style={{ ...s.btn("#222"), cursor: "pointer" }}>
                    📁 Upload nhạc
                    <input type="file" accept="audio/*" onChange={handleMusicUpload} style={{ display: "none" }} />
                  </label>
                  {musicFile && (
                    <span style={{ fontSize: 12, color: C.sub }}>
                      {musicFile.name} {musicDuration && <span style={{ color: "#3d8c40" }}>({Math.floor(musicDuration/60)}:{String(musicDuration%60).padStart(2,"0")})</span>}
                    </span>
                  )}
                </div>

                {/* Sync mode */}
                <label style={s.label}>Sync mode</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {(["fill", "lyric", "beat", "whisper"] as SyncMode[]).map(m => (
                    <button key={m} onClick={() => setSyncMode(m)}
                      style={{ ...s.btn(syncMode === m ? channel.accent : "#222"), padding: "6px 14px", fontSize: 12 }}>
                      {m === "fill" ? "⏱ Fill" : m === "lyric" ? "📝 Lyric" : m === "beat" ? "🥁 Beat" : "🤖 Whisper"}
                    </button>
                  ))}
                </div>

                {/* Fill mode info */}
                {syncMode === "fill" && musicDuration && numScenes > 0 && (
                  <div style={{ fontSize: 12, color: "#3d8c40", background: "#0d2010", padding: "8px 12px", borderRadius: 6 }}>
                    ✓ {numScenes} scenes × {fillDuration}s = {(numScenes * (fillDuration??0)).toFixed(0)}s — khớp với nhạc {Math.floor(musicDuration/60)}:{String(musicDuration%60).padStart(2,"0")}
                  </div>
                )}

                {syncMode === "fill" && !musicDuration && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ fontSize: 12, color: C.sub }}>Giây/scene:</label>
                    <input type="number" min={2} max={30} value={sceneDuration} onChange={e => setSceneDuration(Number(e.target.value))}
                      style={{ ...s.input, width: 70 }} />
                  </div>
                )}

                {/* Lyric input */}
                {syncMode === "lyric" && (
                  <div>
                    <label style={s.label}>Paste LRC hoặc timestamp (format: [mm:ss] lyric text)</label>
                    <textarea value={lrcText} onChange={e => setLrcText(e.target.value)}
                      placeholder={"[00:10.50]Và em đã biết\n[00:15.20]Rằng anh không còn\n...\nHoặc: 10 - Scene mô tả"}
                      style={{ ...s.input, minHeight: 100, fontFamily: "monospace", fontSize: 12 }} />
                  </div>
                )}

                {syncMode === "whisper" && (
                  <div style={{ fontSize: 12, color: C.sub, padding: "8px 12px", background: "#111", borderRadius: 6 }}>
                    🤖 Sẽ dùng HuggingFace Whisper để tự nhận diện lời/timestamp trong file nhạc.
                    {!process.env.NEXT_PUBLIC_HAS_HF_TOKEN && " (Cần HF_TOKEN trong .env.local)"}
                  </div>
                )}

                {/* Analyze button */}
                {syncMode !== "fill" && musicFile && (
                  <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={analyzeSync} disabled={analyzingMusic}
                      style={{ ...s.btn("#2a5298"), opacity: analyzingMusic ? 0.6 : 1 }}>
                      {analyzingMusic ? "⏳ Phân tích..." : "🔍 Phân tích nhạc"}
                    </button>
                    {syncResult && (
                      <span style={{ fontSize: 12, color: "#3d8c40" }}>
                        ✓ {syncResult.points.length} điểm sync
                      </span>
                    )}
                  </div>
                )}

                {/* Sync points preview */}
                {syncResult && syncResult.points.length > 0 && (
                  <div style={{ marginTop: 10, maxHeight: 100, overflowY: "auto", fontSize: 11, color: C.sub, fontFamily: "monospace", background: "#111", padding: "8px", borderRadius: 6 }}>
                    {syncResult.points.slice(0, 20).map((pt, i) => (
                      <div key={i}>{`[${pt.time.toFixed(1)}s → ${syncResult.sceneDurations[i]?.toFixed(1)}s] ${pt.label ?? `Scene ${i+1}`}`}</div>
                    ))}
                    {syncResult.points.length > 20 && <div>...+{syncResult.points.length - 20} điểm nữa</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Formats + Run */}
            <div style={{ ...s.panel, display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <label style={s.label}>Format</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["youtube", "shorts", "tiktok"].map(fmt => (
                    <button key={fmt} onClick={() => setFormats(f => f.includes(fmt) ? f.filter(x=>x!==fmt) : [...f, fmt])}
                      style={{ ...s.btn(formats.includes(fmt) ? channel.accent : "#222"), padding: "5px 12px", fontSize: 12 }}>
                      {fmt === "youtube" ? "▶ YouTube" : fmt === "shorts" ? "📱 Shorts" : "🎵 TikTok"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1 }} />

              {running
                ? <button onClick={handleStop} style={{ ...s.btn("#7a1010"), padding: "10px 24px" }}>⏹ Dừng</button>
                : <button onClick={handleRun} disabled={!jsonScript.trim() || running}
                    style={{ ...s.btn(channel.accent), padding: "10px 24px", fontSize: 14, fontWeight: 700, opacity: !jsonScript.trim() ? 0.4 : 1 }}>
                    ▶ Chạy
                  </button>
              }
            </div>
          </div>

          {/* Right column — progress + output */}
          <div>

            {/* Scene grid */}
            {scenes.length > 0 && (
              <div style={{ ...s.panel, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  Tiến độ — {scenes.filter(s=>s.img==="ok").length}/{scenes.length} scenes
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {scenes.map(sc => (
                    <div key={sc.n} title={`Scene ${sc.n}`}
                      style={{
                        height: 34, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 600,
                        background: sc.img === "ok" ? "#0d2010" : sc.img === "err" ? "#2a0a0a" : "#1a1a1a",
                        border: `1px solid ${sc.img === "ok" ? "#2d6130" : sc.img === "err" ? "#6b1a1a" : C.border}`,
                        color: sc.img === "ok" ? "#4caf50" : sc.img === "err" ? "#ef5350" : C.muted,
                      }}>
                      {sc.n}
                      {sc.voice === "silent" && <span title="Voice lỗi — dùng silent" style={{ color: "#ff9800", marginLeft: 2 }}>⚠</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div style={{ ...s.panel, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Log</div>
                <div ref={logRef}
                  style={{ maxHeight: 220, overflowY: "auto", fontSize: 11, fontFamily: "monospace", color: C.sub, lineHeight: 1.7 }}>
                  {log.map((l, i) => (
                    <div key={i} style={{ color: l.startsWith("✅") ? "#4caf50" : l.startsWith("❌") ? "#ef5350" : l.startsWith("⚠") ? "#ff9800" : C.sub }}>{l}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Output */}
            {Object.keys(outputFiles).length > 0 && (
              <div style={{ ...s.panel }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>✅ Output</div>
                {Object.entries(outputFiles).map(([fmt, filePath]) => (
                  <div key={fmt} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: channel.accent, fontWeight: 600, marginBottom: 4 }}>
                      {fmt === "youtube" ? "▶ YouTube" : fmt === "shorts" ? "📱 Shorts" : "🎵 TikTok"}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, wordBreak: "break-all", marginBottom: 6 }}>{filePath}</div>
                    <a href={`/api/file?path=${encodeURIComponent(filePath)}`} download
                      style={{ ...s.btn("#2a5298"), padding: "4px 10px", fontSize: 11, textDecoration: "none" }}>
                      ⬇ Tải xuống
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Provider selector */}
            {providers.length > 0 && (
              <div style={{ ...s.panel, marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>🔌 Image Provider</span>
                  <button onClick={() => fetch("/api/providers").then(r=>r.json()).then(d=>{ setProviders(d.providers??[]); setActiveProviderState(d.active??"auto"); })}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12 }}>↺ Refresh</button>
                </div>

                {/* Auto option */}
                <div onClick={() => selectProvider("auto")}
                  style={{ padding: "8px 10px", borderRadius: 7, marginBottom: 6, cursor: "pointer",
                    border: `2px solid ${activeProvider === "auto" ? channel.accent : C.border}`,
                    background: activeProvider === "auto" ? "#1a1a1a" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: activeProvider === "auto" ? channel.accent : C.text }}>
                      🤖 Auto (khuyến nghị)
                    </div>
                    <span style={{ fontSize: 10, color: C.sub }}>fallback tự động</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    Fal.ai → Pollinations → HuggingFace → Cloudflare
                  </div>
                </div>

                {/* Individual providers */}
                {providers.map(p => {
                  const isActive = activeProvider === p.key;
                  const dotColor = !p.hasKey ? "#444" : p.status.ok ? "#3d8c40" : "#c97a00";
                  const disabled = !p.hasKey;
                  const qualityColor = p.quality === "S" ? "#f0c040" : p.quality === "A" ? "#4a9eff" : "#888";
                  return (
                    <div key={p.key}
                      onClick={() => !disabled && selectProvider(p.key)}
                      style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 6, cursor: disabled ? "not-allowed" : "pointer",
                        border: `2px solid ${isActive ? channel.accent : C.border}`,
                        background: isActive ? "#1c1c1c" : "#111",
                        opacity: disabled ? 0.4 : 1,
                        transition: "border-color 0.15s" }}>

                      {/* Row 1: name + tier badge + balance */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? channel.accent : C.text }}>{p.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: qualityColor,
                            background: `${qualityColor}22`, padding: "1px 6px", borderRadius: 4 }}>
                            {p.quality}
                          </span>
                        </div>
                        {/* Balance / quota display */}
                        <div style={{ textAlign: "right" }}>
                          {p.balanceLabel && (
                            <span style={{ fontSize: 12, fontWeight: 700,
                              color: p.unlimited ? "#3d8c40"
                                : p.balance != null && p.balance <= 0 ? "#ef5350"
                                : p.balance != null ? "#3d8c40"
                                : "#4a9eff" }}>
                              {p.balanceLabel}
                            </span>
                          )}
                          {!p.hasKey && <span style={{ fontSize: 11, color: "#555" }}>Chưa có key</span>}
                        </div>
                      </div>

                      {/* Row 2: model + free tag */}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 4 }}>
                        <span style={{ fontFamily: "monospace" }}>{p.model}</span>
                        {p.free && !p.unlimited && <span style={{ color: "#2a7" }}>free tier</span>}
                        {!p.free && p.balance != null && p.balance <= 0 && (
                          <span style={{ color: "#c97a00" }}>⚠ hết credit</span>
                        )}
                      </div>

                      {/* Cloudflare progress bar */}
                      {p.quota && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 3 }}>
                            <span>{p.quota.used.toLocaleString()} / {p.quota.limit.toLocaleString()} neurons hôm nay</span>
                            <span>reset: {p.quota.resetIn}</span>
                          </div>
                          <div style={{ height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${p.quota.pct}%`,
                              background: p.quota.pct > 80 ? "#c97a00" : p.quota.pct > 50 ? "#f0c040" : "#3d8c40",
                              borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      )}

                      {/* Last error */}
                      {p.status.lastError && (
                        <div style={{ fontSize: 10, color: "#c97a00", marginTop: 4, fontFamily: "monospace" }}>
                          {p.status.lastError.slice(0, 60)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Tạo kênh mới */}
      {showNewChannel && (
        <div onClick={() => setShowNewChannel(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ ...s.panel, width: 460, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>+ Tạo kênh mới</span>
              <span onClick={() => setShowNewChannel(false)} style={{ cursor: "pointer", color: C.sub }}>✕</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Tên kênh</label>
                <input value={newCh.name} onChange={e => setNewCh({ ...newCh, name: e.target.value })}
                  placeholder="VD: Gaming Facts" style={s.input} />
              </div>
              <div style={{ width: 70 }}>
                <label style={s.label}>Icon</label>
                <input value={newCh.icon} onChange={e => setNewCh({ ...newCh, icon: e.target.value })}
                  style={{ ...s.input, textAlign: "center" }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Màu accent</label>
              <div style={{ display: "flex", gap: 8 }}>
                {ACCENT_PRESETS.map(c => (
                  <div key={c} onClick={() => setNewCh({ ...newCh, accent: c })}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: newCh.accent === c ? "2px solid #fff" : "2px solid transparent" }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Thể loại / phong cách (dùng để AI tự viết kịch bản + ảnh)</label>
              <textarea value={newCh.genreDescription} onChange={e => setNewCh({ ...newCh, genreDescription: e.target.value })}
                placeholder="VD: video giải thích fact ngắn về game, hoạt hình flat 2D vui nhộn, màu sắc tươi sáng"
                style={{ ...s.input, minHeight: 70, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Số scene</label>
                <input value={newCh.sceneCountHint} onChange={e => setNewCh({ ...newCh, sceneCountHint: e.target.value })}
                  placeholder="10-15" style={s.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Có giọng đọc?</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button onClick={() => setNewCh({ ...newCh, hasVoice: true })}
                    style={{ ...s.btn(newCh.hasVoice ? newCh.accent : "#222"), fontSize: 12, padding: "6px 12px" }}>Có voice</button>
                  <button onClick={() => setNewCh({ ...newCh, hasVoice: false })}
                    style={{ ...s.btn(!newCh.hasVoice ? newCh.accent : "#222"), fontSize: 12, padding: "6px 12px" }}>Chỉ text</button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={s.label}>Format mặc định</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["youtube", "shorts", "tiktok"].map(f => (
                  <button key={f} onClick={() => setNewCh({ ...newCh, formats: newCh.formats.includes(f) ? newCh.formats.filter(x => x !== f) : [...newCh.formats, f] })}
                    style={{ ...s.btn(newCh.formats.includes(f) ? newCh.accent : "#222"), fontSize: 12, padding: "6px 12px" }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={createChannel} disabled={creatingChannel || !newCh.name.trim()}
              style={{ ...s.btn(newCh.accent), width: "100%", justifyContent: "center", opacity: creatingChannel || !newCh.name.trim() ? 0.6 : 1 }}>
              {creatingChannel ? "⏳ Đang tạo..." : "✦ Tạo kênh"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
