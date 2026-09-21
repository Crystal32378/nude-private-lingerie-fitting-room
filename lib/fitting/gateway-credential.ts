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

// ------------------------------------------------------------ provider choice

export type JevProvider = "typesafe" | "gateway";
export type CredentialSource = TokenSource | "typesafe_env";

/** JEV_PROVIDER=typesafe|gateway wins; otherwise a TypeSafe key selects TypeSafe,
 *  and without one the Vercel AI Gateway (OIDC) stays in use. */
export function selectJevProvider(env: Record<string, string | undefined> = process.env): JevProvider {
  const explicit = env.JEV_PROVIDER?.trim().toLowerCase();
  if (explicit === "typesafe" || explicit === "gateway") return explicit;
  return env.TYPESAFE_API_KEY ? "typesafe" : "gateway";
}

/** The brand's own TypeSafe key. Only the source label may be exposed. */
export function resolveTypesafeCredential(env: Record<string, string | undefined> = process.env): { token: string | null; source: CredentialSource } {
  const token = env.TYPESAFE_API_KEY?.trim();
  return token ? { token, source: "typesafe_env" } : { token: null, source: "missing" };
}
