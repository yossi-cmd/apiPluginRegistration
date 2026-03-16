import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signToken } from "@/lib/auth";

interface TokenRequestBody {
  apiKey?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as TokenRequestBody;

  if (!body.apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const { rows } = await query<{ id: string }>(
    "SELECT id FROM projects WHERE api_key = $1 LIMIT 1",
    [body.apiKey],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid apiKey" }, { status: 401 });
  }

  const projectId = rows[0].id;

  // 1 hour
  const expiresInSeconds = 60 * 60;
  const token = signToken({ projectId }, expiresInSeconds);

  return NextResponse.json({ token, expiresIn: expiresInSeconds });
}

