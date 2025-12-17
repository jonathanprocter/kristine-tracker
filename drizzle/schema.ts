import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  currentWeek: int("currentWeek").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Weekly tasks in the 9+ week protocol
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  weekNumber: int("weekNumber").notNull(),
  taskName: varchar("taskName", { length: 255 }).notNull(),
  taskDescription: text("taskDescription").notNull(),
  goalDays: int("goalDays").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Daily check-in entries
 */
export const entries = mysqlTable("entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskId: int("taskId").notNull(),
  weekNumber: int("weekNumber").notNull(),
  completed: boolean("completed").default(false).notNull(),
  anxietyLevel: int("anxietyLevel").notNull(),
  guiltLevel: int("guiltLevel").notNull(),
  activityDescription: text("activityDescription"),
  observationAboutBrian: text("observationAboutBrian"),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("entries_userId_idx").on(table.userId),
  userWeekIdx: index("entries_userId_weekNumber_idx").on(table.userId, table.weekNumber),
}));

export type Entry = typeof entries.$inferSelect;
export type InsertEntry = typeof entries.$inferInsert;

/**
 * Accommodation log (Weeks 1-2 only)
 */
export const accommodations = mysqlTable("accommodations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  loggedAt: timestamp("loggedAt").notNull(),
  timeOfDay: varchar("timeOfDay", { length: 10 }).notNull(),
  whatDid: text("whatDid").notNull(),
  couldHeDoIt: mysqlEnum("couldHeDoIt", ["yes", "no", "maybe"]).notNull(),
  whatFelt: text("whatFelt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("accommodations_userId_idx").on(table.userId),
}));

export type Accommodation = typeof accommodations.$inferSelect;
export type InsertAccommodation = typeof accommodations.$inferInsert;

/**
 * Weekly reflections with guided questions
 */
export const reflections = mysqlTable("reflections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  weekNumber: int("weekNumber").notNull(),
  question1Answer: text("question1Answer"),
  question2Answer: text("question2Answer"),
  question3Answer: text("question3Answer"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("reflections_userId_idx").on(table.userId),
  userWeekIdx: index("reflections_userId_weekNumber_idx").on(table.userId, table.weekNumber),
}));

export type Reflection = typeof reflections.$inferSelect;
export type InsertReflection = typeof reflections.$inferInsert;

/**
 * Login activity tracking for admin monitoring
 */
export const loginActivity = mysqlTable("loginActivity", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  loggedInAt: timestamp("loggedInAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("loginActivity_userId_idx").on(table.userId),
}));

export type LoginActivity = typeof loginActivity.$inferSelect;
export type InsertLoginActivity = typeof loginActivity.$inferInsert;

/**
 * Free-form journal entries with AI responses
 */
export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  aiResponse: text("aiResponse"),
  mood: varchar("mood", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("journalEntries_userId_idx").on(table.userId),
}));

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
