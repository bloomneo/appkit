/**
 * @bloomneo/appkit/server — the API side of a Bloom app.
 * @module @bloomneo/appkit/server
 *
 * @llm-rule WHEN: Mounting a Bloom app's API (feature discovery) and serving route contracts
 * @llm-rule AVOID: Copying an api-router into the app, or re-implementing auth/tenant/validation per route
 * @llm-rule NOTE: route(contract, handler) applies the contract's auth, tenant context and validation
 * @llm-rule NOTE: Query-string values arrive as strings — use coercing schemas (z.coerce.number())
 */
export { route, contractRouter, CONTRACT_ROUTER } from './route.js';
export type { ContractRoute, ContractHandler, HandlerContext } from './route.js';
export { createApiRouter } from './api-router.js';
export type { ApiRouterOptions, DiscoveredEndpoint } from './api-router.js';
export { isTenantScoped } from './contract.js';
export type { RouteContract, RouteAuth, StandardSchema, Params, Query, Body, Response } from './contract.js';
export { ServerError } from './errors.js';
