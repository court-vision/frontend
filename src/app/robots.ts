import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/rankings", "/terminal", "/sign-in", "/sign-up"],
        disallow: [
          "/your-teams",
          "/lineup-generation",
          "/manage-lineups",
          "/manage-teams",
          "/matchup",
          "/streamers",
          "/query-builder",
          "/account",
          "/settings",
        ],
      },
    ],
    sitemap: "https://www.courtvision.dev/sitemap.xml",
  };
}
