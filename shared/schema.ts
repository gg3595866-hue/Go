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

  // NEW: Home/Away-specific win rates
  homeTeamWinRateHome: real("home_team_win_rate_home").notNull(),
  homeTeamWinRateAway: real("home_team_win_rate_away").notNull(),
  awayTeamWinRateHome: real("away_team_win_rate_home").notNull(),
  awayTeamWinRateAway: real("away_team_win_rate_away").notNull(),

  // NEW: Points per game
  homeTeamPointsPerGame: real("home_team_points_per_game").notNull(),
  awayTeamPointsPerGame: real("away_team_points_per_game").notNull(),

  // NEW: Over/Under goal percentages
  homeTeamOver05Rate: real("home_team_over_0_5_rate").notNull(),
  awayTeamOver05Rate: real("away_team_over_0_5_rate").notNull(),
  homeTeamOver15Rate: real("home_team_over_1_5_rate").notNull(),
  awayTeamOver15Rate: real("away_team_over_1_5_rate").notNull(),
  homeTeamOver35Rate: real("home_team_over_3_5_rate").notNull(),
  awayTeamOver35Rate: real("away_team_over_3_5_rate").notNull(),

  // NEW: Failed to score percentage
  homeTeamFailedToScoreRate: real("home_team_failed_to_score_rate").notNull(),
  awayTeamFailedToScoreRate: real("away_team_failed_to_score_rate").notNull(),

  // NEW: Goals per half ratio (1H / 2H)
  homeTeamGoalsPerHalfRatio: real("home_team_goals_per_half_ratio").notNull(),
  awayTeamGoalsPerHalfRatio: real("away_team_goals_per_half_ratio").notNull(),

  // NEW: Comparative metrics
  relativeAttackStrength: real("relative_attack_strength").notNull(),
  relativeDefenseStrength: real("relative_defense_strength").notNull(),
  momentumDifference: real("momentum_difference").notNull(),
  recentGoalDifference: real("recent_goal_difference").notNull(),

  // NEW: Market-specific features
  expectedWinRatioHome: real("expected_win_ratio_home").notNull(),
  expectedWinRatioAway: real("expected_win_ratio_away").notNull(),
  winToOddsIndexHome: real("win_to_odds_index_home").notNull(),
  winToOddsIndexAway: real("win_to_odds_index_away").notNull(),
  expectedValue1: real("expected_value_1").notNull(),
  expectedValueX: real("expected_value_x").notNull(),
  expectedValue2: real("expected_value_2").notNull(),
  marketExpectedGoalsHome: real("market_expected_goals_home").notNull(),
  marketExpectedGoalsAway: real("market_expected_goals_away").notNull(),

  // NEW: League position normalized
  homeTeamLeaguePosition: real("home_team_league_position").notNull(),
  awayTeamLeaguePosition: real("away_team_league_position").notNull(),
  homeTeamLeaguePositionNormalized: real("home_team_league_position_normalized").notNull(),
  awayTeamLeaguePositionNormalized: real("away_team_league_position_normalized").notNull(),

  // NEW: Win margin ratio
  homeTeamWinMarginRatio: real("home_team_win_margin_ratio").notNull(),
  awayTeamWinMarginRatio: real("away_team_win_margin_ratio").notNull(),

  // League statistics
  leagueHomeWins: real("league_home_wins").notNull(),
  leagueDraws: real("league_draws").notNull(),
  leagueAwayWins: real("league_away_wins").notNull(),
  leagueUnder25: real("league_under_2_5").notNull(),
  leagueOver25: real("league_over_2_5").notNull(),
  leagueAvgGoals: real("league_avg_goals").notNull(),

  // Betting odds and probabilities
  odds1: real("odds_1").notNull(),
  oddsX: real("odds_x").notNull(),
  odds2: real("odds_2").notNull(),
  prob1: real("prob_1").notNull(),
  probX: real("prob_x").notNull(),
  prob2: real("prob_2").notNull(),

  // Match date for time-aware splitting
  matchDate: integer("match_date", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),

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

  // NEW: Home/Away-specific win rates
  winPercentageHome: z.number().optional(),
  winPercentageAway: z.number().optional(),
  drawPercentageHome: z.number().optional(),
  drawPercentageAway: z.number().optional(),
  lossPercentageHome: z.number().optional(),
  lossPercentageAway: z.number().optional(),

  // NEW: Over/Under percentages
  over05Percentage: z.number().optional(),
  over15Percentage: z.number().optional(),
  over25Percentage: z.number().optional(),
  over35Percentage: z.number().optional(),
  under05Percentage: z.number().optional(),
  under15Percentage: z.number().optional(),
  under25Percentage: z.number().optional(),
  under35Percentage: z.number().optional(),

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

  // Detailed odds and probabilities data
  oddsData: z.object({
    odds1: z.number(),
    oddsX: z.number(),
    odds2: z.number(),
    prob1: z.number(),
    probX: z.number(),
    prob2: z.number(),
  }).optional(),

  // Comparison insights
  insights: z.array(z.string()).optional(),

  // League standings (optional)
  standings: z.object({
    groupName: z.string().optional(),
    table: z.array(standingSchema),
  }).optional(),

  // NEW: League positions for both teams
  homeTeamLeaguePosition: z.number().optional(),
  awayTeamLeaguePosition: z.number().optional(),
  totalTeamsInLeague: z.number().optional(),
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

// Basketball Statistics Table
export const basketballStats = sqliteTable("basketball_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // Team IDs
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  leagueId: integer("league_id").notNull(),
  countryId: integer("country_id").notNull(),

  // Points scored and received per game
  homePointsScoredPerGame: real("home_points_scored_per_game").notNull(),
  awayPointsScoredPerGame: real("away_points_scored_per_game").notNull(),
  homePointsReceivedPerGame: real("home_points_received_per_game").notNull(),
  awayPointsReceivedPerGame: real("away_points_received_per_game").notNull(),

  // Win/Tie/Loss records
  homeWon: integer("home_won").notNull(),
  awayWon: integer("away_won").notNull(),
  homeTied: integer("home_tied").notNull(),
  awayTied: integer("away_tied").notNull(),
  homeLost: integer("home_lost").notNull(),
  awayLost: integer("away_lost").notNull(),

  // Average points per quarter
  homeAvgPointsQ1: real("home_avg_points_q1").notNull(),
  awayAvgPointsQ1: real("away_avg_points_q1").notNull(),
  homeAvgPointsQ2: real("home_avg_points_q2").notNull(),
  awayAvgPointsQ2: real("away_avg_points_q2").notNull(),
  homeAvgPointsQ3: real("home_avg_points_q3").notNull(),
  awayAvgPointsQ3: real("away_avg_points_q3").notNull(),
  homeAvgPointsQ4: real("home_avg_points_q4").notNull(),
  awayAvgPointsQ4: real("away_avg_points_q4").notNull(),

  // Match date for time-aware splitting
  matchDate: integer("match_date", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),

  // Target variables (actual match results)
  ftHomePoints: integer("ft_home_points"),
  ftAwayPoints: integer("ft_away_points"),
  ftResult: text("ft_result"),

  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertBasketballStatsSchema = createInsertSchema(basketballStats).omit({
  id: true,
  createdAt: true,
});

export type InsertBasketballStats = z.infer<typeof insertBasketballStatsSchema>;
export type BasketballStats = typeof basketballStats.$inferSelect;

// Basketball Model Metadata Table
export const basketballModelMetadata = sqliteTable("basketball_model_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  architecture: text("architecture").notNull(),
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

export const insertBasketballModelMetadataSchema = createInsertSchema(basketballModelMetadata).omit({
  id: true,
  createdAt: true,
});

export type BasketballModelMetadata = typeof basketballModelMetadata.$inferSelect;
export type InsertBasketballModelMetadata = z.infer<typeof insertBasketballModelMetadataSchema>;

// Basketball Predictions Table
export const basketballPredictions = sqliteTable("basketball_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  basketballStatsId: integer("basketball_stats_id").notNull(),
  modelId: integer("model_id").notNull(),

  // Prediction probabilities for winner
  predHomeWinProb: real("pred_home_win_prob").notNull(),
  predAwayWinProb: real("pred_away_win_prob").notNull(),
  predResult: text("pred_result").notNull(),

  // Score predictions
  predHomePoints: real("pred_home_points").notNull(),
  predAwayPoints: real("pred_away_points").notNull(),

  // Confidence score
  confidence: real("confidence").notNull(),

  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertBasketballPredictionSchema = createInsertSchema(basketballPredictions).omit({
  id: true,
  createdAt: true,
});

export type BasketballPrediction = typeof basketballPredictions.$inferSelect;
export type InsertBasketballPrediction = z.infer<typeof insertBasketballPredictionSchema>;

// Team Ratings Table - Dynamic Rating System (replaces ML)
export const teamRatings = sqliteTable("team_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().unique(),

  // Core Rating
  eloRating: real("elo_rating").notNull().default(1500),
  attackRating: real("attack_rating").notNull().default(1500),
  defenseRating: real("defense_rating").notNull().default(1500),

  // Match Stats
  totalMatches: integer("total_matches").notNull().default(0),
  homeMatches: integer("home_matches").notNull().default(0),
  awayMatches: integer("away_matches").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  losses: integer("losses").notNull().default(0),

  // Situational Dynamics
  performanceAsFavorite: real("performance_as_favorite").notNull().default(0),
  performanceAsUnderdog: real("performance_as_underdog").notNull().default(0),
  performanceInBadForm: real("performance_in_bad_form").notNull().default(0),
  performanceAfterLoss: real("performance_after_loss").notNull().default(0),
  performanceAfterWin: real("performance_after_win").notNull().default(0),
  performanceInHighScoringGames: real("performance_in_high_scoring_games").notNull().default(0),
  performanceInLowScoringGames: real("performance_in_low_scoring_games").notNull().default(0),
  homeStreak: integer("home_streak").notNull().default(0),
  awayStreak: integer("away_streak").notNull().default(0),
  unbeatenStreak: integer("unbeaten_streak").notNull().default(0),
  losingStreak: integer("losing_streak").notNull().default(0),
  goalMarginAvg: real("goal_margin_avg").notNull().default(0),
  winningMarginBy1: integer("winning_margin_by_1").notNull().default(0),
  winningMarginBy2Plus: integer("winning_margin_by_2_plus").notNull().default(0),
  lossMarginBy1: integer("loss_margin_by_1").notNull().default(0),
  lossMarginBy2Plus: integer("loss_margin_by_2_plus").notNull().default(0),

  // Market Correlations
  winRateVsOdds: real("win_rate_vs_odds").notNull().default(0),
  over25VsOdds: real("over_2_5_vs_odds").notNull().default(0),
  bttsVsOdds: real("btts_vs_odds").notNull().default(0),
  varianceInMarketAccuracy: real("variance_in_market_accuracy").notNull().default(0),
  underdogWinRate: real("underdog_win_rate").notNull().default(0),
  highOddsAccuracy: real("high_odds_accuracy").notNull().default(0),
  lowOddsAccuracy: real("low_odds_accuracy").notNull().default(0),

  // Halftime / Fulltime
  htWinRate: real("ht_win_rate").notNull().default(0),
  htDrawRate: real("ht_draw_rate").notNull().default(0),
  htLossRate: real("ht_loss_rate").notNull().default(0),
  ftWinRate: real("ft_win_rate").notNull().default(0),
  ftDrawRate: real("ft_draw_rate").notNull().default(0),
  ftLossRate: real("ft_loss_rate").notNull().default(0),
  htFtConsistencyRate: real("ht_ft_consistency_rate").notNull().default(0),
  htLeadToWinRate: real("ht_lead_to_win_rate").notNull().default(0),
  htDrawToWinRate: real("ht_draw_to_win_rate").notNull().default(0),
  htLossToWinRate: real("ht_loss_to_win_rate").notNull().default(0),

  // BTTS Dynamics
  bttsYesRate: real("btts_yes_rate").notNull().default(0),
  bttsNoRate: real("btts_no_rate").notNull().default(0),
  bttsAndWinRate: real("btts_and_win_rate").notNull().default(0),
  bttsAndLossRate: real("btts_and_loss_rate").notNull().default(0),
  bttsAndOver25Rate: real("btts_and_over_2_5_rate").notNull().default(0),
  bttsAndUnder25Rate: real("btts_and_under_2_5_rate").notNull().default(0),

  // Goals Stats
  goalsScored: integer("goals_scored").notNull().default(0),
  goalsConceded: integer("goals_conceded").notNull().default(0),
  avgGoalsScored: real("avg_goals_scored").notNull().default(0),
  avgGoalsConceded: real("avg_goals_conceded").notNull().default(0),

  // Pressure Metrics
  comebackRate: real("comeback_rate").notNull().default(0), // Win/draw rate after losing at HT
  performanceInCloseGames: real("performance_in_close_games").notNull().default(0), // Win rate in 1-goal games
  mentalStrength: real("mental_strength").notNull().default(0), // Ability to hold leads
  performanceWhenTrailing: real("performance_when_trailing").notNull().default(0), // Points gained when losing at HT

  // Mistake Propensity Metrics
  leadBlownRate: real("lead_blown_rate").notNull().default(0), // Rate of dropping points after leading at HT
  cleanSheetRate: real("clean_sheet_rate").notNull().default(0), // Rate of not conceding
  lateCollapseRate: real("late_collapse_rate").notNull().default(0), // Rate of losing narrow HT leads
  defensiveErrors: integer("defensive_errors").notNull().default(0), // Count of goals conceded from winning positions

  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const insertTeamRatingSchema = createInsertSchema(teamRatings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TeamRating = typeof teamRatings.$inferSelect;
export type InsertTeamRating = z.infer<typeof insertTeamRatingSchema>;

// Match Predictions using Rating System
export const ratingPredictions = sqliteTable("rating_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchStatsId: integer("match_stats_id").notNull(),
  homeTeamRating: real("home_team_rating").notNull(),
  awayTeamRating: real("away_team_rating").notNull(),
  homeWinProb: real("home_win_prob").notNull(),
  drawProb: real("draw_prob").notNull(),
  awayWinProb: real("away_win_prob").notNull(),
  predictedResult: text("predicted_result").notNull(), // '1', 'X', or '2'
  predictedHomeScore: real("predicted_home_score").notNull(),
  predictedAwayScore: real("predicted_away_score").notNull(),
  predictedHtHomeScore: real("predicted_ht_home_score"),
  predictedHtAwayScore: real("predicted_ht_away_score"),
  bttsProb: real("btts_prob").notNull(),
  predictedBtts: integer("predicted_btts", { mode: 'boolean' }),
  over25Prob: real("over_2_5_prob").notNull(),
  predictedOver25: integer("predicted_over_2_5", { mode: 'boolean' }),
  confidence: real("confidence").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).$default(() => new Date()),
});

export const insertRatingPredictionSchema = createInsertSchema(ratingPredictions).omit({
  id: true,
  createdAt: true,
});

export type RatingPrediction = typeof ratingPredictions.$inferSelect;
export type InsertRatingPrediction = z.infer<typeof insertRatingPredictionSchema>;