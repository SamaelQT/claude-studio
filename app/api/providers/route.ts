import { NextRequest, NextResponse } from "next/server";
import { providerStatus, setActiveProvider, getActiveProvider, ProviderKey } from "@/lib/tools/image";

// ── Fal.ai balance ────────────────────────────────────────────────────────────
async function getFalInfo(): Promise<{ balance: number | null; currency: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { balance: null, currency: "USD" };
  try {
    // Fal.ai credits endpoint
    const res = await fetch("https://fal.ai/api/credits", {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json() as { credits?: number; balance?: number };
      const val = json.credits ?? json.balance ?? null;
      return { balance: val, currency: "USD" };
    }
    // Fallback endpoint
    const res2 = await fetch("https://rest.alpha.fal.ai/billing/credits", {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res2.ok) {
      const json2 = await res2.json() as { credits?: number };
      return { balance: json2.credits ?? null, currency: "USD" };
    }
    return { balance: null, currency: "USD" };
  } catch {
    return { balance: null, currency: "USD" };
  }
}

// ── Cloudflare AI usage ───────────────────────────────────────────────────────
async function getCfUsage(): Promise<{ neuronsUsed: number | null; neuronsLimit: number; resetIn: string } | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) return null;
  try {
    // Get today's date range
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/usage?since=${today}&until=${today}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json() as { result?: { total_neurons?: number } };
    const used = json.result?.total_neurons ?? 0;
    // Free tier: 10,000 neurons/day
    const limit = 10_000;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const diffMs = midnight.getTime() - now.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
    return { neuronsUsed: used, neuronsLimit: limit, resetIn: `${diffH}h ${diffM}m` };
  } catch {
    return null;
  }
}

// ── HuggingFace key check ─────────────────────────────────────────────────────
async function checkHfKey(): Promise<{ valid: boolean; tier?: string }> {
  const token = process.env.HF_TOKEN;
  if (!token) return { valid: false };
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { valid: false };
    const json = await res.json() as { type?: string; isPro?: boolean };
    return { valid: true, tier: json.isPro ? "PRO" : "Free" };
  } catch {
    return { valid: false };
  }
}

// ── GET /api/providers ────────────────────────────────────────────────────────
export async function GET() {
  const [falInfo, cfUsage, hfCheck] = await Promise.all([
    getFalInfo(),
    getCfUsage(),
    checkHfKey(),
  ]);

  const providers = [
    {
      key: "fal",
      name: "Fal.ai",
      model: "FLUX/dev",
      quality: "S",
      free: false,
      hasKey: !!process.env.FAL_KEY,
      balance: falInfo.balance,
      balanceLabel: falInfo.balance != null ? `$${falInfo.balance.toFixed(2)}` : null,
      quota: null,
      status: providerStatus.fal,
    },
    {
      key: "pollinations",
      name: "Pollinations.ai",
      model: "FLUX",
      quality: "A",
      free: true,
      unlimited: true,
      hasKey: true,
      balance: null,
      balanceLabel: "∞ Unlimited",
      quota: null,
      status: providerStatus.pollinations,
    },
    {
      key: "huggingface",
      name: "HuggingFace",
      model: "FLUX.1-schnell",
      quality: "B",
      free: true,
      unlimited: false,
      hasKey: hfCheck.valid,
      balance: null,
      balanceLabel: hfCheck.valid ? `Free (${hfCheck.tier})` : null,
      quota: null,
      status: providerStatus.huggingface,
    },
    {
      key: "cloudflare",
      name: "Cloudflare AI",
      model: "FLUX.1-schnell",
      quality: "B",
      free: true,
      unlimited: false,
      hasKey: !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN),
      balance: null,
      balanceLabel: cfUsage ? `${(cfUsage.neuronsLimit - (cfUsage.neuronsUsed ?? 0)).toLocaleString()} neurons left` : null,
      quota: cfUsage ? {
        used: cfUsage.neuronsUsed ?? 0,
        limit: cfUsage.neuronsLimit,
        pct: Math.round(((cfUsage.neuronsUsed ?? 0) / cfUsage.neuronsLimit) * 100),
        resetIn: cfUsage.resetIn,
      } : null,
      status: providerStatus.cloudflare,
    },
  ];

  return NextResponse.json({ providers, active: getActiveProvider() });
}

// ── POST /api/providers ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as { provider: ProviderKey | "auto" };
  if (!body.provider) return NextResponse.json({ error: "provider required" }, { status: 400 });
  setActiveProvider(body.provider);
  return NextResponse.json({ ok: true, active: body.provider });
}
