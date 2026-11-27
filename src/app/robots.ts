import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scout", "/developer", "/sign-in", "/sign-up", "/privacy"],
        disallow: ["/home", "/week", "/team", "/draft", "/account"],
      },
    ],
    sitemap: "https://www.courtvision.dev/sitemap.xml",
  };
}
