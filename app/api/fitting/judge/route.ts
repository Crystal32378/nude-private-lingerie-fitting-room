import { createGatewayTransport, evaluateTradeoff, GatewayAuthError, type JevTransport } from "../../../../lib/fitting/jev.ts";
import { resolveGatewayCredential, type TokenSource } from "../../../../lib/fitting/gateway-credential.ts";
import { parseTaskRequest, PrivacyViolationError } from "../../../../lib/fitting/privacy.ts";

export const runtime = "nodejs";
export const maxDuration = 15;

// Same bounded, in-memory rate limit pattern as the existing try-on route.
const windows = new Map<string, { since: number; count: number }>();
export async function POST(request: Request): Promise<Response> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
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
  let input: unknown;
  try {
    // No request text, provider error, or user fields are logged or persisted.
    const text = await request.text();
    if (text.length > 8192) throw new PrivacyViolationError(["request too large"]);
    input = JSON.parse(text);
    parseTaskRequest(input);
  } catch {
    return Response.json({ error: "invalid_confirmed_fields" }, { status: 400, headers });
  }

  // The short-lived OIDC token is resolved here, inside this request, and only if a
  // judgment is actually needed. Only its source label is ever logged or returned.
  const seen: { source: TokenSource | null; authFailed: boolean } = { source: null, authFailed: false };
  const base = createGatewayTransport(async () => {
    const credential = await resolveGatewayCredential();
    seen.source = credential.source;
    return credential.token;
  });
  const transport: JevTransport = async (body, signal) => {
    try { return await base(body, signal); }
    catch (error) { if (error instanceof GatewayAuthError) seen.authFailed = true; throw error; }
  };
  const result = await evaluateTradeoff(input, transport);
  const outcome = result.status !== "unavailable" ? result.status : seen.authFailed ? "auth_unavailable" : "judgment_unavailable";
  if (seen.source) {
    headers["X-JEV-Token-Source"] = seen.source;
    console.info(JSON.stringify({ route: "fitting/judge", tokenSource: seen.source, outcome }));
  }
  if (result.status === "unavailable") {
    return Response.json({ error: outcome, ...(seen.source ? { tokenSource: seen.source } : {}) }, { status: 503, headers });
  }
  return Response.json(result, { headers });
}
