#!/usr/bin/env node
import { scan } from './scanner.js';
import { formatConsole, formatJson } from './report.js';
import { missingTimeoutRule } from './rules/missing-timeout.js';
import { nPlusOneQueryRule } from './rules/n-plus-one-query.js';

const RULES = [missingTimeoutRule, nPlusOneQueryRule];

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'scan') {
    console.error('Usage: vibeguard scan <path> [--json]');
    process.exitCode = 1;
    return;
  }

  const target = args[1] ?? '.';
  const asJson = args.includes('--json');

  const result = scan(target, RULES);
  console.log(asJson ? formatJson(result) : formatConsole(result));

  const highSeverityCount = result.findings.filter((f) => f.severity === 'high').length;
  process.exitCode = highSeverityCount > 0 ? 1 : 0;
}

main();
