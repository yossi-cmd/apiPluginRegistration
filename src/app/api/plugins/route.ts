import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractBearerToken, verifyToken } from "@/lib/auth";

interface CreatePluginBody {
  name?: string;
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

  const body = (await req.json()) as CreatePluginBody;

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { rows } = await query<{ id: string }>(
    "INSERT INTO plugins (project_id, name) VALUES ($1, $2) RETURNING id",
    [projectId, body.name],
  );

  return NextResponse.json({ pluginId: rows[0].id });
}

