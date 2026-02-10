// Original endpoints - commented out during maintenance mode
export const PROD_BACKEND_ENDPOINT = "https://api.courtvision.dev";
export const LOCAL_BACKEND_ENDPOINT = "http://127.0.0.1:8000";

// API v1 Internal endpoints
export const API_BASE =
  false // switch for local/production backend
    ? PROD_BACKEND_ENDPOINT
    : LOCAL_BACKEND_ENDPOINT;

export const AUTH_API = `${API_BASE}/v1/internal/auth`;
export const USERS_API = `${API_BASE}/v1/internal/users`;
export const TEAMS_API = `${API_BASE}/v1/internal/teams`;
export const LINEUPS_API = `${API_BASE}/v1/internal/lineups`;
export const MATCHUPS_API = `${API_BASE}/v1/internal/matchups`;
export const STREAMERS_API = `${API_BASE}/v1/internal/streamers`;
export const YAHOO_API = `${API_BASE}/v1/internal/yahoo`;

// API v1 Public endpoints
export const RANKINGS_API = `${API_BASE}/v1/rankings`;
export const PLAYERS_API = `${API_BASE}/v1/players`;
export const GAMES_API = `${API_BASE}/v1/games`;
export const OWNERSHIP_API = `${API_BASE}/v1/ownership`;
export const SCHEDULE_API = `${API_BASE}/v1/schedule`;

// Maintenance mode endpoints - return "/api/maintenance" to be caught by middleware
// export const PROD_BACKEND_ENDPOINT = "/api/maintenance";
// export const DATABSE_API_ENDPOPINT = "/api/maintenance";
// export const LOCAL_BACKEND_ENDPOINT = "/api/maintenance";
// export const LINEUP_GENERATION_API_ENDPOINT = "/api/maintenance";
// export const DATA_API_ENDPOINT = "/api/maintenance";
// https://cv-backend-su3d2jcjkq-uc.a.run.app
