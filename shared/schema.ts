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
