export async function getYoutubeTranscript(videoId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY");

  // Fetch tất cả language tracks song song, lấy cái đầu tiên có nội dung
  const tryLang = async (lang: string): Promise<string> => {
    const url = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("not ok");
    const raw = await res.text();
    if (!raw || raw.trim().length < 10) throw new Error("empty");
    const data = JSON.parse(raw);
    const text = (data.events ?? [])
      .filter((e: { segs?: Array<{ utf8: string }> }) => e.segs)
      .map((e: { segs: Array<{ utf8: string }> }) => e.segs.map((s) => s.utf8).join(""))
      .join(" ")
      .replace(/\n/g, " ")
      .trim();
    if (text.length <= 50) throw new Error("too short");
    return text;
  };

  try {
    const text = await Promise.any(
      ["en", "vi", "zh-Hans", "zh-Hant", "ko", "ja", "th"].map(tryLang)
    );
    return text;
  } catch {
    // tất cả lang đều fail → fallback description
  }

  // Fallback: lấy title + description từ YouTube Data API
  return await getVideoDescription(videoId, apiKey);
}

async function getVideoDescription(videoId: string, apiKey: string): Promise<string> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);
  const { title, description } = item.snippet;
  return `Title: ${title}\n\nDescription:\n${description}`;
}
