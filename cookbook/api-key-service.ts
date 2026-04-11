/**
 * COOKBOOK RECIPE — Third-party API key management with encryption.
 *
 * Demonstrates how to issue API tokens (separate from user login tokens)
 * for webhooks and integrations, store the actual key encrypted at rest,
 * and rate-limit the key holder. This is the "give my customer a key to
 * call our API" pattern.
 *
 * Modules used: auth (API tokens), security (encryption + rate limiting),
 *               database, error, logger
 * Required env: BLOOM_AUTH_SECRET, BLOOM_SECURITY_ENCRYPTION_KEY, DATABASE_URL
 */

import { Router } from 'express';
import {
  authClass,
  securityClass,
  databaseClass,
  errorClass,
  loggerClass,
  utilClass,
} from '@bloomneo/appkit';

const auth = authClass.get();
const security = securityClass.get();
const database = await databaseClass.get();
const error = errorClass.get();
const logger = loggerClass.get('api-keys');
const util = utilClass.get();

const router = Router();

// ── ISSUE: admin issues a new API key for a third party ────────────
router.post(
  '/api-keys',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const u = auth.user(req);
    if (!u) throw error.unauthorized();

    const { name, scopes } = req.body;
    if (!name) throw error.badRequest('name required');

    // Generate a fresh API token (separate from user login tokens)
    const apiToken = auth.generateApiToken({
      keyId: util.uuid(),
      role: 'service',
      level: scopes?.[0] ?? 'webhook',
    }, '1y');  // long expiry

    // Store the token ENCRYPTED at rest (so a database leak doesn't
    // expose the plaintext keys)
    const encryptedToken = security.encrypt(apiToken);

    const record = await database.apiKey.create({
      data: {
        name,
        scopes: JSON.stringify(scopes ?? []),
        encryptedToken,
        createdBy: u.userId,
        tenantId: u.tenantId,
      },
    });

    logger.info('API key issued', { keyId: record.id, by: u.userId });

    // Return the plaintext token ONCE — caller is responsible for storing it.
    // The plaintext is never written to disk in our system.
    res.status(201).json({
      id: record.id,
      name: record.name,
      token: apiToken,
      warning: 'Store this token now. It will not be shown again.',
    });
  }),
);

// ── REVOKE: admin revokes a key ─────────────────────────────────────
router.delete(
  '/api-keys/:id',
  auth.requireUserRoles(['admin.tenant']),
  error.asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    await database.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    logger.warn('API key revoked', { keyId: id });
    res.json({ revoked: true });
  }),
);

// ── PROTECTED ROUTE: third party hits this with their API token ────
// Note: requireApiToken (NOT requireLoginToken) — different middleware
// for different token types.
router.get(
  '/webhook-data',
  auth.requireApiToken(),
  security.requests(60, 60 * 1000),  // 60 requests per minute per token
  error.asyncRoute(async (req, res) => {
    const data = await database.event.findMany({ take: 100 });
    res.json({ data });
  }),
);

export default router;
