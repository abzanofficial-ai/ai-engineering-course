import { ImageResponse } from "next/og";
import { defaultBranding as brand } from "@/lib/branding";

// The card shown when the site is shared on social media and in messages.
export const alt = `${brand.name}: from zero to AI engineer`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#ffffff",
        background: "linear-gradient(120deg, #3f37c9, #6d28d9 55%, #be185d)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${brand.colors.mark.join(", ")})`,
          }}
        />
        {brand.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>
          From zero to AI engineer, and paid for it.
        </div>
        <div style={{ fontSize: 32, opacity: 0.9 }}>
          15 parts · hands-on labs · decision drills · interview practice
        </div>
      </div>
    </div>,
    size,
  );
}
