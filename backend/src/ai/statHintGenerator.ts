import Groq from 'groq-sdk';
import type { QuestionCategory, RaceSnapshot, StatHintKey } from '../types';

const apiKey = process.env.GROQ_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const STAT_HINT_TIMEOUT_MS = 2000;

const SUPPORTED_HINT_KEYS: StatHintKey[] = [
  'TRACK_STATUS',
  'LAP_PROGRESS',
  'TYRE_COMPOUND',
  'TYRE_AGE',
  'STINT_NUMBER',
];

function hasGroq(): boolean {
  return Boolean(groq);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function parseSuggestedKeys(content: string | null | undefined): StatHintKey[] {
  if (!content) {
    return [];
  }

  const normalized = content.toUpperCase();
  return SUPPORTED_HINT_KEYS.filter((key) => normalized.includes(key)).slice(0, 3);
}

export async function generateSuggestedStatKeys(input: {
  questionText: string;
  category: QuestionCategory;
  snapshot: RaceSnapshot;
}): Promise<StatHintKey[]> {
  if (!hasGroq()) {
    return [];
  }

  try {
    const leader = input.snapshot.drivers[0];
    const response = await withTimeout(
      groq!.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 50,
        messages: [
          {
            role: 'system',
            content:
              'Choose the 2 or 3 live stat keys that would help a player reason about the question without giving away the answer. Return only comma-separated keys from the allowed list.',
          },
          {
            role: 'user',
            content: [
              `Allowed keys: ${SUPPORTED_HINT_KEYS.join(', ')}`,
              `Question category: ${input.category}`,
              `Question: ${input.questionText}`,
              `Track status: ${input.snapshot.trackStatus}`,
              `Lap: ${input.snapshot.lapNumber}${input.snapshot.totalLaps ? `/${input.snapshot.totalLaps}` : ''}`,
              `Leader tyre compound: ${leader?.tyreCompound ?? 'UNKNOWN'}`,
              `Leader tyre age: ${leader?.tyreAge ?? 'UNKNOWN'}`,
              `Leader stint number: ${leader?.stintNumber ?? 'UNKNOWN'}`,
            ].join('\n'),
          },
        ],
      }),
      STAT_HINT_TIMEOUT_MS,
      'Groq stat hint selection'
    );

    return parseSuggestedKeys(response.choices[0]?.message?.content);
  } catch (error) {
    console.error('Failed to generate suggested stat keys:', error);
    return [];
  }
}
