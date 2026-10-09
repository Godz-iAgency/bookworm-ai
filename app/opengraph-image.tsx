import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * The picture shown when a link to the site is pasted into TikTok, a message,
 * LinkedIn or X. Drawn at build time from the brand mark, so it needs no design
 * file kept in sync.
 */
export const alt = "Bookworm AI: turn any book into a 7-day learning course";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const mark = await readFile(path.join(process.cwd(), "public", "brand", "mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 84px",
          background: "#080808",
          color: "#ffffff",
        }}
      >
        <img src={markSrc} width={300} height={300} style={{ marginRight: 64 }} />
        <div style={{ display: "flex", flexDirection: "column", width: 668 }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>
            <span>Bookworm&nbsp;</span>
            <span style={{ color: "#00D4FF" }}>AI</span>
          </div>
          <div style={{ marginTop: 22, fontSize: 44, lineHeight: 1.25, color: "#d4dae8" }}>
            Turn any book into a 7-day learning course
          </div>
          <div style={{ marginTop: 38, display: "flex", width: 280, height: 8, borderRadius: 8, background: "linear-gradient(90deg, #00D4FF, #FF006E)" }} />
          <div style={{ marginTop: 26, fontSize: 30, color: "#8d96ab" }}>bookworm-ai.app</div>
        </div>
      </div>
    ),
    size,
  );
}
