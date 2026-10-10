import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/scout", "/developer", "/sign-in", "/sign-up"],
        disallow: ["/week", "/draft", "/account"],
      },
    ],
    sitemap: "https://www.courtvision.dev/sitemap.xml",
  };
}
