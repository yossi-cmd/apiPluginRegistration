import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface ValidateLicenseBody {
  userId?: string;
  pluginId?: string;
}

export async function POST(req: NextRequest) {
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
        WHERE plugin_id = $1
          AND user_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
      ) AS valid
    `,
    [pluginId, userId],
  );

  return NextResponse.json({ valid: rows[0]?.valid ?? false });
}

