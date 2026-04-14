/**
 * examples/util.ts
 *
 * Runnable tour of the @bloomneo/appkit/util module.
 *
 * 12 small, well-tested utilities:
 *   get, isEmpty, slugify, chunk, debounce, pick,
 *   unique, clamp, formatBytes, truncate, sleep, uuid
 *
 * Run: tsx examples/util.ts
 */

import { utilClass } from '../src/util/index.js';

async function main() {
  const util = utilClass.get();

  // 1. Safe nested reads.
  const user = { profile: { name: { first: 'Ada' } } };
  console.log(util.get(user, 'profile.name.first'));            // 'Ada'
  console.log(util.get(user, 'profile.name.middle', '—'));      // '—'

  // 2. Empty check — handles null, '', [], {}, Map, Set.
  console.log('isEmpty("")   =', util.isEmpty(''));
  console.log('isEmpty({x:1})=', util.isEmpty({ x: 1 }));

  // 3. URL-safe slugs.
  console.log(util.slugify('Hello, World! — 2026'));             // 'hello-world-2026'

  // 4. Chunk an array.
  console.log(util.chunk([1, 2, 3, 4, 5], 2));                   // [[1,2],[3,4],[5]]

  // 5. Debounce — classic input-handler smoothing.
  const save = util.debounce((v: string) => console.log('saved:', v), 100);
  save('a'); save('ab'); save('abc');                            // only 'abc' fires
  await util.sleep(150);

  // 6. Pick a subset of keys.
  console.log(util.pick({ id: 1, name: 'x', secret: 's' }, ['id', 'name']));

  // 7. Unique (deep for primitives, reference for objects).
  console.log(util.unique([1, 1, 2, 3, 3]));                     // [1,2,3]

  // 8. Clamp.
  console.log(util.clamp(42, 0, 10));                            // 10

  // 9. formatBytes — human-readable sizes.
  console.log(util.formatBytes(1536));                           // '1.5 KB'

  // 10. truncate — the options object is required.
  console.log(util.truncate('A long sentence that needs trimming.', { length: 20 }));

  // 11. sleep — simple async delay.
  const t0 = Date.now();
  await util.sleep(25);
  console.log('slept ms ≈', Date.now() - t0);

  // 12. uuid.
  console.log('uuid =', util.uuid());

  // Debug.
  console.log('status =', utilClass.getStatus());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
