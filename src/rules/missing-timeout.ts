import * as babelTraverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { unwrapBabelDefault } from '../babel-interop.js';

const traverse = unwrapBabelDefault<(parent: t.Node, opts: TraverseOptions) => void>(babelTraverse);
import type { Finding, ParsedFile, Rule } from '../types.js';

/**
 * Flags fetch()/axios calls with no timeout mechanism.
 *
 * This is deliberately not "missing retry" — a request with no timeout
 * hangs indefinitely regardless of what retry logic wraps it, because the
 * `await` never returns control back to the retry loop. Timeout is the
 * property that actually bounds the wait; retry is a separate concern this
 * rule doesn't try to verify. Conflating the two would produce a finding
 * that sounds precise but isn't technically accurate.
 *
 * fetch(): flags calls with no options object, or an options object with
 * no `signal` property (the standard way to bound a fetch with
 * AbortSignal.timeout(ms) or a manually-wired AbortController).
 *
 * axios: flags axios.get/post/put/patch/delete(url, config) calls whose
 * config object has no `timeout` property, and axios({...}) calls whose
 * config object has no `timeout` property.
 */
function objectHasProperty(node: t.Node | null | undefined, propName: string): boolean {
  if (!node || !t.isObjectExpression(node)) return false;
  return node.properties.some(
    (p) => t.isObjectProperty(p) && ((t.isIdentifier(p.key) && p.key.name === propName) || (t.isStringLiteral(p.key) && p.key.value === propName)),
  );
}

function snippetFor(source: string, node: t.Node): string {
  if (node.start == null || node.end == null) return '';
  const raw = source.slice(node.start, node.end);
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}

export const missingTimeoutRule: Rule = {
  name: 'missing-timeout',
  severity: 'high',
  check(parsed: ParsedFile): Finding[] {
    const findings: Finding[] = [];
    const { ast, source, file } = parsed;

    traverse(ast, {
      CallExpression(path) {
        const { node } = path;
        const callee = node.callee;

        // fetch(url, options?)
        if (t.isIdentifier(callee) && callee.name === 'fetch') {
          const optionsArg = node.arguments[1];
          const hasSignal = objectHasProperty(t.isObjectExpression(optionsArg) ? optionsArg : undefined, 'signal');
          if (!hasSignal) {
            findings.push({
              rule: 'missing-timeout',
              severity: 'high',
              file,
              line: node.loc?.start.line ?? 0,
              column: node.loc?.start.column ?? 0,
              message: "fetch() call has no `signal` (AbortSignal.timeout(...)) — a hung dependency will hang this request indefinitely.",
              snippet: snippetFor(source, node),
            });
          }
          return;
        }

        // axios.get/post/put/patch/delete(url, config?)
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object) &&
          callee.object.name === 'axios' &&
          t.isIdentifier(callee.property) &&
          ['get', 'delete', 'head', 'options'].includes(callee.property.name)
        ) {
          const configArg = node.arguments[1];
          if (!objectHasProperty(configArg, 'timeout')) {
            findings.push(makeAxiosFinding(file, source, node));
          }
          return;
        }
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object) &&
          callee.object.name === 'axios' &&
          t.isIdentifier(callee.property) &&
          ['post', 'put', 'patch'].includes(callee.property.name)
        ) {
          const configArg = node.arguments[2];
          if (!objectHasProperty(configArg, 'timeout')) {
            findings.push(makeAxiosFinding(file, source, node));
          }
          return;
        }

        // axios({ url, ... })
        if (t.isIdentifier(callee) && callee.name === 'axios' && node.arguments.length === 1) {
          const configArg = node.arguments[0];
          if (!objectHasProperty(configArg, 'timeout')) {
            findings.push(makeAxiosFinding(file, source, node));
          }
        }
      },
    });

    return findings;
  },
};

function makeAxiosFinding(file: string, source: string, node: t.CallExpression): Finding {
  return {
    rule: 'missing-timeout',
    severity: 'high',
    file,
    line: node.loc?.start.line ?? 0,
    column: node.loc?.start.column ?? 0,
    message: 'axios call has no `timeout` in its config — a hung dependency will hang this request indefinitely.',
    snippet: snippetFor(source, node),
  };
}
