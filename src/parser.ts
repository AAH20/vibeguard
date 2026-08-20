import { parse } from '@babel/parser';
import type { ParsedFile } from './types.js';

/**
 * Real AST parsing via @babel/parser — not regex or keyword matching. A
 * rule that "detects" a pattern by grepping for a substring produces false
 * positives on comments, strings, and unrelated code, and false negatives
 * on anything reformatted. Parsing to a real syntax tree is what makes a
 * finding's line/column trustworthy enough to act on.
 */
export function parseSource(file: string, source: string): ParsedFile | undefined {
  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
    return { file, source, ast };
  } catch {
    // A file that doesn't parse can't be analyzed; skip it rather than
    // crash the whole scan over one malformed or unsupported file.
    return undefined;
  }
}
