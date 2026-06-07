import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

// Seed: kết hợp project + scene number → mỗi scene có composition khác nhau
// nhưng vẫn reproducible (chạy lại cùng scene = cùng ảnh)
function seedFromFilename(filename: string): number {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    hash = (hash * 31 + filename.charCodeAt(i)) >>> 0;
  }
  return (hash % 9_000_000) + 1_000_000; // 7-digit seed
}

// Guidance scale tối ưu theo style
// Flux: thấp = tự nhiên/dreamy, cao = prompt adherence mạnh hơn
function guidanceForStyle(style: string): number {
  if (style.startsWith("horror")) return 4.5;       // manga cần adherence cao hơn
  if (style === "introvert_sad") return 2.5;        // film grain tự nhiên, dreamy
  if (style === "introvert_fun") return 3.5;        // cozy illustration
  return 3.5;                                        // flux default
}

export async function generateImage(
  prompt: string,
  filename: string,
  outDir?: string,
  style?: string,
): Promise<string> {
  const seed = seedFromFilename(filename);
  const guidance_scale = guidanceForStyle(style ?? "");

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
      num_inference_steps: 35,   // 35 steps đủ tốt, nhanh hơn 50
      guidance_scale,
      seed,
    },
  }) as { data: { images: Array<{ url: string }> } };

  const imageUrl = result.data.images[0].url;
  const response = await fetch(imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const dir = outDir ?? path.join(process.cwd(), "output", "images");
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${filename}.png`);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
