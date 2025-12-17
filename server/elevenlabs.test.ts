import { describe, expect, it } from "vitest";
import { ElevenLabsClient } from "elevenlabs";

describe("ElevenLabs API", () => {
  it("should have a valid API key configured", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it("should be able to list voices (validates API key)", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    const client = new ElevenLabsClient({
      apiKey: apiKey,
    });

    // List voices is a lightweight API call to validate the key
    const voices = await client.voices.getAll();
    expect(voices).toBeDefined();
    expect(voices.voices).toBeDefined();
    expect(Array.isArray(voices.voices)).toBe(true);
  });
});
