# vibeguard

Static analysis for the two production bugs that are invisible in a demo
and expensive at scale: **missing timeouts on external calls**, and
**N+1 query loops**. Not an AI tool — real AST parsing via
`@babel/parser`/`@babel/traverse`, no model calls, no "semantic" claims
the code doesn't back up.

[![CI](https://github.com/AAH20/vibeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/AAH20/vibeguard/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Why these two, and not the other hundred production concerns

Rate limiting, caching, Kubernetes, observability, IAM — most of the things
a scaling app needs already have a mature, dedicated tool. Missing timeouts
and N+1 queries don't: they're syntactically valid, pass every linter, work
perfectly in a demo with a handful of records or one concurrent user, and
degrade in direct proportion to real traffic — exactly the point where a
vibe-coded app meets its first real load. No existing static analyzer
executes code under concurrent load to check for this; both rules below
catch it from the source alone.

## What's actually here — two rules, real AST analysis

**`missing-timeout`** — flags `fetch()` calls with no `signal`
(`AbortSignal.timeout(...)`), and `axios` calls (all forms: `axios.get`,
`axios.post`, `axios({...})`) with no `timeout` in their config. Not
"missing retry" — a request with no timeout hangs indefinitely regardless
of what retry logic wraps it, because the `await` never returns control to
the retry loop in the first place. Timeout is the property that actually
bounds the wait.

**`n-plus-one-query`** — flags an awaited, ORM-shaped call sitting inside a
loop body or inside a `.map()`/`.forEach()`/`.filter()` callback: one query
per item instead of one batched query for all of them. Method-name
matching (`findOne`, `query`, `get`, ...) is a heuristic, not semantic
proof of a database call, and a real scan of a large production codebase
(`continue`, 1,852 files) caught this rule's own first version flagging
`serviceContainer.get()` and `api.get()` as ORM calls — neither is one, a
DI container and an HTTP client respectively. Fixed by requiring ambiguous
method names to also have a database-shaped receiver (`db`, `pool`,
`prisma`, a capitalized model name, ...); unambiguous ORM-only names
(`findOne`, `findById`, `findMany`, ...) still count on their own. That
false-positive class and its fix are both preserved as regression tests,
not just described here.

## Try it

```bash
npm install
npm run build
node dist/src/cli.js scan <path-to-your-repo>
node dist/src/cli.js scan <path> --json   # for CI/tooling consumption
```

Exit code is `1` if any high-severity finding exists, `0` otherwise — safe
to wire into CI directly.

## Real-world validation, not just crafted fixtures

Ten tests cover both true positives and true negatives for each rule
(`npm test`). Beyond the test suite, run directly against real, external
codebases:

- `modelcontextprotocol/servers` (65 files): 0 findings, 0 crashes — a
  small, focused reference implementation with no matching patterns is a
  legitimate result, not evidence the tool doesn't work.
- `continue` (1,852 files): 45 `missing-timeout` findings, 4
  `n-plus-one-query` findings, 1 file correctly isolated as a rule error
  rather than crashing the whole scan (see below) — every one of the four
  N+1 findings resolves to a real, visible SQL string in its own snippet
  (`db.get('SELECT id FROM code_snippets...')`,
  `pool.query('SELECT * FROM ...')`), not a guess.

That real-world run also found and fixed a genuine robustness bug: one
specific file made `@babel/traverse`'s own internal scope tracking throw
`Duplicate declaration "Group"`, which — before the fix — crashed the
entire scan process, not just that file. The scanner now isolates a
per-file, per-rule failure and keeps going; that exact file is kept as a
permanent regression fixture (`tests/fixtures/bad/real-world-traverse-crash.ts`),
not a synthetic reproduction.

## Honest scope

- **Static analysis only.** No sandboxed execution, no runtime behavioral
  observation. This is the tractable half of the problem; a dynamic/
  behavioral layer is a separate, much larger undertaking and isn't
  attempted here.
- **JavaScript/TypeScript only** (`.js/.jsx/.ts/.tsx/.mjs/.cjs`), via
  `@babel/parser` with the `typescript` and `jsx` plugins. No Python, Go,
  or other language support yet.
- **Two rules, not fourteen.** The other twelve items in the original
  concurrency/resilience cluster (race conditions, deadlocks, distributed
  locks, circuit breakers, dead letter queues, thread safety, backpressure,
  ...) are real and out of scope for this release — adding them well
  requires the same fixture-driven, tested-against-real-code discipline
  used for these two, not a rushed bundle.
- **No automated fix generation yet.** Detection only. Auto-generating a
  fix as a PR (the actual distribution mechanic — this is the roadmap, not
  a current claim) is meaningfully harder to get right than detection and
  isn't attempted in this release.
- **Method-name heuristics, stated as heuristics.** The tightened
  detection in `n-plus-one-query` measurably reduces false positives found
  in real code; it doesn't eliminate them. A function named `get` on an
  object that happens to match the database-shaped-name pattern by
  coincidence would still be a false positive. This is a known, real
  limitation, not hidden behind confident language.

## Roadmap

- Auto-generate the fix as a real PR (wrap the bare `fetch()` with a
  timeout, wrap the loop query in a batched equivalent) — the actual
  distribution mechanic, once detection has more real-world mileage on it.
- Additional rules from the same cluster: missing retry/backoff, missing
  circuit breakers on external dependencies, missing idempotency keys on
  mutation endpoints.
- Python support.

## License

Apache-2.0
