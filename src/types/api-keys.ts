export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string; // e.g. "cv_abc1de2fg"
  scopes: string[];
  rate_limit: number;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_days?: number | null;
}

export interface CreateApiKeyResponseData {
  raw_key: string; // Only shown once
  key: ApiKeyListItem;
}

// Follows the BaseApiResponse<T> pattern
export interface ApiKeyListResponse {
  status: string;
  message: string;
  data: ApiKeyListItem[];
  timestamp: string;
}

export interface CreateApiKeyResponse {
  status: string;
  message: string;
  data: CreateApiKeyResponseData;
  timestamp: string;
}
