import { MemoryCategory, WalrusMemory } from './types';

export interface MemoryCandidate {
  shouldRemember: boolean;
  category: MemoryCategory;
  title: string;
  content: string;
  reason: string;
}

/**
 * Memory Write Policy (Blueprint Section 5, 7.4, 7.7, 10):
 * - Never write a memory on generic questions ("what is my balance?", "show transactions").
 * - Only extract concise, durable user-stated goals, risk preferences, alert thresholds,
 *   prior decisions, or explicit feedback.
 * - Strip raw addresses/digests when unnecessary, cap length <= 360 chars, and deduplicate
 *   against existing memories for this wallet.
 */
export function evaluateUserMessageForMemory(
  rawMessage: string,
  existingMemories: WalrusMemory[]
): MemoryCandidate | null {
  const cleaned = rawMessage.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 14 || cleaned.length > 600) return null;

  // Pure questions without declarative personal context should NOT mint a memory
  const lower = cleaned.toLowerCase();
  const isPureQuestion =
    /^(what|how|why|when|where|who|can|should|could|would|is|are|do|does|show|summarize|analyze|list|explain)\b/.test(
      lower
    ) &&
    !/\b(my goal|i want to|i prefer|my target|keep at least|minimum reserve|never|always|alert me|i decided|take profit when)\b/.test(
      lower
    );

  if (isPureQuestion) return null;

  let category: MemoryCategory | null = null;
  let title = '';

  if (
    /\b(goal|saving for|target of|save \$|reach \$|working toward|emergency fund|reserve target)\b/i.test(
      cleaned
    )
  ) {
    category = 'Goal';
    title = 'User-stated financial target';
  } else if (
    /\b(prefer|conservative|aggressive|moderate risk|minimum reserve|keep at least|alert|notify|threshold|lock in|partial profit|risk limit|never risk)\b/i.test(
      cleaned
    )
  ) {
    category = 'Preference';
    title = 'Confirmed risk & alert preference';
  } else if (
    /\b(helpful|not helpful|good advice|wrong|correction|update my|instead of|actual reason)\b/i.test(
      cleaned
    )
  ) {
    category = 'Feedback';
    title = 'User feedback on guidance';
  } else if (
    /\b(i decided|i postponed|i swapped|i moved|outcome|confirmed that|kept my reserve)\b/i.test(
      cleaned
    )
  ) {
    category = 'Outcome';
    title = 'Confirmed decision & outcome';
  }

  if (!category) return null;

  const conciseContent = cleaned.slice(0, 340);
  const normalizedNew = conciseContent.toLowerCase().replace(/[^a-z0-9]/g, '');

  const isDuplicate = existingMemories.some((m) => {
    const existingNorm = m.content.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      existingNorm === normalizedNew ||
      (normalizedNew.length > 20 && existingNorm.includes(normalizedNew)) ||
      (existingNorm.length > 20 && normalizedNew.includes(existingNorm))
    );
  });

  if (isDuplicate) return null;

  return {
    shouldRemember: true,
    category,
    title,
    content: conciseContent,
    reason: `Detected durable ${category.toLowerCase()} statement in user message.`,
  };
}

