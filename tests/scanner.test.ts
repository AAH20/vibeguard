import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../src/scanner.js';
import { missingTimeoutRule } from '../src/rules/missing-timeout.js';
import { nPlusOneQueryRule } from '../src/rules/n-plus-one-query.js';

test('a file that trips a real @babel/traverse internal error does not crash the scan', () => {
  // This exact file (copied verbatim from a real scan of the `continue`
  // codebase) makes @babel/traverse's own scope tracking throw
  // 'Duplicate declaration "Group"' during traversal. Before the fix in
  // scanner.ts, that exception propagated out of scan() entirely and took
  // the whole process down with it — verified live before this test
  // existed, not assumed.
  const result = scan('tests/fixtures/bad', [missingTimeoutRule, nPlusOneQueryRule]);

  assert.ok(result.filesScanned > 0, 'other fixtures in the directory must still be scanned');
  const crashFile = result.ruleErrors.find((e) => e.file.includes('real-world-traverse-crash.ts'));
  assert.ok(crashFile, 'the problem file must be recorded as a rule error, not silently dropped');
  assert.match(crashFile!.error, /Duplicate declaration/);
});
