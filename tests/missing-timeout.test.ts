import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSource } from '../src/parser.js';
import { missingTimeoutRule } from '../src/rules/missing-timeout.js';

function checkFixture(path: string) {
  const source = readFileSync(path, 'utf-8');
  const parsed = parseSource(path, source);
  assert.ok(parsed, `fixture must parse: ${path}`);
  return missingTimeoutRule.check(parsed);
}

test('flags a bare fetch() with no signal', () => {
  const findings = checkFixture('tests/fixtures/bad/fetch-no-timeout.js');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, 'missing-timeout');
  assert.match(findings[0]!.snippet, /fetch\(/);
});

test('flags axios.get and axios.post with no timeout — both calls, not just one', () => {
  const findings = checkFixture('tests/fixtures/bad/axios-no-timeout.js');
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.rule === 'missing-timeout'));
});

test('does NOT flag fetch() with AbortSignal.timeout', () => {
  const findings = checkFixture('tests/fixtures/good/fetch-with-timeout.js');
  assert.equal(findings.length, 0);
});

test('does NOT flag axios calls (get/post/object-form) that include timeout', () => {
  const findings = checkFixture('tests/fixtures/good/axios-with-timeout.js');
  assert.equal(findings.length, 0);
});
