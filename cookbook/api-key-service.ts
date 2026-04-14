/**
 * COOKBOOK — API key issuance & verification service.
 *
 * Modules:    auth + security + database + error + logger
 * Required:   BLOOM_AUTH_SECRET, BLOOM_SECURITY_ENCRYPTION_KEY, DATABASE_URL
 *
 * Design:
 *   • We issue a JWT-style API token via auth.generateApiToken() and ALSO
 *     persist an encrypted copy server-side. The JWT is self-verifying;
 *     the DB copy lets us revoke, audit, and list keys.
 *   • auth.requireApiToken() middleware validates signature + expiry on
 *     every request. The DB lookup is only needed for revocation checks.
 *
 * Schema expectation (Prisma example):
 *   model ApiKey {
 *     id          String   @id @default(cuid())
 *     userId      String
 *     keyId       String   @unique            // goes into JWT.keyId
 *     label       String
 *     scope       String                       // e.g. "read:users"
 *     role        String                       // e.g. "service"
 *     level       String                       // e.g. "basic"
 *     cipher      String                       // encrypted token blob
 *     revokedAt   DateTime?
 *     createdAt   DateTime @default(now())
 *     expiresAt   DateTime?
 *   }
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  authClass,
  securityClass,
  databaseClass,
  errorClass,
  loggerClass,
} from '@bloomneo/appkit';

const auth     = authClass.get();
const security = securityClass.get();
const logger   = loggerClass.get('api-keys');

const router = Router();

// ── Issue a new API key (requires human login) ──────────────────────
router.post(
  '/api-keys',
  auth.requireLoginToken(),
  auth.requireUserPermissions(['manage:api-keys']),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any);
    if (!user) throw errorClass.unauthorized();

    const { label, scope, ttl = '90d' } = req.body ?? {};
    if (typeof label !== 'string' || !label) throw errorClass.badRequest('label required');
    if (typeof scope !== 'string' || !scope) throw errorClass.badRequest('scope required');

    const keyId = randomUUID();
    const token = auth.generateApiToken(
      { keyId, userId: user.userId, scope, role: 'service', level: 'basic' },
      ttl,
    );

    // Store an encrypted copy so we can re-show (never) or audit (yes).
    const db: any = await databaseClass.get(req);
    await db.apiKey.create({
      data: {
        keyId,
        userId: user.userId,
        label,
        scope,
        role: 'service',
        level: 'basic',
        cipher: security.encrypt(token),
      },
    });

    logger.info('api key issued', { keyId, userId: user.userId, label });

    // Plaintext token is returned exactly once.
    res.status(201).json({ keyId, token, label, scope });
  }),
);

// ── List my API keys (no tokens — just metadata) ────────────────────
router.get(
  '/api-keys',
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any)!;
    const db: any = await databaseClass.get(req);
    const keys = await db.apiKey.findMany({
      where: { userId: user.userId, revokedAt: null },
      select: { keyId: true, label: true, scope: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ keys });
  }),
);

// ── Revoke ──────────────────────────────────────────────────────────
router.delete(
  '/api-keys/:keyId',
  auth.requireLoginToken(),
  errorClass.asyncRoute(async (req, res) => {
    const user = auth.getUser(req as any)!;
    const db: any = await databaseClass.get(req);
    const existing = await db.apiKey.findUnique({ where: { keyId: req.params.keyId } });
    if (!existing || existing.userId !== user.userId) throw errorClass.notFound();

    await db.apiKey.update({
      where: { keyId: req.params.keyId },
      data: { revokedAt: new Date() },
    });
    logger.warn('api key revoked', { keyId: req.params.keyId, userId: user.userId });
    res.json({ revoked: true });
  }),
);

// ── Protected endpoint hit with an API token ────────────────────────
router.get(
  '/v1/ping',
  auth.requireApiToken(),
  errorClass.asyncRoute(async (req, res) => {
    const caller = auth.getUser(req as any)!;
    // Revocation check — auth.requireApiToken only verifies the JWT.
    const db: any = await databaseClass.get(req);
    const row = await db.apiKey.findUnique({ where: { keyId: (caller as any).keyId } });
    if (!row || row.revokedAt) throw errorClass.unauthorized('Key revoked');

    res.json({ ok: true, keyId: (caller as any).keyId, scope: row.scope });
  }),
);

export default router;
