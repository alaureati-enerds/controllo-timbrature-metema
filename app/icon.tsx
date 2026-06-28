import { ImageResponse } from "next/og"

export const size = {
  width: 32,
  height: 32,
}
export const contentType = "image/png"

// Favicon generata al build: quadrato scuro con "S" bianca. Segnaposto,
// sostituibile con un file statico in public/ o con logica personalizzata.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: "#1f1f24",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontWeight: 700,
          borderRadius: "18%",
        }}
      >
        S
      </div>
    ),
    { ...size }
  )
}
