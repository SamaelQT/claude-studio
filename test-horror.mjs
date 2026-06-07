import { fal } from "@fal-ai/client";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
fal.config({ credentials: env.match(/FAL_KEY=(.+)/)[1].trim() });

// Test 3 approach khác nhau — xem cái nào kinh dị nhất
const tests = [
  {
    name: "flux-pro-ultra",
    model: "fal-ai/flux-pro/v1.1-ultra",
    prompt: `Junji Ito manga panel style, ink on paper, extreme horror. A young Vietnamese woman sitting in a dark room — but something is DEEPLY WRONG: her shadow on the wall behind her is shaped like a different person reaching toward her, dozens of eyes are visible in the darkness between the wall cracks, a hand with too many fingers is emerging from under the floorboards near her feet, on the wall behind her someone has scratched "dia chi nha ban" (your home address) in blood. She has not noticed any of this yet. Hyperdetailed crosshatch ink shading, Junji Ito signature style, black and white with blood red accents only, 16:9`,
  },
  {
    name: "flux-dev-specific",
    model: "fal-ai/flux/dev",
    prompt: `Junji Ito horror manga art style, black ink illustration. Close-up: a Vietnamese woman's face in dim light — her eyes are looking at the viewer but her reflection in the window behind her is facing a DIFFERENT direction staring at something off-screen. The reflection has been there longer — it looks older, more decayed. Mold growing in corner. Water stain on ceiling shaped like a human figure. Extreme ink detail, horror, deeply unsettling, 16:9 widescreen`,
  },
  {
    name: "flux-dev-bodyhORROR",
    model: "fal-ai/flux/dev",
    prompt: `Korean horror webtoon art style, 2D illustration. Wide shot of a dark Vietnamese apartment hallway at 3AM. A woman stands at the end of the hallway — but the hallway is longer than it should be, impossibly long, the perspective is WRONG. There are 6 doors on each side but the apartment should only have 3 rooms. One door is slightly open and inside is pure darkness with two points of light like eyes. The woman's feet are not touching the floor. Mold, decay, broken lights, highly detailed horror atmosphere, ink shading, cold blues and blacks, 16:9`,
  },
];

for (const t of tests) {
  console.log(`\nTesting: ${t.name}...`);
  const t0 = Date.now();
  try {
    const r = await fal.subscribe(t.model, {
      input: {
        prompt: t.prompt,
        image_size: "landscape_16_9",
        num_images: 1,
        num_inference_steps: t.model.includes("ultra") ? 30 : 50,
        guidance_scale: 7.5,
        seed: 666,
        ...(t.model.includes("ultra") ? {} : {}),
      },
    });
    const buf = Buffer.from(await (await fetch(r.data.images[0].url)).arrayBuffer());
    fs.writeFileSync(`test-horror-${t.name}.png`, buf);
    console.log(`✅ ${t.name}: ${((Date.now()-t0)/1000).toFixed(0)}s, ${(buf.length/1024).toFixed(0)}KB`);
  } catch(e) {
    console.log(`❌ ${t.name}: ${e.message}`);
  }
}
console.log("\nMở 3 file test-horror-*.png so sánh");
