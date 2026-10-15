import type OpenAI from 'openai';

import type { StreamProtocolChunk } from '../protocol';

interface OutputPosition {
  content_index?: number;
  item_id?: string;
  output_index?: number;
  summary_index?: number;
}

interface OutputState {
  id?: string;
  text: Map<string, string>;
  tool?: { arguments: string; id: string; index: number; name: string };
}

/** Reconcile final snapshots with streamed deltas without replaying content or tool arguments. */
export class ResponsesOutput {
  private byId = new Map<string, OutputState>();
  private byIndex = new Map<number, OutputState>();
  private nextToolIndex = 0;

  constructor(private readonly responseId: () => string) {}

  private state(position: OutputPosition): OutputState {
    const { item_id: id, output_index: index } = position;
    const state: OutputState = (id ? this.byId.get(id) : undefined) ??
      (index === undefined ? undefined : this.byIndex.get(index)) ?? {
        text: new Map<string, string>(),
      };
    if (id) {
      state.id = id;
      this.byId.set(id, state);
    }
    if (index !== undefined) this.byIndex.set(index, state);
    return state;
  }

  text(
    position: OutputPosition,
    value: string | undefined,
    type: 'reasoning' | 'text',
    snapshot = false,
    summary = false,
  ): StreamProtocolChunk[] {
    if (typeof value !== 'string' || !value) return [];
    const state = this.state(position);
    const key = `${type}:${summary ? 'summary' : 'content'}:${position.summary_index ?? position.content_index ?? 0}`;
    const previous = state.text.get(key) ?? '';
    // Conflicting snapshots cannot safely replace text already delivered to consumers.
    if (snapshot && !value.startsWith(previous)) return [];
    const delta = snapshot ? value.slice(previous.length) : value;
    if (!delta) return [];
    state.text.set(key, snapshot ? value : previous + value);
    return [{ data: delta, id: state.id, type }];
  }

  tool(
    position: OutputPosition,
    call: { arguments?: string; call_id?: string; name?: string },
    snapshot: boolean,
  ): StreamProtocolChunk[] {
    const state = this.state(position);
    const initial = !state.tool;
    if (!state.tool) {
      if (!call.call_id || !call.name) return [];
      state.tool = {
        arguments: '',
        id: call.call_id,
        index: this.nextToolIndex++,
        name: call.name,
      };
    }
    const tool = state.tool;
    if (call.call_id) this.byId.set(call.call_id, state);
    const value = call.arguments ?? '';
    const delta = snapshot
      ? value.startsWith(tool.arguments)
        ? value.slice(tool.arguments.length)
        : ''
      : value;
    tool.arguments += delta;
    if (!initial && !delta) return [];
    return [
      {
        data: [
          {
            function: { arguments: delta, name: tool.name },
            id: tool.id,
            index: tool.index,
            type: 'function',
          },
        ],
        id: this.responseId() || state.id,
        type: 'tool_calls',
      },
    ];
  }

  part(
    position: OutputPosition,
    part: OpenAI.Responses.ResponseContentPartDoneEvent['part'],
  ): StreamProtocolChunk[] {
    switch (part.type) {
      case 'output_text': {
        return this.text(position, part.text, 'text', true);
      }
      case 'refusal': {
        return this.text(position, part.refusal, 'text', true);
      }
      case 'reasoning_text': {
        return this.text(position, part.text, 'reasoning', true);
      }
      default: {
        return [];
      }
    }
  }

  item(item: OpenAI.Responses.ResponseOutputItem, outputIndex?: number): StreamProtocolChunk[] {
    const position = { item_id: item.id, output_index: outputIndex };
    switch (item.type) {
      case 'message': {
        return (item.content ?? []).flatMap((part, content_index) =>
          this.part({ ...position, content_index }, part),
        );
      }
      case 'function_call': {
        return this.tool(position, item, true);
      }
      case 'reasoning': {
        return [
          ...(item.summary ?? []).flatMap((part, summary_index) =>
            this.text({ ...position, summary_index }, part.text, 'reasoning', true, true),
          ),
          ...(item.content ?? []).flatMap((part, content_index) =>
            this.text({ ...position, content_index }, part.text, 'reasoning', true),
          ),
        ];
      }
      default: {
        return [];
      }
    }
  }
}
