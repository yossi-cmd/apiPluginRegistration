import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface ValidateLicenseBody {
  activationId?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ValidateLicenseBody;
  const { activationId } = body;

  if (!activationId) {
    return NextResponse.json({ error: "activationId is required" }, { status: 400 });
  }

  const { rows } = await query<{ valid: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM activations a
        JOIN licenses l ON a.license_id = l.id
        WHERE a.id = $1
          AND (l.expires_at IS NULL OR l.expires_at > NOW())
      ) AS valid
    `,
    [activationId],
  );

  return NextResponse.json({ valid: rows[0]?.valid ?? false });
}

