import * as babelTraverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { unwrapBabelDefault } from '../babel-interop.js';
import type { Finding, ParsedFile, Rule } from '../types.js';

const traverse = unwrapBabelDefault<(parent: t.Node, opts: TraverseOptions) => void>(babelTraverse);

/**
 * Flags an awaited, ORM-shaped call sitting inside a loop body or inside a
 * .map()/.forEach()/.filter() callback — the classic N+1 pattern: one query
 * per item instead of one batched query for all items. It's invisible with
 * a handful of demo records and directly proportional to user count once
 * real, meaning it degrades exactly at the "first million users" inflection
 * point named as the target, not before.
 *
 * Method-name matching is a heuristic, not a semantic proof of a database
 * call — and an earlier version of this rule was too loose about it: a
 * real scan of a large production codebase (linked-ai/continue) flagged
 * `serviceContainer.get(...)` and `api.get(...)` as ORM calls. Neither is
 * one — a DI container and an HTTP client, respectively. Found by testing
 * against real code, not assumed. Fixed below by splitting method names
 * into two tiers: names that are unambiguous outside an ORM context always
 * count, but generic names shared with other common APIs (`get`, `query`,
 * `find`, `select`, `count`, `create`, `update`, `save`) only count when
 * the object they're called on also looks database-shaped — this doesn't
 * eliminate false positives, but it removes the specific, real class just
 * found, rather than papering over it with a disclaimer.
 */
const UNAMBIGUOUS_ORM_METHODS = new Set(['findOne', 'findById', 'findByPk', 'findMany', 'findFirst', 'aggregate']);
const AMBIGUOUS_ORM_METHODS = new Set(['find', 'query', 'select', 'get', 'count', 'create', 'update', 'destroy', 'save']);
const DB_LIKE_OBJECT_NAMES = /^(db|database|pool|conn|connection|client|knex|prisma|sql|sequelize|model|repo|repository|dao|store)$/i;
/** e.g. `User.findAll`, `Order.query` — a capitalized identifier reads as a model/class, not a service or client. */
function looksLikeModelName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function snippetFor(source: string, node: t.Node): string {
  if (node.start == null || node.end == null) return '';
  const raw = source.slice(node.start, node.end);
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}

function isOrmLikeCall(node: t.Node | null | undefined): node is t.CallExpression {
  if (!node || !t.isCallExpression(node)) return false;
  const callee = node.callee;
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) return false;
  const methodName = callee.property.name;

  if (UNAMBIGUOUS_ORM_METHODS.has(methodName)) return true;
  if (!AMBIGUOUS_ORM_METHODS.has(methodName)) return false;

  // Ambiguous method name: only count it if the receiver also looks
  // database-shaped, e.g. `db.get(...)`, `User.findAll(...)`,
  // `orderRepo.query(...)` — but not `serviceContainer.get(...)` or
  // `api.get(...)`.
  if (t.isIdentifier(callee.object)) {
    return DB_LIKE_OBJECT_NAMES.test(callee.object.name) || looksLikeModelName(callee.object.name);
  }
  // e.g. `db.order.findOne(...)` — walk to the innermost object identifier.
  if (t.isMemberExpression(callee.object) && t.isIdentifier(callee.object.object)) {
    return DB_LIKE_OBJECT_NAMES.test(callee.object.object.name) || looksLikeModelName(callee.object.object.name);
  }
  return false;
}

function isLoopNode(node: t.Node): boolean {
  return t.isForStatement(node) || t.isForOfStatement(node) || t.isForInStatement(node) || t.isWhileStatement(node) || t.isDoWhileStatement(node);
}

function isMapForEachFilterCallback(path: import('@babel/traverse').NodePath): boolean {
  const parent = path.parent;
  if (!t.isCallExpression(parent)) return false;
  const callee = parent.callee;
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) return false;
  if (!['map', 'forEach', 'filter'].includes(callee.property.name)) return false;
  // The function/arrow must actually be the callback argument, not some
  // unrelated function that happens to be a sibling.
  return parent.arguments.includes(path.node as t.Expression);
}

export const nPlusOneQueryRule: Rule = {
  name: 'n-plus-one-query',
  severity: 'high',
  check(parsed: ParsedFile): Finding[] {
    const findings: Finding[] = [];
    const { ast, source, file } = parsed;
    const seen = new Set<t.Node>();

    traverse(ast, {
      AwaitExpression(path) {
        const call = path.node.argument;
        if (!isOrmLikeCall(call) || seen.has(call)) return;

        // Walk up: is this await inside a loop body, or inside a
        // map/forEach/filter callback?
        let current: import('@babel/traverse').NodePath | null = path;
        while (current) {
          if (isLoopNode(current.node)) {
            record();
            return;
          }
          if ((t.isArrowFunctionExpression(current.node) || t.isFunctionExpression(current.node)) && isMapForEachFilterCallback(current)) {
            record();
            return;
          }
          current = current.parentPath;
        }

        function record(): void {
          seen.add(call);
          findings.push({
            rule: 'n-plus-one-query',
            severity: 'high',
            file,
            line: call.loc?.start.line ?? 0,
            column: call.loc?.start.column ?? 0,
            message: 'ORM-shaped call awaited inside a loop/map — likely one query per item instead of one batched query.',
            snippet: snippetFor(source, call),
          });
        }
      },
    });

    return findings;
  },
};
