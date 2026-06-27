import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  // Origini ammesse per gli asset di sviluppo quando si accede al dev server
  // da un dispositivo diverso (es. smartphone via IP del PC sulla LAN).
  allowedDevOrigins: ["192.168.1.*", "192.168.0.*", "10.0.0.*"],
}

export default nextConfig
