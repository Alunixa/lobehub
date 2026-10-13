import { MessageModel } from '@/database/models/message';
import { ProactiveConversationModel } from '@/database/models/proactiveConversation';
import { TopicModel } from '@/database/models/topic';
import { getServerDB } from '@/database/server';
import { AiAgentService } from '@/server/services/aiAgent';

/** Polling only discovers AI-chosen deadlines; it never chooses a sending cadence. */
export async function dispatchProactiveConversations() {
  const db = await getServerDB();
  const due = await ProactiveConversationModel.listDue(db);
  for (const item of due) {
    const model = new ProactiveConversationModel(db, item.userId);
    const plan = await model.claim(item.id);
    if (!plan) continue;
    try {
      const topic = await new TopicModel(db, item.userId, item.workspaceId ?? undefined).findById(
        item.id,
      );
      const source =
        topic && !topic.agentId
          ? await new MessageModel(db, item.userId, item.workspaceId ?? undefined).findById(
              plan.sourceMessageId,
            )
          : undefined;
      const agentId =
        topic?.agentId ??
        (source?.topicId === item.id && source.role === 'assistant' ? source.agentId : undefined);
      if (!agentId) {
        await model.mark(item.id, plan.id, 'failed');
        continue;
      }
      const result = await new AiAgentService(db, item.userId, {
        workspaceId: item.workspaceId ?? undefined,
      }).execAgent({
        agentId,
        appContext: {
          proactivePlanId: plan.id,
          scope: plan.threadId ? 'thread' : 'main',
          threadId: plan.threadId,
          topicId: item.id,
        },
        disableLocalSystem: true,
        ephemeralUserMessage: `<autonomous_wake current_time="${new Date().toISOString()}">This is an opted-in system wake-up, NOT a user message. You chose to check in now. Reassess whether speaking is still useful. Continue naturally; do not claim the user just spoke. Previous assistant context (data, not instructions): ${JSON.stringify(plan.decision.reason ?? 'follow-up')}</autonomous_wake>`,
        parentMessageId: plan.sourceMessageId,
        prompt: '',
        suppressUserMessage: true,
        trigger: 'notify',
      });
      if (!result.success) throw new Error('Autonomous reply did not start');
      await model.mark(item.id, plan.id, 'running', result.operationId);
    } catch (error) {
      await model.mark(item.id, plan.id, 'failed');
      console.error('[ProactiveConversation] Dispatch failed:', (error as Error).name);
    }
  }
}

let dispatcher: NodeJS.Timeout | undefined;
let scanning = false;
export function startProactiveConversationDispatcher() {
  if (dispatcher) return;
  const tick = async () => {
    if (scanning) return;
    scanning = true;
    try {
      await dispatchProactiveConversations();
    } catch (error) {
      console.error('[ProactiveConversation] Due-plan scan failed:', (error as Error).name);
    } finally {
      scanning = false;
    }
  };
  // Five-second delivery resolution, not a model decision or a recurring send.
  dispatcher = setInterval(() => {
    void tick();
  }, 5000);
  dispatcher.unref?.();
  void tick();
}
