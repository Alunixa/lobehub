import { toRecord } from '@lobechat/utils/object';

import { desensitizeUrl } from '../../utils/desensitizeUrl';

class CloudflareStreamTransformer {
  private textDecoder = new TextDecoder();
  private buffer = '';
  private streaming = false;
  private finished = false;

  private emit(controller: TransformStreamDefaultController, type: string, data: unknown) {
    controller.enqueue(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private finish(controller: TransformStreamDefaultController) {
    if (this.finished) return;
    this.finished = true;
    this.emit(controller, 'stop', 'stop');
    this.emit(controller, 'done', 'completed');
  }

  private parseChunk(chunk: string, controller: TransformStreamDefaultController) {
    if (this.finished || !chunk.trim()) return;
    const data = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    this.streaming ||= data.length > 0;
    const json = data.length
      ? data.map((line) => line.slice(5).trimStart()).join('\n')
      : chunk.trim();
    if (json === '[DONE]') {
      this.finish(controller);
      return;
    }
    if (!data.length && /^(?:event:|:)/.test(json)) return;
    const envelope = toRecord(JSON.parse(json));
    const result = toRecord(envelope?.result) ?? envelope;
    if (!result) throw new TypeError('Cloudflare returned an invalid response object.');
    if (result.error || envelope?.success === false) {
      this.finished = true;
      this.emit(controller, 'error', {
        type: 'ProviderBizError',
        body: result.error ?? envelope?.errors,
      });
      return;
    }
    if (typeof result.response === 'string' && result.response)
      this.emit(controller, 'text', result.response);
    if (Array.isArray(result.tool_calls) && result.tool_calls.length) {
      this.emit(
        controller,
        'tool_calls',
        result.tool_calls.map((value, index) => {
          const call = toRecord(value) ?? {};
          const fn = toRecord(call.function) ?? call;
          return {
            function: {
              arguments:
                typeof fn.arguments === 'string'
                  ? fn.arguments
                  : JSON.stringify(fn.arguments ?? {}),
              name: fn.name,
            },
            id: call.id ?? `cloudflare_tool_${index}`,
            index,
            type: 'function',
          };
        }),
      );
    }
  }

  transform(chunk: Uint8Array, controller: TransformStreamDefaultController) {
    this.buffer += this.textDecoder.decode(chunk, { stream: true });
    const frames = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = frames.pop() ?? '';
    for (const frame of frames) this.parseChunk(frame, controller);
  }

  flush(controller: TransformStreamDefaultController) {
    this.buffer += this.textDecoder.decode();
    if (this.buffer.trim()) this.parseChunk(this.buffer, controller);
    if (this.finished) return;
    if (!this.streaming) this.finish(controller);
    else
      this.emit(controller, 'error', {
        type: 'StreamChunkError',
        message:
          'Cloudflare stream ended before its terminal event. The partial response has been preserved.',
      });
  }
}

const DEFAULT_BASE_URL_PREFIX = 'https://api.cloudflare.com';

function fillUrl(accountID: string): string {
  return `${DEFAULT_BASE_URL_PREFIX}/client/v4/accounts/${accountID}/ai/run/`;
}

function desensitizeAccountId(path: string): string {
  return path.replace(/\/[\da-f]{32}\//i, '/****/');
}

function desensitizeCloudflareUrl(url: string): string {
  const urlObj = new URL(url);
  const { protocol, hostname, port, search } = urlObj;
  let { pathname } = urlObj;
  if (url.startsWith(DEFAULT_BASE_URL_PREFIX)) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}${desensitizeAccountId(pathname)}${search}`;
  } else {
    const desensitizedUrl = desensitizeUrl(`${protocol}//${hostname}${port ? `:${port}` : ''}`);
    if (desensitizedUrl.endsWith('/') && pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    return `${desensitizedUrl}${desensitizeAccountId(pathname)}${search}`;
  }
}

export { CloudflareStreamTransformer, DEFAULT_BASE_URL_PREFIX, desensitizeCloudflareUrl, fillUrl };
