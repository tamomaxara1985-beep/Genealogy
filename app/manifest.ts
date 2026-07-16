import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FamilyRoots — Discover Your Family History",
    short_name: "FamilyRoots",
    description: "Build, explore, and share your family tree with AI-powered tools",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
