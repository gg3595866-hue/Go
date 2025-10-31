import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Entity Mapping Tables - These ensure consistent IDs across database and tester
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const countries = sqliteTable("countries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertLeagueSchema = createInsertSchema(leagues).omit({
  id: true,
  createdAt: true,
});

export const insertCountrySchema = createInsertSchema(countries).omit({
  id: true,
  createdAt: true,
});

export type Team = typeof teams.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type InsertCountry = z.infer<typeof insertCountrySchema>;

// Match Statistics Table for Database and Tester tabs
export const matchStats = sqliteTable("match_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  
  // Team IDs
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  leagueId: integer("league_id").notNull(),
  countryId: integer("country_id").notNull(),
  
  // Form metrics
  homeTeamFormHomeL5: real("home_team_form_home_l5").notNull(),
  awayTeamFormAwayL5: real("away_team_form_away_l5").notNull(),
  homeTeamFormOverallL5: real("home_team_form_overall_l5").notNull(),
  awayTeamFormOverallL5: real("away_team_form_overall_l5").notNull(),
  homeTeamFormDiffOverall: real("home_team_form_diff_overall").notNull(),
  
  // Win/Draw/Loss rates (Last 8 games)
  homeTeamWinRateL8: real("home_team_win_rate_l8").notNull(),
  awayTeamWinRateL8: real("away_team_win_rate_l8").notNull(),
  homeTeamDrawRateL8: real("home_team_draw_rate_l8").notNull(),
  awayTeamDrawRateL8: real("away_team_draw_rate_l8").notNull(),
  homeTeamLossRateL8: real("home_team_loss_rate_l8").notNull(),
  awayTeamLossRateL8: real("away_team_loss_rate_l8").notNull(),
  
  // To Nil rates (Last 8 games)
  homeTeamToNilRateL8: real("home_team_to_nil_rate_l8").notNull(),
  awayTeamToNilRateL8: real("away_team_to_nil_rate_l8").notNull(),
  
  // Winning margin rates (Last 8 games)
  homeTeamWinningMargin1GoalRateL8: real("home_team_winning_margin_1_goal_rate_l8").notNull(),
  awayTeamWinningMargin1GoalRateL8: real("away_team_winning_margin_1_goal_rate_l8").notNull(),
  homeTeamWinningMargin2GoalRateL8: real("home_team_winning_margin_2_goal_rate_l8").notNull(),
  awayTeamWinningMargin2GoalRateL8: real("away_team_winning_margin_2_goal_rate_l8").notNull(),
  
  // Half goal rates
  homeTeamFirstHalfGoalRate: real("home_team_first_half_goal_rate").notNull(),
  awayTeamFirstHalfGoalRate: real("away_team_first_half_goal_rate").notNull(),
  homeTeamSecondHalfGoalRate: real("home_team_second_half_goal_rate").notNull(),
  awayTeamSecondHalfGoalRate: real("away_team_second_half_goal_rate").notNull(),
  
  // BTTS and scoring rates (Last 4 games)
  homeTeamBttsRateL4: real("home_team_btts_rate_l4").notNull(),
  awayTeamBttsRateL4: real("away_team_btts_rate_l4").notNull(),
  homeTeamScoredRateL4: real("home_team_scored_rate_l4").notNull(),
  awayTeamScoredRateL4: real("away_team_scored_rate_l4").notNull(),
  homeTeamScoredAgainstRateL4: real("home_team_scored_against_rate_l4").notNull(),
  awayTeamScoredAgainstRateL4: real("away_team_scored_against_rate_l4").notNull(),
  
  // Half-time rates (Last 8 games)
  homeTeamHtWonRateL8: real("home_team_ht_won_rate_l8").notNull(),
  awayTeamHtWonRateL8: real("away_team_ht_won_rate_l8").notNull(),
  homeTeamHtTiedRateL8: real("home_team_ht_tied_rate_l8").notNull(),
  awayTeamHtTiedRateL8: real("away_team_ht_tied_rate_l8").notNull(),
  homeTeamHtLostRateL8: real("home_team_ht_lost_rate_l8").notNull(),
  awayTeamHtLostRateL8: real("away_team_ht_lost_rate_l8").notNull(),
  
  // League statistics
  leagueHomeWins: real("league_home_wins").notNull(),
  leagueDraws: real("league_draws").notNull(),
  leagueAwayWins: real("league_away_wins").notNull(),
  leagueUnder25: real("league_under_2_5").notNull(),
  leagueOver25: real("league_over_2_5").notNull(),
  leagueAvgGoals: real("league_avg_goals").notNull(),
  
  // Target variables (actual match results)
  ftHomeScore: integer("ft_home_score"),
  ftAwayScore: integer("ft_away_score"),
  htHomeScore: integer("ht_home_score"),
  htAwayScore: integer("ht_away_score"),
  ftResult: text("ft_result"),
  bttsYesNo: integer("btts_yes_no"),
  uO25Goals: integer("u_o_2_5_goals"),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertMatchStatsSchema = createInsertSchema(matchStats).omit({
  id: true,
  createdAt: true,
});

export type InsertMatchStats = z.infer<typeof insertMatchStatsSchema>;
export type MatchStats = typeof matchStats.$inferSelect;

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
  drawPercentage: z.number().optional(),
  lossPercentage: z.number().optional(),
  goalsScored: z.number(),
  goalsScoredHome: z.number().optional(),
  goalsScoredAway: z.number().optional(),
  goalsConceded: z.number(),
  goalsConcededHome: z.number().optional(),
  goalsConcededAway: z.number().optional(),
  cleanSheetPercentage: z.number(),
  
  // Double Chance stats
  doubleChance1X: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  doubleChanceX2: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  doubleChance12: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  
  // To Nil stats
  winToNil: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  loseToNil: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  
  // Winning Margin
  winByOneGoal: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  winByTwoPlusGoals: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  
  // BTTS (Both Teams To Score) stats
  btts: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  bttsAndOver25: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  bttsAndWin: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  bttsAndLoss: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  
  // Goals Scored stats
  scoredPercent: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  scoredAgainstPercent: z.object({
    overall: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    home: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    away: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
  
  // Goals in Halves
  goalsInFirstHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  goalsInSecondHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  
  // Halftime Stats
  halftimeStats: z.object({
    wonFirstHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    tiedFirstHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    lostFirstHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    wonSecondHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    tiedSecondHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    lostSecondHalf: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    wonFullTime: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    tiedFullTime: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
    lostFullTime: z.object({ percentage: z.number(), count: z.number(), total: z.number() }).optional(),
  }).optional(),
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

// ML Model Metadata Table
export const modelMetadata = sqliteTable("model_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  architecture: text("architecture").notNull(), // JSON string of model config
  trainingAccuracy: real("training_accuracy"),
  validationAccuracy: real("validation_accuracy"),
  loss: real("loss"),
  trainingDate: integer("training_date", { mode: 'timestamp' }).notNull(),
  totalEpochs: integer("total_epochs").notNull(),
  totalSamples: integer("total_samples").notNull(),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(false),
  modelPath: text("model_path"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertModelMetadataSchema = createInsertSchema(modelMetadata).omit({
  id: true,
  createdAt: true,
});

export type ModelMetadata = typeof modelMetadata.$inferSelect;
export type InsertModelMetadata = z.infer<typeof insertModelMetadataSchema>;

// Match Predictions Table
export const matchPredictions = sqliteTable("match_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchStatsId: integer("match_stats_id").notNull(),
  modelId: integer("model_id").notNull(),
  
  // Prediction probabilities for 1X2
  predHomeWinProb: real("pred_home_win_prob").notNull(),
  predDrawProb: real("pred_draw_prob").notNull(),
  predAwayWinProb: real("pred_away_win_prob").notNull(),
  predResult: text("pred_result").notNull(), // '1', 'X', or '2'
  
  // Score predictions
  predHomeScore: real("pred_home_score").notNull(),
  predAwayScore: real("pred_away_score").notNull(),
  
  // Half-time score predictions
  predHtHomeScore: real("pred_ht_home_score").notNull(),
  predHtAwayScore: real("pred_ht_away_score").notNull(),
  
  // BTTS and Over/Under predictions
  predBttsProb: real("pred_btts_prob").notNull(),
  predBtts: integer("pred_btts", { mode: 'boolean' }).notNull(),
  predOver25Prob: real("pred_over_2_5_prob").notNull(),
  predOver25: integer("pred_over_2_5", { mode: 'boolean' }).notNull(),
  
  // Confidence score
  confidence: real("confidence").notNull(),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertMatchPredictionSchema = createInsertSchema(matchPredictions).omit({
  id: true,
  createdAt: true,
});

export type MatchPrediction = typeof matchPredictions.$inferSelect;
export type InsertMatchPrediction = z.infer<typeof insertMatchPredictionSchema>;
