import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Define the 'users' table (using Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  avatar: text('avatar'),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define 'collaborators' table
export const collaborators = pgTable('collaborators', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  name: text('name').notNull(),
  login: text('login'),
  registration: text('registration'),
  shift: text('shift').default('T2'),
  scale: text('scale').default('A'),
  role: text('role').default('Operador'),
  activeTaskId: text('active_task_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define 'presence_records' table
export const presenceRecords = pgTable('presence_records', {
  id: serial('id').primaryKey(),
  collaboratorId: text('collaborator_id').notNull(),
  name: text('name').notNull(),
  login: text('login'),
  registration: text('registration'),
  shift: text('shift'),
  scale: text('scale'),
  role: text('role'),
  status: text('status').notNull(), // 'presente', 'atraso', 'ausente', 'folga', 'ferias', etc.
  reason: text('reason'),
  date: text('date').notNull(), // YYYY-MM-DD
  source: text('source').default('web_app'),
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define 'operational_tasks' table
export const operationalTasks = pgTable('operational_tasks', {
  id: serial('id').primaryKey(),
  taskId: text('task_id').notNull().unique(),
  name: text('name').notNull(),
  area: text('area').default('Operação'),
  requiredCapacity: integer('required_capacity').default(0),
  members: jsonb('members').$type<string[]>().default([]),
  externalUrl: text('external_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define 'service_requests' table
export const serviceRequests = pgTable('service_requests', {
  id: serial('id').primaryKey(),
  requestId: text('request_id').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requesterName: text('requester_name').notNull(),
  status: text('status').default('pendente'),
  priority: text('priority').default('media'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define 'workspace_integrations' table for Google Workspace linkings
export const workspaceIntegrations = pgTable('workspace_integrations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  service: text('service').notNull(), // 'calendar', 'tasks', 'slides', 'sheets', 'chat'
  resourceId: text('resource_id'),
  resourceName: text('resource_name'),
  metadata: jsonb('metadata'),
  lastSyncedAt: timestamp('last_synced_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  workspaceIntegrations: many(workspaceIntegrations),
}));

export const workspaceIntegrationsRelations = relations(workspaceIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [workspaceIntegrations.userId],
    references: [users.id],
  }),
}));
