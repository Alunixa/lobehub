import { type BuiltinToolManifest } from '@lobechat/types';

import { TopicReferenceApiName, TopicReferenceIdentifier } from './types';

export const TopicReferenceManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Read another user-owned conversation by its topic ID. Use this when the user pastes a conversation ID, when a recent-conversation directory lists a relevant ID, or when a <refer_topic> tag is present. Returns a summary when available and otherwise recent messages.',
      name: TopicReferenceApiName.getTopicContext,
      parameters: {
        additionalProperties: false,
        properties: {
          topicId: {
            description: 'The ID of the topic to retrieve context from',
            type: 'string',
          },
        },
        required: ['topicId'],
        type: 'object',
      },
    },
  ],
  identifier: TopicReferenceIdentifier,
  meta: {
    avatar: '📋',
    description: 'Read user-owned conversations by ID',
    title: 'Topic Reference',
  },
  systemRole:
    'Use getTopicContext when the user provides a conversation/topic ID or when a recent conversation directory contains a relevant ID. Do not guess IDs; only read IDs supplied by the user or listed in the injected recent-conversation context. The tool is scoped to the current user and may return a summary or recent messages.',
  type: 'builtin',
};
