import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paskar's Kontor",
    short_name: "Kontor",
    description: "Live dashboard for opgaver, kalender, AMSW-status og Whoop",
    start_url: "/",
    display: "standalone",
    background_color: "#05070a",
    theme_color: "#05070a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
