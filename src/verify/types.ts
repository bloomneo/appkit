/**
 * Types for the tenant-isolation verifier
 * @module @bloomneo/appkit/verify
 * @file src/verify/types.ts
 *
 * @llm-rule WHEN: Configuring verifyClass.get().run() in a test or CI step
 * @llm-rule AVOID: Declaring resource ids by hand - they are discovered, that is the point
 * @llm-rule NOTE: Identities are real logins; the verifier drives the app exactly as a client would
 */

/** One login the verifier will drive the API as. */
export interface VerifyIdentity {
  /** Short label used in the report, e.g. 'firm-a-admin'. */
  label: string;
  email: string;
  password: string;
  /**
   * True for platform/superuser logins that are *supposed* to see everything.
   * Their reads are excluded from leak assertions and used only to confirm the
   * cross-tenant path still works.
   */
  crossTenant?: boolean;
}

export interface VerifyOptions {
  /** Base URL of a running server, e.g. http://localhost:3000 */
  baseUrl: string;
  /** At least two same-privilege identities in different tenants. */
  identities: VerifyIdentity[];
  /** Login endpoint. Default '/api/auth/login'. */
  loginPath?: string;
  /** Where the token lives in the login response. Default 'token'. */
  tokenField?: string;
  /**
   * Endpoints to probe. Omit and the verifier asks the FBCA api-router at
   * `/api` which features exist, then probes `GET /api/<feature>` for each.
   */
  paths?: string[];
  /** Extra path segments never to probe (health checks, webhooks). */
  exclude?: string[];
  /**
   * Headers sent with every request — e.g. `{ 'X-Frontend-Key': key }` for a
   * Bloom app whose API refuses requests without its frontend key.
   */
  headers?: Record<string, string>;
  /** Milliseconds per request before giving up. Default 5000. */
  timeoutMs?: number;
  /**
   * Also replay DELETE against another tenant's rows. Off by default: when the
   * app leaks, the probe really deletes that row. Turn it on only against a
   * disposable database.
   */
  allowDestructive?: boolean;
  /**
   * Allow a baseUrl that is not localhost / 127.0.0.1 / [::1]. Off by default
   * so the verifier cannot be pointed at a live deployment by accident.
   */
  allowRemote?: boolean;
}

export type FindingKind =
  | 'cross-tenant-read'
  | 'cross-tenant-write'
  | 'cross-tenant-delete'
  | 'unauthenticated-read';

export interface VerifyFinding {
  kind: FindingKind;
  /** The identity that should NOT have been able to do this. */
  actor: string;
  /** The identity whose data was exposed. */
  victim: string;
  method: string;
  path: string;
  status: number;
  /** What made this a leak, in one sentence. */
  detail: string;
}

export interface VerifyReport {
  ok: boolean;
  checks: number;
  findings: VerifyFinding[];
  /** Endpoints probed, for confidence that coverage was real. */
  probed: string[];
  /** Resource ids harvested per identity — the raw material for replay. */
  harvested: Record<string, number>;
  /** Anything that stopped a check from running, so a skip never reads as a pass. */
  skipped: string[];
  /** Whether DELETE probes ran (`allowDestructive`). */
  destructive: boolean;
}
