import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export interface TokenPayload {
  projectId: string;
}

export function signToken(payload: TokenPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
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

