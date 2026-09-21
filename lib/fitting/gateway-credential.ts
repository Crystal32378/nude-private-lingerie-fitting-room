/**
 * Short-lived Gateway credential, resolved inside the request lifecycle.
 *
 * On Vercel Functions the OIDC token arrives as the `x-vercel-oidc-token` request
 * header (exposed through the request context), not as process.env. The official
 * helper reads that first and only falls back to VERCEL_OIDC_TOKEN (local
 * `vercel env pull`). No long-lived Gateway key is read here.
 *
 * Only the SOURCE label may be logged or returned. The token itself never is.
 */
import { getVercelOidcToken } from "@vercel/oidc";

export type TokenSource = "oidc_header" | "local_env" | "missing";

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

function contextHeaderToken(): string | undefined {
  const context = (globalThis as Record<symbol, { get?: () => { headers?: Record<string, string> } } | undefined>)[REQUEST_CONTEXT];
  return context?.get?.()?.headers?.["x-vercel-oidc-token"];
}

export async function resolveGatewayCredential(): Promise<{ token: string | null; source: TokenSource }> {
  let token: string;
  try {
    token = await getVercelOidcToken();
  } catch {
    return { token: null, source: "missing" };
  }
  if (!token) return { token: null, source: "missing" };
  const header = contextHeaderToken();
  return { token, source: header && header === token ? "oidc_header" : "local_env" };
}
