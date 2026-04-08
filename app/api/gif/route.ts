import { NextResponse } from "next/server";

const FALLBACK_GIFS = [
  "https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif",
  "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
  "https://media.giphy.com/media/26uf9QPzzlKPvQG5O/giphy.gif",
  "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif",
  "https://media.giphy.com/media/3ohs7KViF6rA4aan5u/giphy.gif",
  "https://media.giphy.com/media/l3vR85PnGsBwu1PFK/giphy.gif",
  "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
  "https://media.giphy.com/media/3o6ZsY8M8fV7QYQYLu/giphy.gif",
  "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif",
  "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
  "https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/giphy.gif",
  "https://media.giphy.com/media/3o6Mbbs879ozZ9Yic0/giphy.gif",
];

type TenorMediaItem = {
  url?: string;
};

type GiphyGifItem = {
  images?: {
    original?: TenorMediaItem;
    downsized_large?: TenorMediaItem;
    downsized?: TenorMediaItem;
  };
};

export async function GET() {
  try {
    const key = process.env.GIPHY_API_KEY;
    if (!key) {
      throw new Error("Missing GIPHY_API_KEY.");
    }

    const queryPool = [
      "mountain landscape",
      "nature timelapse",
      "scenic clouds",
      "hiking mountain",
      "snow peaks",
      "forest sunrise",
    ];
    const selectedQuery = queryPool[Math.floor(Math.random() * queryPool.length)];
    const randomOffset = Math.floor(Math.random() * 300);
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/random?api_key=${encodeURIComponent(key)}&tag=${encodeURIComponent(
        selectedQuery,
      )}&rating=pg-13&random_id=${Date.now()}-${randomOffset}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch GIFs from Giphy.");
    }

    const data = (await response.json()) as { data?: GiphyGifItem };
    const giphyUrl = data.data?.images?.original?.url ?? data.data?.images?.downsized_large?.url ?? data.data?.images?.downsized?.url;
    if (giphyUrl) {
      return NextResponse.json({ ok: true, source: "giphy", url: giphyUrl });
    }

    return NextResponse.json({ ok: true, source: "fallback", url: FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)] });
  } catch {
    return NextResponse.json({ ok: false, source: "fallback", url: FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)] });
  }
}
