"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { WANSEE_CATALOG, WanseeStory } from "@/lib/wansee-catalog";
import { runFromJSON, ScriptJSON, RunEvent, MusicConfig, generatePreviewImage, PREVIEW_SCENES } from "@/lib/agent/json-runner";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "horror" | "introvert" | "idea";
type SceneState = { n: number; image: "idle" | "ok" | "err"; voice: "idle" | "ok" | "err" | "skip"; voice_text?: string };
type OutputProject = { name: string; file: string; path: string; sizeMB: number; date: string };
type MusicFile = { name: string; path: string };

interface RunState {
  running: boolean;
  log: string[];
  scenes: SceneState[];
  done: boolean;
  outputFiles: Record<string, string>;
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function horrorPrompt(title: string) {
  return `Bạn là AI viết kịch bản horror YouTube tiếng Việt theo style Wansee Entertainment.

Tạo JSON kịch bản cho video: "${title}"

JSON FORMAT — trả về JSON thuần, KHÔNG markdown:
{
  "project_name": "ten_du_an_a_z_0_9",
  "style": "horror",
  "character_sheet": "mô tả nhân vật chính để giữ consistency",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "mô tả cảnh, PHẢI có 1 chi tiết SAI (shadow wrong, reflection different, extra fingers...)",
      "voice_text": "60-80 chữ, ngôi thứ nhất, dùng ... ngắt nhịp, KHÔNG dùng !"
    }
  ],
  "formats": ["youtube"]
}

QUY TẮC:
- 20-22 scenes
- Cấu trúc: Scene 1-3 bình thường → 4-7 dấu hiệu lạ → 8-13 leo thang → 14-18 cao trào → 19-22 kết ám ảnh
- image_prompt: PHẢI có chi tiết SAI cụ thể
- voice_text: 60-80 chữ, ... ngắt nhịp, không "!"
- project_name: chỉ a-z 0-9 gạch dưới`;
}

function introvertPrompt(topic: string) {
  return `Bạn là AI viết kịch bản video "Chuyện Người Hướng Nội" — kiểu meme/relatable content.

Tạo JSON kịch bản cho chủ đề: "${topic}"

JSON FORMAT — trả về JSON thuần, KHÔNG markdown:
{
  "project_name": "ten_du_an_a_z_0_9",
  "style": "introvert",
  "scenes": [
    {
      "n": 1,
      "image_prompt": "cozy aesthetic scene — bedroom, cafe, rainy window, desk lamp. Muted pastel tones",
      "main_text": "câu chính — ngắn, relatable, đúng cảm xúc",
      "punchline": "câu reaction/punchline bên dưới (optional)",
      "duration": 5
    }
  ],
  "formats": ["youtube", "shorts"]
}

QUY TẮC:
- 10-15 scenes
- Mỗi scene = 1 ý/cảm xúc, không cần voice
- main_text: ngắn gọn, đúng tâm trạng, tiếng Việt tự nhiên
- punchline: reaction hài/buồn, optional
- image_prompt: aesthetic, cozy, không có người`;
}

function buildGenericPrompt(style: string, topic: string) {
  const styleMap: Record<string, string> = {
    history: "kênh lịch sử Việt Nam, ngôi thứ ba, nghiêm túc, có tư liệu",
    facts: "kênh kiến thức/facts, ngắn gọn, thú vị, có số liệu",
    gaming: "kênh gaming Việt Nam, hào hứng, nhanh, slang gaming",
    story: "kênh tâm sự chuyện người thật, ngôi thứ nhất, cảm xúc",
  };
  return `Bạn là AI viết kịch bản YouTube tiếng Việt theo style: ${styleMap[style] ?? style}.

Tạo JSON kịch bản cho: "${topic}"

Trả về JSON với project_name, style="${style}", scenes (n, image_prompt, voice_text), formats.
Số scene: 15-20. voice_text: 50-80 chữ/scene.`;
}

// ── Shared styles ──────────────────────────────────────────────────────────────
function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "7px 14px", background: bg, color: "#fff", border: "none",
    borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
    marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4,
  };
}

const inputStyle: React.CSSProperties = {
  background: "#111", color: "#e0e0e0", border: "1px solid #333",
  borderRadius: 6, padding: "6px 10px", fontSize: 12, outline: "none",
};

const selectStyle: React.CSSProperties = {
  background: "#111", color: "#e0e0e0", border: "1px solid #333",
  borderRadius: 6, padding: "6px 10px", fontSize: 12,
};

// ── Small components ───────────────────────────────────────────────────────────
function Chip({ label, value, color = "#e0e0e0" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Music Duration Calculator ──────────────────────────────────────────────────
function MusicDurationCalc({ scenes, offset, onCalc }: { scenes: number; offset: number; onCalc: (s: number) => void }) {
  const [totalSec, setTotalSec] = useState("");
  const avail = Math.max(0, (parseInt(totalSec) || 0) - offset);
  const perScene = scenes > 0 && avail > 0 ? Math.round(avail / scenes) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#666" }}>Nhạc dài (s):</span>
      <input type="number" min={0} value={totalSec} onChange={e => setTotalSec(e.target.value)}
        placeholder="240"
        style={{ ...inputStyle, width: 58, textAlign: "center", fontSize: 11 }} />
      {perScene > 0 && (
        <button onClick={() => onCalc(perScene)}
          style={{ padding: "3px 8px", background: "#1f2937", color: "#60a5fa", border: "1px solid #374151", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
          → {perScene}s/scene
        </button>
      )}
    </div>
  );
}

// ── Style Preview component ────────────────────────────────────────────────────
function StylePreview({ styleKey, onConfirm }: { styleKey: string; onConfirm: (extra: string) => void }) {
  const [sceneDesc, setSceneDesc] = useState(PREVIEW_SCENES[styleKey] ?? "");
  const [extraNotes, setExtraNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgPath, setImgPath] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true); setError(""); setImgPath("");
    const res = await generatePreviewImage(styleKey, sceneDesc, extraNotes);
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    setImgPath(res.filePath);
  }

  function confirm() {
    setConfirmed(true);
    onConfirm(extraNotes);
  }

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Xem thử style ảnh
      </div>

      {confirmed ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#4ade80" }}>✓ Style đã xác nhận{extraNotes ? ` — "${extraNotes}"` : ""}</span>
          <button onClick={() => { setConfirmed(false); setImgPath(""); }} style={{ ...btnStyle("#374151"), marginTop: 0, fontSize: 11, padding: "4px 10px" }}>Đổi style</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Cảnh test</div>
            <textarea value={sceneDesc} onChange={e => setSceneDesc(e.target.value)}
              style={{ ...inputStyle, width: "100%", height: 56, resize: "vertical", boxSizing: "border-box" as const, fontFamily: "inherit", fontSize: 11 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Yêu cầu thêm (optional)</div>
            <input value={extraNotes} onChange={e => setExtraNotes(e.target.value)}
              placeholder="VD: tối hơn, nhiều bóng tối, màu lạnh hơn..."
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: imgPath ? 12 : 0 }}>
            <button onClick={generate} disabled={loading} style={btnStyle(loading ? "#374151" : "#4b5563")}>
              {loading ? "Đang tạo ảnh..." : imgPath ? "↻ Tạo lại" : "👁 Xem thử"}
            </button>
            {imgPath && <button onClick={confirm} style={{ ...btnStyle("#16a34a"), marginTop: 0 }}>✓ Xác nhận style này</button>}
          </div>
          {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{error}</div>}
          {imgPath && (
            <img
              src={`/api/file?path=${encodeURIComponent(imgPath)}`}
              alt="style preview"
              style={{ width: "100%", borderRadius: 6, border: "1px solid #333", marginTop: 4, display: "block" }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Run Panel (shared by Horror and Introvert) ─────────────────────────────────
function RunPanel({
  style, styleVariant, styleExtra, music, musicFiles, onMusicChange,
}: {
  style: string;
  styleVariant?: string;
  styleExtra?: string;
  music: MusicConfig | null;
  musicFiles: MusicFile[];
  onMusicChange: (m: MusicConfig | null) => void;
}) {
  const [jsonText, setJsonText] = useState("");
  const [script, setScript] = useState<ScriptJSON | null>(null);
  const [parseError, setParseError] = useState("");
  const [run, setRun] = useState<RunState>({ running: false, log: [], scenes: [], done: false, outputFiles: {} });
  const [outputs, setOutputs] = useState<OutputProject[]>([]);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMsg, setCacheMsg] = useState("");
  const [sceneDuration, setSceneDuration] = useState(8);
  const abortRef = useRef<AbortController | null>(null);

  const isNoVoice = style === "introvert";

  const loadOutputs = useCallback(async () => {
    const r = await fetch(`/api/output?style=${style}`).then(r => r.json()).catch(() => ({ projects: [] }));
    setOutputs(r.projects ?? []);
  }, [style]);

  useEffect(() => { loadOutputs(); }, [loadOutputs]);

  function parseJSON() {
    try {
      const parsed = JSON.parse(jsonText.trim());
      setScript(parsed);
      setParseError("");
      setCacheMsg("");
    } catch (e) {
      setParseError(String(e));
      setScript(null);
    }
  }

  async function clearImageCache() {
    if (!script) return;
    setClearingCache(true); setCacheMsg("");
    const res = await fetch(`/api/cache?project=${script.project_name}&style=${style}`, { method: "DELETE" })
      .then(r => r.json()).catch(() => null);
    setClearingCache(false);
    setCacheMsg(res?.deleted != null ? `✓ Đã xóa ${res.deleted} ảnh cũ — sẽ tạo lại khi chạy` : "Lỗi xóa cache");
  }

  async function startRun() {
    if (!script) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const scenes: SceneState[] = script.scenes.map(s => ({
      n: s.n, image: "idle", voice: s.voice_text ? "idle" : "skip",
      voice_text: s.voice_text?.slice(0, 80),
    }));
    setRun({ running: true, log: [`Bắt đầu: ${script.project_name} — ${script.scenes.length} scenes`], scenes, done: false, outputFiles: {} });

    await runFromJSON(script, (ev: RunEvent) => {
      setRun(prev => {
        const log = [...prev.log];
        const sc = prev.scenes.map(s => ({ ...s }));
        if (ev.type === "scene_start") log.push(`Scene ${ev.n}/${ev.total}...`);
        if (ev.type === "image_done") { sc[ev.n - 1].image = "ok"; }
        if (ev.type === "image_error") { sc[ev.n - 1].image = "err"; log.push(`❌ Ảnh ${ev.n}: ${ev.error}`); }
        if (ev.type === "voice_done") { sc[ev.n - 1].voice = "ok"; }
        if (ev.type === "voice_error") { sc[ev.n - 1].voice = "err"; log.push(`❌ Voice ${ev.n}: ${ev.error}`); }
        if (ev.type === "assemble_start") log.push("Ghép video...");
        if (ev.type === "assemble_done") {
          log.push("✅ Xong!");
          return { ...prev, log, scenes: sc, running: false, done: true, outputFiles: ev.files };
        }
        if (ev.type === "assemble_error") {
          log.push(`❌ Ghép lỗi: ${ev.error}`);
          return { ...prev, log, scenes: sc, running: false };
        }
        if (ev.type === "done") return { ...prev, log, scenes: sc, running: false, done: true };
        return { ...prev, log, scenes: sc };
      });
    }, ctrl.signal, music ?? undefined, styleVariant, styleExtra, isNoVoice ? sceneDuration : undefined);

    loadOutputs();
  }

  function stopRun() {
    abortRef.current?.abort();
    setRun(prev => ({ ...prev, running: false, log: [...prev.log, "⏹ Đã dừng"] }));
  }

  const estimatedCost = script ? (script.scenes.length * 0.028).toFixed(2) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* JSON input */}
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
          JSON Script
        </div>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setScript(null); setParseError(""); }}
          placeholder="Paste JSON từ Claude.ai Pro vào đây..."
          style={{
            width: "100%", height: 150, background: "#111", color: "#e0e0e0",
            border: "1px solid #444", borderRadius: 6, padding: 10,
            fontFamily: "monospace", fontSize: 12, resize: "vertical", boxSizing: "border-box",
          }}
        />
        {parseError && <div style={{ color: "#f87171", fontSize: 11, marginTop: 4 }}>{parseError}</div>}
        <button onClick={parseJSON} style={btnStyle("#2563eb")}>
          Validate JSON
        </button>
      </div>

      {/* Script info */}
      {script && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Chip label="Project" value={script.project_name} />
              <Chip label="Style" value={styleVariant ?? script.style} />
              <Chip label="Scenes" value={String(script.scenes.length)} />
              <Chip label="Chi phí ~" value={`$${estimatedCost}`} color="#4ade80" />
              {script.formats && <Chip label="Formats" value={script.formats.join(", ")} />}
            </div>
            <button onClick={clearImageCache} disabled={clearingCache}
              title="Xóa ảnh + video cũ, force tạo lại"
              style={{ padding: "5px 10px", background: "#1f1010", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 5, cursor: "pointer", fontSize: 11, marginTop: 0 }}>
              {clearingCache ? "Đang xóa..." : "🗑 Xóa & làm mới"}
            </button>
          </div>

          {/* Duration control — chỉ hiện khi không có voice */}
          {isNoVoice && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#888" }}>Thời lượng/scene:</span>
                <input type="number" min={3} max={30} value={sceneDuration}
                  onChange={e => setSceneDuration(Math.max(3, +e.target.value))}
                  style={{ ...inputStyle, width: 52, textAlign: "center" }} />
                <span style={{ fontSize: 11, color: "#888" }}>giây</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>→</div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: "#e0e0e0", fontWeight: 600 }}>
                  {Math.floor(script.scenes.length * sceneDuration / 60)}m{String(script.scenes.length * sceneDuration % 60).padStart(2,"0")}s
                </span>
                <span style={{ color: "#555", fontSize: 11 }}> ({script.scenes.length} × {sceneDuration}s)</span>
              </div>
              <MusicDurationCalc
                scenes={script.scenes.length}
                offset={music?.auto?.startOffset ?? 0}
                onCalc={setSceneDuration}
              />
            </div>
          )}

          {cacheMsg && <div style={{ marginTop: 6, fontSize: 11, color: cacheMsg.startsWith("✓") ? "#4ade80" : "#f87171" }}>{cacheMsg}</div>}
        </div>
      )}

      {/* Run controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {!run.running ? (
          <button onClick={startRun} disabled={!script}
            style={btnStyle(script ? "#16a34a" : "#374151")}>
            ▶ Chạy Pipeline
          </button>
        ) : (
          <button onClick={stopRun} style={btnStyle("#dc2626")}>
            ⏹ Dừng
          </button>
        )}
        {run.done && (
          <button onClick={loadOutputs} style={{ ...btnStyle("#374151"), marginTop: 0 }}>
            ↻ Làm mới
          </button>
        )}
      </div>

      {/* Scene progress grid */}
      {run.scenes.length > 0 && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Tiến độ — {run.scenes.filter(s => s.image === "ok").length}/{run.scenes.length} ảnh
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {run.scenes.map(s => (
              <div key={s.n} title={s.voice_text ?? `Scene ${s.n}`}
                style={{
                  width: 34, height: 34, borderRadius: 4, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", fontSize: 9,
                  background: s.image === "ok" ? "#052e16" : s.image === "err" ? "#450a0a" : "#1a1a1a",
                  border: `1px solid ${s.image === "ok" ? "#16a34a" : s.image === "err" ? "#b91c1c" : "#333"}`,
                  color: "#aaa",
                }}>
                <div style={{ fontWeight: 700 }}>{s.n}</div>
                <div style={{ fontSize: 8, color: s.voice === "ok" ? "#4ade80" : s.voice === "err" ? "#f87171" : "#555" }}>
                  {s.voice === "ok" ? "♪" : ""}
                </div>
              </div>
            ))}
          </div>
          {run.log.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#888", fontFamily: "monospace" }}>
              {run.log[run.log.length - 1]}
            </div>
          )}
        </div>
      )}

      {/* Done output */}
      {Object.keys(run.outputFiles).length > 0 && (
        <div style={{ background: "#052e16", border: "1px solid #16a34a", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 8 }}>✅ Video đã xuất</div>
          {Object.entries(run.outputFiles).map(([fmt, p]) => (
            <div key={fmt} style={{ fontFamily: "monospace", fontSize: 11, color: "#86efac", marginBottom: 2 }}>
              [{fmt}] {p}
            </div>
          ))}
        </div>
      )}

      {/* Output history */}
      {outputs.length > 0 && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Output ({outputs.length} video)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {outputs.slice(0, 10).map(o => (
              <div key={o.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", background: "#111", borderRadius: 4, fontSize: 12,
              }}>
                <span style={{ color: "#e0e0e0", fontFamily: "monospace" }}>{o.name}</span>
                <span style={{ color: "#666", fontSize: 11 }}>{o.sizeMB}MB · {o.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Horror tab ─────────────────────────────────────────────────────────────────
function HorrorTab({ musicFiles }: { musicFiles: MusicFile[] }) {
  const [catOpen, setCatOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WanseeStory | null>(null);
  const [copied, setCopied] = useState(false);
  const [music] = useState<MusicConfig | null>(null);
  const [horrorLevel, setHorrorLevel] = useState<"horror_light" | "horror_heavy" | "horror_extreme">("horror_light");
  const [styleExtra, setStyleExtra] = useState("");

  const horrorLevels = [
    { key: "horror_light" as const, label: "👻 Nhẹ", desc: "Subtly wrong, psychological" },
    { key: "horror_heavy" as const, label: "😱 Nặng", desc: "Distorted, body horror" },
    { key: "horror_extreme" as const, label: "💀 Cực đại", desc: "Cosmic, visceral terror" },
  ];

  const filtered = WANSEE_CATALOG.filter(s =>
    !search ||
    s.titleVi.toLowerCase().includes(search.toLowerCase()) ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some(t => t.includes(search.toLowerCase()))
  );

  function selectStory(story: WanseeStory) {
    setSelected(story);
    setCopied(false);
  }

  function copyToClipboard() {
    if (!selected) return;
    navigator.clipboard.writeText(horrorPrompt(selected.titleVi));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, minHeight: 0 }}>
      {/* Catalog panel */}
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 120px)" }}>
        <div
          onClick={() => setCatOpen(!catOpen)}
          style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a2a2a", background: "#161616", flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>📁 Wansee</span>
          <span style={{ color: "#666", fontSize: 12 }}>{catOpen ? "▾" : "▸"} {WANSEE_CATALOG.length}</span>
        </div>
        {catOpen && (
          <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              style={{ ...inputStyle, width: "100%", marginBottom: 8, boxSizing: "border-box" as const }}
            />
            {filtered.map(story => (
              <div
                key={story.id}
                onClick={() => selectStory(story)}
                style={{
                  padding: "8px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 3,
                  background: selected?.id === story.id ? "#1e3a5f" : "transparent",
                  border: `1px solid ${selected?.id === story.id ? "#2563eb" : "transparent"}`,
                }}>
                <div style={{ fontSize: 12, color: "#e0e0e0" }}>{story.titleVi}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{story.tags.join(" · ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ overflow: "auto", maxHeight: "calc(100vh - 120px)" }}>
        {selected ? (
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 4 }}>{selected.titleVi}</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>{selected.setting}</div>
            <div style={{ fontStyle: "italic", color: "#aaa", fontSize: 12, marginBottom: 12, borderLeft: "2px solid #374151", paddingLeft: 10 }}>
              "{selected.hook}"
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyToClipboard} style={btnStyle(copied ? "#166534" : "#2563eb")}>
                {copied ? "✓ Đã copy" : "📋 Copy Prompt → Claude.ai Pro"}
              </button>
              <button onClick={() => setSelected(null)} style={{ ...btnStyle("#374151"), marginTop: 8 }}>Bỏ chọn</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "#161616", border: "1px dashed #2a2a2a", borderRadius: 10, padding: 16, marginBottom: 14, textAlign: "center", color: "#555", fontSize: 13 }}>
            👈 Chọn story từ catalog để lấy prompt
          </div>
        )}
        {/* Horror level picker */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Cấp độ kinh dị</div>
          <div style={{ display: "flex", gap: 8 }}>
            {horrorLevels.map(l => (
              <button key={l.key} onClick={() => setHorrorLevel(l.key)}
                style={{ padding: "7px 14px", background: horrorLevel === l.key ? "#450a0a" : "#1a1a1a", color: horrorLevel === l.key ? "#fca5a5" : "#888", border: `1px solid ${horrorLevel === l.key ? "#b91c1c" : "#333"}`, borderRadius: 6, cursor: "pointer", fontSize: 12, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span>{l.label}</span>
                <span style={{ fontSize: 9, color: horrorLevel === l.key ? "#f87171" : "#555" }}>{l.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <StylePreview styleKey={horrorLevel} onConfirm={extra => setStyleExtra(extra)} />
        <div style={{ marginTop: 14 }}>
          <RunPanel style="horror" styleVariant={horrorLevel} styleExtra={styleExtra} music={music} musicFiles={musicFiles} onMusicChange={() => {}} />
        </div>
      </div>
    </div>
  );
}

// ── Introvert tab ──────────────────────────────────────────────────────────────
function IntrovertTab({ musicFiles, onMusicUploaded }: { musicFiles: MusicFile[]; onMusicUploaded: () => void }) {
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [music, setMusic] = useState<MusicConfig | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mood, setMood] = useState<"introvert_sad" | "introvert_fun">("introvert_sad");
  const [styleExtra, setStyleExtra] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moodOptions = [
    { key: "introvert_sad" as const, label: "😔 Buồn / Tâm sự", desc: "Film grain, lạnh, cô đơn" },
    { key: "introvert_fun" as const, label: "😄 Vui / Meme", desc: "Pastel ấm, cozy, dễ thương" },
  ];

  async function uploadMusic(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/music", { method: "POST", body: form }).then(r => r.json()).catch(() => null);
    setUploading(false);
    if (res?.path) {
      onMusicUploaded();
      setMusic({ mode: "auto", auto: { musicPath: res.path, startOffset: 0, volume: 1.0, fadeIn: 0, fadeOut: 0 } });
    }
  }

  function copyPrompt() {
    if (!topic.trim()) return;
    navigator.clipboard.writeText(introvertPrompt(topic));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 16 }}>
      {/* Left: idea + music */}
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 14, height: "fit-content" }}>
        <div>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ý tưởng video</div>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="VD: người hướng nội khi bị ép đi chơi nhóm"
            style={{ ...inputStyle, width: "100%", height: 90, resize: "vertical", boxSizing: "border-box" as const, fontFamily: "inherit", fontSize: 12, display: "block" }}
          />
          <button onClick={copyPrompt} disabled={!topic.trim()}
            style={btnStyle(topic.trim() ? (copied ? "#166534" : "#7c3aed") : "#374151")}>
            {copied ? "✓ Đã copy" : "📋 Copy Prompt → Claude.ai Pro"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Nhạc nền</div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ padding: "3px 8px", background: "#1f2937", color: "#9ca3af", border: "1px solid #374151", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
              {uploading ? "Đang tải..." : "+ Upload"}
            </button>
            <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.flac" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadMusic(f); e.target.value = ""; }} />
          </div>
          <select
            value={music?.auto?.musicPath ?? ""}
            onChange={e => {
              if (!e.target.value) { setMusic(null); return; }
              setMusic({ mode: "auto", auto: { musicPath: e.target.value, startOffset: 0, volume: 1.0, fadeIn: 0, fadeOut: 0 } });
            }}
            style={{ ...selectStyle, width: "100%", marginBottom: 10, boxSizing: "border-box" as const }}
          >
            <option value="">— Không có nhạc —</option>
            {musicFiles.map(f => <option key={f.path} value={f.path}>{f.name}</option>)}
          </select>
          {music?.auto?.musicPath && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ color: "#aaa", fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                Volume: {Math.round(music.auto!.volume * 100)}%
                <input type="range" min={0} max={1} step={0.05} value={music.auto!.volume}
                  onChange={e => setMusic({ ...music!, auto: { ...music!.auto!, volume: +e.target.value } })} />
              </label>
              <label style={{ color: "#aaa", fontSize: 12 }}>
                Cắt intro (giây):&nbsp;
                <input type="number" min={0} value={music.auto!.startOffset}
                  onChange={e => setMusic({ ...music!, auto: { ...music!.auto!, startOffset: +e.target.value } })}
                  style={{ ...inputStyle, width: 55 }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: "#444", lineHeight: 1.6 }}>
          no voice · text overlay · 5s/scene
        </div>
      </div>

      {/* Right: mood picker + style preview + run panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Mood picker */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Mood video</div>
          <div style={{ display: "flex", gap: 10 }}>
            {moodOptions.map(m => (
              <button key={m.key} onClick={() => setMood(m.key)}
                style={{ flex: 1, padding: "10px 12px", background: mood === m.key ? (m.key === "introvert_sad" ? "#1e1b4b" : "#1a1200") : "#111", color: mood === m.key ? (m.key === "introvert_sad" ? "#a5b4fc" : "#fde68a") : "#777", border: `1px solid ${mood === m.key ? (m.key === "introvert_sad" ? "#4f46e5" : "#b45309") : "#333"}`, borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13 }}>{m.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <StylePreview styleKey={mood} onConfirm={extra => setStyleExtra(extra)} />
        <RunPanel style="introvert" styleVariant={mood} styleExtra={styleExtra} music={music} musicFiles={musicFiles} onMusicChange={setMusic} />
      </div>
    </div>
  );
}

// ── Idea tab ───────────────────────────────────────────────────────────────────
function IdeaTab() {
  const styles = [
    { key: "history", label: "📜 Lịch sử" },
    { key: "facts", label: "💡 Facts" },
    { key: "story", label: "💬 Tâm sự" },
    { key: "gaming", label: "🎮 Gaming" },
  ];
  const [style, setStyle] = useState("history");
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);

  function copyPrompt() {
    if (!topic.trim()) return;
    navigator.clipboard.writeText(buildGenericPrompt(style, topic));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 24 }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 15, color: "#e0e0e0" }}>Ý Tưởng Kênh Mới</h2>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Chọn style</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {styles.map(s => (
              <button key={s.key} onClick={() => setStyle(s.key)}
                style={{ padding: "6px 14px", background: style === s.key ? "#374151" : "#1f2937", color: "#e0e0e0", border: `1px solid ${style === s.key ? "#6b7280" : "#374151"}`, borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Ý tưởng / chủ đề</div>
          <textarea value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Mô tả ý tưởng video..."
            style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical", boxSizing: "border-box" as const, fontFamily: "inherit", display: "block" }}
          />
        </div>

        <button onClick={copyPrompt} disabled={!topic.trim()}
          style={btnStyle(topic.trim() ? (copied ? "#166534" : "#2563eb") : "#374151")}>
          {copied ? "✓ Đã copy prompt" : "📋 Copy Prompt → Claude.ai Pro"}
        </button>

        <div style={{ marginTop: 20, padding: 12, background: "#111", borderRadius: 8, fontSize: 11, color: "#555", lineHeight: 1.8 }}>
          <strong style={{ color: "#888" }}>Flow:</strong> Copy prompt → Claude.ai Pro → lấy JSON<br />→ Paste vào Horror hoặc Introvert tab → chạy pipeline
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function Page() {
  const [tab, setTab] = useState<Tab>("horror");
  const [horrorOpen, setHorrorOpen] = useState(true);
  const [musicFiles, setMusicFiles] = useState<MusicFile[]>([]);

  useEffect(() => {
    fetch("/api/music").then(r => r.json()).then(d => setMusicFiles(d.files ?? [])).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 196, background: "#111", borderRight: "1px solid #1f1f1f", padding: "14px 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "0 14px 14px", borderBottom: "1px solid #1f1f1f", marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>Content Studio</div>
          <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>CauChuyen30Dem</div>
        </div>

        {/* Horror folder */}
        <div>
          <div onClick={() => setHorrorOpen(!horrorOpen)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", cursor: "pointer", color: "#888", fontSize: 12, userSelect: "none" }}>
            <span>👻 Horror Content</span>
            <span style={{ color: "#444" }}>{horrorOpen ? "▾" : "▸"}</span>
          </div>
          {horrorOpen && (
            <div onClick={() => setTab("horror")}
              style={{
                padding: "6px 14px 6px 26px", cursor: "pointer", fontSize: 12,
                background: tab === "horror" ? "#1e3a5f" : "transparent",
                color: tab === "horror" ? "#60a5fa" : "#666",
                borderLeft: `2px solid ${tab === "horror" ? "#2563eb" : "transparent"}`,
              }}>
              📁 Wansee
            </div>
          )}
        </div>

        {/* Introvert */}
        <div onClick={() => setTab("introvert")}
          style={{
            padding: "7px 14px", cursor: "pointer", fontSize: 12,
            background: tab === "introvert" ? "#2d1b69" : "transparent",
            color: tab === "introvert" ? "#a78bfa" : "#888",
            borderLeft: `2px solid ${tab === "introvert" ? "#7c3aed" : "transparent"}`,
          }}>
          🌙 Hướng Nội
        </div>

        {/* Idea */}
        <div onClick={() => setTab("idea")}
          style={{
            padding: "7px 14px", cursor: "pointer", fontSize: 12,
            background: tab === "idea" ? "#1a1200" : "transparent",
            color: tab === "idea" ? "#fbbf24" : "#888",
            borderLeft: `2px solid ${tab === "idea" ? "#d97706" : "transparent"}`,
          }}>
          💡 Ý Tưởng Mới
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#e0e0e0" }}>
          {tab === "horror" && "👻 Horror Content — Wansee"}
          {tab === "introvert" && "🌙 Hướng Nội Content"}
          {tab === "idea" && "💡 Ý Tưởng Mới"}
        </h1>

        {tab === "horror" && <HorrorTab musicFiles={musicFiles} />}
        {tab === "introvert" && <IntrovertTab musicFiles={musicFiles} onMusicUploaded={() => fetch("/api/music").then(r => r.json()).then(d => setMusicFiles(d.files ?? []))} />}
        {tab === "idea" && <IdeaTab />}
      </div>
    </div>
  );
}
