// @ts-nocheck - Complex type issues with optional chaining
// @ts-nocheck - Complex type inference issues
import Groq from 'groq-sdk';
import type { RaceSnapshot, DriverState, QuestionInstanceState } from '../types';
import { getQuestionById } from '../engine/questionBank';
import { getDriverByNumber } from '../engine/derivedSignals';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 200;

/**
 * Generate an explanation for a question outcome using Groq
 */
export async function generateExplanation(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot,
  outcome: boolean
): Promise<string> {
  const question = getQuestionById(instance.questionId);
  if (!question) {
    return generateBasicExplanation(instance, outcome);
  }

  const driver1 = instance.driver1;
  const driver2 = instance.driver2;

  if (!driver1) {
    return generateBasicExplanation(instance, outcome);
  }

  // Build context for Groq
  const context = buildContext(instance, currentSnapshot, outcome);

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `You are an F1 expert commentator. Generate a brief (2-4 sentences) explanation for this prediction question outcome.

Question: ${instance.questionText}
Result: ${outcome ? 'YES - The prediction came true' : 'NO - The prediction did not come true'}

Context:
- Driver: ${driver1.name} (${driver1.team})
- Position at trigger: P${driver1.position}
- Position now: P${getDriverByNumber(currentSnapshot, driver1.driverNumber)?.position ?? 'N/A'}
- Tyre age at trigger: ${driver1.tyreAge} laps
- Current tyre age: ${getDriverByNumber(currentSnapshot, driver1.driverNumber)?.tyreAge ?? 'N/A'} laps
- Pit stops at trigger: ${driver1.pitCount}
${driver2 ? `- Competitor: ${driver2.name} (${driver2.team})` : ''}

${context}

Provide a concise, insightful explanation for ${driver1.name}'s fans. Be engaging but factual. Don't use markdown or special formatting.`,
        },
      ],
    });

    const explanation = response.choices[0]?.message?.content;
    if (explanation) {
      return explanation.trim();
    }

    return generateBasicExplanation(instance, outcome);
  } catch (error) {
    console.error('Failed to generate AI explanation:', error);
    return generateBasicExplanation(instance, outcome);
  }
}

/**
 * Build additional context based on question category
 */
function buildContext(
  instance: QuestionInstanceState,
  currentSnapshot: RaceSnapshot,
  outcome: boolean
): string {
  const question = getQuestionById(instance.questionId);
  if (!question) return '';

  const driver1 = instance.driver1;
  const driver2 = instance.driver2;
  const currentDriver1 = driver1 ? getDriverByNumber(currentSnapshot, driver1.driverNumber) : null;

  const parts: string[] = [];

  switch (question.category) {
    case 'PIT_WINDOW':
      parts.push('- This was a pit strategy prediction.');
      if (currentDriver1 && driver1) {
        parts.push(`- Pit stops made: ${currentDriver1.pitCount - driver1.pitCount}`);
      }
      break;

    case 'STRATEGY':
      parts.push('- This was a strategic prediction involving tyre and position management.');
      if (driver2) {
        parts.push(`- ${driver2.name} was the key competitor in this scenario.`);
      }
      break;

    case 'OVERTAKE':
      parts.push('- This was an overtaking prediction.');
      if (driver1 && driver2) {
        const gapThen = driver1.interval;
        const gapNow = currentDriver1?.interval ?? null;
        if (gapThen !== null && gapNow !== null) {
          parts.push(`- Gap change: ${gapThen.toFixed(2)}s → ${gapNow.toFixed(2)}s`);
        }
      }
      break;

    case 'ENERGY_BATTLE':
      parts.push('- This was a DRS/energy battle prediction.');
      if (driver1) {
        parts.push(`- DRS status: ${driver1.drsEnabled ? 'Active' : 'Inactive'}`);
      }
      break;

    case 'GAP_CLOSING':
      parts.push('- This was a gap closing prediction.');
      if (driver1 && driver2) {
        const triggerGap = Math.abs((driver1.gap ?? 0) - (driver2.gap ?? 0));
        const currentGap = Math.abs(
          (currentDriver1?.gap ?? 0) - (getDriverByNumber(currentSnapshot, driver2.driverNumber)?.gap ?? 0)
        );
        parts.push(`- Gap: ${triggerGap.toFixed(2)}s → ${currentGap.toFixed(2)}s`);
      }
      break;

    case 'FINISH_POSITION':
      parts.push('- This was a finish position prediction.');
      if (currentDriver1) {
        parts.push(`- Final position: P${currentDriver1.position}`);
      }
      break;
  }

  return parts.join('\n');
}

/**
 * Generate a basic explanation without AI (fallback)
 */
function generateBasicExplanation(
  instance: QuestionInstanceState,
  outcome: boolean
): string {
  const driver1 = instance.driver1;
  const driver2 = instance.driver2;
  const yesNo = outcome ? 'Yes' : 'No';
  const didDidNot = outcome ? 'did' : 'did not';

  if (!driver1) {
    return `${yesNo}! The prediction ${didDidNot} come true.`;
  }

  const driver2Text = driver2 ? ` and ${driver2.name}` : '';

  switch (instance.questionId.split('_')[0]) {
    case 'PIT':
      return `${yesNo}! ${driver1.name} ${didDidNot} pit as expected. Tyre strategy played a key role.`;

    case 'STRAT':
      return `${yesNo}! The strategic move ${outcome ? 'worked' : 'didn\'t work'} for ${driver1.name}${driver2Text}.`;

    case 'OVER':
      return `${yesNo}! ${driver1.name} ${didDidNot} complete the overtake${driver2 ? ` on ${driver2.name}` : ''}.`;

    case 'ENERGY':
      return `${yesNo}! The DRS/energy battle ${outcome ? 'went in favor of' : 'didn\'t favor'} ${driver1.name}.`;

    case 'GAP':
      return `${yesNo}! The gap ${outcome ? 'closed' : 'didn\'t close'} as predicted for ${driver1.name}.`;

    case 'FINISH':
      return `${yesNo}! ${driver1.name} ${didDidNot} achieve the predicted finish position.`;

    default:
      return `${yesNo}! The prediction ${didDidNot} come true for ${driver1.name}.`;
  }
}

/**
 * Generate a pre-race insight (optional feature)
 */
export async function generatePreRaceInsight(
  driver: DriverState,
  snapshot: RaceSnapshot
): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `You are an F1 expert. Give a brief (1-2 sentences) insight about ${driver.name} starting P${driver.position} for their fans.

Team: ${driver.team}
Position: P${driver.position}
Gap to leader: ${driver.gap?.toFixed(2) ?? 'N/A'}s

Be encouraging and insightful. No markdown.`,
        },
      ],
    });

    const insight = response.choices[0]?.message?.content;
    if (insight) {
      return insight.trim();
    }

    return `${driver.name} starts P${driver.position} for ${driver.team}.`;
  } catch (error) {
    console.error('Failed to generate pre-race insight:', error);
    return `${driver.name} starts P${driver.position} for ${driver.team}.`;
  }
}

/**
 * Generate a post-race summary (optional feature)
 */
export async function generatePostRaceSummary(
  topThree: DriverState[],
  snapshot: RaceSnapshot
): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are an F1 commentator. Give a brief (3-4 sentences) post-race summary.

Podium:
1. ${topThree[0]?.name} (${topThree[0]?.team})
2. ${topThree[1]?.name} (${topThree[1]?.team})
3. ${topThree[2]?.name} (${topThree[2]?.team})

Be engaging and highlight the key moments. No markdown.`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content;
    if (summary) {
      return summary.trim();
    }

    return `Great race with ${topThree[0]?.name} taking the win!`;
  } catch (error) {
    console.error('Failed to generate post-race summary:', error);
    return `Great race with ${topThree[0]?.name} taking the win!`;
  }
}