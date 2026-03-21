import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

interface ActivateLicenseBody {
  licenseKey?: string;
  pluginId?: string;
  siteUrl?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ActivateLicenseBody;
  const { licenseKey, pluginId, siteUrl } = body;

  if (!licenseKey || !pluginId || !siteUrl) {
    return NextResponse.json(
      { error: "licenseKey, pluginId and siteUrl are required" },
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

  // For this license+site, keep only the newest activation active.
  await query(
    `
      UPDATE activations
      SET is_active = false
      WHERE license_id = $1
        AND site_url = $2
        AND is_active = true
    `,
    [license.id, siteUrl],
  );

  if (license.allowed_activations !== null) {
    const { rows: countRows } = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM activations
        WHERE license_id = $1
          AND is_active = true
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
      INSERT INTO activations (id, license_id, site_url, is_active)
      VALUES ($1, $2, $3, true)
    `,
    [activationId, license.id, siteUrl],
  );

  return NextResponse.json({ activationId });
}

