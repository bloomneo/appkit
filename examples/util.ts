/**
 * CANONICAL PATTERN — small zero-dependency utility helpers.
 *
 * Copy this file when you need any of the util methods. These are the
 * common Node.js helpers that get reinvented in every project — appkit
 * ships them once with consistent semantics.
 *
 * Public methods: get, isEmpty, slugify, chunk, debounce, pick,
 *                 unique, clamp, formatBytes, truncate, sleep, uuid
 */

import { utilClass } from '@bloomneo/appkit';

const util = utilClass.get();

// ── Safe deep property access (read-only) ───────────────────────────
const obj = { a: { b: { c: 42 } } };
const value = util.get(obj, 'a.b.c', 0);              // → 42
const missing = util.get(obj, 'a.b.x.y', 'default');  // → 'default' (safe)
// Note: there is no util.set() — use plain assignment for mutation.

// ── Subset ──────────────────────────────────────────────────────────
const user = { id: 1, email: 'a@b', password: 'secret', role: 'admin' };
const minimal = util.pick(user, ['id', 'email']);     // → { id, email }
// Note: there is no util.omit() — use util.pick() with the keys you want to keep.

// ── Array helpers ───────────────────────────────────────────────────
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const batches = util.chunk(items, 3);                 // → [[1,2,3], [4,5,6], [7,8,9]]
const deduped = util.unique([1, 2, 2, 3, 3]);         // → [1, 2, 3]

// ── Function helpers ────────────────────────────────────────────────
const debouncedSearch = util.debounce((q: string) => {
  // ...api call
}, 300);
// Note: there is no util.throttle() — use util.debounce() for rate-limiting calls.

// ── Misc ────────────────────────────────────────────────────────────
const id = util.uuid();                               // → 'a1b2c3d4-...'
const slug = util.slugify('My Awesome Post!');        // → 'my-awesome-post'
const size = util.formatBytes(1_572_864);             // → '1.5 MB'
const clamped = util.clamp(150, 0, 100);              // → 100
const short = util.truncate('A very long string', { length: 10 }); // → 'A very lon...'

await util.sleep(100);                                // → wait 100ms

export { value, missing, minimal, batches, deduped, id, slug, size, clamped, short };
