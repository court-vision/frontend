import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.courtvision.dev";
  const page = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  });

  return [page("", "daily", 1.0), page("/scout", "daily", 0.9), page("/developer", "weekly", 0.6), page("/sign-up", "monthly", 0.4), page("/privacy", "monthly", 0.2)];
}
