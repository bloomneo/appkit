/**
 * The current HTTP request's correlation id, carried through async code so
 * every log line written while handling the request can name it. Set by
 * requestId() from @bloomneo/appkit/server; read by the logger.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

export const requestStore = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}
