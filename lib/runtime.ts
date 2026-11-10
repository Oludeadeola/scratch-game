/**
 * The robot interpreter.
 *
 * Runs a Program and yields one frame per executed block. Frames are what make
 * "step-by-step run" work: slow mode walks the frames with a pause between
 * each, normal mode walks them fast, and in both cases the frame tells the UI
 * which block to light up.
 *
 * The interpreter is deterministic and has no I/O. That matters for shared Run:
 * every browser in the room executes the same program and lands on the same
 * pixels without any of them streaming state to the others.
 */

import {
  type Comparison,
  type Node,
  type Program,
  type TurnFraction,
  degreesForFraction,
  readNumber,
  readText,
} from './program';

export interface PenLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RobotState {
  /** Grid position. The number line is the row y === 0, running 0…20. */
  x: number;
  y: number;
  /** Degrees. 0 points right, along increasing numbers; 90 points up. */
  heading: number;
  score: number;
  /** Robot scale. 1 is normal; `grow by` and `shrink by` move it. */
  size: number;
  penDown: boolean;
  lines: PenLine[];
  /** Current speech bubble, or null. */
  bubble: string | null;
  /** Everything the robot has said this run, in order. */
  said: string[];
}

export interface Frame {
  /** Block to highlight while this frame is on screen. */
  blockId: string;
  state: RobotState;
  /** Milliseconds to hold before the next frame, from `wait N seconds`. */
  pauseMs: number;
}

export const START_STATE: RobotState = Object.freeze({
  x: 0,
  y: 0,
  heading: 0,
  score: 0,
  size: 1,
  penDown: false,
  lines: [],
  bubble: null,
  said: [],
});

/** The number line the robot starts on. */
export const LINE_MIN = 0;
export const LINE_MAX = 20;

/** Stops a runaway `repeat` from hanging a Chromebook mid-lesson. */
const MAX_FRAMES = 4000;
const MAX_REPEATS = 200;

export function freshState(): RobotState {
  return { ...START_STATE, lines: [], said: [] };
}

function snapshot(state: RobotState): RobotState {
  return { ...state, lines: state.lines.slice(), said: state.said.slice() };
}

function compare(score: number, cmp: Comparison, value: number): boolean {
  if (cmp === '>') return score > value;
  if (cmp === '<') return score < value;
  return score === value;
}

/** Moves the robot `distance` cells along its heading, drawing if pen is down. */
function travel(state: RobotState, distance: number): void {
  const radians = (state.heading * Math.PI) / 180;
  const x = state.x + Math.cos(radians) * distance;
  const y = state.y + Math.sin(radians) * distance;
  jump(state, x, y);
}

/** Moves the robot to an absolute cell, drawing if the pen is down. */
function jump(state: RobotState, x: number, y: number): void {
  // Round away floating point dust from 120-degree turns so that a triangle
  // closes exactly and the shape checker can trust the numbers.
  const nx = Math.round(x * 1e6) / 1e6;
  const ny = Math.round(y * 1e6) / 1e6;
  if (state.penDown) {
    state.lines.push({ x1: state.x, y1: state.y, x2: nx, y2: ny });
  }
  state.x = nx;
  state.y = ny;
}

function say(state: RobotState, text: string): void {
  state.bubble = text;
  state.said.push(text);
}

/**
 * Executes the program, yielding a frame after each block.
 *
 * It is a generator so the caller controls pacing: the slow-mode runner awaits
 * between frames, while the challenge checker drains it in a tight loop to get
 * the final state without animating anything.
 */
export function* execute(program: Program): Generator<Frame, RobotState, void> {
  const state = freshState();
  let frames = 0;
  /** Set by `stop`, which must unwind out of every enclosing loop. */
  let stopped = false;

  function* emit(blockId: string, pauseMs = 0): Generator<Frame, void, void> {
    frames += 1;
    yield { blockId, state: snapshot(state), pauseMs };
  }

  function* run(nodes: Node[]): Generator<Frame, void, void> {
    for (const node of nodes) {
      if (stopped || frames >= MAX_FRAMES) return;

      switch (node.op) {
        case 'move_steps':
          travel(state, readNumber(node, 'N'));
          yield* emit(node.id);
          break;

        case 'move_back':
          travel(state, -readNumber(node, 'N'));
          yield* emit(node.id);
          break;

        case 'turn_fraction': {
          const fraction = readNumber(node, 'FRACTION', 4) as TurnFraction;
          const degrees = degreesForFraction(fraction);
          const direction = readText(node, 'DIR', 'right');
          state.heading += direction === 'right' ? -degrees : degrees;
          state.heading = ((state.heading % 360) + 360) % 360;
          yield* emit(node.id);
          break;
        }

        case 'go_to_number':
          jump(state, readNumber(node, 'N'), 0);
          yield* emit(node.id);
          break;

        case 'go_home':
          state.heading = 0;
          jump(state, 0, 0);
          yield* emit(node.id);
          break;

        case 'say_text':
          say(state, readText(node, 'TEXT'));
          yield* emit(node.id);
          break;

        case 'say_for_seconds':
          say(state, readText(node, 'TEXT'));
          yield* emit(node.id, Math.max(0, readNumber(node, 'N')) * 1000);
          break;

        case 'grow_by':
          // Bounded so a child cannot shrink the robot to nothing or grow it
          // off the stage and think the app broke.
          state.size = Math.min(4, state.size + readNumber(node, 'N') * 0.25);
          yield* emit(node.id);
          break;

        case 'shrink_by':
          state.size = Math.max(0.25, state.size - readNumber(node, 'N') * 0.25);
          yield* emit(node.id);
          break;

        case 'say_score':
          say(state, String(state.score));
          yield* emit(node.id);
          break;

        case 'say_each_number': {
          const from = readNumber(node, 'FROM');
          const to = readNumber(node, 'TO');
          const rawStep = readNumber(node, 'STEP', 1);
          const size = Math.abs(rawStep) || 1;
          const step = to >= from ? size : -size;
          const count = Math.floor(Math.abs(to - from) / size) + 1;
          for (let i = 0; i < count && frames < MAX_FRAMES; i += 1) {
            say(state, String(from + step * i));
            yield* emit(node.id);
          }
          break;
        }

        case 'set_score':
          state.score = readNumber(node, 'N');
          yield* emit(node.id);
          break;

        case 'change_score':
          state.score += readNumber(node, 'N');
          yield* emit(node.id);
          break;

        case 'pen_down':
          state.penDown = true;
          yield* emit(node.id);
          break;

        case 'pen_up':
          state.penDown = false;
          yield* emit(node.id);
          break;

        case 'wait_seconds':
          yield* emit(node.id, Math.max(0, readNumber(node, 'N')) * 1000);
          break;

        case 'repeat_times': {
          const times = Math.min(
            MAX_REPEATS,
            Math.max(0, Math.floor(readNumber(node, 'N'))),
          );
          for (let i = 0; i < times; i += 1) {
            if (stopped || frames >= MAX_FRAMES) break;
            yield* emit(node.id);
            if (node.body) yield* run(node.body);
          }
          break;
        }

        case 'if_score': {
          const cmp = readText(node, 'CMP', '=') as Comparison;
          yield* emit(node.id);
          if (compare(state.score, cmp, readNumber(node, 'N')) && node.body) {
            yield* run(node.body);
          }
          break;
        }

        case 'stop_all':
          yield* emit(node.id);
          stopped = true;
          return;

        default:
          break;
      }
    }
  }

  yield* run(program.nodes);
  return snapshot(state);
}

/** Runs a program to completion with no animation. Used by challenge checks. */
export function runToEnd(program: Program): {
  state: RobotState;
  frames: number;
} {
  const iterator = execute(program);
  let frames = 0;
  let next = iterator.next();
  while (!next.done) {
    frames += 1;
    next = iterator.next();
  }
  return { state: next.value, frames };
}

/** Collects every frame up front, so the player can scrub without re-running. */
export function collectFrames(program: Program): Frame[] {
  return Array.from(execute(program));
}
