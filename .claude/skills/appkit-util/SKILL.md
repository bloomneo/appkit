---
name: appkit-util
description: >-
  Use when writing code that needs string, date, array, or number utilities
  from `@bloomneo/appkit/util` — `get(obj, path)`, `slugify`, `chunk`,
  `truncate`, `debounce`, `formatBytes`, etc. Covers the `utilClass.get()`
  pattern.
---

# @bloomneo/appkit/util

Single-entry utility grab-bag: `utilClass.get()` returns an object with
dotted-path access, array helpers, string formatters, and throttle helpers.
The common helpers lodash-ish-users expect, plus a few formatting niceties.

## Canonical flow

```ts
import { utilClass } from '@bloomneo/appkit/util';

const util = utilClass.get();

// Safe dotted-path get with default
util.get(obj, 'user.profile.name', 'Anonymous');

// Array ops
util.chunk([1, 2, 3, 4, 5], 2);                 // [[1,2],[3,4],[5]]
util.uniq([1, 1, 2, 3, 3]);                     // [1, 2, 3]

// String ops
util.slugify('Hello, World!');                  // 'hello-world'
util.truncate('long text...', { length: 8 });   // 'long te…'

// Throttle / debounce
const debounced = util.debounce(fn, 300);

// Formatting
util.formatBytes(1536);                         // '1.5 KB'
util.formatDate(new Date(), 'YYYY-MM-DD');
util.formatCurrency(42.5, 'USD');               // '$42.50'
```

## Public API

### Util instance (from `utilClass.get()`)

```ts
// Object traversal
util.get(obj, path, default?)                  // → T | default
util.has(obj, path)                             // → boolean
util.pick(obj, keys[])                          // → Partial<T>
util.omit(obj, keys[])                          // → Partial<T>

// Arrays
util.chunk(arr, size)
util.uniq(arr)
util.groupBy(arr, keyFn)

// Strings
util.slugify(str, options?)
util.truncate(str, options?)
util.camelCase(str) / util.kebabCase(str) / util.snakeCase(str)

// Throttle / debounce
util.debounce(fn, wait, options?)
util.throttle(fn, wait)

// Formatting
util.formatBytes(bytes, precision?)
util.formatDate(date, format?)
util.formatCurrency(value, currency?)
util.formatNumber(value, precision?)

// ID / hash
util.uuid()                                     // RFC4122 v4
util.hash(str)                                  // fast non-crypto hash
```

### utilClass

```ts
utilClass.get(overrides?)                       // → Util instance
utilClass.clearCache()                          // clear memoization cache
utilClass.reset(cfg?)                           // tests
utilClass.isDevelopment() / isProduction()
utilClass.getStatus()                           // → diagnostic
```

## Env vars

Most util behavior is configured per call, but a few globals:

- `BLOOM_UTIL_CACHE=false` — disable memoization (default on, off in tests)
- `BLOOM_UTIL_CACHE_SIZE` — LRU size, default 1000
- `BLOOM_UTIL_CACHE_TTL` — ms, default 300000 (5 min)
- `BLOOM_UTIL_SLUGIFY_LOWERCASE=false` — preserve case in `slugify`
- `BLOOM_UTIL_LOCALE` — for date/number formatting
- `BLOOM_UTIL_CURRENCY` — default currency for `formatCurrency`
- `BLOOM_UTIL_DATE_FORMAT` — default format for `formatDate`

## Common mistakes

- Reaching for lodash first — many of the same primitives are already here
  with no extra install.
- Calling `util.get(obj, 'a.b.c')` where `obj` is null/undefined — returns
  the default (or undefined). Safe, doesn't throw.
- Using `util.debounce` without preserving the returned function — each call
  to `util.debounce(fn, 300)` returns a new debounced wrapper. Store it once.
