import fs from "fs";
import path from "path";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

// ── Seed từ filename ──────────────────────────────────────────────────────────
function seedFromFilename(filename: string): number {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = (hash * 31 + filename.charCodeAt(i)) >>> 0;
  }
  return (hash % 9_000_000) + 1_000_000;
}

// ── Provider status (in-memory) ───────────────────────────────────────────────
export type ProviderKey = "fal" | "pollinations" | "huggingface" | "cloudflare";

export const providerStatus: Record<ProviderKey, { ok: boolean; lastError?: string; lastUsed?: number }> = {
  fal:          { ok: true },
  pollinations: { ok: true },
  huggingface:  { ok: true },
  cloudflare:   { ok: true },
};

// Active provider được chọn từ UI (null = auto theo priority)
let activeProvider: ProviderKey | "auto" = "auto";

export function setActiveProvider(p: ProviderKey | "auto") {
  activeProvider = p;
  console.log(`[image] provider set to: ${p}`);
}

export function getActiveProvider() { return activeProvider; }

// ── Provider implementations ──────────────────────────────────────────────────

async function tryFal(prompt: string, seed: number, style?: string): Promise<Buffer> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");

  const guidanceScale = style?.startsWith("wansee") ? 4.5 : style === "huong-noi" ? 3.0 : 3.5;

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
      num_inference_steps: 35,
      guidance_scale: guidanceScale,
      seed,
    },
  }) as { data: { images: Array<{ url: string }> } };

  const imageUrl = result.data.images[0].url;
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Fal download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tryPollinations(prompt: string, seed: number): Promise<Buffer> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&seed=${seed}&model=flux&nologo=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) throw new Error(`Pollinations non-image: ${ct}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tryHuggingFace(prompt: string): Promise<Buffer> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN not set");
  const res = await fetch(
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { width: 1920, height: 1080 } }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HuggingFace HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) throw new Error(`HuggingFace non-image: ${ct}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tryCloudflare(prompt: string): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) throw new Error("CF_ACCOUNT_ID / CF_API_TOKEN not set");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, num_steps: 4, width: 1920, height: 1080 }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);
  const json = await res.json() as { result?: { image?: string } };
  if (!json.result?.image) throw new Error("Cloudflare: no image in response");
  return Buffer.from(json.result.image, "base64");
}

// ── Priority order (top = tốt nhất, dùng trước) ───────────────────────────────
// Fal đứng đầu vì chất lượng tốt nhất khi còn balance
// Khi hết balance → tự động xuống Pollinations → HuggingFace → Cloudflare
const AUTO_PRIORITY: ProviderKey[] = ["fal", "pollinations", "huggingface", "cloudflare"];

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateImage(
  prompt: string,
  filename: string,
  outDir?: string,
  style?: string,
  providerOverride?: ProviderKey | "auto",
): Promise<{ path: string; usedProvider: ProviderKey }> {
  const seed = seedFromFilename(filename);
  const dir = outDir ?? path.join(process.cwd(), "output", "images");
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${filename}.png`);

  // Nếu file đã có (cache), trả về luôn
  if (fs.existsSync(outputPath)) {
    return { path: outputPath, usedProvider: "pollinations" };
  }

  const chosen = providerOverride ?? activeProvider;
  const tryList: ProviderKey[] = chosen === "auto"
    ? AUTO_PRIORITY.filter(k => {
        // Bỏ qua provider không có key
        if (k === "fal" && !process.env.FAL_KEY) return false;
        if (k === "huggingface" && !process.env.HF_TOKEN) return false;
        if (k === "cloudflare" && (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN)) return false;
        return true;
      })
    : [chosen];

  const errors: string[] = [];

  for (const key of tryList) {
    try {
      let buf: Buffer;
      if (key === "fal")          buf = await tryFal(prompt, seed, style);
      else if (key === "pollinations") buf = await tryPollinations(prompt, seed);
      else if (key === "huggingface")  buf = await tryHuggingFace(prompt);
      else                             buf = await tryCloudflare(prompt);

      fs.writeFileSync(outputPath, buf);
      providerStatus[key] = { ok: true, lastUsed: Date.now() };
      console.log(`[image] ${key} ✓ ${filename}`);
      return { path: outputPath, usedProvider: key };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${key}: ${msg}`);
      providerStatus[key] = { ok: false, lastError: msg, lastUsed: Date.now() };
      console.warn(`[image] ${key} ✗ ${msg}`);
      // Nếu chọn thủ công (không phải auto), throw luôn, không fallback
      if (chosen !== "auto") throw new Error(`${key} failed: ${msg}`);
    }
  }

  throw new Error(`Tất cả providers thất bại:\n${errors.join("\n")}`);
}

// ── Fal balance ───────────────────────────────────────────────────────────────
export async function getFalBalance(): Promise<number | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://fal.ai/api/billing/balance", {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { balance?: number };
    return json.balance ?? null;
  } catch {
    return null;
  }
}
