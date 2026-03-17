import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export interface TokenPayload {
  projectId: string;
}

export function signToken(payload: TokenPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as TokenPayload;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

