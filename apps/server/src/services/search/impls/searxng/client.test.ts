// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearXNGClient } from './client';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SearXNGClient', () => {
  let client: SearXNGClient;

  beforeEach(() => {
    client = new SearXNGClient('https://searxng.example.com');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return results on successful response', async () => {
    const mockResponse = {
      answers: [],
      corrections: [],
      infoboxes: [],
      number_of_results: 1,
      query: 'test',
      results: [{ title: 'Test', url: 'https://example.com' }],
      suggestions: [],
      unresponsive_engines: [],
    };

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
      ok: true,
    });

    const result = await client.search('test');
    expect(result).toEqual(mockResponse);
  });

  it('should return empty response when SearXNG 500 body contains "empty results"', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('SearxNG returned empty results'),
    });

    const result = await client.search('杭州天气');

    expect(result).toEqual({
      answers: [],
      corrections: [],
      infoboxes: [],
      number_of_results: 0,
      query: '杭州天气',
      results: [],
      suggestions: [],
      unresponsive_engines: [],
    });
  });

  it('should return empty response when body contains "Empty Results" (case insensitive)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () =>
        Promise.resolve('{"error":"Search failed","message":"SearxNG returned Empty Results"}'),
    });

    const result = await client.search('test query');

    expect(result.results).toEqual([]);
    expect(result.number_of_results).toBe(0);
  });

  it('should throw error for non-empty-results 500 responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('something went wrong'),
    });

    await expect(client.search('test')).rejects.toThrow(
      'Failed to search: 500 Internal Server Error - something went wrong',
    );
  });

  it('should include response body in error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: () => Promise.resolve('upstream timeout'),
    });

    await expect(client.search('test')).rejects.toThrow(
      'Failed to search: 502 Bad Gateway - upstream timeout',
    );
  });

  it('should handle text() failure gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.reject(new Error('read failed')),
    });

    await expect(client.search('test')).rejects.toThrow(
      'Failed to search: 500 Internal Server Error',
    );
  });

  describe('searchWithEngineFallback', () => {
    const configResponse = (engines: Array<Record<string, unknown>>) => ({
      json: () => Promise.resolve({ engines }),
      ok: true,
    });

    const searchResponse = (data: Record<string, unknown>) => ({
      json: () =>
        Promise.resolve({
          answers: [],
          corrections: [],
          infoboxes: [],
          number_of_results: 0,
          query: 'test',
          results: [],
          suggestions: [],
          unresponsive_engines: [],
          ...data,
        }),
      ok: true,
    });

    it('retries the next engine when the primary engine is unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce(
          configResponse([
            {
              categories: ['general'],
              name: 'google cse',
              shortcut: 'goc',
              time_range_support: true,
            },
            {
              categories: ['general'],
              name: 'bing',
              shortcut: 'bi',
              time_range_support: false,
            },
          ]),
        )
        // A suspended bang may leak aggregate results. None belong to Google,
        // so they must not short-circuit the Bing retry.
        .mockResolvedValueOnce(
          searchResponse({
            results: [
              {
                engine: 'yandex',
                engines: ['yandex'],
                title: 'Stale fallback',
                url: 'https://stale.example',
              },
            ],
            unresponsive_engines: [['google cse', 'CAPTCHA']],
          }),
        )
        .mockResolvedValueOnce(
          searchResponse({
            number_of_results: 1,
            results: [
              {
                engine: 'bing',
                engines: ['bing'],
                title: 'Fresh Bing result',
                url: 'https://fresh.example',
              },
            ],
          }),
        );

      const result = await client.searchWithEngineFallback('test');

      expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get('q')).toBe('!goc test');
      expect(new URL(mockFetch.mock.calls[2][0]).searchParams.get('q')).toBe('!bi test');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].engines).toEqual(['bing']);
    });

    it('maps generic engine aliases to available no-account engines', async () => {
      mockFetch
        .mockResolvedValueOnce(
          configResponse([
            { name: 'google cse', shortcut: 'goc', time_range_support: true },
            { name: 'yahoo', shortcut: 'yh', time_range_support: true },
          ]),
        )
        .mockResolvedValueOnce(
          searchResponse({
            results: [
              {
                engine: 'google cse',
                engines: ['google cse'],
                title: 'Google result',
                url: 'https://google.example',
              },
            ],
          }),
        );

      await client.searchWithEngineFallback('test', {
        engines: ['google', 'yahoo japan'],
      });

      expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get('q')).toBe('!goc test');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('only throws when every candidate engine fails', async () => {
      mockFetch
        .mockResolvedValueOnce(
          configResponse([
            { name: 'google cse', shortcut: 'goc' },
            { name: 'bing', shortcut: 'bi' },
          ]),
        )
        .mockResolvedValueOnce(
          searchResponse({ unresponsive_engines: [['google cse', 'timeout']] }),
        )
        .mockResolvedValueOnce(
          searchResponse({ unresponsive_engines: [['bing', 'too many requests']] }),
        );

      await expect(
        client.searchWithEngineFallback('test', {
          preferredEngines: ['google cse', 'bing'],
        }),
      ).rejects.toThrow(
        'SearXNG search engines unavailable: google cse: timeout; bing: too many requests',
      );
    });

    it('returns a clean empty result instead of an error when at least one engine responds', async () => {
      mockFetch
        .mockResolvedValueOnce(
          configResponse([
            { name: 'google cse', shortcut: 'goc' },
            { name: 'bing', shortcut: 'bi' },
          ]),
        )
        .mockResolvedValueOnce(searchResponse({}))
        .mockResolvedValueOnce(
          searchResponse({ unresponsive_engines: [['bing', 'too many requests']] }),
        );

      const result = await client.searchWithEngineFallback('no matches', {
        preferredEngines: ['google cse', 'bing'],
      });

      expect(result.results).toEqual([]);
      expect(result.number_of_results).toBe(0);
    });

    it('omits time_range for engines that do not support it', async () => {
      mockFetch
        .mockResolvedValueOnce(
          configResponse([{ name: 'bing', shortcut: 'bi', time_range_support: false }]),
        )
        .mockResolvedValueOnce(
          searchResponse({
            results: [
              {
                engine: 'bing',
                engines: ['bing'],
                title: 'Bing result',
                url: 'https://bing.example',
              },
            ],
          }),
        );

      await client.searchWithEngineFallback('test', {
        engines: ['bing'],
        time_range: 'week',
      });

      expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get('time_range')).toBeNull();
    });
  });
});
