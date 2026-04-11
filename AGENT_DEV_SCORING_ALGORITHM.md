# AGENT_DEV_SCORING_ALGORITHM

> A measurement protocol for how friendly a code package is to **both** AI coding agents
> and human developers. Designed to be applied by an LLM (Claude, GPT, etc.) reading the
> package's files, not by an automated script.

## Philosophy

A code package is **agent-and-dev friendly** if a fresh consumer — human or AI — can
generate working code on the first try without trial-and-error. The metric is
deterministic: two reviewers applying this rubric to the same package should arrive at
the same score within ±5 points. Vibes don't count. Anything that can't be measured by
reading files and counting things isn't in the rubric.

The rubric assumes a **dual audience**: humans need prose explanations and "why"
justifications, agents need short prescriptive rules and copy-pasteable patterns. A
good package serves both with the same docs. Most dimensions are scored separately for
each audience and averaged.

## How to use this rubric

1. Give an LLM (Claude, GPT, etc.) access to the package source tree.
2. Point it at this file.
3. Ask: *"Apply the AGENT_DEV_SCORING_ALGORITHM to package X. Walk through every
   dimension, show your work, and report a final weighted score out of 100."*
4. The LLM reads each dimension's recipe, opens the relevant files, counts what the
   recipe says to count, and produces a score with justifications for every number.
5. The same prompt re-run on the same package should produce the same score (modulo the
   inherent variance of LLM judgment for sub-scores in the 0-10 range).

This rubric is **not** an executable script. There is no `npm run score`. The LLM is the
runtime. This is intentional: scripts go stale, prompts to LLMs adapt to new evidence.

---

## The 11 dimensions

Each dimension has:

- A **plain-English description** of what it measures
- A **how-to-measure recipe** (instructions for the LLM, not shell commands)
- A **failure mode it catches** (a concrete past bug from the bloomneo project)
- A **dev sub-score** (how well does this serve a human developer, 0-10)
- An **agent sub-score** (how well does this serve an AI coding agent, 0-10)
- A **final dimension score** = `(dev + agent) / 2` rounded to 0.5

---

### 1. API correctness ⚖️ weight 15%

Every method, type, or property an LLM reads in any documentation file must actually
exist at runtime with the documented signature. Hallucinated methods are the worst
possible failure mode because the docs themselves teach the agent to write broken code.

**How to measure (LLM recipe):**

1. Open `src/<module>/<module>.ts` (or whatever the source file is).
2. List every public method on the exported class. Note: TypeScript `private` keyword
   is compile-time only — for this dimension, "public" means "not marked private."
3. Open every documentation file: `README.md`, `AGENTS.md`, `llms.txt`, every
   `examples/*.ts`, every `cookbook/*.ts`, every `src/<module>/README.md`.
4. For each `<instance>.<methodName>(` reference in those files, check whether
   `<methodName>` is in the list from step 2.
5. Count mismatches.

**Failure mode it catches:** The `auth.requireRole()` and `auth.requireLogin()`
hallucinations that shipped in `AGENTS.md` and `llms.txt` for a full release cycle.
Both methods don't exist; the real names are `requireUserRoles([...])` and
`requireLoginToken()`.

**Dev sub-score:**
- 0 — multiple files reference methods that throw at runtime
- 5 — one or two files reference methods that don't exist; everything else is correct
- 10 — every method named in any doc exists exactly as documented

**Agent sub-score:**
- 0 — agents copying from any doc generate uncompilable code
- 5 — agents have a 50/50 chance of picking up a correct method name
- 10 — every method an agent could grep returns a valid match

---

### 2. Doc consistency ⚖️ weight 12%

Every public API surface is referenced **the same way** across all documentation
artifacts. If the README says `xClass.get()`, the AGENTS.md must also say
`xClass.get()`, not `new XClass()`. Inconsistency forces the consumer to choose
between contradicting sources of truth.

**How to measure (LLM recipe):**

1. Pick the 5 most-used public APIs in the package (e.g. for auth: `generateLoginToken`,
   `verifyToken`, `requireLoginToken`, `requireUserRoles`, `user`).
2. For each one, find every doc file that mentions it (`README.md`, `AGENTS.md`,
   `llms.txt`, `src/<module>/README.md`, `examples/*.ts`, `cookbook/*.ts`).
3. Compare the *signatures*, *argument shapes*, and *invocation patterns* across files.
   They should all match.
4. Count contradictions.

**Failure mode it catches:** The earlier session where AGENTS.md said `auth.signToken`
was the canonical token method, llms.txt said `generateLoginToken` was an alias for
`signToken`, the README used `generateLoginToken` directly, and the example file used
`generateLoginToken`. **Four files, three different stories.** An agent reading them
all has no way to resolve the conflict.

**Dev sub-score:**
- 0 — different files give contradicting instructions
- 5 — files agree on method names but disagree on argument shapes or order of operations
- 10 — every doc tells the same story

**Agent sub-score:**
- 0 — an agent grepping all docs sees ≥3 distinct invocations of the same API
- 5 — an agent sees 2 distinct invocations and has to guess which is canonical
- 10 — an agent sees exactly one canonical pattern across all files

---

### 3. Runtime verification ⚖️ weight 12%

Every public API is exercised by a real test that imports the **built module** (not
the source) and calls the method. Tests that only check types pass don't count.
Tests that exist but don't actually run also don't count.

**How to measure (LLM recipe):**

1. Look for `*.test.ts`, `*.spec.ts`, or `tests/` directories near each module.
2. For each public method from dimension 1's audit, find the test that calls it.
3. Verify the test:
   - Imports from the package's actual entry point (e.g. `from './index.js'`), not
     from a mock or a stub
   - Asserts a real return value, not just that the method "exists"
   - Has run successfully (look for CI badges, recent test output, or a passing
     `npm test` command in the README)
4. Count public methods with no test, with a stub-only test, or with a test the LLM
   can't verify ran recently.

**Failure mode it catches:** The `service.webhook` role.level bug. The README showed
the example, the typecheck passed (because role/level were typed as plain `string`),
but the runtime threw `Invalid role.level: "service.webhook"`. Only an actual `npm test`
that called `auth.generateApiToken({ role: 'service', level: 'webhook' })` could have
caught it. We caught it after publishing.

**Dev sub-score:**
- 0 — no tests for any public method
- 3 — partial test coverage; common methods tested, edge cases skipped
- 7 — every public method has at least one test
- 10 — every public method has positive AND negative tests; tests assert specific
  return values, not just truthy

**Agent sub-score:**
- 0 — agent can't tell whether the documented behavior actually works
- 5 — agent finds a test file but it's outdated or doesn't run
- 10 — agent runs `npm test`, sees green, knows the documented patterns are real

---

### 4. Type safety ⚖️ weight 8%

Public APIs use precise TypeScript types. Zero `any` in exported signatures. Generics
propagate correctly through `forwardRef`, higher-order functions, and factory methods.
Literal-union types are used where the input is constrained (e.g. `'success' | 'error'`,
not `string`).

**How to measure (LLM recipe):**

1. Open `dist/types/*.d.ts` (the compiled type definitions consumers actually see).
2. Search for `: any`, `<any>`, `as any` in exported types.
3. For each generic factory or `forwardRef`, verify the generic propagates to the
   call site (e.g. `<DataTable<User> ...>` should narrow `data` to `User[]`).
4. For each input that has a constrained set of valid values (role names, status
   strings, mode flags), verify it's typed as a union, not as `string`.
5. Count `any` instances and over-loose types.

**Failure mode it catches:** The DataTable forwardRef bug from uikit 1.5.0. The
interface `DataTableProps<T = unknown>` was generic, but `forwardRef<HTMLTableElement,
DataTableProps>` erased `T` at the value level, so `<DataTable<User> ...>` failed to
compile. Pure runtime tests would never catch it; pure type tests would.

**Dev sub-score:**
- 0 — `any` everywhere, no generic propagation, every input typed as `string`
- 5 — public types are mostly tight but generics don't propagate through HOFs
- 10 — zero `any`, generics flow end-to-end, constrained inputs are union types

**Agent sub-score:**
- 0 — agent autocomplete returns `any` for every method call
- 5 — autocomplete works at the top level but breaks inside callbacks
- 10 — autocomplete narrows correctly even after destructuring and HOFs

---

### 5. Discoverability ⚖️ weight 8%

A consumer (human or agent) lands at the package and finds the canonical entry point
in **under 30 seconds**. There is exactly one `import` statement that gives access to
the most-used APIs. The package.json `description` is prompt-shaped (not marketing).
Deep imports are explicitly marked as non-canonical optimizations.

**How to measure (LLM recipe):**

1. Open `package.json`. Read the `description` field. Is it a marketing tagline or a
   prompt-shaped sentence ("Use this for: X, Y, Z. Includes A, B, C.")?
2. Open `README.md`. Find the first code block. Is it a working `import` example that
   could be copied verbatim into a fresh project?
3. Search for "deep imports" in the docs. Are deep imports (e.g.
   `@bloomneo/appkit/auth`) documented as non-canonical?
4. Count the number of distinct ways the docs show importing the same API. Should be 1.

**Failure mode it catches:** The "use deep imports vs use flat imports" confusion in
uikit 1.5.0 where the README, the templates, and the examples all used different
import styles for the same components. Agents had to choose; humans were confused.

**Dev sub-score:**
- 0 — README starts with marketing fluff, no import example in the first 50 lines
- 5 — README has an import example but it conflicts with the templates or AGENTS.md
- 10 — first 30 lines of README contain a copy-pasteable canonical import that
  matches every other doc

**Agent sub-score:**
- 0 — agent grepping for `import` returns ≥3 different patterns
- 5 — agent finds one canonical pattern but also finds non-canonical patterns
  without warnings
- 10 — agent finds exactly one canonical pattern; everything else has explicit
  "non-canonical" annotations

---

### 6. Example completeness ⚖️ weight 12%

Every public primitive (component, hook, class, function) has a minimal copy-pasteable
example file that **actually compiles and runs**. The example is the smallest possible
working snippet, not a contrived multi-feature demo. Examples are typechecked AND
runtime-verified.

**How to measure (LLM recipe):**

1. Count the public primitives (from dimension 1's audit). For appkit auth, that's
   12 methods: `generateLoginToken`, `generateApiToken`, `verifyToken`, etc.
2. Open `examples/<module>.ts` (or whatever the example folder is).
3. For each public primitive, verify there's an example file that uses it. Either one
   file per primitive, or one file per module containing snippets for every primitive.
4. For each example file, verify:
   - It typechecks (would `tsc --noEmit` succeed against this file?)
   - It would run if executed (no obviously broken imports, no methods called with
     wrong shapes)
5. Count primitives with no example, examples that don't compile, examples that
   compile but call non-existent methods.

**Failure mode it catches:** The 12 example files I shipped in an earlier round that
referenced 4 hallucinated method names. They typechecked clean (because of `any`
casts) but threw at runtime. Only by writing them, running them, and watching them
fail did the bugs surface.

**Dev sub-score:**
- 0 — no examples folder, or examples don't compile
- 5 — examples exist for the most common APIs, edge cases unrepresented
- 10 — every public primitive has a working example file

**Agent sub-score:**
- 0 — agent looking for a usage pattern has nothing to copy
- 5 — agent finds an example but has to modify it heavily to match the real API
- 10 — agent copies the example verbatim and only changes the data

---

### 7. Composability examples ⚖️ weight 8%

A `cookbook/` (or equivalent) folder contains 3-5 multi-module recipes showing how
the primitives **combine** to solve real-world tasks. These are larger than single-
module examples and represent the canonical "build a CRUD page" or "build an
authenticated API endpoint" patterns.

**How to measure (LLM recipe):**

1. Look for a `cookbook/`, `recipes/`, or equivalent folder in the package root.
2. Count the recipe files. Each one should compose ≥2 modules.
3. For each recipe, verify:
   - It has a top comment explaining what real-world task it solves
   - It uses real method names from the package (not hallucinated)
   - It typechecks
4. Score based on coverage: do the recipes cover the most common multi-module
   compositions for this package's domain?

**Failure mode it catches:** The "user does CRUD" task taking 600 LOC of bespoke
glue code in client codebases because there was no canonical "this is how you wire
auth + db + error + logger together" recipe to copy from.

**Dev sub-score:**
- 0 — no cookbook
- 5 — cookbook exists but recipes are toy examples or untested
- 10 — 3-5 realistic recipes covering the most common multi-module compositions

**Agent sub-score:**
- 0 — agent has to invent the multi-module wiring from scratch
- 5 — agent finds a recipe but it doesn't match the use case
- 10 — agent finds a recipe close enough to copy verbatim

---

### 8. Educational errors ⚖️ weight 8%

Runtime errors thrown by the package **name the missing thing** AND **link to the
canonical fix**. Generic `TypeError: Cannot read property 'X' of undefined` is the
worst kind of error. Errors should be readable by both humans and LLMs and should
contain enough context to self-correct without consulting external docs.

**How to measure (LLM recipe):**

1. Find every `throw new Error(...)` and `throw new <CustomError>(...)` in the
   package source.
2. Read each error message. Does it:
   - Name the specific module/method that produced it?
   - Name the specific input that was wrong?
   - Suggest a fix or link to a doc?
3. Count "good" errors (with all 3) vs "bad" errors (generic `Error` with vague text).

**Failure mode it catches:** The cryptic `Cannot read properties of undefined
(reading 'map')` that consumers got when passing `undefined` to `<DataTable data={...}>`
before we added `requireArrayProp`. The fix changed the error to `[@bloomneo/uikit]
<DataTable> expects \`data\` to be an array. Pass [] while loading. See examples/data-table.tsx`.

**Dev sub-score:**
- 0 — most errors are generic `TypeError` / `Error` with no context
- 5 — errors name the module but don't link to docs or suggest fixes
- 10 — every error names module + missing thing + link to fix

**Agent sub-score:**
- 0 — agent can't determine what to fix from the error
- 5 — agent can guess what to fix but has no canonical reference
- 10 — agent reads the error and self-corrects on the next iteration

---

### 9. Convention enforcement ⚖️ weight 7%

There is **exactly one canonical way** to do each common task. Non-canonical patterns
are either prevented at compile time or warned about at runtime. The package doesn't
ship two equally-valid ways to do the same thing without explicitly marking which is
canonical.

**How to measure (LLM recipe):**

1. List the 5 most-common tasks the package supports (e.g. for auth: "issue a token",
   "verify a token", "protect a route by login", "protect a route by role", "extract
   the user from a request").
2. For each task, count the number of distinct ways the docs show how to do it.
3. If there's >1 way, check whether one is explicitly marked as canonical and the
   others as alternatives.

**Failure mode it catches:** The "deep imports vs flat imports" issue from earlier
where both styles worked, both were documented, and neither was marked canonical.
Agents picked randomly.

**Dev sub-score:**
- 0 — multiple ways to do each task, none marked canonical
- 5 — one canonical way exists but the docs also show alternatives without warnings
- 10 — exactly one canonical way per task; non-canonical patterns explicitly flagged

**Agent sub-score:** Same scale as dev sub-score.

---

### 10. Drift prevention ⚖️ weight 5%

There is an **automated check** (CI gate, test, or pre-commit hook) that catches
documentation drifting from the source code. If a future contributor renames a
public method but forgets to update the README, the build breaks.

**How to measure (LLM recipe):**

1. Look for `scripts/check-*`, CI configurations, husky hooks, or test files that
   compare doc references against source.
2. Verify the check runs as part of `npm test` or CI.
3. If no automated check exists, score 0 regardless of the current state of the docs.

**Failure mode it catches:** The entire reason this rubric exists. We rebuilt the
auth docs three times because there was no gate preventing the next round of drift.

**Dev sub-score:**
- 0 — no drift check exists
- 5 — drift check exists but is manual ("run this command before releasing")
- 10 — drift check runs automatically in CI on every PR

**Agent sub-score:** Same scale.

---

### 11. Reading order ⚖️ weight 5%

A fresh consumer (dev or agent) lands at any entry point and finds the canonical path
through the docs in **under 30 seconds**. The README points to AGENTS.md and llms.txt,
AGENTS.md points to examples and cookbook, examples point back to source. There are
**no dead ends** where the consumer has to guess where to look next.

**How to measure (LLM recipe):**

1. Pretend to be a fresh consumer who just ran `npm install <package>`. Open the
   first file you'd naturally read — usually `node_modules/<package>/README.md`.
2. From that file, can you find a path to:
   - The canonical import statement?
   - At least one working example?
   - The full API reference?
3. Count the number of clicks/file-opens to reach each. Should be ≤2 for each.

**Failure mode it catches:** Earlier in this session, an agent reading bloomneo had to
open `node_modules/@bloomneo/uikit/llms.txt` directly, which was a discovery
nightmare. Adding pointers from README.md → AGENTS.md → llms.txt → examples solved it.

**Dev sub-score:**
- 0 — README is marketing only; no pointers to anything else
- 5 — README points to docs/ but the next layer doesn't point further
- 10 — README → AGENTS.md → examples → source forms a complete clickable path

**Agent sub-score:** Same scale.

---

### 12. Simplicity ⚖️ weight 9%

How small is the public surface area, and how much of it does a typical
consumer actually need? Fewer methods + tighter signatures = lower cognitive
load. **Multiplier dimension** — if the API is small, every other dimension
needs less work.

**How to measure:**
1. Count public methods on the main class. ≤8 ideal, 8–15 acceptable, >15 high.
2. Identify the 80% case: how many methods cover the most common task?
3. Count required args per method (avg). 1–2 = good; 4+ = friction.
4. Count "modes" (boolean flags, options that change behavior).
5. Count concepts a consumer must learn before being productive.

**Failure mode it catches:** A package with 50 methods where the dev can't tell
which 5 they actually need.

**Score (0–10):** 0 = >30 methods, no clear default, options object on every
method · 5 = 10–15 methods, default usage takes 3 of them · 10 = ≤8 methods,
"minimum viable use" is one method with one arg.

---

### 13. Clarity ⚖️ weight 9%

Do names mean what they say? Can a consumer guess the right method without
reading docs? **Self-documenting names eliminate half the doc artifacts in
the rest of the rubric.**

**How to measure:**
1. Check public method names for vague verbs (`process`, `handle`, `do`, `run`).
2. Check parameter names — `(email, password)` good, `(x, y)` bad.
3. Check return types for opaque shapes (`any`, `Result<T>`, generic objects).
4. Check for jargon that requires domain expertise.

**Failure mode it catches:** A package where `auth.process(req)` does
authentication, `auth.handle(req)` does authorization, and `auth.run(req)`
does session refresh — three identical-looking names doing different things.

**Score (0–10):** 0 = ≥30% vague names · 5 = some unclear names but common
ones are explicit · 10 = every public method name reads as a sentence
describing what it does.

---

### 14. Unambiguity ⚖️ weight 5%

For each input, exactly one valid interpretation. For each output, exactly
one valid mental model.

**How to measure:**
1. Count overloaded methods (same name, different shapes).
2. Check return types — does `null` mean "not found" or "failure"?
3. Check boolean flags with non-obvious meanings.
4. Check for state-dependent behavior (same call, different result).
5. Check for shape-but-not-semantics matches (e.g. `requireUserRoles` is OR,
   `requireUserPermissions` is AND — same shape, different rule).

**Failure mode it catches:** `cache.get(key)` returning `null` for both
"not in cache" and "found, value is null" — consumer can't tell.

**Score (0–10):** 0 = most methods have overloads, opaque returns, or
state-dependent behavior · 5 = edge cases ambiguous, happy path clear ·
10 = every method has exactly one valid interpretation.

---

### 15. Learning curve ⚖️ weight 5%

How fast can a fresh dev (or agent) reach productive? Composite of setup
cost, mental model cost, failure recovery cost, progressive disclosure,
context-switch cost from related tools.

**Canonical "fresh dev" profile:** *2-year Node.js dev who knows Express
basics, has used JWT once, has never seen this package.*

**How to measure:**
1. **Time to first working call** — count lines of README the dev reads
   before reaching a copy-pasteable code block; count required env vars
   before that block runs.
2. **Progressive disclosure** — are simple cases at the top? Can a dev
   write a working snippet using 2–3 concepts and learn the rest later?
3. **Failure recovery** — when the dev makes the most likely first
   mistake, what does the error message teach them?
4. **Context-switch cost** — does the package use ecosystem idioms
   (Express middleware, Promises, standard JWT) or invent its own?
5. **Required reading depth** — to use 80% of the module well, how many
   files does the dev need to open?

**Failure mode it catches:** A dev who installed an hour ago still
can't write a working endpoint and gives up.

**Score (0–10):** 0 = can't write working code after 30 min of reading ·
5 = working snippet in ~15 min by reading README + one example · 10 =
working snippet in ~2 min from README hero alone, errors guide all
setup mistakes.

**Agent sub-score** uses a slightly different scale: 0 = agent reads ≥4
files and synthesizes a non-obvious chain · 5 = agent reads README +
AGENTS.md + one example · 10 = agent reads first 30 lines of AGENTS.md
and generates correct code first try.

---

## Weighted summary (v1.1)

| # | Dimension | Weight |
|---|---|---:|
| 1 | API correctness | **12%** |
| 2 | Doc consistency | 8% |
| 3 | Runtime verification | 9% |
| 4 | Type safety | 6% |
| 5 | Discoverability | 6% |
| 6 | Example completeness | 8% |
| 7 | Composability examples | 6% |
| 8 | Educational errors | 5% |
| 9 | Convention enforcement | 5% |
| 10 | Drift prevention | 4% |
| 11 | Reading order | 3% |
| **12** | **Simplicity** | **9%** |
| **13** | **Clarity** | **9%** |
| **14** | **Unambiguity** | 5% |
| **15** | **Learning curve** | **5%** |
| | **Total** | **100%** |

**Why these four upstream dimensions matter (added in v1.1):**
The original 11 dimensions all measured *artifacts* (docs, tests, examples)
— they catch downstream bugs but don't measure whether the API itself is
small, clear, unambiguous, or fast to learn. A package can score 10/10 on
every artifact dimension while still being a 50-method tangle that takes
3 days to learn. Dimensions 12–15 measure the API itself, upstream of
everything else.

**Final score** = `Σ(dimension_score × weight) / 10`

(Each dimension score is on a 0-10 scale; weights sum to 100%; multiplying and
dividing by 10 gives a final score on a 0-100 scale.)

---

## Score bands

| Band | Range | Meaning |
|---|---|---|
| 🔴 **Not usable** | 0–30 | Multiple categories of bug ship to consumers. Agents and devs both fail repeatedly. Don't release. |
| 🟠 **Usable with caveats** | 30–60 | A skilled consumer can work around the gaps. Agents need significant babysitting. Ship only with prominent "rough edges" warnings. |
| 🟡 **Solid** | 60–85 | Most consumers will succeed first try. A few specific failure modes remain. Acceptable to ship; document the remaining gaps. |
| 🟢 **Exemplary** | 85–100 | Both devs and agents succeed reliably. Remaining gaps are aesthetic, not functional. Use as a reference for other packages. |

---

## Anti-patterns (immediate score caps)

These red flags cap the maximum score regardless of how well other dimensions perform:

| Anti-pattern | Score cap |
|---|---|
| Any documented method is hallucinated (doesn't exist on the runtime API) | **40 max** |
| Any example file fails to compile | **50 max** |
| Any example file compiles but throws at runtime | **55 max** |
| Two doc files contradict each other on the same API | **60 max** |
| Public types contain `any` for an input that has a constrained set of values | **70 max** |
| No tests exist for any public method | **65 max** |
| README has zero pointers to AGENTS.md, examples, or llms.txt | **75 max** |
| Generic `TypeError` thrown without naming the missing thing | **80 max** |
| Two equally-valid ways to do the same task, neither marked canonical | **80 max** |

---

## How to apply this rubric

For an LLM scoring a package:

1. **Read this file in full** before scoring anything. The recipes matter.
2. **Read the package's source tree** (`src/`, `examples/`, `cookbook/`, `README.md`,
   `AGENTS.md`, `llms.txt`, etc.) before opening this file again to score.
3. **Score each dimension separately**, showing your work. Don't average dimensions
   together until the end.
4. **For each dimension, write at least one paragraph** explaining the score —
   what you found, what failures the score reflects, what would push it higher.
5. **Apply the anti-pattern caps** AFTER computing the weighted score. If the
   weighted score is 78 but the package has a hallucinated method (40 cap), the
   final reported score is 40.
6. **Write the final score** as `<weighted>/100` with the cap (if any) noted
   separately, e.g.: `78/100, capped at 40 due to hallucinated methods`.

Re-running this rubric on the same package should produce the same score within
±5 points. If two reviewers disagree by more than that, the rubric needs to be
clarified.

---

## How to read a score block in a module README

Every module README should end with a `## Agent-Dev Friendliness Score` block in this
shape:

```markdown
## Agent-Dev Friendliness Score

**Score: 82/100 — 🟡 Solid**
*Last scored: 2026-04-11 (manual, by Claude)*
*Rubric: AGENT_DEV_SCORING_ALGORITHM.md v1*

| Dim | Score | Notes |
|---|---:|---|
| 1. API correctness | 10/10 | All 12 methods verified by auth.test.ts |
| 2. Doc consistency | 9/10 | Slight variance in BLOOM_AUTH_ROLES example phrasing |
| ... | ... | ... |

**Gaps to close to reach 90+**:
- ...
```

The block lives at the bottom of the module README. It anchors the rubric in the
module's own home and gives future readers a snapshot of where the module stands
and what to fix.

---

## How to extend this rubric

When you find a new failure mode that this rubric doesn't catch, add a dimension.
Each new dimension needs:

- A name + 1-line description
- A how-to-measure recipe (LLM-readable, not script)
- A failure mode it catches (concrete, past-tense, from a real bug)
- Dev + agent sub-scores
- A weight that comes out of the existing 100% (rebalance the others)

Don't add dimensions that score "general code quality" (linting, formatting, test
coverage of internal logic). Those have their own tools. This rubric is about
**agent-and-dev consumability** — i.e., the externally visible surface area.

---

*Version 1.0 — 2026-04-11*
*Maintained as part of `@bloomneo/appkit`. Reusable for any package.*
