import { pickString, toRecord } from '@lobechat/utils/object';

/** Normalize the same HTTP response; never retry or issue a second model request. */
export const createStreamingFetch =
  (fetcher: typeof fetch): typeof fetch =>
  async (input, init) => {
    const response = await fetcher(input, init);
    if (!response.ok || typeof init?.body !== 'string') return response;

    let request: Record<PropertyKey, unknown> | undefined;
    try {
      request = toRecord(JSON.parse(init.body));
    } catch {
      return response;
    }
    if (request?.stream !== true || !response.body) return response;

    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    if (!/\/(?:chat\/completions|responses)\/?$/.test(path)) return response;
    const contentType = response.headers.get('content-type') ?? '';
    const headers = new Headers(response.headers);
    // A transformed body no longer has the upstream entity length or encoding.
    headers.delete('content-length');
    headers.delete('content-encoding');

    if (contentType.includes('application/json')) {
      const data = toRecord(await response.json());
      let event = data;
      if (data?.object === 'response') {
        const status = pickString(data.status);
        event = {
          response: data,
          type: `response.${status ?? 'unknown'}`,
        };
      }
      headers.set('content-type', 'text/event-stream');
      return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
        headers,
        status: response.status,
      });
    }
    if (!contentType.includes('text/event-stream')) return response;

    return new Response(
      response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          flush(controller) {
            // Some relays omit the final blank line. Flush that frame at EOF,
            // but do not invent a stop event when the upstream really truncated.
            controller.enqueue(new TextEncoder().encode('\n\n'));
          },
          transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        }),
      ),
      { headers, status: response.status },
    );
  };
