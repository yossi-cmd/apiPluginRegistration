import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface ValidateLicenseBody {
  activationId?: string;
  pluginId?: string;
}

function normalizeSiteUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function getRequestSiteUrl(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host");

  if (origin) return normalizeSiteUrl(origin);
  if (referer) return normalizeSiteUrl(referer);
  if (forwardedHost) return normalizeSiteUrl(`${forwardedProto}://${forwardedHost}`);
  if (host) return normalizeSiteUrl(`${forwardedProto}://${host}`);
  return normalizeSiteUrl(req.nextUrl.origin);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ValidateLicenseBody;
  const { activationId, pluginId } = body;
  const siteUrl = getRequestSiteUrl(req);

  if (!activationId || !pluginId) {
    return NextResponse.json(
      { error: "activationId and pluginId are required" },
      { status: 400 },
    );
  }

  if (!siteUrl) {
    return NextResponse.json(
      { error: "Could not determine request site URL from request headers" },
      { status: 400 },
    );
  }

  const { rows } = await query<{ valid: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM activations a
        JOIN licenses l ON a.license_id = l.id
        WHERE a.id = $1
          AND l.plugin_id = $2
          AND a.site_url = $3
          AND a.is_active = true
          AND (l.expires_at IS NULL OR l.expires_at > NOW())
      ) AS valid
    `,
    [activationId, pluginId, siteUrl],
  );

  return NextResponse.json({ valid: rows[0]?.valid ?? false });
}

