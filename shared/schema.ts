import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Football fixtures types
export const matchSchema = z.object({
  id: z.string(),
  matchUrl: z.string().optional(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeTeamLogo: z.string().optional(),
  awayTeamLogo: z.string().optional(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  homeHalfScore: z.number().nullable(),
  awayHalfScore: z.number().nullable(),
  status: z.enum(['FT', 'LIVE', 'SCHEDULED', 'POSTPONED']),
  time: z.string(),
  competition: z.string(),
  competitionLogo: z.string().optional(),
  odds: z.object({
    home: z.number(),
    draw: z.number(),
    away: z.number(),
  }).optional(),
});

export type Match = z.infer<typeof matchSchema>;

export const fixturesResponseSchema = z.object({
  date: z.string(),
  matches: z.array(matchSchema),
});

export type FixturesResponse = z.infer<typeof fixturesResponseSchema>;

// Match details types for ML training data
export const teamFormSchema = z.object({
  last5: z.array(z.enum(['W', 'L', 'D'])),
  homeForm: z.number(),
  awayForm: z.number(),
  overallForm: z.number(),
});

export const teamStatsSchema = z.object({
  winPercentage: z.number(),
  goalsScored: z.number(),
  goalsScoredHome: z.number().optional(),
  goalsScoredAway: z.number().optional(),
  goalsConceded: z.number(),
  goalsConcededHome: z.number().optional(),
  goalsConcededAway: z.number().optional(),
  cleanSheetPercentage: z.number(),
});

export const headToHeadSchema = z.object({
  totalMatches: z.number(),
  homeWins: z.number(),
  draws: z.number(),
  awayWins: z.number(),
  last5Results: z.array(z.object({
    result: z.enum(['W', 'L', 'D']),
    homeTeam: z.string(),
    awayTeam: z.string(),
  })).optional(),
});

export const streakDataSchema = z.object({
  description: z.string(),
  type: z.enum(['wins', 'losses', 'draws', 'goals', 'cleanSheets', 'other']),
  count: z.number(),
});

export const standingSchema = z.object({
  position: z.number(),
  team: z.string(),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  goalDifference: z.number(),
  points: z.number(),
});

export const matchDetailsSchema = z.object({
  matchId: z.string(),
  matchUrl: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeTeamLogo: z.string().optional(),
  awayTeamLogo: z.string().optional(),
  competition: z.string(),
  competitionLogo: z.string().optional(),
  status: z.string(),
  score: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
    halfTime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }).optional(),
  }),
  date: z.string(),
  
  // Form data
  homeTeamForm: teamFormSchema,
  awayTeamForm: teamFormSchema,
  
  // Statistics
  homeTeamStats: teamStatsSchema,
  awayTeamStats: teamStatsSchema,
  
  // Head to head
  headToHead: headToHeadSchema.optional(),
  
  // Streaks
  streaks: z.array(streakDataSchema).optional(),
  
  // Betting odds
  odds: z.object({
    home: z.number(),
    draw: z.number(),
    away: z.number(),
  }).optional(),
  
  // Comparison insights
  insights: z.array(z.string()).optional(),
  
  // League standings (optional)
  standings: z.object({
    groupName: z.string().optional(),
    table: z.array(standingSchema),
  }).optional(),
});

export type MatchDetails = z.infer<typeof matchDetailsSchema>;
