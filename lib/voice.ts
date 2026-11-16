/**
 * The robot's voice.
 *
 * Young children work for a person, not a progress bar. A lesson that opens
 * with "How are you doing, Cleo? Welcome back!" lands completely differently
 * from one that opens with a grid of blocks, and it costs nothing: every word
 * here is spoken by the browser's own synthesiser, so no audio is recorded, no
 * audio is uploaded, and there is no per-word bill.
 *
 * Two rules shape everything below.
 *
 * Browsers will not speak until the user has interacted with the page, so the
 * greeting has to ride on a tap. Rather than fight that, the welcome card makes
 * the tap the moment itself — the child presses a big button and the robot
 * starts talking.
 *
 * And nothing is said the same way twice. A child hears the completion line
 * twelve times across a term; one fixed sentence stops being praise by the
 * third time.
 */

import { speak } from './speech';

/** Picks a line, avoiding the one used last so praise does not repeat. */
function pick(lines: string[], avoid?: string): string {
  const pool = lines.length > 1 && avoid ? lines.filter((l) => l !== avoid) : lines;
  return pool[Math.floor(Math.random() * pool.length)];
}

let lastPraise = '';
let lastNudge = '';

/** Time-of-day greeting, because "good morning" at 8pm sounds like a machine. */
function timeGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export interface WelcomeOptions {
  name: string;
  /** The project for this week, e.g. "Robot Number Quest". */
  project: string;
  /** What she has to do, in the challenge's own words. */
  prompt: string;
  /** True if she has opened this project before. */
  returning: boolean;
}

/** The words shown on the welcome card, and spoken when she taps it. */
export function welcomeScript({
  name,
  project,
  prompt,
  returning,
}: WelcomeOptions): { heading: string; lines: string[]; speech: string } {
  const greeting = returning
    ? pick([
        `Welcome back, ${name}!`,
        `${name}, you are back!`,
        `Hello again, ${name}!`,
      ])
    : pick([
        `${timeGreeting()}, ${name}!`,
        `Hi ${name}!`,
        `Hello ${name}, lovely to see you!`,
      ]);

  const howAreYou = pick([
    'How are you doing today?',
    'How are you today?',
    'I hope you are having a good day.',
  ]);

  const lines = [howAreYou, `Today we are doing ${project}.`, prompt];

  return {
    heading: greeting,
    lines,
    // Spoken slightly differently from the text on screen: full sentences,
    // with a pause before the challenge so she has time to look at the stage.
    speech: `${greeting} ${howAreYou} Welcome to your maths lesson. Today we are doing ${project}. ${prompt} Let's get started!`,
  };
}

export function speakWelcome(options: WelcomeOptions): void {
  speak(welcomeScript(options).speech);
}

/** Said when a challenge is passed for the first time. */
export function praise(name: string): string {
  const line = pick(
    [
      `Brilliant work, ${name}! You did it!`,
      `Yes! Well done, ${name}. That is exactly right.`,
      `Amazing, ${name}! You earned a star.`,
      `You got it, ${name}! That was great thinking.`,
      `Fantastic, ${name}! Your robot did just what you wanted.`,
    ],
    lastPraise,
  );
  lastPraise = line;
  return line;
}

export function speakPraise(name: string): void {
  speak(praise(name));
}

/**
 * Said when a run finishes but the challenge is not passed.
 *
 * Never "wrong". A seven-year-old who hears "wrong" four times stops pressing
 * Run, and a child who stops pressing Run stops learning.
 */
export function nudge(name: string, firstUnmetRule?: string): string {
  const opener = pick(
    [
      `Good try, ${name}!`,
      `Nice work so far, ${name}.`,
      `You are close, ${name}!`,
      `Almost there, ${name}!`,
    ],
    lastNudge,
  );
  lastNudge = opener;
  return firstUnmetRule
    ? `${opener} Have a look at this bit: ${firstUnmetRule}.`
    : `${opener} Have another look at your blocks and try again.`;
}

export function speakNudge(name: string, firstUnmetRule?: string): void {
  speak(nudge(name, firstUnmetRule));
}

/** Said when someone else joins the room, so she is not alone on screen. */
export function speakArrival(who: string, isTeacher: boolean): void {
  speak(
    isTeacher
      ? `${who} has joined. Your teacher is here!`
      : `${who} has joined the lesson.`,
  );
}

/** A short cheer a teacher can send by hand. */
export function speakCheer(name: string): void {
  speak(
    pick([
      `Your teacher says well done, ${name}!`,
      `${name}, your teacher is really proud of that.`,
      `Great job, ${name}! Your teacher sent you a star.`,
    ]),
  );
}
