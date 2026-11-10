/**
 * Blockly block definitions, in two wordings.
 *
 * Every block exists once, with one type and one set of field names. What
 * changes with the child's age is only how it reads:
 *
 *   Builder (8+)  "move 5 steps"          — Scratch shaped, worded
 *   Junior  (4-7) "➡️ 5"                   — ScratchJr shaped, pictures
 *
 * Because the shared events carry block types and field values and never
 * labels, a 6-year-old in Junior mode and her teacher in Builder mode can drag
 * blocks into the same script and each sees it in their own language. That is
 * the thing neither Scratch nor ScratchJr can do, and it is worth the small
 * amount of indirection below.
 *
 * Numbers never use Blockly's inline editor. They route to the big on-screen
 * pad through `field_mathblocks_number`, so a child never meets a keyboard.
 */

import * as Blockly from 'blockly/core';
import { type Mode } from './ages';
import { type Node, type Program } from './program';

/** Category colours, chosen for contrast on the light editor background. */
export const COLOURS = {
  motion: '#1d6fd0',
  looks: '#8a3ffc',
  score: '#c2410c',
  pen: '#0f766e',
  control: '#b45309',
} as const;

export const HAT_BLOCK = 'when_run_clicked';

/* ------------------------------------------------------------------ */
/* The number pad field                                                */
/* ------------------------------------------------------------------ */

export type NumberPadRequest = {
  initial: number;
  min: number;
  max: number;
  /** Called with the chosen value, or null if the child cancelled. */
  resolve: (value: number | null) => void;
};

let numberPadHandler: ((request: NumberPadRequest) => void) | null = null;

export function setNumberPadHandler(
  handler: ((request: NumberPadRequest) => void) | null,
): void {
  numberPadHandler = handler;
}

class MathBlocksNumberField extends Blockly.FieldNumber {
  showEditor_(event?: Event, quietInput?: boolean): void {
    if (!numberPadHandler) {
      super.showEditor_(event, quietInput);
      return;
    }
    const min = this.getMin();
    const max = this.getMax();
    numberPadHandler({
      initial: Number(this.getValue()) || 0,
      min: Number.isFinite(min) ? min : -999,
      max: Number.isFinite(max) ? max : 999,
      resolve: (value) => {
        if (value !== null) this.setValue(value);
      },
    });
  }

  static override fromJson(
    options: Blockly.FieldNumberConfig & { value?: number },
  ): MathBlocksNumberField {
    return new MathBlocksNumberField(
      options.value ?? 0,
      options.min,
      options.max,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Block specs                                                         */
/* ------------------------------------------------------------------ */

type FieldJson = Record<string, unknown>;

interface BlockSpec {
  type: string;
  /** Worded label for ages 8+. */
  builder: string;
  /** Picture label for ages 4-7. */
  junior: string;
  args?: FieldJson[];
  colour: string;
  /** Plain words for the tooltip and for read aloud. */
  tooltip: string;
  /** True for blocks that wrap other blocks. */
  hasBody?: boolean;
}

const pad = (name: string, value: number, min: number, max: number): FieldJson => ({
  type: 'field_mathblocks_number',
  name,
  value,
  min,
  max,
});

const SPECS: BlockSpec[] = [
  /* Motion -------------------------------------------------------- */
  {
    type: 'move_steps',
    builder: 'move %1 steps',
    junior: '➡️ %1',
    args: [pad('N', 5, 0, 20)],
    colour: COLOURS.motion,
    tooltip: 'Move forward along the number line.',
  },
  {
    type: 'move_back',
    builder: 'move back %1 steps',
    junior: '⬅️ %1',
    args: [pad('N', 5, 0, 20)],
    colour: COLOURS.motion,
    tooltip: 'Move backwards along the number line.',
  },
  {
    type: 'turn_fraction',
    builder: 'turn %1 by %2 turn',
    junior: '%1 %2',
    args: [
      {
        type: 'field_dropdown',
        name: 'DIR',
        options: [
          ['↻', 'right'],
          ['↺', 'left'],
        ],
      },
      {
        type: 'field_dropdown',
        name: 'FRACTION',
        options: [
          ['a quarter (¼)', '4'],
          ['a third (⅓)', '3'],
          ['a half (½)', '2'],
        ],
      },
    ],
    colour: COLOURS.motion,
    tooltip: 'Turn part of a whole turn.',
  },
  {
    type: 'go_to_number',
    builder: 'go to number %1',
    junior: '🎯 %1',
    args: [pad('N', 10, 0, 20)],
    colour: COLOURS.motion,
    tooltip: 'Jump straight to a number on the number line.',
  },
  {
    type: 'go_home',
    builder: 'go back to start',
    junior: '🏠',
    colour: COLOURS.motion,
    tooltip: 'Go back to 0 and face right.',
  },

  /* Looks --------------------------------------------------------- */
  {
    type: 'say_text',
    builder: 'say %1',
    junior: '💬 %1',
    args: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }],
    colour: COLOURS.looks,
    tooltip: 'Show a speech bubble.',
  },
  {
    type: 'say_for_seconds',
    builder: 'say %1 for %2 seconds',
    junior: '💬 %1 ⏱️ %2',
    args: [
      { type: 'field_input', name: 'TEXT', text: 'Hello!' },
      pad('N', 2, 0, 60),
    ],
    colour: COLOURS.looks,
    tooltip: 'Show a speech bubble, then carry on after a pause.',
  },
  {
    type: 'say_score',
    builder: 'say the score',
    junior: '💬 🏆',
    colour: COLOURS.looks,
    tooltip: 'Say whatever the score is right now.',
  },
  {
    type: 'say_each_number',
    builder: 'say each number from %1 to %2 counting by %3',
    junior: '🔢 %1 → %2 ⏭️ %3',
    args: [pad('FROM', 0, -100, 200), pad('TO', 20, -100, 200), pad('STEP', 2, 1, 100)],
    colour: COLOURS.looks,
    tooltip: 'Count out loud, one number at a time.',
  },
  {
    type: 'grow_by',
    builder: 'grow by %1',
    junior: '🔍➕ %1',
    args: [pad('N', 2, 0, 10)],
    colour: COLOURS.looks,
    tooltip: 'Make the robot bigger.',
  },
  {
    type: 'shrink_by',
    builder: 'shrink by %1',
    junior: '🔍➖ %1',
    args: [pad('N', 2, 0, 10)],
    colour: COLOURS.looks,
    tooltip: 'Make the robot smaller.',
  },

  /* Score --------------------------------------------------------- */
  {
    type: 'set_score',
    builder: 'set score to %1',
    junior: '🏆 = %1',
    args: [pad('N', 0, -100, 999)],
    colour: COLOURS.score,
    tooltip: 'Make the score exactly this number.',
  },
  {
    type: 'change_score',
    builder: 'change score by %1',
    junior: '🏆 ➕ %1',
    args: [pad('N', 5, -100, 999)],
    colour: COLOURS.score,
    tooltip: 'Add to the score. Use a minus number to take away.',
  },

  /* Pen ----------------------------------------------------------- */
  {
    type: 'pen_down',
    builder: 'pen down',
    junior: '🖍️ ⬇️',
    colour: COLOURS.pen,
    tooltip: 'Start drawing a line as the robot moves.',
  },
  {
    type: 'pen_up',
    builder: 'pen up',
    junior: '🖍️ ⬆️',
    colour: COLOURS.pen,
    tooltip: 'Stop drawing.',
  },

  /* Control ------------------------------------------------------- */
  {
    type: 'wait_seconds',
    builder: 'wait %1 seconds',
    junior: '⏱️ %1',
    args: [pad('N', 1, 0, 60)],
    colour: COLOURS.control,
    tooltip: 'Pause before the next block.',
  },
  {
    type: 'repeat_times',
    builder: 'repeat %1 times',
    junior: '🔁 %1',
    args: [pad('N', 4, 0, 100)],
    colour: COLOURS.control,
    tooltip: 'Do the blocks inside over and over.',
    hasBody: true,
  },
  {
    type: 'if_score',
    builder: 'if score is %1 %2',
    junior: '❓ 🏆 %1 %2',
    args: [
      {
        type: 'field_dropdown',
        name: 'CMP',
        options: [
          ['equal to', '='],
          ['more than', '>'],
          ['less than', '<'],
        ],
      },
      pad('N', 10, -100, 999),
    ],
    colour: COLOURS.control,
    tooltip: 'Only do the blocks inside when the score matches.',
    hasBody: true,
  },
  {
    type: 'stop_all',
    builder: 'stop',
    junior: '🛑',
    colour: COLOURS.control,
    tooltip: 'Stop the whole script here.',
  },
];

const SPEC_BY_TYPE = new Map(SPECS.map((spec) => [spec.type, spec]));

/** Plain words for a block type, used by read aloud and tooltips. */
export function tooltipForType(type: string): string {
  return SPEC_BY_TYPE.get(type)?.tooltip ?? type;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

function buildJson(spec: BlockSpec, mode: Mode): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: spec.type,
    message0: mode === 'junior' ? spec.junior : spec.builder,
    colour: spec.colour,
    tooltip: spec.tooltip,
    previousStatement: null,
    nextStatement: null,
  };
  if (spec.args?.length) json.args0 = spec.args;
  if (spec.hasBody) {
    json.message1 = '%1';
    json.args1 = [{ type: 'input_statement', name: 'BODY' }];
  }
  // `stop` ends a script, so nothing may follow it.
  if (spec.type === 'stop_all') delete json.nextStatement;
  return json;
}

function hatJson(mode: Mode): Record<string, unknown> {
  return {
    type: HAT_BLOCK,
    message0: mode === 'junior' ? '🏁' : '▶  when Run is clicked',
    nextStatement: null,
    colour: '#334155',
    tooltip: 'Everything under here runs when you press Run.',
    deletable: false,
    movable: false,
  };
}

let registeredMode: Mode | null = null;

/**
 * Defines every block in the wording for this mode.
 *
 * Re-registering with a different mode redefines the same types with new
 * labels, which is safe: existing blocks keep their type and field values.
 */
export function registerBlocks(mode: Mode): void {
  if (registeredMode === mode) return;
  registeredMode = mode;

  if (!Blockly.fieldRegistry.fromJson({ type: 'field_mathblocks_number' })) {
    Blockly.fieldRegistry.register('field_mathblocks_number', MathBlocksNumberField);
  }

  const definitions = Blockly.common.createBlockDefinitionsFromJsonArray([
    hatJson(mode),
    ...SPECS.map((spec) => buildJson(spec, mode)),
  ] as Parameters<typeof Blockly.common.createBlockDefinitionsFromJsonArray>[0]);

  Blockly.common.defineBlocks(definitions);
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

/**
 * Junior sees a short palette. Every block here can be understood from its
 * picture, and the abstract ones (conditionals, set-score, ranged counting)
 * are held back until Builder.
 */
const JUNIOR_PALETTE: Record<string, string[]> = {
  Move: ['move_steps', 'move_back', 'turn_fraction', 'go_home'],
  Say: ['say_text', 'say_score', 'grow_by', 'shrink_by'],
  Score: ['change_score'],
  Pen: ['pen_down', 'pen_up'],
  Control: ['wait_seconds', 'repeat_times', 'stop_all'],
};

const BUILDER_PALETTE: Record<string, string[]> = {
  Move: ['move_steps', 'move_back', 'turn_fraction', 'go_to_number', 'go_home'],
  Say: ['say_text', 'say_for_seconds', 'say_score', 'say_each_number', 'grow_by', 'shrink_by'],
  Score: ['set_score', 'change_score'],
  Pen: ['pen_down', 'pen_up'],
  Control: ['wait_seconds', 'repeat_times', 'if_score', 'stop_all'],
};

const CATEGORY_COLOUR: Record<string, string> = {
  Move: COLOURS.motion,
  Say: COLOURS.looks,
  Score: COLOURS.score,
  Pen: COLOURS.pen,
  Control: COLOURS.control,
};

/** Picture-only category names for Junior, so the palette needs no reading. */
const JUNIOR_CATEGORY_NAME: Record<string, string> = {
  Move: '➡️',
  Say: '💬',
  Score: '🏆',
  Pen: '🖍️',
  Control: '🔁',
};

export function toolboxFor(mode: Mode): Blockly.utils.toolbox.ToolboxDefinition {
  const palette = mode === 'junior' ? JUNIOR_PALETTE : BUILDER_PALETTE;
  return {
    kind: 'categoryToolbox',
    contents: Object.entries(palette).map(([name, types]) => ({
      kind: 'category',
      name: mode === 'junior' ? JUNIOR_CATEGORY_NAME[name] : name,
      colour: CATEGORY_COLOUR[name],
      contents: types.map((type) => ({ kind: 'block', type })),
    })),
  };
}

/** A Scratch-ish theme. Junior gets larger type. */
export function themeFor(mode: Mode): Blockly.Theme {
  return Blockly.Theme.defineTheme(`mathblocks-${mode}`, {
    name: `mathblocks-${mode}`,
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: '#f8fafc',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#0f172a',
      flyoutBackgroundColour: '#eef2f7',
      flyoutForegroundColour: '#0f172a',
      flyoutOpacity: 1,
      scrollbarColour: '#94a3b8',
      insertionMarkerColour: '#0f172a',
      insertionMarkerOpacity: 0.4,
      cursorColour: '#0f172a',
    },
    fontStyle: {
      family: 'system-ui, sans-serif',
      weight: 'bold',
      size: mode === 'junior' ? 15 : 12,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Workspace -> Program                                                */
/* ------------------------------------------------------------------ */

export function workspaceToProgram(workspace: Blockly.Workspace): Program {
  const hat = workspace.getTopBlocks(true).find((block) => block.type === HAT_BLOCK);
  if (!hat) return { nodes: [] };
  return { nodes: chainToNodes(hat.getNextBlock()) };
}

function chainToNodes(start: Blockly.Block | null): Node[] {
  const nodes: Node[] = [];
  let block = start;
  while (block) {
    if (!block.isInsertionMarker()) nodes.push(blockToNode(block));
    block = block.getNextBlock();
  }
  return nodes;
}

function blockToNode(block: Blockly.Block): Node {
  const args: Record<string, number | string> = {};
  for (const input of block.inputList) {
    for (const field of input.fieldRow) {
      const name = field.name;
      if (!name) continue;
      const raw = field.getValue();
      // Dropdowns carry strings; anything that parses as a number becomes one.
      const asNumber = Number(raw);
      args[name] =
        raw !== null && raw !== '' && Number.isFinite(asNumber)
          ? asNumber
          : String(raw ?? '');
    }
  }

  const node: Node = { id: block.id, op: block.type as Node['op'], args };
  const body = block.getInputTargetBlock('BODY');
  if (body) node.body = chainToNodes(body);
  return node;
}

/** The last block in the script, which is where a tapped block attaches. */
export function lastBlockInScript(
  workspace: Blockly.Workspace,
  hatId: string,
): Blockly.Block | null {
  const hat = workspace.getBlockById(hatId);
  if (!hat) return null;
  let block: Blockly.Block = hat;
  while (block.getNextBlock()) block = block.getNextBlock() as Blockly.Block;
  return block;
}
