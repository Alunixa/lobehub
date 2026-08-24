import qs from 'query-string';
import urlJoin from 'url-join';

const ENGINE_CONFIG_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 25_000;

export const DEFAULT_GENERAL_ENGINE_FALLBACKS = [
  'google cse',
  'bing',
  'duckduckgo web',
  'yahoo',
  'naver',
] as const;

const CATEGORY_ENGINE_FALLBACKS: Record<string, string[]> = {
  images: ['bing images', 'google cse images', 'duckduckgo images', 'naver images'],
  news: ['google news', 'bing news', 'duckduckgo news', 'yahoo', 'naver news'],
  science: ['google scholar', 'arxiv', 'pubmed'],
  videos: ['bing videos', 'duckduckgo videos', 'naver videos', 'youtube'],
};

const ENGINE_ALIASES: Record<string, string[]> = {
  'duckduckgo': ['duckduckgo', 'duckduckgo web'],
  'google': ['google', 'google cse'],
  'yahoo japan': ['yahoo'],
  'yahoo_japan': ['yahoo'],
};

const STATIC_ENGINE_CONFIGS: SearXNGEngineConfig[] = [
  { categories: ['general'], name: 'google cse', shortcut: 'goc', timeRangeSupport: true },
  { categories: ['general'], name: 'bing', shortcut: 'bi', timeRangeSupport: false },
  { categories: ['general'], name: 'duckduckgo', shortcut: 'ddg', timeRangeSupport: true },
  { categories: ['general'], name: 'duckduckgo web', shortcut: 'ddgw', timeRangeSupport: false },
  { categories: ['general'], name: 'yahoo', shortcut: 'yh', timeRangeSupport: true },
  { categories: ['general'], name: 'naver', shortcut: 'nvr', timeRangeSupport: true },
];

export interface SearXNGEngineConfig {
  categories: string[];
  name: string;
  shortcut: string;
  timeRangeSupport: boolean;
}

export interface SearXNGSearchOptions {
  categories?: string[];
  engines?: string[];
  preferredEngines?: string[];
  time_range?: string;
}

export interface SearXNGSearchResult {
  category: string;
  content?: string;
  engine: string;
  engines: string[];
  iframe_src?: string;
  img_src?: string;
  parsed_url: string[];
  positions: number[];
  publishedDate?: string | null;
  score: number;
  template: string;
  thumbnail?: string | null;
  thumbnail_src?: string | null;
  title: string;
  url: string;
}

export interface SearXNGSearchResponse {
  answers: any[];
  corrections: any[];
  infoboxes: any[];
  number_of_results: number;
  query: string;
  results: SearXNGSearchResult[];
  suggestions: string[];
  unresponsive_engines: unknown[];
}

interface SearXNGConfigEngine {
  categories?: string[];
  name?: string;
  shortcut?: string;
  time_range_support?: boolean;
}

interface SearXNGConfigResponse {
  engines?: SearXNGConfigEngine[];
}

const normalizeEngineName = (name: string) => name.trim().toLowerCase();

const dedupe = (values: string[]) => Array.from(new Set(values));

const isConfiguredEngine = (
  engine: SearXNGConfigEngine,
): engine is SearXNGConfigEngine & { name: string; shortcut: string } =>
  !!engine.name?.trim() && !!engine.shortcut?.trim();

const getUnresponsiveEngineReason = (items: unknown[], engineName: string) => {
  const expectedName = normalizeEngineName(engineName);

  for (const item of items) {
    if (Array.isArray(item)) {
      const [name, reason] = item;
      if (normalizeEngineName(String(name ?? '')) === expectedName)
        return String(reason ?? 'error');
      continue;
    }

    if (item && typeof item === 'object') {
      const data = item as Record<string, unknown>;
      const name = data.engine ?? data.name;
      if (normalizeEngineName(String(name ?? '')) !== expectedName) continue;

      return String(data.error ?? data.reason ?? data.message ?? 'error');
    }
  }
};

const resultBelongsToEngine = (result: SearXNGSearchResult, engineName: string) => {
  const expectedName = normalizeEngineName(engineName);
  const engines = result.engines?.length ? result.engines : [result.engine];

  return engines.some((engine) => normalizeEngineName(engine ?? '') === expectedName);
};

export class SearXNGClient {
  private baseUrl: string;
  private engineConfigCache?: { engines: SearXNGEngineConfig[]; expiresAt: number };

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getEngineConfigs(): Promise<SearXNGEngineConfig[]> {
    if (this.engineConfigCache && this.engineConfigCache.expiresAt > Date.now()) {
      return this.engineConfigCache.engines;
    }

    try {
      const response = await fetch(urlJoin(this.baseUrl, '/config'), {
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Failed to load SearXNG config: ${response.status}`);

      const config = (await response.json()) as SearXNGConfigResponse;
      const engines = (config.engines ?? []).filter(isConfiguredEngine).map((engine) => ({
        categories: engine.categories ?? [],
        name: normalizeEngineName(engine.name),
        shortcut: engine.shortcut.trim(),
        timeRangeSupport: engine.time_range_support === true,
      }));

      if (engines.length === 0) throw new Error('SearXNG config contains no engines');

      this.engineConfigCache = {
        engines,
        expiresAt: Date.now() + ENGINE_CONFIG_CACHE_TTL_MS,
      };
      return engines;
    } catch {
      // Keep the core no-account fallbacks usable when /config is temporarily
      // unavailable. These shortcuts are stable SearXNG defaults.
      return STATIC_ENGINE_CONFIGS;
    }
  }

  private resolveEngineCandidates(configs: SearXNGEngineConfig[], options: SearXNGSearchOptions) {
    const byName = new Map(configs.map((engine) => [normalizeEngineName(engine.name), engine]));
    const requestedNames = options.engines?.length
      ? options.engines.flatMap((name) => {
          const normalized = normalizeEngineName(name);
          return ENGINE_ALIASES[normalized] ?? [normalized];
        })
      : options.categories?.length && !options.categories.includes('general')
        ? options.categories.flatMap((category) => CATEGORY_ENGINE_FALLBACKS[category] ?? [])
        : options.preferredEngines?.length
          ? options.preferredEngines
          : [...DEFAULT_GENERAL_ENGINE_FALLBACKS];

    return dedupe(requestedNames.map(normalizeEngineName))
      .map((name) => byName.get(name))
      .filter((engine): engine is SearXNGEngineConfig => !!engine);
  }

  async searchWithEngineFallback(
    query: string,
    options: SearXNGSearchOptions = {},
  ): Promise<SearXNGSearchResponse> {
    const configs = await this.getEngineConfigs();
    const candidates = this.resolveEngineCandidates(configs, options);

    // Specialized/custom deployments may not expose any of the known engine
    // names. Preserve compatibility by using the ordinary aggregate request.
    if (candidates.length === 0) return this.search(query, options);

    const failures: string[] = [];
    let cleanEmptyResponse: SearXNGSearchResponse | undefined;

    for (const engine of candidates) {
      try {
        const data = await this.search(`!${engine.shortcut} ${query}`, {
          ...(options.time_range && engine.timeRangeSupport
            ? { time_range: options.time_range }
            : {}),
        });
        const results = data.results.filter((result) => resultBelongsToEngine(result, engine.name));

        if (results.length > 0) {
          return {
            ...data,
            number_of_results: results.length,
            results,
          };
        }

        const reason = getUnresponsiveEngineReason(data.unresponsive_engines, engine.name);
        if (reason) {
          failures.push(`${engine.name}: ${reason}`);
          continue;
        }

        cleanEmptyResponse = {
          ...data,
          number_of_results: 0,
          results: [],
        };
      } catch (error) {
        failures.push(`${engine.name}: ${(error as Error).message}`);
      }
    }

    // A clean zero-result response is not a provider outage. Only surface an
    // error when every candidate failed due to timeout/CAPTCHA/rate-limit/etc.
    if (cleanEmptyResponse) return cleanEmptyResponse;

    throw new Error(`SearXNG search engines unavailable: ${failures.join('; ')}`);
  }

  async search(
    query: string,
    optionalParams: Record<string, any> = {},
  ): Promise<SearXNGSearchResponse> {
    try {
      const { time_range, ...otherParams } = optionalParams;

      const processedParams = Object.entries(otherParams).reduce<Record<string, any>>(
        (acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value.join(',') : value;
          return acc;
        },
        {},
      );

      const searchParams = qs.stringify({
        ...processedParams,
        ...(time_range !== 'anytime' && { time_range }),
        format: 'json',
        q: query,
      });

      const response = await fetch(urlJoin(this.baseUrl, `/search?${searchParams}`), {
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });

      if (response.ok) {
        return await response.json();
      }

      const body = await response.text().catch(() => '');

      // SearXNG returns 500 for empty results, treat as normal empty response
      if (body.toLowerCase().includes('empty results')) {
        return {
          answers: [],
          corrections: [],
          infoboxes: [],
          number_of_results: 0,
          query,
          results: [],
          suggestions: [],
          unresponsive_engines: [],
        };
      }

      throw new Error(
        `Failed to search: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
      );
    } catch (error) {
      console.error('Error searching:', error);
      throw error;
    }
  }
}
