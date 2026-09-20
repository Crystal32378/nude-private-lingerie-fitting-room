import { evaluateTradeoff } from "../../../../lib/fitting/jev.ts";
import { parseTaskRequest, PrivacyViolationError } from "../../../../lib/fitting/privacy.ts";

export const runtime = "nodejs";
export const maxDuration = 15;

// Same bounded, in-memory rate limit pattern as the existing try-on route.
const windows = new Map<string, { since: number; count: number }>();
export async function POST(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  const internalUrl = new URL(request.url);
  const publicHost = request.headers.get("host") ?? internalUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? internalUrl.protocol.slice(0, -1);
  if (origin && origin !== `${protocol}://${publicHost}`) return Response.json({ error: "request_rejected" }, { status: 403, headers });
  const now = Date.now();
  for (const [key, value] of windows) if (now - value.since > 60_000) windows.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const window = windows.get(ip) ?? { since: now, count: 0 };
  if (++window.count > 12) return Response.json({ error: "temporarily_unavailable" }, { status: 429, headers });
  windows.set(ip, window);
  try {
    // No request text, provider error, or user fields are logged or persisted.
    const text = await request.text();
    if (text.length > 8192) throw new PrivacyViolationError(["request too large"]);
    const input: unknown = JSON.parse(text);
    parseTaskRequest(input);
    return Response.json(await evaluateTradeoff(input), { headers });
  } catch {
    return Response.json({ error: "invalid_confirmed_fields" }, { status: 400, headers });
  }
}
