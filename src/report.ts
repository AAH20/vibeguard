import type { ScanResult } from './scanner.js';

export function formatConsole(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`Scanned ${result.filesScanned} files (${result.filesSkipped} skipped/unparsable).`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push('No findings.');
    return lines.join('\n');
  }

  const byFile = new Map<string, typeof result.findings>();
  for (const f of result.findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  for (const [file, findings] of byFile) {
    lines.push(file);
    for (const f of findings) {
      lines.push(`  ${f.line}:${f.column}  [${f.severity}] ${f.rule} — ${f.message}`);
      lines.push(`    ${f.snippet}`);
    }
  }

  lines.push('');
  lines.push(`${result.findings.length} finding(s) across ${byFile.size} file(s).`);

  if (result.ruleErrors.length > 0) {
    lines.push('');
    lines.push(`${result.ruleErrors.length} file(s) parsed but made a rule error out during analysis (that rule was skipped for that file, others still ran):`);
    for (const e of result.ruleErrors) {
      lines.push(`  ${e.file}  [${e.rule}] ${e.error}`);
    }
  }

  return lines.join('\n');
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
