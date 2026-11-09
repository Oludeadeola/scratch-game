/**
 * Blockly block definitions and the palette.
 *
 * Styling follows the PRD's accessibility floor rather than Blockly's defaults:
 * 18px text, high-contrast category colours, and chunky blocks that a 7-year-old
 * can hit with a finger on an iPad.
 *
 * Numbers deliberately do NOT use Blockly's built-in number field. They use
 * `field_mathblocks_number`, which opens the big on-screen number pad, so a
 * child never has to find the keyboard.
 */

import * as Blockly from 'blockly/core';
import { type Node, type Program } from './program';

/** Category colours. Chosen for contrast against the light editor background. */
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

/**
 * Opens the app's number pad instead of an inline text editor.
 *
 * The field itself stays a plain number field as far as Blockly is concerned;
 * we just intercept the click. The React layer registers `onRequestNumberPad`
 * at mount, which keeps all the DOM and styling for the pad in React.
 */
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
/* Block definitions                                                   */
/* ------------------------------------------------------------------ */

type BlockJson = Parameters<typeof Blockly.common.createBlockDefinitionsFromJsonArray>[0][number];

const padNumber = (name: string, value: number, min: number, max: number) => ({
  type: 'field_mathblocks_number',
  name,
  value,
  min,
  max,
});

const BLOCK_JSON: BlockJson[] = [
  {
    type: HAT_BLOCK,
    message0: '▶  when Run is clicked',
    nextStatement: null,
    colour: '#334155',
    tooltip: 'Everything under here runs when you press Run.',
    deletable: false,
    movable: false,
  },

  /* Motion -------------------------------------------------------- */
  {
    type: 'move_steps',
    message0: 'move %1 steps',
    args0: [padNumber('N', 5, 0, 20)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Move forward along the number line.',
  },
  {
    type: 'move_back',
    message0: 'move back %1 steps',
    args0: [padNumber('N', 5, 0, 20)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Move backwards along the number line.',
  },
  {
    type: 'turn_fraction',
    message0: 'turn %1 by %2 turn',
    args0: [
      {
        type: 'field_dropdown',
        name: 'DIR',
        options: [
          ['right ↻', 'right'],
          ['left ↺', 'left'],
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
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Turn part of a whole turn.',
  },
  {
    type: 'go_to_number',
    message0: 'go to number %1',
    args0: [padNumber('N', 10, 0, 20)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Jump straight to a number on the number line.',
  },
  {
    type: 'go_home',
    message0: 'go back to start',
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Go back to 0 and face right.',
  },

  /* Looks --------------------------------------------------------- */
  {
    type: 'say_text',
    message0: 'say %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'Hello!' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.looks,
    tooltip: 'Show a speech bubble.',
  },
  {
    type: 'say_score',
    message0: 'say the score',
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.looks,
    tooltip: 'Say whatever the score is right now.',
  },
  {
    type: 'say_each_number',
    message0: 'say each number from %1 to %2 counting by %3',
    args0: [
      padNumber('FROM', 0, -100, 200),
      padNumber('TO', 20, -100, 200),
      padNumber('STEP', 2, 1, 100),
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.looks,
    tooltip: 'Count out loud, one number at a time.',
  },

  /* Score --------------------------------------------------------- */
  {
    type: 'set_score',
    message0: 'set score to %1',
    args0: [padNumber('N', 0, -100, 999)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.score,
    tooltip: 'Make the score exactly this number.',
  },
  {
    type: 'change_score',
    message0: 'change score by %1',
    args0: [padNumber('N', 5, -100, 999)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.score,
    tooltip: 'Add to the score. Use a minus number to take away.',
  },

  /* Pen ----------------------------------------------------------- */
  {
    type: 'pen_down',
    message0: 'pen down',
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.pen,
    tooltip: 'Start drawing a line as the robot moves.',
  },
  {
    type: 'pen_up',
    message0: 'pen up',
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.pen,
    tooltip: 'Stop drawing.',
  },

  /* Control ------------------------------------------------------- */
  {
    type: 'wait_seconds',
    message0: 'wait %1 seconds',
    args0: [padNumber('N', 1, 0, 60)],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.control,
    tooltip: 'Pause before the next block.',
  },
  {
    type: 'repeat_times',
    message0: 'repeat %1 times',
    args0: [padNumber('N', 4, 0, 100)],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'BODY' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.control,
    tooltip: 'Do the blocks inside over and over.',
  },
  {
    type: 'if_score',
    message0: 'if score is %1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'CMP',
        options: [
          ['equal to', '='],
          ['more than', '>'],
          ['less than', '<'],
        ],
      },
      padNumber('N', 10, -100, 999),
    ],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'BODY' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.control,
    tooltip: 'Only do the blocks inside when the score matches.',
  },
];

let registered = false;

/** Registers blocks and the number-pad field. Safe to call more than once. */
export function registerBlocks(): void {
  if (registered) return;
  registered = true;

  Blockly.fieldRegistry.register(
    'field_mathblocks_number',
    MathBlocksNumberField,
  );
  Blockly.common.defineBlocks(
    Blockly.common.createBlockDefinitionsFromJsonArray(BLOCK_JSON),
  );
}

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Move',
      colour: COLOURS.motion,
      contents: [
        { kind: 'block', type: 'move_steps' },
        { kind: 'block', type: 'move_back' },
        { kind: 'block', type: 'turn_fraction' },
        { kind: 'block', type: 'go_to_number' },
        { kind: 'block', type: 'go_home' },
      ],
    },
    {
      kind: 'category',
      name: 'Say',
      colour: COLOURS.looks,
      contents: [
        { kind: 'block', type: 'say_text' },
        { kind: 'block', type: 'say_score' },
        { kind: 'block', type: 'say_each_number' },
      ],
    },
    {
      kind: 'category',
      name: 'Score',
      colour: COLOURS.score,
      contents: [
        { kind: 'block', type: 'set_score' },
        { kind: 'block', type: 'change_score' },
      ],
    },
    {
      kind: 'category',
      name: 'Pen',
      colour: COLOURS.pen,
      contents: [
        { kind: 'block', type: 'pen_down' },
        { kind: 'block', type: 'pen_up' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: COLOURS.control,
      contents: [
        { kind: 'block', type: 'wait_seconds' },
        { kind: 'block', type: 'repeat_times' },
        { kind: 'block', type: 'if_score' },
      ],
    },
  ],
};

/** A Scratch-ish theme: bold text, rounded blocks, strong category colours. */
export const THEME = Blockly.Theme.defineTheme('mathblocks', {
  name: 'mathblocks',
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
  fontStyle: { family: 'system-ui, sans-serif', weight: 'bold', size: 13 },
});

/* ------------------------------------------------------------------ */
/* Workspace -> Program                                                */
/* ------------------------------------------------------------------ */

/**
 * Reads the script under the hat block into the plain Program the interpreter
 * and the challenge checkers understand.
 */
export function workspaceToProgram(workspace: Blockly.Workspace): Program {
  const hat = workspace
    .getTopBlocks(true)
    .find((block) => block.type === HAT_BLOCK);
  if (!hat) return { nodes: [] };
  return { nodes: chainToNodes(hat.getNextBlock()) };
}

function chainToNodes(start: Blockly.Block | null): Node[] {
  const nodes: Node[] = [];
  let block = start;
  while (block) {
    if (!block.isInsertionMarker()) {
      nodes.push(blockToNode(block));
    }
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
      // Dropdowns carry strings; everything else that parses as a number is one.
      const asNumber = Number(raw);
      args[name] =
        raw !== null && raw !== '' && Number.isFinite(asNumber)
          ? asNumber
          : String(raw ?? '');
    }
  }

  const node: Node = {
    id: block.id,
    op: block.type as Node['op'],
    args,
  };

  const body = block.getInputTargetBlock('BODY');
  if (body) node.body = chainToNodes(body);

  return node;
}
