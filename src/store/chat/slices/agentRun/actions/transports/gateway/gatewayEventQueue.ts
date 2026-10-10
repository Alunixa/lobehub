import type { StreamChunkData } from '@lobechat/agent-gateway-client';
import { createCooperativeQueue } from '@lobechat/utils/client/cooperativeQueue';

interface ChunkBatch {
  data: StreamChunkData;
  parts: string[];
}

/**
 * Merge only adjacent deltas of the same kind, never across a step/tool/terminal
 * boundary. A replay burst should not reparse the entire conversation per token.
 */
export const createGatewayEventQueue = (onChunk: (data: StreamChunkData) => void) => {
  const queue = createCooperativeQueue();
  let pendingBatch: ChunkBatch | undefined;

  const enqueue = (task: () => Promise<void> | void) => {
    pendingBatch = undefined;
    queue(task);
  };

  const enqueueChunk = (data: StreamChunkData) => {
    const delta =
      data.chunkType === 'text'
        ? data.content
        : data.chunkType === 'reasoning'
          ? data.reasoning
          : undefined;

    if (!delta) {
      enqueue(() => onChunk(data));
      return;
    }

    if (pendingBatch?.data.chunkType === data.chunkType) {
      pendingBatch.parts.push(delta);
      return;
    }

    const batch: ChunkBatch = { data, parts: [delta] };
    pendingBatch = batch;
    queue(() => {
      if (pendingBatch === batch) pendingBatch = undefined;
      const text = batch.parts.join('');
      onChunk({
        ...batch.data,
        ...(batch.data.chunkType === 'text' ? { content: text } : { reasoning: text }),
      });
    });
  };

  return { enqueue, enqueueChunk };
};
