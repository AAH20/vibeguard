/**
 * @babel/traverse's CJS build declares `export default traverse` in its
 * .d.ts, but under real Node ESM `import`, the interop double-wraps it:
 * `import * as ns from '@babel/traverse'` yields `ns.default` as another
 * object (not the function), with the real function one level deeper at
 * `ns.default.default`. Confirmed directly at runtime, not assumed — a
 * plain `require()` only shows the single-wrapped shape, which is why a
 * type-level fix alone silently passed compilation and then failed every
 * test at runtime the first time this ran for real.
 *
 * Handles both the single- and double-wrapped shape defensively, since
 * which one shows up can depend on the resolving toolchain, not just the
 * package itself.
 */
export function unwrapBabelDefault<T>(mod: unknown): T {
  let current: unknown = mod;
  while (current && typeof current === 'object' && 'default' in current && typeof current !== 'function') {
    const next = (current as { default: unknown }).default;
    if (typeof next === 'function') return next as T;
    if (next === current) break;
    current = next;
  }
  if (typeof current === 'function') return current as T;
  throw new Error('Could not unwrap @babel/traverse default export — its module shape has changed.');
}
