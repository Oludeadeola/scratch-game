'use client';

/**
 * The stage: a robot on a grid whose home row is a number line from 0 to 20.
 *
 * Drawn as one SVG so it scales cleanly from a 768px iPad to a laptop without
 * any canvas sizing code, and so the pen trail, the grid and the robot all
 * share one coordinate system.
 */

import { LINE_MAX, LINE_MIN, type RobotState } from '@/lib/runtime';

/** Grid extent in cells. Wider than the number line so turns have room. */
const MIN_X = -2;
const MAX_X = LINE_MAX + 2;
const MIN_Y = -5;
const MAX_Y = 7;

const CELL = 36;
const WIDTH = (MAX_X - MIN_X) * CELL;
const HEIGHT = (MAX_Y - MIN_Y) * CELL;

/** Cell coordinates to SVG coordinates. SVG y grows downward; the grid's does not. */
const sx = (x: number) => (x - MIN_X) * CELL;
const sy = (y: number) => (MAX_Y - y) * CELL;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export interface StageProps {
  state: RobotState;
  /** Shown above the stage while a run is in progress. */
  running?: boolean;
}

export default function Stage({ state, running = false }: StageProps) {
  // Keep the robot on screen even if a script sends it far off the grid, so a
  // child never loses sight of it and thinks the app broke.
  const robotX = clamp(state.x, MIN_X + 0.5, MAX_X - 0.5);
  const robotY = clamp(state.y, MIN_Y + 0.5, MAX_Y - 0.5);
  const offGrid = robotX !== state.x || robotY !== state.y;

  const ticks: number[] = [];
  for (let n = LINE_MIN; n <= LINE_MAX; n += 1) ticks.push(n);

  return (
    <div className="stage-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="stage-svg"
        role="img"
        aria-label={describeStage(state)}
      >
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#ffffff" />

        {/* Grid */}
        <g stroke="#e2e8f0" strokeWidth={1}>
          {range(MIN_X, MAX_X).map((x) => (
            <line key={`v${x}`} x1={sx(x)} y1={0} x2={sx(x)} y2={HEIGHT} />
          ))}
          {range(MIN_Y, MAX_Y).map((y) => (
            <line key={`h${y}`} x1={0} y1={sy(y)} x2={WIDTH} y2={sy(y)} />
          ))}
        </g>

        {/* The number line: the row the robot starts on */}
        <line
          x1={sx(LINE_MIN)}
          y1={sy(0)}
          x2={sx(LINE_MAX)}
          y2={sy(0)}
          stroke="#0f172a"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <g>
          {ticks.map((n) => (
            <g key={n}>
              <line
                x1={sx(n)}
                y1={sy(0) - 6}
                x2={sx(n)}
                y2={sy(0) + 6}
                stroke="#0f172a"
                strokeWidth={n % 5 === 0 ? 3 : 1.5}
              />
              <text
                x={sx(n)}
                y={sy(0) + 26}
                textAnchor="middle"
                fontSize={n % 5 === 0 ? 16 : 13}
                fontWeight={n % 5 === 0 ? 700 : 500}
                fill="#0f172a"
              >
                {n}
              </text>
            </g>
          ))}
        </g>

        {/* Pen trail */}
        <g
          stroke="#d6336c"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {state.lines.map((line, index) => (
            <line
              key={index}
              x1={sx(line.x1)}
              y1={sy(line.y1)}
              x2={sx(line.x2)}
              y2={sy(line.y2)}
            />
          ))}
        </g>

        {/* Robot */}
        <g
          transform={`translate(${sx(robotX)} ${sy(robotY)}) rotate(${-state.heading})`}
          opacity={offGrid ? 0.55 : 1}
        >
          <Robot penDown={state.penDown} />
        </g>

        {/* Speech bubble */}
        {state.bubble !== null && (
          <SpeechBubble x={sx(robotX)} y={sy(robotY)} text={state.bubble} />
        )}
      </svg>

      <div className="stage-bar">
        <span className="stage-score">
          <span className="stage-score-label">Score</span>
          <span className="stage-score-value">{state.score}</span>
        </span>
        {running && <span className="stage-running">Running…</span>}
        {offGrid && (
          <span className="stage-note">
            The robot went past the end of the number line
          </span>
        )}
      </div>
    </div>
  );
}

function Robot({ penDown }: { penDown: boolean }) {
  return (
    <g>
      {/* Facing arrow, so a turn is visible even when standing still */}
      <path d="M 10 0 L 26 0 M 20 -6 L 26 0 L 20 6" stroke="#1d6fd0" strokeWidth={3} fill="none" strokeLinecap="round" />
      <rect x={-14} y={-14} width={28} height={28} rx={8} fill="#1d6fd0" />
      <rect x={-9} y={-7} width={18} height={9} rx={3} fill="#e0f2fe" />
      <circle cx={-4} cy={-2.5} r={2.2} fill="#0f172a" />
      <circle cx={4} cy={-2.5} r={2.2} fill="#0f172a" />
      <rect x={-6} y={5} width={12} height={3} rx={1.5} fill="#bae6fd" />
      {penDown && <circle cx={0} cy={0} r={4} fill="#d6336c" stroke="#ffffff" strokeWidth={1.5} />}
    </g>
  );
}

function SpeechBubble({ x, y, text }: { x: number; y: number; text: string }) {
  const width = Math.max(54, text.length * 11 + 22);
  const height = 34;
  const bx = x + 18;
  const by = y - 46;
  return (
    <g>
      <path
        d={`M ${x + 8} ${y - 14} L ${bx + 10} ${by + height} L ${bx + 24} ${by + height} Z`}
        fill="#0f172a"
      />
      <rect x={bx} y={by} width={width} height={height} rx={10} fill="#0f172a" />
      <text
        x={bx + width / 2}
        y={by + height / 2 + 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="#ffffff"
      >
        {text}
      </text>
    </g>
  );
}

function range(low: number, high: number): number[] {
  const out: number[] = [];
  for (let v = low; v <= high; v += 1) out.push(v);
  return out;
}

/** Alt text, so the stage is not a blank hole for a screen reader. */
function describeStage(state: RobotState): string {
  const where =
    state.y === 0
      ? `on number ${Math.round(state.x)}`
      : `${Math.round(state.x)} across and ${Math.round(state.y)} up`;
  const saying = state.bubble ? `, saying ${state.bubble}` : '';
  return `Robot ${where}. Score ${state.score}${saying}.`;
}
