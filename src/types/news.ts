/**
 * News items as the public news routes send them (`GET /v1/players/{id}/news`,
 * `GET /v1/news`; backend `schemas/news.py`). Shims over the generated OpenAPI
 * schema; regenerate with `bun run generate:api`.
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type NewsItem = S["NewsItemResp"];
export type NewsKind = NewsItem["kind"];
export type NewsListData = S["NewsListData"];
