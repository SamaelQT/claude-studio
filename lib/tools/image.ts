import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

export async function generateImage(prompt: string, filename: string, outDir?: string): Promise<string> {

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
      num_inference_steps: 4,
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
