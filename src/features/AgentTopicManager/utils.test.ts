import type { ChatTopic } from '@/types/topic';

import {
  areAllTopicsArchived,
  getProjectFilterLabel,
  getProjectLabel,
  matchesGroup,
  matchesStatus,
  parseTopicManagerStatus,
} from './utils';

const createTopic = (metadata: ChatTopic['metadata']): ChatTopic => ({
  createdAt: 1,
  id: 'topic-1',
  metadata,
  title: 'Topic',
  updatedAt: 1,
});

describe('AgentTopicManager utils', () => {
  it('matches project filters by source path while displaying active worktree context', () => {
    const topic = createTopic({
      workingDirectory: '/repo-fix',
      workingDirectoryConfig: {
        git: { activeWorktree: '/repo-fix', branch: 'fix', isWorktree: true },
        path: '/repo',
        repoType: 'git',
      },
    });

    expect(matchesGroup(topic, ['/repo'])).toBe(true);
    expect(matchesGroup(topic, ['/repo-fix'])).toBe(false);
    expect(getProjectFilterLabel(topic)).toBe('repo');
    expect(getProjectLabel(topic)).toBe('repo/repo-fix · fix');
  });

  it('parses the completed route filter and safely falls back for invalid query values', () => {
    expect(parseTopicManagerStatus('completed')).toBe('completed');
    expect(parseTopicManagerStatus(['completed'])).toBe('active');
    expect(parseTopicManagerStatus('unknown')).toBe('active');
  });

  it('treats completed and legacy archived topics as recoverable archives', () => {
    const topics = [
      createTopic(undefined),
      { ...createTopic(undefined), id: 'completed', status: 'completed' as const },
      { ...createTopic(undefined), id: 'archived', status: 'archived' as const },
    ];

    expect(matchesStatus(topics[1], 'completed')).toBe(true);
    expect(matchesStatus(topics[2], 'completed')).toBe(true);
    expect(areAllTopicsArchived(topics, ['completed', 'archived'])).toBe(true);
    expect(areAllTopicsArchived(topics, ['completed', 'active'])).toBe(false);
  });
});
