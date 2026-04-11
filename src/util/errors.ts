/**
 * Educational runtime errors for @bloomneo/appkit.
 *
 * Modules throw these (instead of plain TypeError or generic Error) so that
 * humans AND AI coding agents reading the error message get an actionable
 * fix-it-now message that names the missing thing AND points at the canonical
 * pattern in AGENTS.md or the relevant example file.
 *
 * Format is intentionally consistent across all 12 modules:
 *
 *   [@bloomneo/appkit] <Module> requires <thing>. <reason>.
 *   See: <docs URL or example file>
 *
 * Agents that read errors and self-correct will fetch the link and recover
 * on the next iteration. Without this, agents get cryptic "X is undefined"
 * messages and have to guess.
 *
 * @file src/util/errors.ts
 */

const DOCS_BASE = 'https://github.com/bloomneo/appkit/blob/main/AGENTS.md';

export class AppKitError extends Error {
  readonly module: string;
  readonly docsUrl: string;

  constructor(module: string, message: string, slug?: string) {
    const url = slug ? `${DOCS_BASE}#${slug}` : DOCS_BASE;
    super(`[@bloomneo/appkit] ${module}: ${message}\nSee: ${url}`);
    this.name = 'AppKitError';
    this.module = module;
    this.docsUrl = url;
  }
}

/**
 * Throw if a required env var is missing. Use at module init / first .get()
 * call so the error is loud and immediate, not deferred to the first request.
 *
 * @example
 *   requireEnv('Auth', 'BLOOM_AUTH_SECRET',
 *     'Set this to a 32+ character random string. See examples/.env.example.');
 */
export function requireEnv(module: string, varName: string, hint?: string): string {
  const value = process.env[varName];
  if (value === undefined || value === '') {
    const msg = hint
      ? `requires env var \`${varName}\` to be set. ${hint}`
      : `requires env var \`${varName}\` to be set.`;
    throw new AppKitError(module, msg, 'environment-variables');
  }
  return value;
}

/**
 * Throw if `value` is missing or wrongly typed. Use at the top of public
 * methods that depend on caller-provided data.
 *
 * @example
 *   const auth = authClass.get();
 *   auth.signToken = (payload) => {
 *     requireProp('Auth', 'signToken.payload', payload);
 *     // ...
 *   };
 */
export function requireProp<T>(
  module: string,
  prop: string,
  value: T | undefined | null,
  hint?: string,
): T {
  if (value === undefined || value === null) {
    const msg = hint
      ? `\`${prop}\` is required. ${hint}`
      : `\`${prop}\` is required.`;
    throw new AppKitError(module, msg);
  }
  return value;
}

/**
 * Lighter-weight version that only warns in development. Use for nice-to-have
 * conventions ("you should pass a 32-char secret, not a 16-char one") that
 * shouldn't crash a production app on startup.
 */
export function warnInDev(module: string, message: string, slug?: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const url = slug ? `${DOCS_BASE}#${slug}` : DOCS_BASE;
  // eslint-disable-next-line no-console
  console.warn(`[@bloomneo/appkit] ${module}: ${message}\nSee: ${url}`);
}
