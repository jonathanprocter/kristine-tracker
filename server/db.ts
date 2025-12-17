import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  tasks, 
  Task,
  InsertTask,
  entries, 
  Entry,
  InsertEntry,
  accommodations,
  Accommodation,
  InsertAccommodation,
  reflections,
  Reflection,
  InsertReflection,
  loginActivity,
  LoginActivity,
  InsertLoginActivity,
  journalEntries,
  JournalEntry,
  InsertJournalEntry
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserWeek(userId: number, weekNumber: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users).set({ currentWeek: weekNumber }).where(eq(users.id, userId));
}

// Task queries
export async function getTaskByWeek(weekNumber: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(tasks).where(eq(tasks.weekNumber, weekNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tasks).orderBy(tasks.weekNumber);
}

export async function seedTasks() {
  const db = await getDb();
  if (!db) return;
  
  const existingTasks = await db.select().from(tasks).limit(1);
  if (existingTasks.length > 0) return;
  
  const taskData: InsertTask[] = [
    {
      weekNumber: 1,
      taskName: "The Accommodation Log",
      taskDescription: "Log every accommodation throughout the day. An accommodation is doing something FOR Brian that he could do himself.",
      goalDays: 5,
    },
    {
      weekNumber: 2,
      taskName: "The Accommodation Log",
      taskDescription: "Continue logging every accommodation throughout the day to build awareness of patterns.",
      goalDays: 5,
    },
    {
      weekNumber: 3,
      taskName: "The 15-Minute Exit",
      taskDescription: "Leave the house for 15 minutes daily. Don't announce where/why, just say 'I'm going out for 15 minutes'.",
      goalDays: 4,
    },
    {
      weekNumber: 4,
      taskName: "The 15-Minute Exit",
      taskDescription: "Continue leaving the house for 15 minutes daily to break continuous presence pattern.",
      goalDays: 4,
    },
    {
      weekNumber: 5,
      taskName: "The Self-Care Hour",
      taskDescription: "Take 1 hour daily for self-care activity. This is NON-NEGOTIABLE time, not 'if Brian is okay'.",
      goalDays: 4,
    },
    {
      weekNumber: 6,
      taskName: "The Self-Care Hour",
      taskDescription: "Continue taking 1 hour daily for self-care to reclaim personal time and model healthy behavior.",
      goalDays: 4,
    },
    {
      weekNumber: 7,
      taskName: "The Validation Boundary",
      taskDescription: "Practice 'validate and move on' 3x daily. When Brian says 'I feel anxious', respond 'That sounds uncomfortable' then walk away or change subject.",
      goalDays: 5,
    },
    {
      weekNumber: 8,
      taskName: "The Validation Boundary",
      taskDescription: "Continue practicing validation without accommodation to support Brian emotionally without enabling.",
      goalDays: 5,
    },
    {
      weekNumber: 9,
      taskName: "The Bedroom Return",
      taskDescription: "Sleep in your own bed (not on couch with Brian). Announce once, then do it consistently without negotiation.",
      goalDays: 6,
    },
  ];
  
  await db.insert(tasks).values(taskData);
}

// Entry queries
export async function createEntry(entry: InsertEntry): Promise<Entry> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(entries).values(entry);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(entries).where(eq(entries.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getEntriesByUser(userId: number): Promise<Entry[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(entries).where(eq(entries.userId, userId)).orderBy(desc(entries.completedAt));
}

export async function getEntriesByUserAndWeek(userId: number, weekNumber: number): Promise<Entry[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.weekNumber, weekNumber)))
    .orderBy(desc(entries.completedAt));
}

export async function getEntriesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Entry[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(entries)
    .where(and(
      eq(entries.userId, userId),
      gte(entries.completedAt, startDate),
      lte(entries.completedAt, endDate)
    ))
    .orderBy(desc(entries.completedAt));
}

// Accommodation queries
export async function createAccommodation(accommodation: InsertAccommodation): Promise<Accommodation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accommodations).values(accommodation);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(accommodations).where(eq(accommodations.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getAccommodationsByUser(userId: number): Promise<Accommodation[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(accommodations)
    .where(eq(accommodations.userId, userId))
    .orderBy(desc(accommodations.loggedAt));
}

export async function getAccommodationsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Accommodation[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(accommodations)
    .where(and(
      eq(accommodations.userId, userId),
      gte(accommodations.loggedAt, startDate),
      lte(accommodations.loggedAt, endDate)
    ))
    .orderBy(desc(accommodations.loggedAt));
}

// Reflection queries
export async function createReflection(reflection: InsertReflection): Promise<Reflection> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reflections).values(reflection);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(reflections).where(eq(reflections.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getReflectionsByUser(userId: number): Promise<Reflection[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(reflections)
    .where(eq(reflections.userId, userId))
    .orderBy(desc(reflections.weekNumber));
}

export async function getReflectionByUserAndWeek(userId: number, weekNumber: number): Promise<Reflection | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(reflections)
    .where(and(eq(reflections.userId, userId), eq(reflections.weekNumber, weekNumber)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Login activity queries
export async function logLoginActivity(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(loginActivity).values({ userId });
}

export async function getLoginActivityByUser(userId: number): Promise<LoginActivity[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(loginActivity)
    .where(eq(loginActivity.userId, userId))
    .orderBy(desc(loginActivity.loggedInAt));
}

export async function getLastLoginByUser(userId: number): Promise<LoginActivity | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(loginActivity)
    .where(eq(loginActivity.userId, userId))
    .orderBy(desc(loginActivity.loggedInAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Journal entry queries
export async function createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(journalEntries).values(entry);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(journalEntries).where(eq(journalEntries.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getJournalEntriesByUser(userId: number): Promise<JournalEntry[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt));
}

export async function updateJournalEntryAiResponse(id: number, aiResponse: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(journalEntries)
    .set({ aiResponse })
    .where(eq(journalEntries.id, id));
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
}
