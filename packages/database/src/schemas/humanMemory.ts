import { index, jsonb, pgTable, real, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamptz } from './_helpers';
import { topics } from './topic';
import { users } from './user';

/**
 * The three compact, user-wide memory slots used by the human memory pipeline.
 *
 * Embeddings are stored as JSON so providers with different dimensions can
 * coexist without making the database schema depend on a single model.
 */
export const userCoreMemories = pgTable('user_core_memory', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  personaTone: text('persona_tone'),
  userCore: text('user_core'),
  activeMatters: text('active_matters'),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export type UserCoreMemoryItem = typeof userCoreMemories.$inferSelect;
export type NewUserCoreMemory = typeof userCoreMemories.$inferInsert;

export const userEpisodicMemories = pgTable(
  'user_episodic_memories',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceTopicId: text('source_topic_id').references(() => topics.id, {
      onDelete: 'set null',
    }),
    content: text('content').notNull(),
    embedding: jsonb('embedding').$type<number[]>(),
    importance: real('importance').notNull().default(0.5),
    strengthS: real('strength_s').notNull().default(7),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastRecalledAt: timestamptz('last_recalled_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_episodic_memories_user_id_idx').on(table.userId),
    index('user_episodic_memories_user_recalled_idx').on(table.userId, table.lastRecalledAt),
    index('user_episodic_memories_source_topic_id_idx').on(table.sourceTopicId),
  ],
);

export type UserEpisodicMemoryItem = typeof userEpisodicMemories.$inferSelect;
export type NewUserEpisodicMemory = typeof userEpisodicMemories.$inferInsert;
