/**
 * The route-contract shape appkit enforces. Contracts are declared with
 * `defineRoute()` from `@bloomneo/bloom`; appkit reads them structurally, so
 * it needs no dependency on bloom (same shape, checked by the compiler where
 * both are installed).
 */

/** Standard Schema v1 (https://standardschema.dev) — Zod 3.24+, Valibot, ArkType. */
export interface StandardSchema<Output = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: unknown; readonly output: Output } | undefined;
  };
}

type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> }> };

export type RouteAuth = 'public' | 'user' | 'apiToken' | { readonly roles: readonly string[] };

export interface RouteContract {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly auth: RouteAuth;
  readonly tenant?: boolean;
  readonly params?: StandardSchema;
  readonly query?: StandardSchema;
  readonly body?: StandardSchema;
  readonly response?: StandardSchema;
  readonly summary?: string;
}

type Out<S> = S extends StandardSchema<infer O> ? O : undefined;

export type Params<C extends RouteContract> = Out<C['params']>;
export type Query<C extends RouteContract> = Out<C['query']>;
export type Body<C extends RouteContract> = Out<C['body']>;
export type Response<C extends RouteContract> = C['response'] extends StandardSchema<infer O> ? O : unknown;

/** Non-public routes are tenant-scoped unless the contract says `tenant: false`. */
export function isTenantScoped(contract: RouteContract): boolean {
  return contract.tenant ?? contract.auth !== 'public';
}

export interface Issue {
  path: string;
  message: string;
}

export async function validateWith<T>(
  schema: StandardSchema | undefined,
  value: unknown,
): Promise<{ ok: true; value: T } | { ok: false; issues: Issue[] }> {
  if (!schema) return { ok: true, value: value as T };
  const result = await schema['~standard'].validate(value);
  if (!result.issues) return { ok: true, value: result.value as T };
  return {
    ok: false,
    issues: result.issues.map((issue) => ({
      path: (issue.path ?? [])
        .map((p) => (typeof p === 'object' && p !== null && 'key' in p ? String(p.key) : String(p)))
        .join('.'),
      message: issue.message,
    })),
  };
}
