import { createSSEHeaders } from '@lobechat/utils/server';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { resolveValidWorkspaceIdFromRequest } from '@/app/(backend)/webapi/_utils/workspace';
import { AgentOperationModel } from '@/database/models/agentOperation';
import { createStreamEventManager } from '@/server/modules/AgentRuntime';
import { createResumableAgentStream } from '@/server/modules/AgentRuntime/resumableStream';

const getStream = checkAuth(async (request, { serverDB, userId }) => {
  const params = new URL(request.url).searchParams;
  const operationId = params.get('operationId');
  const lastEventId = request.headers.get('Last-Event-ID') || params.get('lastEventId') || '0';
  if (!operationId || !/^\d+(?:-\d+)?$/.test(lastEventId)) {
    return Response.json({ error: 'Invalid operation or stream cursor' }, { status: 400 });
  }
  const workspaceId = await resolveValidWorkspaceIdFromRequest({ req: request, serverDB, userId });
  const operations = new AgentOperationModel(serverDB, userId, workspaceId);
  const operation = await operations.findById(operationId);
  if (!operation || operation.userId !== userId) {
    return Response.json({ error: 'Operation not found or inaccessible' }, { status: 404 });
  }

  const manager = createStreamEventManager();
  return new Response(
    createResumableAgentStream({
      getStatus: async () => {
        const persisted = await operations.findById(operationId);
        return persisted ? { error: persisted.error, status: persisted.status } : undefined;
      },
      lastEventId,
      manager,
      operationId,
      signal: request.signal,
    }),
    { headers: createSSEHeaders() },
  );
});

export const GET = (request: Request) => getStream(request, { params: Promise.resolve({}) });
