/**
 * Age and the two editor modes.
 *
 * ScratchJr and Scratch are built for different children, and the gap between a
 * 5-year-old and a 9-year-old is the widest in this product's whole audience.
 * Rather than ship one compromise editor, the app picks a mode from the child's
 * age:
 *
 *   Junior  (4-7)  — ScratchJr shaped. Picture blocks, almost no reading, a
 *                    short palette, tap a block and it snaps onto the script,
 *                    every block read aloud as it lands.
 *   Builder (8+)   — Scratch shaped. Worded blocks, the full palette, nesting,
 *                    conditionals, drag to arrange.
 *
 * What the mode must NOT change is the shape of the program: block types and
 * field names are identical in both modes. That is what lets a teacher in
 * Builder mode and a 6-year-old in Junior mode edit the same script live — the
 * shared events carry types and field values, never labels. Only the wording,
 * the sizing and the palette differ.
 *
 * On privacy: COPPA treats a neutral age question as a screening step, which is
 * fine, but a stored birthday is personal data. So we ask for an age in years,
 * never a date of birth, keep it on the child's own device, and never put it in
 * the shared document, the URL or any request.
 */

export type Mode = 'junior' | 'builder';

export const MIN_AGE = 4;
export const MAX_AGE = 12;

/** The age at which the editor switches from ScratchJr-shaped to Scratch-shaped. */
export const BUILDER_FROM_AGE = 8;

export function clampAge(age: number): number {
  if (!Number.isFinite(age)) return 7;
  return Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(age)));
}

export function modeForAge(age: number): Mode {
  return clampAge(age) >= BUILDER_FROM_AGE ? 'builder' : 'junior';
}

export interface ModeSettings {
  /** Blockly zoom at load. Younger hands need bigger targets. */
  startScale: number;
  /** Blockly block text size, in points. */
  fontSizePt: number;
  /** Palette across the top (ScratchJr) rather than down the side (Scratch). */
  horizontalToolbox: boolean;
  /** Tapping a palette block snaps it onto the end of the script. */
  tapToAdd: boolean;
  /** Speak each block as it is added. */
  speakOnAdd: boolean;
  /** Grid snapping helps small hands land a block. */
  snap: boolean;
}

export const MODE_SETTINGS: Record<Mode, ModeSettings> = {
  junior: {
    startScale: 1.15,
    fontSizePt: 15,
    horizontalToolbox: true,
    tapToAdd: true,
    speakOnAdd: true,
    snap: true,
  },
  builder: {
    startScale: 0.95,
    fontSizePt: 12,
    horizontalToolbox: false,
    tapToAdd: false,
    speakOnAdd: false,
    snap: true,
  },
};

export function settingsForMode(mode: Mode): ModeSettings {
  return MODE_SETTINGS[mode];
}

/**
 * The school year an age usually maps to. Used only to suggest a starting
 * week, never to gate anything — a 7-year-old may well be on week 11.
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

export function modeDescription(mode: Mode): string {
  return mode === 'junior'
    ? 'Picture blocks, read aloud, tap to build'
    : 'Worded blocks, full palette, drag to build';
}
