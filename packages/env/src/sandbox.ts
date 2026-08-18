import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const getSandboxConfig = () => {
  return createEnv({
    runtimeEnv: {
      ONLYBOXES_BASE_URL: process.env.ONLYBOXES_BASE_URL,
      ONLYBOXES_JIT_ISSUER: process.env.ONLYBOXES_JIT_ISSUER,
      ONLYBOXES_JIT_SIGNING_KEY: process.env.ONLYBOXES_JIT_SIGNING_KEY,
      ONLYBOXES_JIT_TTL_SEC: process.env.ONLYBOXES_JIT_TTL_SEC,
      ONLYBOXES_LEASE_TTL_SEC: process.env.ONLYBOXES_LEASE_TTL_SEC,
      HOST_EXECUTOR_BASE_URL: process.env.HOST_EXECUTOR_BASE_URL,
      HOST_EXECUTOR_TOKEN: process.env.HOST_EXECUTOR_TOKEN,
      SANDBOX_PROVIDER: process.env.SANDBOX_PROVIDER,
    },
    server: {
      ONLYBOXES_BASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
      ONLYBOXES_JIT_ISSUER: z.preprocess(emptyStringToUndefined, z.string().optional()),
      ONLYBOXES_JIT_SIGNING_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
      ONLYBOXES_JIT_TTL_SEC: z.preprocess(
        emptyStringToUndefined,
        z.coerce.number().int().positive().optional(),
      ),
      ONLYBOXES_LEASE_TTL_SEC: z.preprocess(emptyStringToUndefined, z.coerce.number().optional()),
      HOST_EXECUTOR_BASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
      HOST_EXECUTOR_TOKEN: z.preprocess(emptyStringToUndefined, z.string().min(32).optional()),
      SANDBOX_PROVIDER: z.preprocess(
        emptyStringToUndefined,
        z.enum(['host', 'market', 'onlyboxes']).optional(),
      ),
    },
  });
};

export const sandboxEnv = getSandboxConfig();
