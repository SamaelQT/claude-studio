import React from "react";
import { Composition } from "remotion";
import { AiTipVideo } from "./Video";
import type { Props } from "./types";
import { H, W } from "./theme";
// Bản mặc định để xem trước trong Remotion Studio (npm run studio). Khi render, render.mjs truyền kịch bản thật qua inputProps.
import script from "../scripts/01-zalo-don-hang.json";
import timeline from "../public/01-zalo-don-hang/timeline.json";

export const Root: React.FC = () => (
  <Composition
    id="AiTip"
    component={AiTipVideo}
    width={W}
    height={H}
    fps={30}
    durationInFrames={300}
    defaultProps={{ script, timeline } as Props}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil(props.timeline.total * 30) })}
  />
);
