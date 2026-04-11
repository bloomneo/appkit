/**
 * Vitest tests for the error module.
 * @file src/error/error.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { errorClass } from './index.js';

beforeEach(() => { errorClass.clearCache(); });

describe('errorClass.get()', () => {
  it('returns an ErrorClass instance', () => {
    const error = errorClass.get();
    expect(error).toBeDefined();
    expect(typeof error).toBe('object');
  });

  it('returns the same instance (singleton)', () => {
    expect(errorClass.get()).toBe(errorClass.get());
  });
});

describe('Semantic error constructors', () => {
  const error = errorClass.get();

  const cases: [string, () => Error, number, string][] = [
    ['badRequest',  () => error.badRequest('bad'),   400, 'BAD_REQUEST'],
    ['unauthorized',() => error.unauthorized('auth'),401, 'UNAUTHORIZED'],
    ['forbidden',   () => error.forbidden('deny'),   403, 'FORBIDDEN'],
    ['notFound',    () => error.notFound('missing'), 404, 'NOT_FOUND'],
    ['conflict',    () => error.conflict('dup'),     409, 'CONFLICT'],
    ['tooMany',     () => error.tooMany('slow'),     429, 'TOO_MANY_REQUESTS'],
    ['serverError', () => error.serverError('oops'), 500, 'SERVER_ERROR'],
    ['internal',    () => error.internal('oops'),    500, 'SERVER_ERROR'],
  ];

  for (const [name, factory, status, type] of cases) {
    it(`${name}() sets statusCode=${status} and type=${type}`, () => {
      const err = factory() as any;
      expect(err instanceof Error).toBe(true);
      expect(err.statusCode).toBe(status);
      expect(err.type).toBe(type);
    });
  }

  it('createError() sets arbitrary status code and type', () => {
    const err = error.createError(503, 'maintenance', 'MAINTENANCE') as any;
    expect(err.statusCode).toBe(503);
    expect(err.type).toBe('MAINTENANCE');
  });
});

describe('errorClass shortcuts (static-style calls)', () => {
  it('errorClass.badRequest() works without calling get() first', () => {
    const err = errorClass.badRequest('test') as any;
    expect(err.statusCode).toBe(400);
  });

  it('errorClass.tooMany() works', () => {
    const err = errorClass.tooMany('test') as any;
    expect(err.statusCode).toBe(429);
  });

  it('errorClass.internal() works', () => {
    const err = errorClass.internal('test') as any;
    expect(err.statusCode).toBe(500);
  });
});

describe('handleErrors() middleware factory', () => {
  it('returns a function (4-arg Express error handler)', () => {
    const mw = errorClass.get().handleErrors();
    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(4);
  });
});

describe('asyncRoute() wrapper', () => {
  it('returns a function', () => {
    const wrapped = errorClass.asyncRoute(async (_req, res) => { res.json({}); });
    expect(typeof wrapped).toBe('function');
  });
});

describe('isClientError() / isServerError()', () => {
  const error = errorClass.get();

  it('400 is a client error', () => {
    expect(error.isClientError(error.badRequest() as any)).toBe(true);
  });

  it('500 is a server error', () => {
    expect(error.isServerError(error.serverError() as any)).toBe(true);
  });

  it('400 is NOT a server error', () => {
    expect(error.isServerError(error.badRequest() as any)).toBe(false);
  });
});

describe('Public API surface — drift check', () => {
  const INSTANCE_METHODS = [
    'badRequest', 'unauthorized', 'forbidden', 'notFound', 'conflict',
    'tooMany', 'serverError', 'internal', 'createError',
    'handleErrors', 'asyncRoute', 'isClientError', 'isServerError',
    'getEnvironmentInfo', 'getConfig',
  ];

  const error = errorClass.get();
  for (const m of INSTANCE_METHODS) {
    it(`error.${m} exists and is a function`, () => {
      expect(typeof (error as any)[m]).toBe('function');
    });
  }
});
