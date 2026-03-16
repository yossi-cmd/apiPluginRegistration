import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractBearerToken, verifyToken } from "@/lib/auth";

interface ValidateLicenseBody {
  userId?: string;
  pluginId?: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  let projectId: string;
  try {
    const payload = verifyToken(token);
    projectId = payload.projectId;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json()) as ValidateLicenseBody;
  const { userId, pluginId } = body;

  if (!userId || !pluginId) {
    return NextResponse.json({ error: "userId and pluginId are required" }, { status: 400 });
  }

  const { rows } = await query<{ valid: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM licenses
        WHERE project_id = $1
          AND plugin_id = $2
          AND user_id = $3
          AND (expires_at IS NULL OR expires_at > NOW())
      ) AS valid
    `,
    [projectId, pluginId, userId],
  );

  return NextResponse.json({ valid: rows[0]?.valid ?? false });
}

