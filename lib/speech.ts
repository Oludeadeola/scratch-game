/**
 * Read aloud, for children still learning to read.
 *
 * Uses the browser's own speech synthesis: nothing is uploaded, which keeps the
 * feature on the right side of the PRD's "no voice data leaves the device"
 * rule and costs nothing to run.
 */

import { type Program, describeNode } from './program';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Picks a clear English voice, preferring a child-friendly one where present. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((voice) => voice.lang.startsWith('en'));
  const pool = english.length ? english : voices;
  const preferred = pool.find((voice) =>
    /samantha|aria|jenny|zira|female/i.test(voice.name),
  );
  return preferred ?? pool[0];
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Speaks one phrase, cancelling anything already in progress. */
export function speak(text: string): void {
  if (!speechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  // Slower than default: these are 7-year-olds, and some are hearing the
  // instruction in their second language.
  utterance.rate = 0.85;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

/** Reads the whole script out, one block per line. */
export function speakProgram(program: Program): void {
  if (!program.nodes.length) {
    speak('Your script is empty. Drag a block to start.');
    return;
  }
  const lines: string[] = [];
  const walk = (nodes: Program['nodes'], depth: number) => {
    for (const node of nodes) {
      lines.push(`${depth ? 'inside, ' : ''}${describeNode(node)}`);
      if (node.body) walk(node.body, depth + 1);
    }
  };
  walk(program.nodes, 0);
  speak(`When Run is clicked. ${lines.join('. ')}.`);
}
