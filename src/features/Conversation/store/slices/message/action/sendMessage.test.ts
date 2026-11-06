import type { SendMessageParams } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '@/store/chat';
import { useFileStore } from '@/store/file';

import { createStore } from '../../../index';

const context = { agentId: 'agent', threadId: null, topicId: 'topic' };
const richText = { root: { children: [{ text: 'Keep my draft', type: 'text' }], type: 'root' } };
const createFile = (id: string) => ({
  file: new File(['fixture'], `${id}.txt`, { type: 'text/plain' }),
  id,
  status: 'success' as const,
});

beforeEach(() => {
  useFileStore.setState({ chatContextSelections: [], chatUploadFileList: [] });
});
afterEach(() => {
  vi.restoreAllMocks();
  useChatStore.setState({ mainInputEditor: null });
  useFileStore.setState({ chatContextSelections: [], chatUploadFileList: [] });
});

function setup() {
  const store = createStore({ context });
  const editor = {
    getMarkdownContent: vi.fn(() => ''),
    setDocument: vi.fn(),
    setJSONState: vi.fn(),
  };
  store.getState().setEditor(editor);
  store.getState().updateInputMessage('Keep my draft');
  return { editor, store };
}

describe('conversation send failure draft recovery', () => {
  it('restores rich text, attachments and context selections in the owning editor', async () => {
    const { editor, store } = setup();
    const params: SendMessageParams = {
      contexts: [{ content: 'Context', id: 'context', type: 'text' }],
      editorData: richText,
      files: [createFile('original')],
      message: 'Keep my draft',
    };
    vi.spyOn(useChatStore.getState(), 'sendMessage').mockImplementation(async ({ onSendError }) => {
      expect(store.getState().inputMessage).toBe('');
      onSendError?.();
      return undefined;
    });

    await store.getState().sendMessage(params);

    expect(editor.setJSONState).toHaveBeenCalledExactlyOnceWith(richText);
    expect(editor.setDocument).not.toHaveBeenCalled();
    expect(store.getState().inputMessage).toBe(params.message);
    expect(useFileStore.getState().chatUploadFileList).toEqual(params.files);
    expect(useFileStore.getState().chatContextSelections).toEqual(params.contexts);
  });

  it.each([
    { content: '<p>text</p>', format: 'xml', xml: '<p>text</p>' },
    { content: 'Selection', format: 'markdown', xml: undefined },
  ])(
    'restores $format page selections without starting another send',
    async ({ content, format, xml }) => {
      const { editor, store } = setup();
      const send = vi
        .spyOn(useChatStore.getState(), 'sendMessage')
        .mockImplementation(async ({ onSendError }) => {
          onSendError?.();
          return undefined;
        });

      await store.getState().sendMessage({
        message: 'Keep my draft',
        pageSelections: [{ content: 'Selection', id: 'selection', pageId: 'page', xml }],
      });

      expect(editor.setDocument).toHaveBeenCalledExactlyOnceWith('markdown', 'Keep my draft');
      expect(useFileStore.getState().chatContextSelections).toEqual([
        {
          content,
          format,
          id: 'selection',
          pageId: 'page',
          preview: 'Selection',
          type: 'text',
        },
      ]);
      expect(send).toHaveBeenCalledOnce();
    },
  );

  it.each([
    'new input',
    'new editor text',
    'new attachment',
    'new context',
    'another topic',
    'another mounted editor',
    'unmounted editor',
  ])('does not overwrite %s when a failed send completes late', async (scenario) => {
    const { editor, store } = setup();
    vi.spyOn(useChatStore.getState(), 'sendMessage').mockImplementation(async ({ onSendError }) => {
      switch (scenario) {
        case 'new input': {
          store.getState().updateInputMessage('New draft');
          break;
        }
        case 'new editor text': {
          editor.getMarkdownContent.mockReturnValue('New draft');
          break;
        }
        case 'new attachment': {
          useFileStore.setState({ chatUploadFileList: [createFile('new')] });
          break;
        }
        case 'new context': {
          useFileStore.setState({
            chatContextSelections: [{ content: 'New context', id: 'new', type: 'text' }],
          });
          break;
        }
        case 'another topic': {
          store.setState({ context: { ...context, topicId: 'other' } });
          break;
        }
        case 'another mounted editor': {
          useChatStore.setState({ mainInputEditor: { ...editor } as never });
          break;
        }
        case 'unmounted editor': {
          store.getState().cleanupInput();
          break;
        }
      }
      onSendError?.();
      return undefined;
    });

    await store.getState().sendMessage({
      editorData: richText,
      files: [createFile('original')],
      message: 'Keep my draft',
    });

    expect(editor.setDocument).not.toHaveBeenCalled();
    expect(editor.setJSONState).not.toHaveBeenCalled();
    expect(store.getState().inputMessage).toBe(scenario === 'new input' ? 'New draft' : '');
    expect(useFileStore.getState().chatUploadFileList.map((file) => file.id)).toEqual(
      scenario === 'new attachment' ? ['new'] : [],
    );
    expect(useFileStore.getState().chatContextSelections.map((selection) => selection.id)).toEqual(
      scenario === 'new context' ? ['new'] : [],
    );
  });
});
