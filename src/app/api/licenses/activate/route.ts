import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

interface ActivateLicenseBody {
  licenseKey?: string;
  pluginId?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ActivateLicenseBody;
  const { licenseKey, pluginId } = body;

  if (!licenseKey || !pluginId) {
    return NextResponse.json(
      { error: "licenseKey and pluginId are required" },
      { status: 400 },
    );
  }

  // Find license for this plugin only (prevents using a key from another plugin)
  const { rows: licenseRows } = await query<{
    id: string;
    allowed_activations: number | null;
  }>(
    `
      SELECT id, allowed_activations
      FROM licenses
      WHERE license_key = $1
        AND plugin_id = $2
    `,
    [licenseKey, pluginId],
  );

  if (licenseRows.length === 0) {
    return NextResponse.json(
      { error: "License not found for this plugin" },
      { status: 404 },
    );
  }

  const license = licenseRows[0];

  if (license.allowed_activations !== null) {
    const { rows: countRows } = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM activations
        WHERE license_id = $1
      `,
      [license.id],
    );

    const currentCount = Number.parseInt(countRows[0]?.count ?? "0", 10);

    if (currentCount >= license.allowed_activations) {
      return NextResponse.json(
        { error: "Activation limit reached", allowedActivations: license.allowed_activations },
        { status: 403 },
      );
    }
  }

  const activationId = randomUUID();

  await query(
    `
      INSERT INTO activations (id, license_id)
      VALUES ($1, $2)
    `,
    [activationId, license.id],
  );

  return NextResponse.json({ activationId });
}

