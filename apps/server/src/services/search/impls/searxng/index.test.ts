// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { SearXNGClient } from './client';
import { hetongxue } from './fixtures/searXNG';
import { SearXNGImpl } from './index';

vi.mock('@/envs/tools', () => ({
  toolsEnv: {
    SEARXNG_ENGINE_FALLBACKS: undefined,
    SEARXNG_URL: 'https://demo.com',
  },
}));

describe('SearXNGImpl', () => {
  describe('query', () => {
    it('搜索结果超过10个', async () => {
      vi.spyOn(SearXNGClient.prototype, 'searchWithEngineFallback').mockResolvedValueOnce(
        hetongxue,
      );

      const searchImpl = new SearXNGImpl();
      const results = await searchImpl.query('何同学');

      // Assert
      expect(results.results.length).toEqual(43);
    });

    it('returns an empty response when individual upstream engines are unavailable', async () => {
      vi.spyOn(SearXNGClient.prototype, 'searchWithEngineFallback').mockResolvedValueOnce({
        ...hetongxue,
        number_of_results: 0,
        results: [],
        unresponsive_engines: [
          ['brave', 'Too many requests'],
          ['duckduckgo', 'CAPTCHA'],
        ],
      });

      const searchImpl = new SearXNGImpl();
      const results = await searchImpl.query('test');

      expect(results.errorDetail).toBeUndefined();
      expect(results.results).toEqual([]);
    });

    it('passes the configured engine priority to the client', async () => {
      const { toolsEnv } = await import('@/envs/tools');
      vi.mocked(toolsEnv).SEARXNG_ENGINE_FALLBACKS = 'google cse， bing, duckduckgo web, yahoo';
      const searchSpy = vi
        .spyOn(SearXNGClient.prototype, 'searchWithEngineFallback')
        .mockResolvedValueOnce(hetongxue);

      const searchImpl = new SearXNGImpl();
      await searchImpl.query('test');

      expect(searchSpy).toHaveBeenCalledWith('test', {
        categories: undefined,
        engines: undefined,
        preferredEngines: ['google cse', 'bing', 'duckduckgo web', 'yahoo'],
        time_range: undefined,
      });
    });
  });
});
