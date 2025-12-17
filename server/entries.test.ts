import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createEntry: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    taskId: 1,
    weekNumber: 1,
    completed: true,
    anxietyLevel: 5,
    guiltLevel: 4,
    activityDescription: "Walked around the block",
    observationAboutBrian: "He was fine",
    completedAt: new Date(),
  }),
  getEntriesByUser: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      taskId: 1,
      weekNumber: 1,
      completed: true,
      anxietyLevel: 5,
      guiltLevel: 4,
      activityDescription: "Walked around the block",
      observationAboutBrian: "He was fine",
      completedAt: new Date(),
    },
  ]),
  getEntriesByUserAndWeek: vi.fn().mockResolvedValue([]),
  logLoginActivity: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "kristine@example.com",
    name: "Kristine",
    loginMethod: "manus",
    role: "user",
    currentWeek: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("entries.create", () => {
  it("creates a new entry with valid input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.entries.create({
      taskId: 1,
      weekNumber: 1,
      completed: true,
      anxietyLevel: 5,
      guiltLevel: 4,
      activityDescription: "Walked around the block",
      observationAboutBrian: "He was fine",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.completed).toBe(true);
    expect(result.anxietyLevel).toBe(5);
    expect(result.guiltLevel).toBe(4);
  });

  it("validates anxiety level is within 0-10 range", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.entries.create({
        taskId: 1,
        weekNumber: 1,
        completed: true,
        anxietyLevel: 15, // Invalid - above 10
        guiltLevel: 4,
      })
    ).rejects.toThrow();
  });

  it("validates guilt level is within 0-10 range", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.entries.create({
        taskId: 1,
        weekNumber: 1,
        completed: true,
        anxietyLevel: 5,
        guiltLevel: -1, // Invalid - below 0
      })
    ).rejects.toThrow();
  });
});

describe("entries.getByUser", () => {
  it("returns entries for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.entries.getByUser();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
