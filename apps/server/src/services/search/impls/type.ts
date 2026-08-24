import { type SearchParams, type UniformSearchResponse } from '@lobechat/types';

/**
 * Search service implementation interface.
 */
export interface SearchServiceImpl {
  /**
   * The provider already exhausts its own engine candidates. Do not retry the
   * same provider by removing engine/category restrictions, because doing so
   * can silently fall back to a lower-quality aggregate.
   */
  handlesSearchEngineFailover?: boolean;

  /**
   * Query for search results
   */
  query: (query: string, params?: SearchParams) => Promise<UniformSearchResponse>;

  /**
   * The provider selects the best engine itself. Do not forward explicit engine
   * restrictions or retry by removing them.
   */
  useAutoSearchEngineSelection?: boolean;
}
