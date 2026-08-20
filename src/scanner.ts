import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parseSource } from './parser.js';
import type { Finding, Rule } from './types.js';

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

function collectFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (!IGNORED_DIRS.has(entry)) stack.push(full);
      } else if (CODE_EXTENSIONS.has(extname(entry))) {
        files.push(full);
      }
    }
  }
  return files;
}

export interface RuleError {
  readonly rule: string;
  readonly file: string;
  readonly error: string;
}

export interface ScanResult {
  readonly filesScanned: number;
  /** Files that failed to read or failed to parse — never analyzed at all. */
  readonly filesSkipped: number;
  readonly findings: Finding[];
  /** Files that parsed fine but made a specific rule throw during traversal — analyzed by the other rules, just not this one. Kept separate from filesSkipped so the report doesn't conflate "never looked at this file" with "one rule choked on it." */
  readonly ruleErrors: RuleError[];
}

export function scan(root: string, rules: readonly Rule[]): ScanResult {
  const files = collectFiles(root);
  const findings: Finding[] = [];
  const ruleErrors: RuleError[] = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, 'utf-8');
    } catch {
      filesSkipped += 1;
      continue;
    }
    const parsed = parseSource(file, source);
    if (!parsed) {
      filesSkipped += 1;
      continue;
    }
    filesScanned += 1;
    for (const rule of rules) {
      try {
        findings.push(...rule.check(parsed));
      } catch (err) {
        // A single file tripping an internal traverse error (seen for
        // real: @babel/traverse's own scope tracking throwing "Duplicate
        // declaration" on one file during a real-world scan) must not take
        // down the whole scan or silently look like a clean pass. Record
        // it, keep going with the other rules and files.
        ruleErrors.push({ rule: rule.name, file, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return { filesScanned, filesSkipped, findings, ruleErrors };
}
