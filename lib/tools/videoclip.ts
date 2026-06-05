import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

export async function generateVideoClip(
  imagePath: string,
  motionPrompt: string,
  filename: string,
  outDir?: string
): Promise<string> {
  fal.config({ credentials: process.env.FAL_KEY });

  const dir = outDir ?? path.join(process.cwd(), "output", "clips");
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${filename}.mp4`);

  if (fs.existsSync(outputPath)) return outputPath;

  // Upload ảnh lên fal storage để lấy URL
  const imageBuffer = fs.readFileSync(imagePath);
  const imageFile = new File([imageBuffer], path.basename(imagePath), { type: "image/png" });
  const imageUrl = await fal.storage.upload(imageFile);

  // Kling image-to-video
  const result = await fal.subscribe("fal-ai/kling-video/v1.6/standard/image-to-video", {
    input: {
      image_url: imageUrl,
      prompt: motionPrompt,
      duration: "5",
      aspect_ratio: "16:9",
    },
  }) as { data: { video: { url: string } } };

  const videoUrl = result.data.video.url;
  const response = await fetch(videoUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
