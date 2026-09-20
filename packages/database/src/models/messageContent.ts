import type { EditMessageContentParams, InsertContextMessageParams } from '@lobechat/types';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';

import { sanitizeNullBytes } from '@/utils/sanitizeNullBytes';

import { files, messages, messagesFiles, topics } from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';
import { buildWorkspacePayload, buildWorkspaceWhere } from '../utils/workspace';

/**
 * Atomic user-authored content changes. Kept separate from streaming updates:
 * replacing an attachment set must not be confused with appending generated images.
 */
export class MessageContentModel {
  constructor(
    private db: LobeChatDatabase,
    private userId: string,
    private workspaceId?: string,
  ) {}

  private get scope() {
    return { userId: this.userId, workspaceId: this.workspaceId };
  }

  private async validateFiles(tx: Transaction, fileIds: string[]) {
    const ids = [...new Set(fileIds)];
    if (!ids.length) return ids;
    const ownedFiles = await tx
      .select({ id: files.id })
      .from(files)
      .where(and(inArray(files.id, ids), buildWorkspaceWhere(this.scope, files)));
    if (ownedFiles.length !== ids.length) throw new Error('Attachment not found or inaccessible');
    return ids;
  }

  private async findMessage(tx: Transaction, id: string) {
    const [message] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), buildWorkspaceWhere(this.scope, messages)))
      .for('update');
    if (!message) throw new Error('Message not found or inaccessible');
    return message;
  }

  edit = async ({ id, content, editorData, fileIds }: EditMessageContentParams) =>
    this.db.transaction(async (tx) => {
      const message = await this.findMessage(tx, id);
      if (message.role !== 'user' || message.userId !== this.userId)
        throw new Error('Only your own user messages can be edited with attachments');
      const ids = await this.validateFiles(tx, fileIds);
      if (!content.trim() && !ids.length) throw new Error('Message cannot be empty');

      await tx
        .update(messages)
        .set({ content: sanitizeNullBytes(content), editorData: editorData ?? null })
        .where(eq(messages.id, id));
      await tx
        .delete(messagesFiles)
        .where(and(eq(messagesFiles.messageId, id), buildWorkspaceWhere(this.scope, messagesFiles)));
      if (ids.length) {
        await tx.insert(messagesFiles).values(
          ids.map((fileId) => buildWorkspacePayload(this.scope, { fileId, messageId: id })),
        );
      }
      return message;
    });

  insert = async (params: InsertContextMessageParams) =>
    this.db.transaction(async (tx) => {
      // Lock the topic before its message rows so simultaneous insertions use
      // one consistent chain. A retried request uses the same client-generated ID.
      const [candidate] = await tx
        .select({ topicId: messages.topicId })
        .from(messages)
        .where(
          and(eq(messages.id, params.anchorId), buildWorkspaceWhere(this.scope, messages)),
        );
      if (!candidate?.topicId) throw new Error('Save the conversation before inserting context');
      await tx
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.id, candidate.topicId), buildWorkspaceWhere(this.scope, topics)))
        .for('update');

      const [existing] = await tx
        .select()
        .from(messages)
        .where(and(eq(messages.id, params.id), buildWorkspaceWhere(this.scope, messages)));
      if (existing) {
        const metadata = existing.metadata as { isCustomContext?: boolean } | null;
        if (
          existing.userId !== this.userId ||
          existing.topicId !== candidate.topicId ||
          !metadata?.isCustomContext
        ) throw new Error('Message ID is already in use');
        return existing;
      }

      const anchor = await this.findMessage(tx, params.anchorId);
      if ((anchor.threadId ?? null) !== (params.threadId ?? null))
        throw new Error('Choose a message in the current conversation branch');
      if (anchor.messageGroupId)
        throw new Error('Expand or restore the grouped messages before inserting context');
      if (!['user', 'assistant', 'tool'].includes(anchor.role))
        throw new Error('This message does not support context insertion');
      if (
        (params.position === 'before' && anchor.role === 'tool') ||
        (params.position === 'after' && Array.isArray(anchor.tools) && anchor.tools.length)
      ) throw new Error('Context cannot split a tool call and its results');

      const ids = await this.validateFiles(tx, params.fileIds);
      if (!params.content.trim() && !ids.length) throw new Error('Context cannot be empty');
      const before = params.position === 'before';
      const metadata = anchor.metadata as { activeBranchIndex?: number } | null;
      const [inserted] = await tx
        .insert(messages)
        .values(
          buildWorkspacePayload(this.scope, {
            agentId: anchor.agentId,
            content: sanitizeNullBytes(params.content),
            editorData: params.editorData ?? null,
            groupId: anchor.groupId,
            id: params.id,
            metadata: {
              ...(!before && metadata?.activeBranchIndex !== undefined
                ? { activeBranchIndex: metadata.activeBranchIndex }
                : {}),
              isCustomContext: true,
            },
            parentId: before ? anchor.parentId : anchor.id,
            role: 'user',
            sessionId: anchor.sessionId,
            threadId: anchor.threadId,
            topicId: anchor.topicId,
          }),
        )
        .returning();

      if (before) {
        await tx.update(messages).set({ parentId: inserted.id }).where(eq(messages.id, anchor.id));
      } else {
        // Retain every alternative branch, and do not change other threads.
        await tx
          .update(messages)
          .set({ parentId: inserted.id })
          .where(
            and(
              eq(messages.parentId, anchor.id),
              ne(messages.id, inserted.id),
              inArray(messages.role, ['user', 'assistant']),
              eq(messages.topicId, anchor.topicId!),
              anchor.threadId ? eq(messages.threadId, anchor.threadId) : isNull(messages.threadId),
              buildWorkspaceWhere(this.scope, messages),
            ),
          );
      }
      if (ids.length) {
        await tx.insert(messagesFiles).values(
          ids.map((fileId) =>
            buildWorkspacePayload(this.scope, { fileId, messageId: inserted.id }),
          ),
        );
      }
      await tx.update(topics).set({ updatedAt: new Date() }).where(eq(topics.id, anchor.topicId!));
      return inserted;
    });
}
