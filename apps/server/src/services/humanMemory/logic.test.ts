import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';

import {
  applyCoreMemoryOperations,
  buildHumanMemoryPrompt,
  buildRecentMemoryWindow,
  cosineSimilarity,
  MAX_CORE_MEMORY_TOKENS,
  rankEpisodicMemories,
  sanitizeHumanMemoryText,
  textSimilarity,
} from './logic';

const memory = (
  overrides: Partial<Parameters<typeof rankEpisodicMemories>[0]['memories'][number]>,
) => ({
  content: '用户喜欢在周末徒步',
  id: 'memory-1',
  importance: 0.7,
  lastRecalledAt: new Date('2026-11-22T00:00:00.000Z'),
  strengthS: 7,
  ...overrides,
});

describe('human memory logic', () => {
  it('ranks by semantic similarity, recency decay and importance', () => {
    const result = rankEpisodicMemories({
      memories: [
        memory({ content: '用户喜欢在周末徒步', id: 'fresh' }),
        memory({
          content: '用户喜欢在周末徒步',
          id: 'old',
          lastRecalledAt: new Date('2025-01-01T00:00:00.000Z'),
        }),
      ],
      now: new Date('2026-11-23T00:00:00.000Z'),
      query: '周末徒步',
    });

    expect(result[0]?.id).toBe('fresh');
    expect(result[0]?.finalScore).toBeGreaterThan(result[1]?.finalScore ?? 0);
  });

  it('does not inject an unrelated memory during ordinary chat', () => {
    const result = rankEpisodicMemories({
      memories: [memory({ content: '用户的猫叫小雪' })],
      now: new Date('2026-11-23T00:00:00.000Z'),
      query: '帮我解释一下二分查找',
    });

    expect(result).toHaveLength(0);
  });

  it('wakes an old memory when vector similarity crosses the semantic threshold', () => {
    const result = rankEpisodicMemories({
      memories: [memory({ content: '很久以前记录的旅行计划', embedding: [1, 0] })],
      now: new Date('2026-11-23T00:00:00.000Z'),
      query: '完全不同的文字',
      queryEmbedding: [1, 0],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.semanticSim).toBe(1);
  });

  it('limits the recalled memories to the top three', () => {
    const result = rankEpisodicMemories({
      limit: 3,
      memories: Array.from({ length: 6 }, (_, index) =>
        memory({ content: `用户喜欢徒步路线 ${index}`, id: `memory-${index}` }),
      ),
      query: '用户喜欢徒步',
    });

    expect(result).toHaveLength(3);
  });

  it('keeps only the configured recent message window', () => {
    const messages = Array.from({ length: 10 }, (_, index) => index);
    expect(buildRecentMemoryWindow(messages, 2)).toEqual([6, 7, 8, 9]);
  });

  it('merges core memory ADD operations without duplicating facts', () => {
    const result = applyCoreMemoryOperations(
      {
        activeMatters: null,
        personaTone: '简洁',
        userCore: '住在新加坡',
      },
      [
        { action: 'ADD', content: '住在新加坡', slot: 'userCore' },
        { action: 'ADD', content: '喜欢 TypeScript', slot: 'userCore' },
      ],
    );

    expect(result.userCore).toBe('住在新加坡\n喜欢 TypeScript');
  });

  it('replaces a core memory slot when requested', () => {
    const result = applyCoreMemoryOperations(
      { activeMatters: '旧计划', personaTone: null, userCore: null },
      [{ action: 'REPLACE', content: '新计划', slot: 'activeMatters' }],
    );

    expect(result.activeMatters).toBe('新计划');
  });

  it('builds a naturalized prompt without exposing retrieval mechanics', () => {
    const prompt = buildHumanMemoryPrompt({
      coreMemory: {
        activeMatters: '正在做项目',
        personaTone: '简洁',
        userCore: '喜欢 TypeScript',
      },
      recalledMemories: [{ content: '曾经完成过一个迁移项目' }],
    });

    expect(prompt).toContain('[Core Memory]');
    expect(prompt).toContain('[Recalled Long-Term Memory]');
    expect(prompt).toContain('Do not mention memory');
    expect(prompt).not.toContain('检索记录');
  });

  it('provides stable bounded fallbacks for text and vector similarity', () => {
    expect(textSimilarity('周末徒步', '用户喜欢在周末徒步')).toBeGreaterThan(0.5);
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1], [1, 0])).toBeUndefined();
  });

  it('never recalls a fresh maximally important but unrelated fact for hi', () => {
    const now = new Date();
    expect(
      rankEpisodicMemories({
        memories: [memory({ content: '用户部署了项目', importance: 1, lastRecalledAt: now })],
        now,
        query: 'hi',
      }),
    ).toEqual([]);
  });

  it('retains complete turns including tool calls and assistant retries', () => {
    const messages = [
      { role: 'user', id: 'u1' },
      { role: 'assistant', id: 'a1' },
      { role: 'tool', id: 't1' },
      { role: 'assistant', id: 'retry' },
      { role: 'user', id: 'u2' },
    ];
    expect(buildRecentMemoryWindow(messages, 2)).toEqual(messages);
    expect(buildRecentMemoryWindow(messages, 1)).toEqual([messages[4]]);
  });

  it('bounds the complete Core prompt using tokens rather than characters per slot', () => {
    const prompt = buildHumanMemoryPrompt({
      coreMemory: {
        personaTone: '语气'.repeat(3200),
        userCore: '事实'.repeat(3200),
        activeMatters: '计划'.repeat(3200),
      },
      recalledMemories: [],
    });
    expect(estimateTokenCount(prompt)).toBeLessThan(MAX_CORE_MEMORY_TOKENS + 100);
    expect(prompt).toContain('Persona and tone:');
    expect(prompt).toContain('User profile:');
    expect(prompt).toContain('Active matters:');
  });

  it('removes image URLs and encoded payloads before memory processing', () => {
    const base64 = 'B'.repeat(160);
    const result = sanitizeHumanMemoryText(
      `记住我喜欢徒步 ![image](https://cdn.example.test/hike.png) data:image/png;base64,${base64}`,
    );

    expect(result).toBe('记住我喜欢徒步');
    expect(result).not.toContain('cdn.example.test');
    expect(result).not.toContain('data:image');
  });
});
