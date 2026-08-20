import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSource } from '../src/parser.js';
import { nPlusOneQueryRule } from '../src/rules/n-plus-one-query.js';

function checkFixture(path: string) {
  const source = readFileSync(path, 'utf-8');
  const parsed = parseSource(path, source);
  assert.ok(parsed, `fixture must parse: ${path}`);
  return nPlusOneQueryRule.check(parsed);
}

test('flags an awaited ORM call inside a for-of loop', () => {
  const findings = checkFixture('tests/fixtures/bad/n-plus-one-for-of.js');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, 'n-plus-one-query');
  assert.match(findings[0]!.snippet, /findOne/);
});

test('flags an awaited ORM call inside .map(), even wrapped in Promise.all', () => {
  const findings = checkFixture('tests/fixtures/bad/n-plus-one-map.js');
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.snippet, /findById/);
});

test('does NOT flag a single batched query outside any loop', () => {
  const findings = checkFixture('tests/fixtures/good/batched-query.js');
  assert.equal(findings.length, 0);
});

test('does NOT flag serviceContainer.get() or api.get() as ORM calls — real false-positive class found scanning continue', () => {
  const findings = checkFixture('tests/fixtures/good/non-orm-get-calls.js');
  assert.equal(findings.length, 0);
});

test('DOES still flag an ambiguous method name when the receiver is database-shaped (db.get)', () => {
  const findings = checkFixture('tests/fixtures/bad/ambiguous-method-db-object.js');
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.snippet, /db\.get/);
});
