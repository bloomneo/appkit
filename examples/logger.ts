/**
 * examples/logger.ts
 *
 * Runnable tour of the @bloomneo/appkit/logger module.
 *
 * Transports auto-enable from environment:
 *   • console                  — always on
 *   • BLOOM_LOGGER_FILE_PATH   — file transport
 *   • BLOOM_LOGGER_HTTP_URL    — HTTP ingest transport
 *   • BLOOM_LOGGER_WEBHOOK_URL — Slack-style webhook transport
 *
 * Run: tsx examples/logger.ts
 */

import { loggerClass } from '../src/logger/index.js';

async function main() {
  // 1. Root logger — no component name.
  const log = loggerClass.get();

  // 2. Component loggers — auto-tag every record with { component }.
  //    Calling get('auth') twice returns the same cached child.
  const authLog = loggerClass.get('auth');
  const dbLog   = loggerClass.get('database');

  // 3. Log at each level. error() gets special visual formatting in dev.
  log.info('boot complete', { port: 3000 });
  log.warn('cache miss high', { ratio: 0.42 });
  log.debug('query plan', { sql: 'SELECT 1' });

  authLog.info('user login', { userId: 'u_1' });
  dbLog.error('connection refused', { err: 'ECONNREFUSED', host: 'db.local' });

  // 4. Structured children — attach request-scoped bindings.
  const reqLog = log.child({ requestId: 'req_abc123', userId: 'u_1' });
  reqLog.info('handler start');
  reqLog.info('handler end', { durationMs: 12 });

  // 5. fatal() — the process is about to exit. Use sparingly.
  //    log.fatal('unrecoverable', { reason: '...' });

  // 6. flush() before clean shutdown; some transports buffer.
  await log.flush();

  // 7. Debug — which transports are actually running?
  console.log('active transports =', loggerClass.getActiveTransports());
  console.log('has file?         =', loggerClass.hasTransport('file'));
  console.log('config summary    =', loggerClass.getConfig());

  // 8. Teardown (tests / graceful exit).
  await loggerClass.clear();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
