import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blackbox — Interview preparation",
    short_name: "Blackbox",
    description: "Track-calibrated mock interviews, moderated group discussions and a curated practice bank.",
    start_url: "/home",
    display: "standalone",
    background_color: "#16181c",
    theme_color: "#16181c",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
