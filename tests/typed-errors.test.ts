/**
 * tests/typed-errors.test.ts
 *
 * Every error appkit throws is an AppKitError subclass (6.0 contract). Apps
 * catch one type — `err instanceof AppKitError` — instead of duck-typing
 * plain `Error`s by message prefix.
 *
 * 1. A source scan fails the build if a plain `throw new Error(` (or
 *    `reject(new Error(`) creeps back into src/**. src/database is excluded
 *    while it is being rewritten separately.
 * 2. Representative errors from queue / storage / email / auth are checked
 *    end to end: instanceof AppKitError, the module's own class, `module`
 *    and a stable `code`.
 * 3. handleErrors() maps them: typed HTTP errors keep their status, every
 *    other AppKitError becomes a 500 that does not leak internals in
 *    production.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AppKitError } from '../src/internal/errors.js';
import { QueueError, queueClass } from '../src/queue/index.js';
import { StorageError, storageClass } from '../src/storage/index.js';
import { EmailError } from '../src/email/index.js';
import { getSmartDefaults as emailDefaults } from '../src/email/defaults.js';
import { AuthError, TokenError, authClass } from '../src/auth/index.js';
import { ConfigError, configClass } from '../src/config/index.js';
import { VerifyError, verifyClass } from '../src/verify/index.js';
import { AppError, ErrorClass } from '../src/error/index.js';
import { getSmartDefaults as errorDefaults } from '../src/error/defaults.js';
import { SecurityError } from '../src/security/index.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

describe('no plain Error throws in src/**', () => {
  it('every throw uses an AppKitError subclass', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split('\\').join('/');
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/\b(throw|reject\()\s*new\s+(Type|Range)?Error\s*\(/.test(line)) {
          offenders.push(`src/${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `Use the module's AppKitError subclass instead:\n${offenders.join('\n')}`).toEqual([]);
  });
});

/** Run fn, return what it threw (sync or async). */
async function caught(fn: () => unknown): Promise<any> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new AppKitError('expected the call to throw');
}

function expectTyped(err: any, cls: Function, module: string, code: string) {
  expect(err).toBeInstanceOf(AppKitError);
  expect(err).toBeInstanceOf(cls);
  expect(err.module).toBe(module);
  expect(err.code).toBe(code);
  expect(err.message).toMatch(new RegExp(`^\\[@bloomneo/appkit/${module}\\] `));
}

describe('representative module errors are typed', () => {
  it('queue: invalid job type → QueueError QUEUE_INVALID_JOB_TYPE', async () => {
    const err = await caught(() => queueClass.get().add('bad type!', { a: 1 }));
    expectTyped(err, QueueError, 'queue', 'QUEUE_INVALID_JOB_TYPE');
    await queueClass.disconnectAll();
  });

  it('queue: bad delay → QueueError QUEUE_INVALID_DELAY', async () => {
    const err = await caught(() => queueClass.get().schedule('job', { a: 1 }, -5));
    expectTyped(err, QueueError, 'queue', 'QUEUE_INVALID_DELAY');
    await queueClass.disconnectAll();
  });

  it('storage: path traversal key → StorageError STORAGE_INVALID_KEY', async () => {
    const err = await caught(() => storageClass.get().put('../escape.txt', 'x'));
    expectTyped(err, StorageError, 'storage', 'STORAGE_INVALID_KEY');
    await storageClass.disconnectAll();
  });

  it('storage: missing file → StorageError STORAGE_FILE_NOT_FOUND', async () => {
    const err = await caught(() => storageClass.get().get(`missing/${Date.now()}.txt`));
    expectTyped(err, StorageError, 'storage', 'STORAGE_FILE_NOT_FOUND');
    expect(err.cause).toBeInstanceOf(StorageError);
    await storageClass.disconnectAll();
  });

  it('email: bad BLOOM_EMAIL_STRATEGY → EmailError EMAIL_INVALID_STRATEGY', async () => {
    const saved = process.env.BLOOM_EMAIL_STRATEGY;
    process.env.BLOOM_EMAIL_STRATEGY = 'pigeon';
    try {
      const err = await caught(() => emailDefaults());
      expectTyped(err, EmailError, 'email', 'EMAIL_INVALID_STRATEGY');
    } finally {
      if (saved === undefined) delete process.env.BLOOM_EMAIL_STRATEGY;
      else process.env.BLOOM_EMAIL_STRATEGY = saved;
    }
  });

  it('auth: empty password → AuthError AUTH_INVALID_PASSWORD', async () => {
    const err = await caught(() => authClass.get().hashPassword(''));
    expectTyped(err, AuthError, 'auth', 'AUTH_INVALID_PASSWORD');
  });

  it('auth: login token without userId → AuthError AUTH_INVALID_PAYLOAD', async () => {
    const err = await caught(() =>
      authClass.get().generateLoginToken({ role: 'user', level: 'basic' } as any),
    );
    expectTyped(err, AuthError, 'auth', 'AUTH_INVALID_PAYLOAD');
  });

  it('auth: unknown role in requireUserRoles → AuthError AUTH_INVALID_ROLE', async () => {
    const err = await caught(() => authClass.get().requireUserRoles(['wizard.supreme']));
    expectTyped(err, AuthError, 'auth', 'AUTH_INVALID_ROLE');
  });

  it('auth: bad token stays a TokenError (401 path unchanged)', async () => {
    const err = await caught(() => authClass.get().verifyToken('not.a.jwt'));
    expect(err).toBeInstanceOf(TokenError);
    expect(err).toBeInstanceOf(AppKitError);
    expect(err.module).toBe('auth');
  });

  it('config: missing required key → ConfigError CONFIG_MISSING', async () => {
    const err = await caught(() => configClass.get().getRequired('nope.not.here'));
    expectTyped(err, ConfigError, 'config', 'CONFIG_MISSING');
  });

  it('verify: remote host without allowRemote → VerifyError VERIFY_REMOTE_REFUSED', async () => {
    const err = await caught(() =>
      verifyClass.get().run({
        baseUrl: 'https://prod.example.com',
        identities: [
          { label: 'a', email: 'a@x.test', password: 'x' },
          { label: 'b', email: 'b@x.test', password: 'x' },
        ],
      } as any),
    );
    expectTyped(err, VerifyError, 'verify', 'VERIFY_REMOTE_REFUSED');
  });
});

describe('handleErrors() and AppKitError', () => {
  function run(err: unknown, nodeEnv: 'production' | 'development') {
    const defaults = errorDefaults();
    const handler = new ErrorClass({
      ...defaults,
      middleware: { showStack: false, logErrors: false },
      environment: {
        ...defaults.environment,
        nodeEnv,
        isProduction: nodeEnv === 'production',
        isDevelopment: nodeEnv === 'development',
      },
    }).handleErrors();
    let status = 0;
    let body: any;
    const res: any = {
      status(code: number) { status = code; return res; },
      json(data: unknown) { body = data; return res; },
    };
    handler(err as any, {} as any, res, () => {});
    return { status, body };
  }

  it('AppError keeps its status, type and message (also in production)', () => {
    const { status, body } = run(new AppError('Email taken', 409, 'CONFLICT'), 'production');
    expect(status).toBe(409);
    expect(body).toEqual({ error: 'CONFLICT', message: 'Email taken' });
  });

  it('AppError 5xx message is still sent in production', () => {
    const { status, body } = run(new AppError('Payment provider down', 503, 'UNAVAILABLE'), 'production');
    expect(status).toBe(503);
    expect(body.message).toBe('Payment provider down');
  });

  it('SecurityError keeps its HTTP status (429)', () => {
    const { status } = run(new SecurityError('Too many requests', 429), 'production');
    expect(status).toBe(429);
  });

  it('a misuse AppKitError becomes 500 and hides internals in production', () => {
    const err = new QueueError('[@bloomneo/appkit/queue] Invalid BLOOM_QUEUE_CONCURRENCY: "x"', {
      code: 'QUEUE_INVALID_CONFIG',
    });
    const { status, body } = run(err, 'production');
    expect(status).toBe(500);
    expect(body.error).toBe('SERVER_ERROR');
    expect(body.message).not.toContain('BLOOM_QUEUE');
    expect(body.code).toBeUndefined();
  });

  it('a misuse AppKitError shows its message and code in development', () => {
    const err = new ConfigError('[@bloomneo/appkit/config] Missing required configuration: "x"', {
      code: 'CONFIG_MISSING',
    });
    const { status, body } = run(err, 'development');
    expect(status).toBe(500);
    expect(body.message).toContain('Missing required configuration');
    expect(body.code).toBe('CONFIG_MISSING');
  });
});
