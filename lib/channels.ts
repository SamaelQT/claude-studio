import { WANSEE_VIDEOS } from "./wansee-videos";

export interface ChannelVideo {
  id: string;
  title: string;
  views: number;
  url: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  style: "horror" | "history" | "facts" | "gaming" | "lifestyle";
  videos: ChannelVideo[];
}

export const CHANNELS: Channel[] = [
  {
    id: "wansee",
    name: "Wansee Entertainment",
    description: "Kinh dị hoạt hình 2D • Tiếng Anh → Tiếng Việt",
    style: "horror",
    videos: WANSEE_VIDEOS.map((v) => ({
      id: v.id,
      title: v.title,
      views: v.views,
      url: v.url,
    })),
  },
  // Thêm kênh mới ở đây, ví dụ:
  // {
  //   id: "top5_unknowns",
  //   name: "Top 5 Unknowns",
  //   description: "Bí ẩn & sự thật kỳ lạ • Tiếng Anh → Tiếng Việt",
  //   style: "facts",
  //   videos: [],
  // },
];
