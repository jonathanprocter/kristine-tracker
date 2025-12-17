import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { invokeLLM } from "./_core/llm";
import { ElevenLabsClient } from "elevenlabs";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now - attempt.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }

  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }

  attempt.count++;
  attempt.lastAttempt = now;
  return true;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    attempt.count++;
    attempt.lastAttempt = now;
  } else {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  }
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Simple login for Kristine (name) and Jonathan (PIN)
    simpleLogin: publicProcedure
      .input(z.object({
        credential: z.string().min(1).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        // Rate limiting by IP
        const clientIp = ctx.req.ip || ctx.req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIp)) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts. Please try again in 15 minutes.',
          });
        }

        const credential = input.credential.trim().toLowerCase();

        let openId: string;
        let name: string;
        let role: "user" | "admin";

        if (credential === "kristine") {
          openId = "kristine-user";
          name = "Kristine";
          role = "user";
        } else if (credential === "5786") {
          openId = "jonathan-admin";
          name = "Jonathan";
          role = "admin";
        } else {
          recordFailedAttempt(clientIp);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid credentials. Enter "Kristine" or your PIN.',
          });
        }

        // Successful login - reset rate limit
        resetRateLimit(clientIp);
        
        // Upsert user
        await db.upsertUser({
          openId,
          name,
          role,
          lastSignedIn: new Date(),
        });
        
        // Get the user to get their ID
        const user = await db.getUserByOpenId(openId);
        if (!user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create user',
          });
        }
        
        // Log login activity
        await db.logLoginActivity(user.id);
        
        // Create session token using SDK and set cookie
        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        
        return { success: true, name, role };
      }),
  }),

  tasks: router({
    getByWeek: protectedProcedure
      .input(z.object({ weekNumber: z.number() }))
      .query(async ({ input }) => {
        return await db.getTaskByWeek(input.weekNumber);
      }),
    
    getAll: protectedProcedure.query(async () => {
      return await db.getAllTasks();
    }),
    
    seed: protectedProcedure.mutation(async () => {
      await db.seedTasks();
      return { success: true };
    }),
  }),

  entries: router({
    create: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        weekNumber: z.number().min(1).max(52),
        completed: z.boolean(),
        anxietyLevel: z.number().min(0).max(10),
        guiltLevel: z.number().min(0).max(10),
        activityDescription: z.string().max(5000).optional(),
        observationAboutBrian: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const entry = await db.createEntry({
          userId: ctx.user.id,
          ...input,
        });
        
        // Log login activity
        await db.logLoginActivity(ctx.user.id);
        
        return entry;
      }),
    
    getByUser: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEntriesByUser(ctx.user.id);
    }),
    
    getByWeek: protectedProcedure
      .input(z.object({ weekNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getEntriesByUserAndWeek(ctx.user.id, input.weekNumber);
      }),
    
    getByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getEntriesByDateRange(ctx.user.id, input.startDate, input.endDate);
      }),
  }),

  accommodations: router({
    create: protectedProcedure
      .input(z.object({
        loggedAt: z.date(),
        timeOfDay: z.string().max(10),
        whatDid: z.string().min(1).max(2000),
        couldHeDoIt: z.enum(["yes", "no", "maybe"]),
        whatFelt: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const accommodation = await db.createAccommodation({
          userId: ctx.user.id,
          ...input,
        });
        
        return accommodation;
      }),
    
    getByUser: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAccommodationsByUser(ctx.user.id);
    }),
    
    getByDateRange: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getAccommodationsByDateRange(ctx.user.id, input.startDate, input.endDate);
      }),
  }),

  reflections: router({
    create: protectedProcedure
      .input(z.object({
        weekNumber: z.number().min(1).max(52),
        question1Answer: z.string().max(5000).optional(),
        question2Answer: z.string().max(5000).optional(),
        question3Answer: z.string().max(5000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const reflection = await db.createReflection({
          userId: ctx.user.id,
          ...input,
        });
        
        return reflection;
      }),
    
    getByUser: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReflectionsByUser(ctx.user.id);
    }),
    
    getByWeek: protectedProcedure
      .input(z.object({ weekNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getReflectionByUserAndWeek(ctx.user.id, input.weekNumber);
      }),
  }),

  user: router({
    updateWeek: protectedProcedure
      .input(z.object({ weekNumber: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserWeek(ctx.user.id, input.weekNumber);
        return { success: true };
      }),
    
    getCurrentWeek: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return user?.currentWeek ?? 1;
    }),
  }),

  ai: router({
    getAffirmation: protectedProcedure
      .input(z.object({
        weekNumber: z.number(),
        recentAnxiety: z.number().optional(),
        recentGuilt: z.number().optional(),
        completedDays: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { weekNumber, recentAnxiety, recentGuilt, completedDays } = input;

        const phaseNames: Record<number, string> = {
          1: "Accommodation Awareness",
          2: "Accommodation Awareness",
          3: "The 15-Minute Exit",
          4: "The 15-Minute Exit",
          5: "Self-Care Hour",
          6: "Self-Care Hour",
          7: "Validation Practice",
          8: "Validation Practice",
          9: "Bedroom Return",
        };

        const phaseDescriptions: Record<number, string> = {
          1: "noticing and logging accommodations she makes for Brian",
          2: "continuing to build awareness of accommodation patterns",
          3: "taking 15-minute breaks away from home",
          4: "establishing her 15-minute exit routine",
          5: "carving out one hour daily for self-care",
          6: "making her self-care hour non-negotiable",
          7: "practicing validation without over-involvement",
          8: "mastering the 'validate and move on' technique",
          9: "reclaiming her bedroom and sleep space",
        };

        const currentPhase = phaseNames[weekNumber] || "Your Journey";
        const phaseDesc = phaseDescriptions[weekNumber] || "her personal growth journey";

        // Fetch additional context for more personalized response
        let trendContext = "";
        let accommodationContext = "";
        try {
          const entries = await db.getEntriesByUser(ctx.user.id);
          if (entries.length >= 5) {
            const recent3 = entries.slice(0, 3);
            const older3 = entries.slice(3, 6);
            const recentAvgAnx = recent3.reduce((sum, e) => sum + e.anxietyLevel, 0) / recent3.length;
            const olderAvgAnx = older3.reduce((sum, e) => sum + e.anxietyLevel, 0) / older3.length;
            if (recentAvgAnx < olderAvgAnx - 1) {
              trendContext = "Her anxiety has been improving recently, which shows her progress!";
            } else if (recentAvgAnx > olderAvgAnx + 1) {
              trendContext = "Her anxiety has been higher recently - she may need extra encouragement.";
            }
          }

          if (weekNumber <= 2) {
            const accommodations = await db.getAccommodationsByUser(ctx.user.id);
            if (accommodations.length > 0) {
              const yesCount = accommodations.filter(a => a.couldHeDoIt === 'yes').length;
              accommodationContext = `She has logged ${accommodations.length} accommodations, ${yesCount} of which Brian could have done himself.`;
            }
          }
        } catch (error) {
          console.error("Error fetching context for affirmation:", error);
        }

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a warm, supportive companion for Kristine, a mother working on her relationship with her adult son Brian who has anxiety. Generate a single short affirmation (1-2 sentences max) that is:
- Warm and nurturing, like a supportive friend
- Focused on Kristine's wellbeing and growth
- NEVER use phrases like "healthier boundaries", "setting boundaries", or "boundary-setting" - these trigger defensiveness
- Instead use phrases like "taking care of yourself", "your own needs matter", "supporting Brian by supporting yourself", "giving yourself permission"
- Acknowledge that change is hard and feelings are valid
- Current phase: ${currentPhase} (Week ${weekNumber}) - ${phaseDesc}
${recentAnxiety !== undefined ? `- Her recent anxiety level: ${recentAnxiety}/10` : ''}
${recentGuilt !== undefined ? `- Her recent guilt level: ${recentGuilt}/10` : ''}
${completedDays !== undefined ? `- Days completed this week: ${completedDays}/7` : ''}
${trendContext ? `- Trend observation: ${trendContext}` : ''}
${accommodationContext ? `- Accommodation insight: ${accommodationContext}` : ''}

Make the affirmation specific to her current phase when possible. Be aware of her emotional state and tailor your tone accordingly.

Respond with ONLY the affirmation text, no quotes or extra formatting.`
              },
              {
                role: "user",
                content: "Generate a supportive affirmation for Kristine."
              }
            ],
          });

          const content = result.choices[0]?.message?.content;
          const affirmation = typeof content === 'string' ? content : (Array.isArray(content) && content[0]?.type === 'text' ? content[0].text : null);

          return { affirmation: affirmation || "You are doing important work. Every small step matters." };
        } catch (error) {
          console.error("AI affirmation error:", error);
          return { affirmation: "You are doing important work. Every small step matters." };
        }
      }),
    
    getWeeklySummary: protectedProcedure
      .input(z.object({
        weekNumber: z.number().min(1).max(52),
      }))
      .mutation(async ({ ctx, input }) => {
        const { weekNumber } = input;

        // Fetch actual user data from database - don't trust client-provided stats
        const entries = await db.getEntriesByUserAndWeek(ctx.user.id, weekNumber);
        const reflection = await db.getReflectionByUserAndWeek(ctx.user.id, weekNumber);

        // Calculate stats from actual data
        const avgAnxiety = entries.length > 0
          ? entries.reduce((sum, e) => sum + e.anxietyLevel, 0) / entries.length
          : undefined;
        const avgGuilt = entries.length > 0
          ? entries.reduce((sum, e) => sum + e.guiltLevel, 0) / entries.length
          : undefined;
        const completedCount = entries.filter(e => e.completed).length;
        const completionRate = entries.length > 0
          ? Math.round((completedCount / entries.length) * 100)
          : undefined;

        // Compile reflection answers if available
        let reflectionAnswers: string | undefined;
        if (reflection) {
          const answers = [
            reflection.question1Answer,
            reflection.question2Answer,
            reflection.question3Answer,
          ].filter(Boolean);
          if (answers.length > 0) {
            reflectionAnswers = answers.join(" | ");
          }
        }
        
        const phaseNames: Record<number, string> = {
          1: "Awareness Building",
          2: "Awareness Building",
          3: "15-Minute Break",
          4: "15-Minute Break",
          5: "Self-Care Hour",
          6: "Self-Care Hour",
          7: "Validation Practice",
          8: "Validation Practice",
          9: "Reclaiming Your Space",
        };
        
        const currentPhase = phaseNames[weekNumber] || "Your Journey";
        
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a warm, supportive companion for Kristine, summarizing her week. Generate a brief, encouraging summary (3-4 sentences) that:
- Celebrates her effort and progress, no matter how small
- Is warm and nurturing, like a supportive friend
- NEVER use "boundaries" language
- Acknowledges any challenges she faced with compassion
- Ends with gentle encouragement for the next week

Her week ${weekNumber} (${currentPhase}) stats:
${avgAnxiety !== undefined ? `- Average anxiety: ${avgAnxiety}/10` : ''}
${avgGuilt !== undefined ? `- Average guilt: ${avgGuilt}/10` : ''}
${completionRate !== undefined ? `- Completion rate: ${completionRate}%` : ''}
${reflectionAnswers ? `- Her reflections: ${reflectionAnswers}` : ''}

Respond with ONLY the summary text, no quotes.`
              },
              {
                role: "user",
                content: "Generate a supportive weekly summary for Kristine."
              }
            ],
          });
          
          const content = result.choices[0]?.message?.content;
          const summary = typeof content === 'string' ? content : (Array.isArray(content) && content[0]?.type === 'text' ? content[0].text : null);
          
          return { summary: summary || "You've completed another week of your journey. Every step forward, no matter how small, is progress worth celebrating." };
        } catch (error) {
          console.error("AI summary error:", error);
          return { summary: "You've completed another week of your journey. Every step forward, no matter how small, is progress worth celebrating." };
        }
      }),
    
    getCheckInFeedback: protectedProcedure
      .input(z.object({
        weekNumber: z.number(),
        completed: z.boolean(),
        anxietyLevel: z.number(),
        guiltLevel: z.number(),
        activityDescription: z.string().optional(),
        observationAboutBrian: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { weekNumber, completed, anxietyLevel, guiltLevel, activityDescription, observationAboutBrian } = input;

        const phaseDescriptions: Record<number, string> = {
          1: "building awareness of accommodations",
          2: "building awareness of accommodations",
          3: "taking 15-minute breaks",
          4: "taking 15-minute breaks",
          5: "taking self-care hours",
          6: "taking self-care hours",
          7: "practicing validation",
          8: "practicing validation",
          9: "reclaiming her sleep space",
        };

        // Fetch progress context for more personalized feedback
        let progressContext = "";
        let consecutiveContext = "";
        try {
          const weekEntries = await db.getEntriesByUserAndWeek(ctx.user.id, weekNumber);
          const completedCount = weekEntries.filter(e => e.completed).length;
          const totalThisWeek = weekEntries.length;

          if (completedCount > 0) {
            progressContext = `This is her ${completedCount + (completed ? 1 : 0)} completed day this week out of ${totalThisWeek + 1} check-ins.`;
          }

          // Check for streaks
          const recentEntries = await db.getEntriesByUser(ctx.user.id);
          let consecutiveCompleted = 0;
          for (const entry of recentEntries) {
            if (entry.completed) consecutiveCompleted++;
            else break;
          }
          if (completed && consecutiveCompleted >= 2) {
            consecutiveContext = `She's on a ${consecutiveCompleted + 1}-day streak of completing her tasks!`;
          }
        } catch (error) {
          console.error("Error fetching progress context:", error);
        }

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a warm, supportive companion for Kristine after she logs her daily check-in. Generate a brief, personalized response (2-3 sentences) that:
- Acknowledges her effort and feelings with genuine warmth
- Is nurturing, not clinical - like a caring friend who truly gets what she's going through
- NEVER use "boundaries" language - use "taking care of yourself", "your needs", "giving yourself permission" instead
- If anxiety/guilt is high (7+), validate those feelings as completely normal for someone making changes
- If she completed the task, celebrate gently without being over-the-top
- If she didn't complete it, be compassionate - acknowledge the difficulty and that tomorrow is a new opportunity
- Reference her specific activity or observation if provided
- Current focus: ${phaseDescriptions[weekNumber] || "her journey"}

Her check-in:
- Week ${weekNumber}
- Task completed: ${completed ? 'Yes' : 'No'}
- Anxiety level: ${anxietyLevel}/10${anxietyLevel >= 7 ? ' (elevated)' : anxietyLevel <= 3 ? ' (low - encouraging!)' : ''}
- Guilt level: ${guiltLevel}/10${guiltLevel >= 7 ? ' (elevated)' : guiltLevel <= 3 ? ' (low - great progress!)' : ''}
${activityDescription ? `- What she did: "${activityDescription}"` : ''}
${observationAboutBrian ? `- Her observation about Brian: "${observationAboutBrian}"` : ''}
${progressContext ? `- Progress: ${progressContext}` : ''}
${consecutiveContext ? `- Streak: ${consecutiveContext}` : ''}

Tailor your response to her emotional state. If both anxiety AND guilt are high, especially focus on validation and self-compassion.

Respond with ONLY the feedback text, no quotes.`
              },
              {
                role: "user",
                content: "Generate supportive feedback for Kristine's check-in."
              }
            ],
          });

          const content = result.choices[0]?.message?.content;
          const feedback = typeof content === 'string' ? content : (Array.isArray(content) && content[0]?.type === 'text' ? content[0].text : null);

          return { feedback: feedback || "Thank you for checking in today. Your commitment to this process shows real strength." };
        } catch (error) {
          console.error("AI feedback error:", error);
          return { feedback: "Thank you for checking in today. Your commitment to this process shows real strength." };
        }
      }),
    
    // Interactive AI chat for Kristine to get support
    chat: protectedProcedure
      .input(z.object({
        message: z.string().min(1).max(2000),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(5000),
        })).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { message, conversationHistory = [] } = input;

        // Fetch current context about Kristine
        let currentContext = "";
        try {
          const user = await db.getUserById(ctx.user.id);
          const currentWeek = user?.currentWeek ?? 1;
          const entries = await db.getEntriesByUser(ctx.user.id);
          const weekEntries = entries.filter(e => e.weekNumber === currentWeek);
          const completedThisWeek = weekEntries.filter(e => e.completed).length;

          const phaseNames: Record<number, string> = {
            1: "Accommodation Awareness", 2: "Accommodation Awareness",
            3: "The 15-Minute Exit", 4: "The 15-Minute Exit",
            5: "Self-Care Hour", 6: "Self-Care Hour",
            7: "Validation Practice", 8: "Validation Practice",
            9: "Bedroom Return",
          };

          // Calculate recent averages
          const recent5 = entries.slice(0, 5);
          const avgAnxiety = recent5.length > 0
            ? (recent5.reduce((sum, e) => sum + e.anxietyLevel, 0) / recent5.length).toFixed(1)
            : "N/A";
          const avgGuilt = recent5.length > 0
            ? (recent5.reduce((sum, e) => sum + e.guiltLevel, 0) / recent5.length).toFixed(1)
            : "N/A";

          currentContext = `
Current week: ${currentWeek} (${phaseNames[currentWeek] || "Journey"})
Days completed this week: ${completedThisWeek}/7
Total check-ins: ${entries.length}
Recent average anxiety: ${avgAnxiety}/10
Recent average guilt: ${avgGuilt}/10`;

          // Add accommodation context if in weeks 1-2
          if (currentWeek <= 2) {
            const accommodations = await db.getAccommodationsByUser(ctx.user.id);
            if (accommodations.length > 0) {
              const yesCount = accommodations.filter(a => a.couldHeDoIt === 'yes').length;
              currentContext += `
Accommodations logged: ${accommodations.length} (${yesCount} Brian could do himself)`;
            }
          }

          // Check for recent journal entries
          const journals = await db.getJournalEntriesByUser(ctx.user.id);
          if (journals.length > 0) {
            currentContext += `
Journal entries: ${journals.length}`;
          }
        } catch (error) {
          console.error("Error fetching chat context:", error);
        }

        try {
          // Build conversation with history
          const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            {
              role: "system",
              content: `You are a warm, supportive AI companion named "Journey" for Kristine, a mother working on her relationship with her adult son Brian who has anxiety. You're here to listen, support, and gently guide her.

CRITICAL RULES:
- NEVER use words like "boundaries", "boundary-setting", or "healthier boundaries" - these trigger defensiveness
- Instead use: "taking care of yourself", "your needs matter", "supporting Brian by supporting yourself", "giving yourself permission", "making space for your own wellbeing"
- Be warm, nurturing, and understanding - like a caring friend, not a therapist
- Acknowledge that change is hard and her feelings are valid
- Don't give clinical advice - offer gentle support and validation
- Keep responses concise (2-4 sentences unless she asks for more detail)
- If she expresses distress, validate first, then gently offer perspective
- Celebrate small wins without being over-the-top
- Remember she loves Brian deeply - honor that while supporting her growth

KRISTINE'S CURRENT STATUS:
${currentContext}

ABOUT THE PROGRAM:
- Week 1-2: Accommodation Awareness (noticing what she does for Brian)
- Week 3-4: 15-Minute Exit (brief breaks away from home)
- Week 5-6: Self-Care Hour (non-negotiable personal time)
- Week 7-8: Validation Practice (acknowledge feelings, then move on)
- Week 9+: Bedroom Return (sleeping in her own bed)

Be present, supportive, and genuinely caring in your responses.`
            }
          ];

          // Add conversation history
          for (const msg of conversationHistory.slice(-10)) { // Keep last 10 messages for context
            messages.push({
              role: msg.role,
              content: msg.content,
            });
          }

          // Add current message
          messages.push({
            role: "user",
            content: message,
          });

          const result = await invokeLLM({ messages });

          const content = result.choices[0]?.message?.content;
          const response = typeof content === 'string'
            ? content
            : (Array.isArray(content) && content[0]?.type === 'text' ? content[0].text : null);

          return {
            response: response || "I'm here for you, Kristine. What's on your mind?",
          };
        } catch (error) {
          console.error("AI chat error:", error);
          return {
            response: "I'm having trouble connecting right now, but I'm still here for you. Could you try again in a moment?",
          };
        }
      }),

    // Text-to-speech for affirmations
    textToSpeech: protectedProcedure
      .input(z.object({
        text: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { text } = input;
        
        try {
          // Get API key directly from process.env
          const apiKey = process.env.ELEVENLABS_API_KEY;
          console.log("[TTS] API key available:", !!apiKey, "length:", apiKey?.length || 0);
          
          if (!apiKey) {
            throw new Error("ELEVENLABS_API_KEY not configured");
          }
          
          const client = new ElevenLabsClient({
            apiKey: apiKey,
          });
          
          // Use a warm, calming female voice (configurable via env var)
          const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
          const audioStream = await client.textToSpeech.convert(voiceId, {
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.8,
              style: 0.3,
            },
          });
          
          console.log("[TTS] Audio stream received");
          
          // Collect chunks into buffer
          const chunks: Buffer[] = [];
          for await (const chunk of audioStream) {
            chunks.push(Buffer.from(chunk));
          }
          const audioBuffer = Buffer.concat(chunks);
          console.log("[TTS] Audio buffer size:", audioBuffer.length);
          
          // Upload to S3
          const fileKey = `tts/${nanoid()}.mp3`;
          const { url } = await storagePut(fileKey, audioBuffer, "audio/mpeg");
          console.log("[TTS] Uploaded to:", url);
          
          return { audioUrl: url };
        } catch (error: any) {
          console.error("[TTS] Error:", error?.message || error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate audio: ' + (error?.message || 'Unknown error') });
        }
      }),
  }),

  journal: router({
    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(10000),
        mood: z.string().max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const entry = await db.createJournalEntry({
          userId: ctx.user.id,
          content: input.content,
          mood: input.mood,
        });
        
        // Generate AI response asynchronously
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a warm, supportive companion helping Kristine on her journey of self-care while supporting her son Brian. She is working on recognizing her own needs and taking care of herself. Respond to her journal entry with empathy, validation, and gentle encouragement. Keep your response to 2-3 sentences. Be nurturing and understanding. Never use clinical language or mention "boundaries" - instead focus on self-care, taking care of herself, and her growth.`
              },
              {
                role: "user",
                content: `Kristine wrote in her journal: "${input.content}"`
              }
            ],
          });
          
          const messageContent = response.choices[0]?.message?.content;
          const aiResponse = typeof messageContent === 'string' ? messageContent : "Thank you for sharing. Every thought you write down is a step toward understanding yourself better.";
          await db.updateJournalEntryAiResponse(entry.id, aiResponse);
          
          return { ...entry, aiResponse };
        } catch (error) {
          console.error("[Journal AI] Error generating response:", error);
          const fallbackResponse = "Thank you for sharing your thoughts. Taking time to reflect is an important part of taking care of yourself.";
          await db.updateJournalEntryAiResponse(entry.id, fallbackResponse);
          return { ...entry, aiResponse: fallbackResponse };
        }
      }),
    
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getJournalEntriesByUser(ctx.user.id);
    }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Security: Verify the journal entry belongs to the current user
        const entries = await db.getJournalEntriesByUser(ctx.user.id);
        const entryBelongsToUser = entries.some(e => e.id === input.id);
        if (!entryBelongsToUser) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete your own journal entries',
          });
        }
        await db.deleteJournalEntry(input.id);
        return { success: true };
      }),
  }),

  admin: router({
    getUserActivity: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const entries = await db.getEntriesByUser(input.userId);
        const accommodations = await db.getAccommodationsByUser(input.userId);
        const reflections = await db.getReflectionsByUser(input.userId);
        const loginActivity = await db.getLoginActivityByUser(input.userId);
        
        return {
          entries,
          accommodations,
          reflections,
          loginActivity,
        };
      }),
    
    getLoginTracking: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLoginActivityByUser(input.userId);
      }),
    
    getRedFlags: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        const lastLogin = await db.getLastLoginByUser(input.userId);
        const currentWeekEntries = await db.getEntriesByUserAndWeek(input.userId, user?.currentWeek ?? 1);
        
        const redFlags: string[] = [];
        
        // Check for no login in 3+ days
        if (lastLogin) {
          const daysSinceLogin = Math.floor((Date.now() - lastLogin.loggedInAt.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceLogin >= 3) {
            redFlags.push(`No login for ${daysSinceLogin} days`);
          }
        }
        
        // Check completion rate
        const completedCount = currentWeekEntries.filter(e => e.completed).length;
        if (completedCount < 2) {
          redFlags.push(`Low completion rate: ${completedCount} days this week`);
        }
        
        // Check anxiety trend
        if (currentWeekEntries.length >= 3) {
          const recentEntries = currentWeekEntries.slice(0, 3);
          const avgAnxiety = recentEntries.reduce((sum, e) => sum + e.anxietyLevel, 0) / recentEntries.length;
          if (avgAnxiety > 7) {
            redFlags.push(`High anxiety levels: average ${avgAnxiety.toFixed(1)}/10`);
          }
        }
        
        return redFlags;
      }),
    
    // Get Kristine's user ID for admin dashboard
    getKristineUserId: adminProcedure.query(async () => {
      const kristine = await db.getUserByOpenId("kristine-user");
      return kristine?.id ?? null;
    }),
  }),
});

export type AppRouter = typeof appRouter;
