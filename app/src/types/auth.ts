export interface AuthUser {
  id: string;
  email: string;
  accessToken?: string;
  type?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  type?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  typeSubmit: "LOGIN" | "CREATE";
}
