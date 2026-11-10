/**
 * The program model.
 *
 * A MathBlocks project is one script hanging under a single "when Run is
 * clicked" hat block. Blockly owns the editing experience; this module owns the
 * shape we actually execute, so the interpreter, the challenge checkers and the
 * read-aloud feature never have to know Blockly exists.
 */

export const OPS = [
  'move_steps',
  'move_back',
  'turn_fraction',
  'go_to_number',
  'go_home',
  'say_text',
  'say_for_seconds',
  'say_score',
  'say_each_number',
  'grow_by',
  'shrink_by',
  'set_score',
  'change_score',
  'pen_down',
  'pen_up',
  'wait_seconds',
  'repeat_times',
  'if_score',
  'stop_all',
] as const;

export type Op = (typeof OPS)[number];

/** A quarter, third or half turn, stored as the fraction's denominator. */
export type TurnFraction = 2 | 3 | 4;
export type TurnDirection = 'right' | 'left';
export type Comparison = '=' | '>' | '<';

export interface Node {
  /** Blockly block id, so the stage can light up the block that is running. */
  id: string;
  op: Op;
  /** Numeric / text fields, keyed by field name. */
  args: Record<string, number | string>;
  /** Statement body for `repeat_times` and `if_score`. */
  body?: Node[];
}

export interface Program {
  nodes: Node[];
}

export const EMPTY_PROGRAM: Program = { nodes: [] };

/** Degrees turned for each fraction of a full turn. */
export function degreesForFraction(fraction: TurnFraction): number {
  return 360 / fraction;
}

export function fractionLabel(fraction: TurnFraction): string {
  return fraction === 2 ? '½' : fraction === 3 ? '⅓' : '¼';
}

/** Spoken form of a fraction, for read aloud. Screen readers mangle "½". */
export function fractionSpoken(fraction: TurnFraction): string {
  return fraction === 2 ? 'a half' : fraction === 3 ? 'a third' : 'a quarter';
}

function num(node: Node, key: string, fallback = 0): number {
  const value = node.args[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(node: Node, key: string, fallback = ''): string {
  const value = node.args[key];
  return value === undefined || value === null ? fallback : String(value);
}

export const readNumber = num;
export const readText = str;

/**
 * A plain-English sentence for one block, used by the read-aloud button and by
 * the teacher's replay view. Kept deliberately short and in the same words a
 * 7-year-old sees on the block itself.
 */
export function describeNode(node: Node): string {
  switch (node.op) {
    case 'move_steps':
      return `move ${num(node, 'N')} steps`;
    case 'move_back':
      return `move back ${num(node, 'N')} steps`;
    case 'turn_fraction':
      return `turn ${str(node, 'DIR', 'right')} by ${fractionSpoken(
        num(node, 'FRACTION', 4) as TurnFraction,
      )} turn`;
    case 'go_to_number':
      return `go to number ${num(node, 'N')}`;
    case 'go_home':
      return 'go back to start';
    case 'say_text':
      return `say ${str(node, 'TEXT')}`;
    case 'say_for_seconds':
      return `say ${str(node, 'TEXT')} for ${num(node, 'N')} seconds`;
    case 'say_score':
      return 'say the score';
    case 'grow_by':
      return `grow by ${num(node, 'N')}`;
    case 'shrink_by':
      return `shrink by ${num(node, 'N')}`;
    case 'say_each_number':
      return `say each number from ${num(node, 'FROM')} to ${num(
        node,
        'TO',
      )} counting by ${num(node, 'STEP', 1)}`;
    case 'set_score':
      return `set score to ${num(node, 'N')}`;
    case 'change_score':
      return `change score by ${num(node, 'N')}`;
    case 'pen_down':
      return 'pen down';
    case 'pen_up':
      return 'pen up';
    case 'wait_seconds':
      return `wait ${num(node, 'N')} seconds`;
    case 'repeat_times':
      return `repeat ${num(node, 'N')} times`;
    case 'if_score':
      return `if score is ${str(node, 'CMP', '=')} ${num(node, 'N')}`;
    case 'stop_all':
      return 'stop';
    default:
      return node.op;
  }
}

/** Every op used anywhere in the script, including inside loop bodies. */
export function opsUsed(program: Program): Set<Op> {
  const used = new Set<Op>();
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      used.add(node.op);
      if (node.body) walk(node.body);
    }
  };
  walk(program.nodes);
  return used;
}

/** Counts of each op, for challenges like "land on 12 using two jumps". */
export function opCounts(program: Program): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      counts[node.op] = (counts[node.op] ?? 0) + 1;
      if (node.body) walk(node.body);
    }
  };
  walk(program.nodes);
  return counts;
}

/** Total block count, used to tell an empty project from a real attempt. */
export function countBlocks(program: Program): number {
  return Object.values(opCounts(program)).reduce((a, b) => a + b, 0);
}
