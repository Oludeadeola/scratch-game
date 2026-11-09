/**
 * The twelve built-in challenges, one per week of the 2nd grade course.
 *
 * Each challenge stores its target and its rules as code, so the app can mark
 * the work the moment the student taps Run instead of waiting for the teacher.
 * A rule looks at two things: the program she built (did she use a repeat?) and
 * the state the robot ended in (is the score 50?).
 */

import {
  type Node,
  type Program,
  type TurnFraction,
  countBlocks,
  opCounts,
  opsUsed,
  readNumber,
} from './program';
import { type PenLine, type RobotState, runToEnd } from './runtime';

export interface Challenge {
  week: number;
  project: string;
  /** The instruction the student hears and reads. Plain words, one sentence. */
  prompt: string;
  /** Common Core code(s) this challenge practises. */
  standards: string[];
  /** The "predict first" question asked before Run. */
  predictQuestion: string;
  /** What the robot actually did, to show next to her guess. */
  predictActual: (state: RobotState) => string;
  /** The rules. Every one must pass to earn the star. */
  rules: Rule[];
}

export interface Rule {
  /** Shown as a checklist item, so a near miss tells her which part to fix. */
  label: string;
  test: (program: Program, state: RobotState) => boolean;
}

export interface CheckResult {
  passed: boolean;
  /** Per-rule outcome, in order, for the checklist on the challenge card. */
  results: { label: string; passed: boolean }[];
  state: RobotState;
}

/* ------------------------------------------------------------------ */
/* Helpers the rules are written in terms of                           */
/* ------------------------------------------------------------------ */

const EPSILON = 1e-6;

function near(a: number, b: number, tolerance = EPSILON): boolean {
  return Math.abs(a - b) <= tolerance;
}

function lineLength(line: PenLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

/** Collects every node with the given op, including inside loop bodies. */
function nodesWithOp(program: Program, op: Node['op']): Node[] {
  const found: Node[] = [];
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.op === op) found.push(node);
      if (node.body) walk(node.body);
    }
  };
  walk(program.nodes);
  return found;
}

/** Which turn fractions appear anywhere in the script. */
function fractionsUsed(program: Program): Set<TurnFraction> {
  const used = new Set<TurnFraction>();
  for (const node of nodesWithOp(program, 'turn_fraction')) {
    used.add(readNumber(node, 'FRACTION', 4) as TurnFraction);
  }
  return used;
}

/** Every amount passed to `change score by`. */
function scoreDeltas(program: Program): number[] {
  return nodesWithOp(program, 'change_score').map((node) =>
    readNumber(node, 'N'),
  );
}

/** Movement blocks, which is what a challenge means by "jumps". */
function jumpCount(program: Program): number {
  const counts = opCounts(program);
  return (counts.move_steps ?? 0) + (counts.move_back ?? 0);
}

/** Splits the pen trail into runs of connected lines, one run per shape. */
function shapes(lines: PenLine[]): PenLine[][] {
  const groups: PenLine[][] = [];
  let current: PenLine[] = [];
  for (const line of lines) {
    const previous = current[current.length - 1];
    const connected =
      previous && near(previous.x2, line.x1) && near(previous.y2, line.y1);
    if (connected) {
      current.push(line);
    } else {
      if (current.length) groups.push(current);
      current = [line];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * A closed shape with the given number of equal sides, which is how the PRD
 * defines a correct square: four equal sides that end where they started.
 */
function isRegularPolygon(group: PenLine[], sides: number): boolean {
  if (group.length !== sides) return false;
  const lengths = group.map(lineLength);
  if (lengths.some((length) => length < EPSILON)) return false;
  if (lengths.some((length) => !near(length, lengths[0], 1e-3))) return false;
  const first = group[0];
  const last = group[group.length - 1];
  return near(last.x2, first.x1, 1e-3) && near(last.y2, first.y1, 1e-3);
}

function drewPolygon(state: RobotState, sides: number): boolean {
  return shapes(state.lines).some((group) => isRegularPolygon(group, sides));
}

/** True when `sequence` appears in what the robot said, in order, back to back. */
function saidRun(state: RobotState, sequence: number[]): boolean {
  const wanted = sequence.map(String);
  const said = state.said;
  for (let start = 0; start + wanted.length <= said.length; start += 1) {
    let match = true;
    for (let i = 0; i < wanted.length; i += 1) {
      if (said[start + i] !== wanted[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function saidNumber(state: RobotState, value: number): boolean {
  return state.said.includes(String(value));
}

function countBy(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const direction = to >= from ? 1 : -1;
  for (let v = from; direction > 0 ? v <= to : v >= to; v += step * direction) {
    out.push(v);
  }
  return out;
}

/** Everything the robot said that reads as a whole number. */
function spokenNumbers(state: RobotState): number[] {
  return state.said
    .map((text) => Number(text))
    .filter((value) => Number.isInteger(value));
}

/** Is the robot standing on this number on the number line? */
function standingOn(state: RobotState, value: number): boolean {
  return near(state.x, value, 1e-3) && near(state.y, 0, 1e-3);
}

const lastSaid = (state: RobotState): string =>
  state.said.length ? state.said[state.said.length - 1] : 'nothing';

const finalScore = (state: RobotState): string => String(state.score);

const finalSpot = (state: RobotState): string =>
  near(state.y, 0, 1e-3) ? String(Math.round(state.x)) : 'off the number line';

/* ------------------------------------------------------------------ */
/* The twelve weeks                                                    */
/* ------------------------------------------------------------------ */

export const CHALLENGES: Challenge[] = [
  {
    week: 1,
    project: 'Robot Number Quest',
    prompt: 'Make the robot count by 5s and say 50.',
    standards: ['2.NBT.A.2'],
    predictQuestion: 'What number will the robot say at the end?',
    predictActual: lastSaid,
    rules: [
      {
        label: 'You used a repeat block',
        test: (program) => opsUsed(program).has('repeat_times'),
      },
      {
        label: 'You counted up by 5s',
        test: (program) => scoreDeltas(program).some((delta) => delta === 5),
      },
      { label: 'The score is 50', test: (_p, state) => state.score === 50 },
      { label: 'The robot said 50', test: (_p, state) => saidNumber(state, 50) },
    ],
  },
  {
    week: 2,
    project: 'Shape Drawing Studio',
    prompt: 'Draw a square, then draw a triangle.',
    standards: ['2.G.A.1'],
    predictQuestion: 'How many corners will your two shapes have altogether?',
    predictActual: (state) => {
      const corners = shapes(state.lines).reduce(
        (total, group) => total + group.length,
        0,
      );
      return String(corners);
    },
    rules: [
      {
        label: 'You put the pen down',
        test: (program) => opsUsed(program).has('pen_down'),
      },
      {
        label: 'You drew a square: 4 equal sides, back where it started',
        test: (_p, state) => drewPolygon(state, 4),
      },
      {
        label: 'You drew a triangle: 3 equal sides, back where it started',
        test: (_p, state) => drewPolygon(state, 3),
      },
    ],
  },
  {
    week: 3,
    project: 'Number Line Treasure Hunt',
    prompt: 'Land on 12 using exactly two jumps.',
    standards: ['2.MD.B.6', '2.NBT.B.8'],
    predictQuestion: 'Which number will the robot land on?',
    predictActual: finalSpot,
    rules: [
      { label: 'You used exactly two jumps', test: (program) => jumpCount(program) === 2 },
      { label: 'The robot landed on 12', test: (_p, state) => standingOn(state, 12) },
    ],
  },
  {
    week: 4,
    project: 'Math Quiz Master',
    prompt: 'Start at 15, then jump back to 8.',
    standards: ['2.OA.B.2'],
    predictQuestion: 'Which number will the robot land on?',
    predictActual: finalSpot,
    rules: [
      {
        label: 'You started at 15',
        test: (program) =>
          nodesWithOp(program, 'go_to_number').some(
            (node) => readNumber(node, 'N') === 15,
          ),
      },
      {
        label: 'You jumped backwards',
        test: (program) => opsUsed(program).has('move_back'),
      },
      { label: 'The robot landed on 8', test: (_p, state) => standingOn(state, 8) },
    ],
  },
  {
    week: 5,
    project: 'Sharing Machine',
    prompt: 'Repeat 3 times, add 4 each time, and say 12.',
    standards: ['2.OA.C.4'],
    predictQuestion: 'What number will the robot say at the end?',
    predictActual: lastSaid,
    rules: [
      {
        label: 'Your repeat block runs 3 times',
        test: (program) =>
          nodesWithOp(program, 'repeat_times').some(
            (node) => readNumber(node, 'N') === 3,
          ),
      },
      {
        label: 'You add 4 each time',
        test: (program) => scoreDeltas(program).some((delta) => delta === 4),
      },
      { label: 'The score is 12', test: (_p, state) => state.score === 12 },
      { label: 'The robot said 12', test: (_p, state) => saidNumber(state, 12) },
    ],
  },
  {
    week: 6,
    project: 'Countdown Clock',
    prompt: 'Count back by 5s from 60 all the way to 0.',
    standards: ['2.MD.C.7'],
    predictQuestion: 'How many numbers will the robot say?',
    predictActual: (state) => String(state.said.length),
    rules: [
      {
        label: 'The robot said 60, 55, 50 … all the way to 0',
        test: (_p, state) => saidRun(state, countBy(60, 0, 5)),
      },
      { label: 'The robot finished on 0', test: (_p, state) => lastSaid(state) === '0' },
    ],
  },
  {
    week: 7,
    project: 'Pizza Party Shares',
    prompt: 'Turn the robot by a half, a third and a quarter turn.',
    standards: ['2.G.A.3'],
    predictQuestion: 'Will the robot be facing the same way as it started?',
    predictActual: (state) =>
      near(state.heading, 0, 1e-3) ? 'yes, the same way' : 'no, a different way',
    rules: [
      { label: 'You used a half turn', test: (program) => fractionsUsed(program).has(2) },
      { label: 'You used a third turn', test: (program) => fractionsUsed(program).has(3) },
      {
        label: 'You used a quarter turn',
        test: (program) => fractionsUsed(program).has(4),
      },
    ],
  },
  {
    week: 8,
    project: 'Pattern Detective',
    prompt: 'Make the robot say only the even numbers up to 20.',
    standards: ['2.OA.C.3'],
    predictQuestion: 'How many even numbers are there up to 20?',
    predictActual: (state) => String(state.said.length),
    rules: [
      {
        label: 'The robot said 2, 4, 6 … up to 20',
        test: (_p, state) => saidRun(state, countBy(2, 20, 2)),
      },
      {
        label: 'It did not say any odd numbers',
        test: (_p, state) => spokenNumbers(state).every((value) => value % 2 === 0),
      },
    ],
  },
  {
    week: 9,
    project: 'Measuring Code Artist',
    prompt: 'Draw two lines. Make the second line 3 longer than the first.',
    standards: ['2.MD.A.4'],
    predictQuestion: 'How long will the second line be?',
    predictActual: (state) =>
      state.lines.length >= 2
        ? String(Math.round(lineLength(state.lines[1])))
        : 'no second line yet',
    rules: [
      { label: 'You drew two lines', test: (_p, state) => state.lines.length === 2 },
      {
        label: 'The second line is 3 longer than the first',
        test: (_p, state) =>
          state.lines.length === 2 &&
          near(lineLength(state.lines[1]), lineLength(state.lines[0]) + 3, 1e-3),
      },
    ],
  },
  {
    week: 10,
    project: 'Coin Catch Game',
    prompt: 'Make 41 cents using quarters, dimes, nickels and pennies.',
    standards: ['2.MD.C.8'],
    predictQuestion: 'How many coins will you need?',
    predictActual: (_state) => 'check your coin blocks',
    rules: [
      {
        label: 'Every jump is a coin: 25, 10, 5 or 1',
        test: (program) => {
          const deltas = scoreDeltas(program);
          return (
            deltas.length > 0 && deltas.every((delta) => [25, 10, 5, 1].includes(delta))
          );
        },
      },
      { label: 'The score is 41 cents', test: (_p, state) => state.score === 41 },
    ],
  },
  {
    week: 11,
    project: 'Place Value Builder',
    prompt: 'Build 245 using jumps of 100, 10 and 1.',
    standards: ['2.NBT.A.1'],
    predictQuestion: 'How many hundreds, tens and ones make 245?',
    predictActual: (state) => `${state.score} so far`,
    rules: [
      {
        label: 'Every jump is 100, 10 or 1',
        test: (program) => {
          const deltas = scoreDeltas(program);
          return (
            deltas.length > 0 && deltas.every((delta) => [100, 10, 1].includes(delta))
          );
        },
      },
      { label: 'You used a jump of 100', test: (program) => scoreDeltas(program).includes(100) },
      { label: 'The score is 245', test: (_p, state) => state.score === 245 },
    ],
  },
  {
    week: 12,
    project: 'Showcase Game Studio',
    prompt: 'Free build! Make something to show your family.',
    standards: ['2.MD.D.10'],
    predictQuestion: 'What do you think your robot will do?',
    predictActual: (state) =>
      state.said.length ? `it said ${state.said.join(', ')}` : 'it moved around',
    rules: [
      { label: 'You used at least 3 blocks', test: (program) => countBlocks(program) >= 3 },
      {
        label: 'The robot did something when you pressed Run',
        test: (_p, state) =>
          state.said.length > 0 ||
          state.lines.length > 0 ||
          state.x !== 0 ||
          state.y !== 0 ||
          state.score !== 0,
      },
    ],
  },
];

export function challengeForWeek(week: number): Challenge {
  return CHALLENGES.find((c) => c.week === week) ?? CHALLENGES[0];
}

/** Runs the program and marks it against the week's rules. */
export function checkChallenge(
  challenge: Challenge,
  program: Program,
): CheckResult {
  const { state } = runToEnd(program);
  const results = challenge.rules.map((rule) => ({
    label: rule.label,
    passed: safeTest(rule, program, state),
  }));
  return { passed: results.every((r) => r.passed), results, state };
}

/**
 * A rule must never take the editor down. A malformed program should mean "not
 * passed yet", not a white screen in the middle of a lesson.
 */
function safeTest(rule: Rule, program: Program, state: RobotState): boolean {
  try {
    return rule.test(program, state);
  } catch {
    return false;
  }
}
