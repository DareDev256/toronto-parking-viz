import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "ckan0.cf.opendata.inter.prod-toronto.ca",
  "secure.toronto.ca",
  "retro.umoiq.com",
  "tor.publicbikesystem.net",
  "gtfsrt.ttc.ca",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "TorontoCityPulse/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Proxy fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
