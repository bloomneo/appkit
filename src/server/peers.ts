/**
 * express is an optional peer: loaded when a router is actually built, so
 * the rest of appkit stays importable without it.
 */
import { ServerError } from './errors.js';

let expressModule: any = null;

export async function loadExpress(): Promise<any> {
  if (expressModule) return expressModule;
  try {
    expressModule = await import('express' as string);
    return expressModule;
  } catch (cause) {
    throw new ServerError(
      '[@bloomneo/appkit/server] express is required to build routers. Install it: npm install express',
      { code: 'SERVER_MISSING_EXPRESS', cause },
    );
  }
}
