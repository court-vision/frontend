/**
 * API-key management types — generated from the backend's OpenAPI schema.
 *
 * This file is a shim: the names below are the ones the app has always
 * imported, re-exported from `src/types/generated/api.ts` (regenerate with
 * `bun run generate:api` after updating `openapi/openapi.json`).
 */
import type { components } from "./generated/api";

type S = components["schemas"];

export type ApiKeyListItem = S["ApiKeyListItem"];
export type CreateApiKeyRequest = S["CreateApiKeyRequest"];
export type CreateApiKeyResponseData = S["CreateApiKeyData"];
export type ApiKeyListResponse = S["ApiKeyListResp"];
export type CreateApiKeyResponse = S["CreateApiKeyResp"];
export type RevokeApiKeyResponse = S["RevokeApiKeyResp"];
