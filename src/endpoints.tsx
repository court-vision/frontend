export const PROD_BACKEND_ENDPOINT = "https://api.courtvision.dev";

// Set NEXT_PUBLIC_API_BASE (e.g. http://127.0.0.1:8000) to target a local backend
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || PROD_BACKEND_ENDPOINT;

// API v1 Internal endpoints
export const AUTH_API = `${API_BASE}/v1/internal/auth`;
export const USERS_API = `${API_BASE}/v1/internal/users`;
export const TEAMS_API = `${API_BASE}/v1/internal/teams`;
export const LINEUPS_API = `${API_BASE}/v1/internal/lineups`;
export const MATCHUPS_API = `${API_BASE}/v1/internal/matchups`;
export const STREAMERS_API = `${API_BASE}/v1/internal/streamers`;
export const YAHOO_API = `${API_BASE}/v1/internal/yahoo`;
export const NOTIFICATIONS_API = `${API_BASE}/v1/internal/notifications`;
export const API_KEYS_API = `${API_BASE}/v1/internal/api-keys`;

// API v1 Public endpoints
export const LIVE_API = `${API_BASE}/v1/live`;
export const RANKINGS_API = `${API_BASE}/v1/rankings`;
export const PLAYERS_API = `${API_BASE}/v1/players`;
export const GAMES_API = `${API_BASE}/v1/games`;
export const OWNERSHIP_API = `${API_BASE}/v1/ownership`;
export const SCHEDULE_API = `${API_BASE}/v1/schedule`;
export const PLAYOFF_API = `${API_BASE}/v1/playoff`;
