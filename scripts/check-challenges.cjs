/* Smoke-tests the interpreter and the challenge checkers. */
const path = require('path');
// Resolved against the working directory, not this file, so `npm run verify`
// can pass a path relative to the project root.
const OUT = path.resolve(process.cwd(), process.argv[2]);
const { challengeForWeek, checkChallenge } = require(path.join(OUT, 'challenges.js'));
const { runToEnd } = require(path.join(OUT, 'runtime.js'));

let id = 0;
const n = (op, args = {}, body) => {
  const node = { id: 'b' + ++id, op, args };
  if (body) node.body = body;
  return node;
};

const cases = [
  {
    week: 1,
    label: 'count by 5s to 50',
    program: { nodes: [
      n('repeat_times', { N: 10 }, [
        n('change_score', { N: 5 }),
      ]),
      n('say_score'),
    ]},
    expect: true,
  },
  {
    week: 1,
    label: 'counts by 5s but only to 45 (should fail)',
    program: { nodes: [
      n('repeat_times', { N: 9 }, [n('change_score', { N: 5 })]),
      n('say_score'),
    ]},
    expect: false,
  },
  {
    week: 2,
    label: 'square then triangle',
    program: { nodes: [
      n('pen_down'),
      n('repeat_times', { N: 4 }, [
        n('move_steps', { N: 4 }),
        n('turn_fraction', { DIR: 'right', FRACTION: 4 }),
      ]),
      n('pen_up'),
      n('go_to_number', { N: 10 }),
      n('pen_down'),
      n('repeat_times', { N: 3 }, [
        n('move_steps', { N: 3 }),
        n('turn_fraction', { DIR: 'right', FRACTION: 3 }),
      ]),
    ]},
    expect: true,
  },
  {
    week: 3,
    label: 'land on 12 in two jumps',
    program: { nodes: [n('move_steps', { N: 7 }), n('move_steps', { N: 5 })] },
    expect: true,
  },
  {
    week: 3,
    label: 'lands on 12 but in three jumps (should fail)',
    program: { nodes: [n('move_steps', { N: 4 }), n('move_steps', { N: 4 }), n('move_steps', { N: 4 })] },
    expect: false,
  },
  {
    week: 4,
    label: 'start at 15, back to 8',
    program: { nodes: [n('go_to_number', { N: 15 }), n('move_back', { N: 7 })] },
    expect: true,
  },
  {
    week: 5,
    label: 'repeat 3, add 4, say 12',
    program: { nodes: [
      n('repeat_times', { N: 3 }, [n('change_score', { N: 4 })]),
      n('say_score'),
    ]},
    expect: true,
  },
  {
    week: 6,
    label: 'count back by 5s from 60',
    program: { nodes: [n('say_each_number', { FROM: 60, TO: 0, STEP: 5 })] },
    expect: true,
  },
  {
    week: 7,
    label: 'half, third and quarter turns',
    program: { nodes: [
      n('turn_fraction', { DIR: 'right', FRACTION: 2 }),
      n('turn_fraction', { DIR: 'right', FRACTION: 3 }),
      n('turn_fraction', { DIR: 'right', FRACTION: 4 }),
    ]},
    expect: true,
  },
  {
    week: 8,
    label: 'even numbers to 20',
    program: { nodes: [n('say_each_number', { FROM: 2, TO: 20, STEP: 2 })] },
    expect: true,
  },
  {
    week: 8,
    label: 'counts by 1s, says odds too (should fail)',
    program: { nodes: [n('say_each_number', { FROM: 1, TO: 20, STEP: 1 })] },
    expect: false,
  },
  {
    week: 9,
    label: 'two lines, second 3 longer',
    program: { nodes: [
      n('pen_down'),
      n('move_steps', { N: 4 }),
      n('pen_up'),
      n('turn_fraction', { DIR: 'left', FRACTION: 4 }),
      n('move_steps', { N: 2 }),
      n('pen_down'),
      n('move_steps', { N: 7 }),
    ]},
    expect: true,
  },
  {
    week: 10,
    label: '41 cents: 25 + 10 + 5 + 1',
    program: { nodes: [
      n('change_score', { N: 25 }),
      n('change_score', { N: 10 }),
      n('change_score', { N: 5 }),
      n('change_score', { N: 1 }),
    ]},
    expect: true,
  },
  {
    week: 11,
    label: 'build 245',
    program: { nodes: [
      n('repeat_times', { N: 2 }, [n('change_score', { N: 100 })]),
      n('repeat_times', { N: 4 }, [n('change_score', { N: 10 })]),
      n('repeat_times', { N: 5 }, [n('change_score', { N: 1 })]),
    ]},
    expect: true,
  },
  {
    week: 12,
    label: 'free build',
    program: { nodes: [n('move_steps', { N: 3 }), n('say_text', { TEXT: 'Hi' }), n('change_score', { N: 1 })] },
    expect: true,
  },
];

let pass = 0;
let fail = 0;
for (const testCase of cases) {
  const challenge = challengeForWeek(testCase.week);
  const result = checkChallenge(challenge, testCase.program);
  const ok = result.passed === testCase.expect;
  if (ok) {
    pass += 1;
    console.log(`  PASS  wk${String(testCase.week).padStart(2)}  ${testCase.label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  wk${String(testCase.week).padStart(2)}  ${testCase.label}`);
    console.log(`        expected passed=${testCase.expect}, got ${result.passed}`);
    for (const rule of result.results) {
      console.log(`          [${rule.passed ? 'x' : ' '}] ${rule.label}`);
    }
  }
}

// Runaway loop guard
const runaway = { nodes: [n('repeat_times', { N: 9999 }, [n('change_score', { N: 1 })])] };
const started = Date.now();
const { frames } = runToEnd(runaway);
console.log(`\n  guard: runaway repeat stopped at ${frames} frames in ${Date.now() - started}ms`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
