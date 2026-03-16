import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { randomUUID } from "crypto";

interface RegisterLicenseBody {
  userId?: string;
  pluginId?: string;
  durationDays?: number | null;
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

  const body = (await req.json()) as RegisterLicenseBody;
  const { userId, pluginId, durationDays } = body;

  if (!userId || !pluginId) {
    return NextResponse.json({ error: "userId and pluginId are required" }, { status: 400 });
  }

  // Ensure plugin belongs to the same project
  const pluginResult = await query<{ id: string }>(
    "SELECT id FROM plugins WHERE id = $1 AND project_id = $2",
    [pluginId, projectId],
  );

  if (pluginResult.rows.length === 0) {
    return NextResponse.json({ error: "Plugin not found for this project" }, { status: 404 });
  }

  let expiresAt: Date | null = null;
  if (typeof durationDays === "number" && durationDays > 0) {
    expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);
  }

  const licenseKey = randomUUID();

  const { rows } = await query<{ license_key: string }>(
    `
      INSERT INTO licenses (project_id, plugin_id, user_id, license_key, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING license_key
    `,
    [projectId, pluginId, userId, licenseKey, expiresAt],
  );

  return NextResponse.json({ licenseKey: rows[0].license_key });
}

