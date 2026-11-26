import type { MetadataRoute } from "next";
import { getSetting } from "@/server/admin";
import { appIcons, getBranding } from "@/server/branding";

// Name and icons come from System settings, so the installed app shows the company's name and logo.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [company, branding] = await Promise.all([getSetting("company"), getBranding()]);
  const icons = appIcons(branding);
  const name = company.name || "Feed";
  return {
    id: "/",
    name: `${name} Feedback`,
    short_name: name.length > 12 ? "Feedback" : name,
    description: "Raise concerns and share ideas anonymously, without logging in.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: icons.i192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icons.i512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icons.i512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}