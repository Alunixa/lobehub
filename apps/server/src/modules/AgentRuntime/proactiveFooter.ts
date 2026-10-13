import type { ProactiveDecision } from '@lobechat/types';
import { ProactiveDecisionSchema } from '@lobechat/types';

export const PROACTIVE_OPEN = '<lobe_proactive_plan>';
const PROACTIVE_CLOSE = '</lobe_proactive_plan>';
const MAX_PRIVATE_CHARS = 4096;

export const proactiveSchedulingPrompt = (now: string) =>
  `Autonomous follow-up is enabled for this conversation. Current server time: ${now}.
After your final user-facing answer, decide yourself whether a future follow-up is useful.
Do not use a fixed recurring cadence. Consider the user's intent, availability and whether another message would be welcome.
Append one private footer, never describe it in the visible answer:
${PROACTIVE_OPEN}{"sendAt":"future ISO8601 timestamp","reason":"brief context"}${PROACTIVE_CLOSE}
OR ${PROACTIVE_OPEN}{"idleForSeconds":number,"reason":"brief context"}${PROACTIVE_CLOSE}
Use exactly one timing field. idleForSeconds starts when this answer ends and is cancelled if the user speaks again.
If no follow-up is useful, append ${PROACTIVE_OPEN}null${PROACTIVE_CLOSE}.
A wake-up is a system event, not a new user request. Never fabricate user messages.`;

/** Incrementally hides the reserved control footer, including split opening tags. */
export class ProactiveFooterStream {
  private pending = '';
  private privateText: string | undefined;

  append(text: string): string {
    if (this.privateText !== undefined) {
      this.privateText = (this.privateText + text).slice(0, MAX_PRIVATE_CHARS);
      return '';
    }
    this.pending += text;
    const index = this.pending.indexOf(PROACTIVE_OPEN);
    if (index >= 0) {
      const visible = this.pending.slice(0, index);
      this.privateText = this.pending.slice(
        index + PROACTIVE_OPEN.length,
        index + PROACTIVE_OPEN.length + MAX_PRIVATE_CHARS,
      );
      this.pending = '';
      return visible;
    }
    let held = 0;
    for (let length = 1; length < PROACTIVE_OPEN.length; length++) {
      if (this.pending.endsWith(PROACTIVE_OPEN.slice(0, length))) held = length;
    }
    const visible = this.pending.slice(0, this.pending.length - held);
    this.pending = held ? this.pending.slice(-held) : '';
    return visible;
  }

  finish(): { decision?: ProactiveDecision; declined?: boolean; visibleTail: string } {
    if (this.privateText === undefined) {
      const visibleTail =
        this.pending.length >= 8 && PROACTIVE_OPEN.startsWith(this.pending) ? '' : this.pending;
      this.pending = '';
      return { visibleTail };
    }
    const end = this.privateText.indexOf(PROACTIVE_CLOSE);
    if (end < 0 || this.privateText.slice(end + PROACTIVE_CLOSE.length).trim())
      return { visibleTail: '' };
    try {
      const raw = JSON.parse(this.privateText.slice(0, end));
      if (raw === null) return { declined: true, visibleTail: '' };
      const parsed = ProactiveDecisionSchema.safeParse(raw);
      return { decision: parsed.success ? parsed.data : undefined, visibleTail: '' };
    } catch {
      return { visibleTail: '' };
    }
  }
}
