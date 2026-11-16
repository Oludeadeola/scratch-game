/**
 * The age ladder.
 *
 * ScratchJr stops at 7 and Scratch starts around 8, and the jump between them
 * is a cliff: a different app, a different shape of block, a different idea of
 * what a number is. This is the same idea as both, as one continuous climb. A
 * 4-year-old gets four blocks and numbers up to five. A 12-year-old gets the
 * lot. Every year in between adds something.
 *
 * What each age changes:
 *   - which blocks are in the palette
 *   - how big a number the pad will let her choose
 *   - how many times a repeat may run
 *   - whether she can nest a loop inside a loop
 *   - whether "say" means typing or picking from pictures
 *   - how big the blocks are, and whether a tap is enough to place one
 *   - which track of challenges she starts on
 *
 * What it must NEVER change is the program itself. Block types and field
 * definitions are identical on every client, and limits are applied in the
 * palette and the number pad — never in the block. If a 5-year-old's
 * `move_steps` field capped at 10 while her teacher's capped at 20, the
 * teacher setting 15 would silently clamp to 10 on the child's screen and the
 * two workspaces would drift apart for good. Limits are about what a child can
 * choose, not about what a script is allowed to contain.
 */

export type Mode = 'junior' | 'builder';
export type Track = 'early' | 'core';
export type Typing = 'pick' | 'free';

export const MIN_AGE = 4;
export const MAX_AGE = 12;

export interface AgeProfile {
  age: number;
  /** Short name for this rung, shown on the join screen. */
  title: string;
  /** One line on what is new at this age. */
  unlocks: string;
  mode: Mode;
  track: Track;
  /** Block types offered in the palette, in palette order. */
  blocks: string[];
  /** The largest number the pad will offer. */
  maxNumber: number;
  /** The largest repeat count the pad will offer. */
  maxRepeat: number;
  /** May she put a loop inside a loop? */
  allowNesting: boolean;
  /** Pick a phrase from pictures, or type freely. */
  typing: Typing;
  startScale: number;
  horizontalToolbox: boolean;
  tapToAdd: boolean;
  speakOnAdd: boolean;
}

/* The blocks, in the order they become available. */
const FIRST_FOUR = ['move_steps', 'move_back', 'turn_fraction', 'go_home'];
const SAY = ['say_text'];
const PEN = ['pen_down', 'pen_up'];
const REPEAT = ['repeat_times'];
const SCORE = ['change_score'];
const WAIT_AND_SIZE = ['wait_seconds', 'grow_by', 'shrink_by'];
const SAY_SCORE = ['say_score'];
const TARGET_AND_STOP = ['go_to_number', 'stop_all'];
const FULL_SCORE = ['set_score'];
const COUNTING = ['say_each_number', 'say_for_seconds'];
const CONDITIONS = ['if_score'];

function ladder(): Record<number, AgeProfile> {
  const base = {
    allowNesting: false,
    typing: 'pick' as Typing,
    horizontalToolbox: true,
    tapToAdd: true,
    speakOnAdd: true,
  };

  const rungs: AgeProfile[] = [
    {
      ...base,
      age: 4,
      title: 'First blocks',
      unlocks: 'Move, turn and draw. Numbers up to 5.',
      mode: 'junior',
      track: 'early',
      blocks: [...FIRST_FOUR, ...SAY, ...PEN],
      maxNumber: 5,
      maxRepeat: 5,
      startScale: 1.35,
    },
    {
      ...base,
      age: 5,
      title: 'Repeating',
      unlocks: 'A repeat block, and numbers up to 10.',
      mode: 'junior',
      track: 'early',
      blocks: [...FIRST_FOUR, ...SAY, ...PEN, ...REPEAT],
      maxNumber: 10,
      maxRepeat: 5,
      startScale: 1.3,
    },
    {
      ...base,
      age: 6,
      title: 'Keeping score',
      unlocks: 'A score to add to, waiting, growing and shrinking.',
      mode: 'junior',
      track: 'early',
      blocks: [...FIRST_FOUR, ...SAY, ...SAY_SCORE, ...PEN, ...REPEAT, ...SCORE, ...WAIT_AND_SIZE],
      maxNumber: 10,
      maxRepeat: 10,
      startScale: 1.25,
    },
    {
      ...base,
      age: 7,
      title: 'The number line',
      unlocks: 'Jump to any number up to 20, and loops inside loops.',
      mode: 'junior',
      track: 'core',
      blocks: [
        ...FIRST_FOUR,
        ...TARGET_AND_STOP,
        ...SAY,
        ...SAY_SCORE,
        ...PEN,
        ...REPEAT,
        ...SCORE,
        ...WAIT_AND_SIZE,
      ],
      maxNumber: 20,
      maxRepeat: 10,
      allowNesting: true,
      typing: 'free',
      startScale: 1.15,
    },
    {
      age: 8,
      title: 'Words, not pictures',
      unlocks: 'Worded blocks, counting out loud, and "if the score is…".',
      mode: 'builder',
      track: 'core',
      blocks: [
        ...FIRST_FOUR,
        ...TARGET_AND_STOP,
        ...SAY,
        ...COUNTING,
        ...SAY_SCORE,
        ...WAIT_AND_SIZE.slice(1),
        ...PEN,
        ...REPEAT,
        ...CONDITIONS,
        ...SCORE,
        ...FULL_SCORE,
        'wait_seconds',
      ],
      maxNumber: 100,
      maxRepeat: 20,
      allowNesting: true,
      typing: 'free',
      startScale: 1,
      horizontalToolbox: false,
      tapToAdd: false,
      speakOnAdd: false,
    },
  ];

  const byAge: Record<number, AgeProfile> = {};
  for (const rung of rungs) byAge[rung.age] = rung;

  // 9 and up are age 8's editor with more headroom on the numbers, which is
  // where the 3rd grade work (times tables, place value) actually lives.
  const grown = [
    { age: 9, maxNumber: 200, maxRepeat: 50, title: 'Bigger numbers', unlocks: 'Numbers up to 200 and longer loops.' },
    { age: 10, maxNumber: 500, maxRepeat: 100, title: 'Hundreds', unlocks: 'Numbers up to 500.' },
    { age: 11, maxNumber: 999, maxRepeat: 100, title: 'Place value', unlocks: 'Numbers up to 999.' },
    { age: 12, maxNumber: 999, maxRepeat: 100, title: 'Everything', unlocks: 'The whole palette, no limits.' },
  ];
  for (const step of grown) {
    byAge[step.age] = {
      ...byAge[8],
      age: step.age,
      title: step.title,
      unlocks: step.unlocks,
      maxNumber: step.maxNumber,
      maxRepeat: step.maxRepeat,
    };
  }

  return byAge;
}

const AGE_LADDER = ladder();

export function clampAge(age: number): number {
  if (!Number.isFinite(age)) return 7;
  return Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(age)));
}

export function profileForAge(age: number): AgeProfile {
  return AGE_LADDER[clampAge(age)];
}

/** Every rung, for the ladder preview on the join screen. */
export function allProfiles(): AgeProfile[] {
  return Object.values(AGE_LADDER).sort((a, b) => a.age - b.age);
}

export function modeForAge(age: number): Mode {
  return profileForAge(age).mode;
}

/** A teacher is an adult: the full editor, no limits. */
export const TEACHER_PROFILE: AgeProfile = {
  ...AGE_LADDER[12],
  age: 30,
  title: 'Teacher',
  unlocks: 'Everything, plus the class controls.',
};

/**
 * The school year an age usually maps to. Used only to suggest a track, never
 * to gate anything — a 7-year-old may well be ready for week 11.
 */
export function suggestedGrade(age: number): string {
  const value = clampAge(age);
  if (value <= 5) return 'Kindergarten';
  if (value === 6) return '1st grade';
  if (value === 7) return '2nd grade';
  if (value === 8) return '3rd grade';
  return `${value - 5}th grade`;
}

export function modeLabel(mode: Mode): string {
  return mode === 'junior' ? 'Junior' : 'Builder';
}

export function trackLabel(track: Track): string {
  return track === 'early' ? 'Early Steps' : '2nd grade course';
}
