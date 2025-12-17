import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockImplementation((openId: string) => {
    if (openId === "kristine-user") {
      return Promise.resolve({
        id: 1,
        openId: "kristine-user",
        name: "Kristine",
        role: "user",
        currentWeek: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
    } else if (openId === "jonathan-admin") {
      return Promise.resolve({
        id: 2,
        openId: "jonathan-admin",
        name: "Jonathan",
        role: "admin",
        currentWeek: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  logLoginActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock the SDK
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

function createPublicContext(): { ctx: TrpcContext; cookies: Map<string, string> } {
  const cookies = new Map<string, string>();

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => {
        cookies.set(name, value);
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("auth.simpleLogin", () => {
  it("allows Kristine to login with her name", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.simpleLogin({
      credential: "kristine",
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe("Kristine");
    expect(result.role).toBe("user");
  });

  it("allows Jonathan to login with PIN 5786", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.simpleLogin({
      credential: "5786",
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe("Jonathan");
    expect(result.role).toBe("admin");
  });

  it("rejects invalid credentials", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.simpleLogin({
        credential: "invalid",
      })
    ).rejects.toThrow("Invalid credentials");
  });

  it("is case-insensitive for Kristine name", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.simpleLogin({
      credential: "KRISTINE",
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe("Kristine");
  });
});
