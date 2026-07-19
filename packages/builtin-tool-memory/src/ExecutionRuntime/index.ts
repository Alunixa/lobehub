import type {
  ActivityMemoryItemSchema,
  AddIdentityActionSchema,
  ContextMemoryItemSchema,
  ExperienceMemoryItemSchema,
  PreferenceMemoryItemSchema,
  RemoveIdentityActionSchema,
  UpdateIdentityActionSchema,
} from '@lobechat/memory-user-memory/schemas';
import { formatMemorySearchResults } from '@lobechat/prompts';
import type {
  AddActivityMemoryResult,
  AddContextMemoryResult,
  AddExperienceMemoryResult,
  AddIdentityMemoryResult,
  AddPreferenceMemoryResult,
  BuiltinServerRuntimeOutput,
  QueryTaxonomyOptionsParams,
  QueryTaxonomyOptionsResult,
  RemoveIdentityMemoryResult,
  SearchMemoryParams,
  SearchMemoryResult,
  UpdateIdentityMemoryResult,
} from '@lobechat/types';
import { getErrorMessage } from '@lobechat/utils/error';
import type { z } from 'zod';

export interface MemoryRuntimeService {
  addActivityMemory: (
    params: z.infer<typeof ActivityMemoryItemSchema>,
  ) => Promise<AddActivityMemoryResult>;
  addContextMemory: (
    params: z.infer<typeof ContextMemoryItemSchema>,
  ) => Promise<AddContextMemoryResult>;
  addExperienceMemory: (
    params: z.infer<typeof ExperienceMemoryItemSchema>,
  ) => Promise<AddExperienceMemoryResult>;
  addIdentityMemory: (
    params: z.infer<typeof AddIdentityActionSchema>,
  ) => Promise<AddIdentityMemoryResult>;
  addPreferenceMemory: (
    params: z.infer<typeof PreferenceMemoryItemSchema>,
  ) => Promise<AddPreferenceMemoryResult>;
  queryTaxonomyOptions: (params: QueryTaxonomyOptionsParams) => Promise<QueryTaxonomyOptionsResult>;
  removeIdentityMemory: (
    params: z.infer<typeof RemoveIdentityActionSchema>,
  ) => Promise<RemoveIdentityMemoryResult>;
  searchMemory: (params: SearchMemoryParams) => Promise<SearchMemoryResult>;
  updateIdentityMemory: (
    params: z.infer<typeof UpdateIdentityActionSchema>,
  ) => Promise<UpdateIdentityMemoryResult>;
}

export type MemoryToolPermission = 'read-only' | 'read-write';

export interface MemoryExecutionRuntimeOptions {
  service: MemoryRuntimeService;
  toolPermission?: MemoryToolPermission;
}

const failureResult = (message: string): BuiltinServerRuntimeOutput => ({
  content: message,
  error: { message },
  success: false,
});

const READ_ONLY_RESULT = failureResult('Memory tool is in read-only mode for this chat');

export class MemoryExecutionRuntime {
  private service: MemoryRuntimeService;
  private toolPermission: MemoryToolPermission;

  constructor(options: MemoryExecutionRuntimeOptions) {
    this.service = options.service;
    this.toolPermission = options.toolPermission ?? 'read-write';
  }

  private get isReadOnly() {
    return this.toolPermission === 'read-only';
  }

  async searchUserMemory(params: SearchMemoryParams): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = await this.service.searchMemory(params);
      const formattedQuery = params.queries?.join(' | ') || 'facet-only search';

      const { meta: _meta, ...safeResult } = result;

      return {
        content: formatMemorySearchResults({ query: formattedQuery, results: result }),
        state: safeResult,
        success: true,
      };
    } catch (e) {
      return failureResult(`searchUserMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async queryTaxonomyOptions(
    params: QueryTaxonomyOptionsParams,
  ): Promise<BuiltinServerRuntimeOutput> {
    try {
      const result = await this.service.queryTaxonomyOptions(params);

      return {
        content: JSON.stringify(result),
        state: result,
        success: true,
      };
    } catch (e) {
      return failureResult(`queryTaxonomyOptions with error detail: ${getErrorMessage(e)}`);
    }
  }

  async addContextMemory(
    params: z.infer<typeof ContextMemoryItemSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.addContextMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Context memory "${params.title}" saved with memoryId: "${result.memoryId}" and contextId: "${result.contextId}"`,
        state: { contextId: result.contextId, memoryId: result.memoryId },
        success: true,
      };
    } catch (e) {
      return failureResult(`addContextMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async addActivityMemory(
    params: z.infer<typeof ActivityMemoryItemSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.addActivityMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Activity memory "${params.title}" saved with memoryId: "${result.memoryId}" and activityId: "${result.activityId}"`,
        state: { activityId: result.activityId, memoryId: result.memoryId },
        success: true,
      };
    } catch (e) {
      return failureResult(`addActivityMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async addExperienceMemory(
    params: z.infer<typeof ExperienceMemoryItemSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.addExperienceMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Experience memory "${params.title}" saved with memoryId: "${result.memoryId}" and experienceId: "${result.experienceId}"`,
        state: { experienceId: result.experienceId, memoryId: result.memoryId },
        success: true,
      };
    } catch (e) {
      return failureResult(`addExperienceMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async addIdentityMemory(
    params: z.infer<typeof AddIdentityActionSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.addIdentityMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Identity memory "${params.title}" saved with memoryId: "${result.memoryId}" and identityId: "${result.identityId}"`,
        state: { identityId: result.identityId, memoryId: result.memoryId },
        success: true,
      };
    } catch (e) {
      return failureResult(`addIdentityMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async addPreferenceMemory(
    params: z.infer<typeof PreferenceMemoryItemSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.addPreferenceMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Preference memory "${params.title}" saved with memoryId: "${result.memoryId}" and preferenceId: "${result.preferenceId}"`,
        state: { memoryId: result.memoryId, preferenceId: result.preferenceId },
        success: true,
      };
    } catch (e) {
      return failureResult(`addPreferenceMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async updateIdentityMemory(
    params: z.infer<typeof UpdateIdentityActionSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.updateIdentityMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Identity memory updated: ${params.id}`,
        state: { identityId: params.id },
        success: true,
      };
    } catch (e) {
      return failureResult(`updateIdentityMemory with error detail: ${getErrorMessage(e)}`);
    }
  }

  async removeIdentityMemory(
    params: z.infer<typeof RemoveIdentityActionSchema>,
  ): Promise<BuiltinServerRuntimeOutput> {
    if (this.isReadOnly) return READ_ONLY_RESULT;
    try {
      const result = await this.service.removeIdentityMemory(params);

      if (!result.success) {
        return failureResult(result.message);
      }

      return {
        content: `Identity memory removed: ${params.id}\nReason: ${params.reason}`,
        state: { identityId: params.id, reason: params.reason },
        success: true,
      };
    } catch (e) {
      return failureResult(`removeIdentityMemory with error detail: ${getErrorMessage(e)}`);
    }
  }
}
