import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const alt = "Des Moines Fencing Club";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Approximate hex equivalents of the design-system OKLCH tokens:
//   purple-950  oklch(20% 0.09 310)  → #1e0b30
//   brass       oklch(78% 0.17 75)   → #c9a23a
const PURPLE_950 = "#1e0b30";
const BRASS = "#c9a23a";

export default function OGImage() {
  // Load logo from disk so satori can render it (SVG data-URIs are not
  // supported by satori; PNG is safe).
  const logoData = fs.readFileSync(path.join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: PURPLE_950,
          padding: "0 96px",
          gap: 0,
        }}
      >
        {/* Badge */}
        <img
          src={logoSrc}
          width={148}
          height={148}
          style={{ marginBottom: 40 }}
        />

        {/* Brass strip rule — 1px line + centre tick, matching StripRule */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            marginBottom: 40,
          }}
        >
          <div style={{ flex: 1, height: 1, background: BRASS }} />
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: BRASS,
              margin: "0 16px",
            }}
          />
          <div style={{ flex: 1, height: 1, background: BRASS }} />
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 62,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-1.5px",
            lineHeight: 1,
            textAlign: "center",
            marginBottom: 22,
          }}
        >
          Des Moines Fencing Club
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 19,
            color: BRASS,
            letterSpacing: "3.5px",
            textTransform: "uppercase",
          }}
        >
          Olympic fencing in central Iowa
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
