/*
 * @file Keep a lint-disable line inside the column limit. A disable directive
 *   carries its reason after `--`, and a long reason pushes the line past
 *   printWidth. oxfmt cannot wrap a comment, so nothing fixes it and nothing
 *   else complains: the line just sits there, wider than every line around it,
 *   and a reviewer reads it by scrolling sideways.
 *
 *   The fix is placement, not deletion. A disable line answers WHICH rule and,
 *   briefly, WHY; the paragraph explaining the reasoning belongs on its own
 *   comment line above, where oxfmt's width applies to prose the same as to
 *   code:
 *
 *   ```
 *   // A cleared settings field is sent as JSON null; undefined drops the key.
 *   // oxlint-disable-next-line socket/prefer-undefined-over-null -- null is the value under test
 *   ```
 *
 *   Deliberately measures the LINE, not the reason. A short reason on a deeply
 *   indented line still overflows, and the column limit is the thing being
 *   protected. No autofix: only the author knows which half of the sentence is
 *   the short phrase and which is the paragraph.
 */

import type { AstNode, RuleContext } from '../../lib/rule-types.mts'

/**
 * The fleet's oxfmt `printWidth`. Kept here rather than read from the config
 * because a lint rule runs per file with no config loader, and the two moving
 * together is what `lint-configs-protect-verbatim` already gates.
 */
export const PRINT_WIDTH = 80

/**
 * A disable directive in either linter's spelling, with a reason after `--`.
 * The reason is what makes these lines long, so a directive without one cannot
 * overflow for the reason this rule exists to catch.
 */
const DISABLE_WITH_REASON_RE =
  /^\s*(?:\/\*|\/\/)\s*(?:eslint|oxlint)-disable(?:-next-line)?\s+\S+.*--\s*\S/

/**
 * Whether `line`, exactly as authored, is a disable directive carrying a reason
 * and running past the limit.
 *
 * Pure and exported so the behavior is tested directly on strings. The rule
 * body only locates candidate lines; every judgment lives here.
 */
export function isOverlongDisableLine(
  line: string,
  limit: number = PRINT_WIDTH,
): boolean {
  return DISABLE_WITH_REASON_RE.test(line) && line.length > limit
}

/**
 * Every 1-indexed line number in `text` that {@link isOverlongDisableLine}
 * rejects. Pure; the scanner half of the rule.
 */
export function findOverlongDisableLines(
  text: string,
  limit: number = PRINT_WIDTH,
): number[] {
  const found: number[] = []
  const lines = text.split('\n')
  for (let i = 0, { length } = lines; i < length; i += 1) {
    if (isOverlongDisableLine(lines[i]!, limit)) {
      found.push(i + 1)
    }
  }
  return found
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Keep a lint-disable line within printWidth; move the explanation to the line above.',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: undefined,
    messages: {
      longDisableReason:
        'This lint-disable line is {{width}} columns, past the {{limit}} limit, and oxfmt cannot wrap a comment. Keep a short phrase after `--` and move the explanation to its own comment line above.',
    },
    schema: [],
  },

  create(context: RuleContext) {
    const sourceCode = context.getSourceCode
      ? context.getSourceCode()
      : context.sourceCode
    return {
      // Scans the SOURCE TEXT rather than the comment nodes. A disable
      // directive is a line-shaped thing, and its authored width — indentation
      // included — is exactly what the limit governs, so reading the raw lines
      // measures the property directly instead of reconstructing it from a
      // comment node whose shape varies by parser.
      Program(node: AstNode) {
        const text: string = sourceCode.getText ? sourceCode.getText() : ''
        if (!text) {
          return
        }
        const lines = text.split('\n')
        const overlong = findOverlongDisableLines(text)
        for (let i = 0, { length } = overlong; i < length; i += 1) {
          const lineNumber = overlong[i]!
          const width = (lines[lineNumber - 1] ?? '').length
          context.report({
            node,
            loc: {
              start: { column: 0, line: lineNumber },
              end: { column: width, line: lineNumber },
            },
            messageId: 'longDisableReason',
            data: { limit: String(PRINT_WIDTH), width: String(width) },
          })
        }
      },
    }
  },
}

// oxlint-disable-next-line socket/no-default-export -- oxlint plugin contract requires default-exported rule object.
export default rule
