import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import { resolve } from 'path';

const databasePath = resolve(process.cwd(), 'database.db');
const testerPath = resolve(process.cwd(), 'tester.db');

const databaseSqlite = new Database(databasePath);
const testerSqlite = new Database(testerPath);

databaseSqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS match_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    home_team_form_home_l5 REAL NOT NULL,
    away_team_form_away_l5 REAL NOT NULL,
    home_team_form_overall_l5 REAL NOT NULL,
    away_team_form_overall_l5 REAL NOT NULL,
    home_team_form_diff_overall REAL NOT NULL,
    home_team_win_rate_l8 REAL NOT NULL,
    away_team_win_rate_l8 REAL NOT NULL,
    home_team_draw_rate_l8 REAL NOT NULL,
    away_team_draw_rate_l8 REAL NOT NULL,
    home_team_loss_rate_l8 REAL NOT NULL,
    away_team_loss_rate_l8 REAL NOT NULL,
    home_team_to_nil_rate_l8 REAL NOT NULL,
    away_team_to_nil_rate_l8 REAL NOT NULL,
    home_team_winning_margin_1_goal_rate_l8 REAL NOT NULL,
    away_team_winning_margin_1_goal_rate_l8 REAL NOT NULL,
    home_team_winning_margin_2_goal_rate_l8 REAL NOT NULL,
    away_team_winning_margin_2_goal_rate_l8 REAL NOT NULL,
    home_team_first_half_goal_rate REAL NOT NULL,
    away_team_first_half_goal_rate REAL NOT NULL,
    home_team_second_half_goal_rate REAL NOT NULL,
    away_team_second_half_goal_rate REAL NOT NULL,
    home_team_btts_rate_l4 REAL NOT NULL,
    away_team_btts_rate_l4 REAL NOT NULL,
    home_team_scored_rate_l4 REAL NOT NULL,
    away_team_scored_rate_l4 REAL NOT NULL,
    home_team_scored_against_rate_l4 REAL NOT NULL,
    away_team_scored_against_rate_l4 REAL NOT NULL,
    home_team_ht_won_rate_l8 REAL NOT NULL,
    away_team_ht_won_rate_l8 REAL NOT NULL,
    home_team_ht_tied_rate_l8 REAL NOT NULL,
    away_team_ht_tied_rate_l8 REAL NOT NULL,
    home_team_ht_lost_rate_l8 REAL NOT NULL,
    away_team_ht_lost_rate_l8 REAL NOT NULL,
    league_home_wins REAL NOT NULL,
    league_draws REAL NOT NULL,
    league_away_wins REAL NOT NULL,
    league_under_2_5 REAL NOT NULL,
    league_over_2_5 REAL NOT NULL,
    league_avg_goals REAL NOT NULL,
    ft_home_score INTEGER,
    ft_away_score INTEGER,
    ht_home_score INTEGER,
    ht_away_score INTEGER,
    ft_result TEXT,
    btts_yes_no INTEGER,
    u_o_2_5_goals INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS model_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    version TEXT NOT NULL,
    architecture TEXT NOT NULL,
    training_accuracy REAL,
    validation_accuracy REAL,
    loss REAL,
    training_date INTEGER NOT NULL,
    total_epochs INTEGER NOT NULL,
    total_samples INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    model_path TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS match_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_stats_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    pred_home_win_prob REAL NOT NULL,
    pred_draw_prob REAL NOT NULL,
    pred_away_win_prob REAL NOT NULL,
    pred_result TEXT NOT NULL,
    pred_home_score REAL NOT NULL,
    pred_away_score REAL NOT NULL,
    pred_btts_prob REAL NOT NULL,
    pred_btts INTEGER NOT NULL,
    pred_over_2_5_prob REAL NOT NULL,
    pred_over_2_5 INTEGER NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS basketball_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    home_points_scored_per_game REAL NOT NULL,
    away_points_scored_per_game REAL NOT NULL,
    home_points_received_per_game REAL NOT NULL,
    away_points_received_per_game REAL NOT NULL,
    home_won INTEGER NOT NULL,
    away_won INTEGER NOT NULL,
    home_tied INTEGER NOT NULL,
    away_tied INTEGER NOT NULL,
    home_lost INTEGER NOT NULL,
    away_lost INTEGER NOT NULL,
    home_avg_points_q1 REAL NOT NULL,
    away_avg_points_q1 REAL NOT NULL,
    home_avg_points_q2 REAL NOT NULL,
    away_avg_points_q2 REAL NOT NULL,
    home_avg_points_q3 REAL NOT NULL,
    away_avg_points_q3 REAL NOT NULL,
    home_avg_points_q4 REAL NOT NULL,
    away_avg_points_q4 REAL NOT NULL,
    ft_home_points INTEGER,
    ft_away_points INTEGER,
    ft_result TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS basketball_model_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    version TEXT NOT NULL,
    architecture TEXT NOT NULL,
    training_accuracy REAL,
    validation_accuracy REAL,
    loss REAL,
    training_date INTEGER NOT NULL,
    total_epochs INTEGER NOT NULL,
    total_samples INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    model_path TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS basketball_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    basketball_stats_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    pred_home_win_prob REAL NOT NULL,
    pred_away_win_prob REAL NOT NULL,
    pred_result TEXT NOT NULL,
    pred_home_points REAL NOT NULL,
    pred_away_points REAL NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS team_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL UNIQUE,
    elo_rating REAL NOT NULL DEFAULT 1500,
    attack_rating REAL NOT NULL DEFAULT 1500,
    defense_rating REAL NOT NULL DEFAULT 1500,
    total_matches INTEGER NOT NULL DEFAULT 0,
    home_matches INTEGER NOT NULL DEFAULT 0,
    away_matches INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    performance_as_favorite REAL NOT NULL DEFAULT 0,
    performance_as_underdog REAL NOT NULL DEFAULT 0,
    performance_in_bad_form REAL NOT NULL DEFAULT 0,
    performance_after_loss REAL NOT NULL DEFAULT 0,
    performance_after_win REAL NOT NULL DEFAULT 0,
    performance_in_high_scoring_games REAL NOT NULL DEFAULT 0,
    performance_in_low_scoring_games REAL NOT NULL DEFAULT 0,
    home_streak INTEGER NOT NULL DEFAULT 0,
    away_streak INTEGER NOT NULL DEFAULT 0,
    unbeaten_streak INTEGER NOT NULL DEFAULT 0,
    losing_streak INTEGER NOT NULL DEFAULT 0,
    goal_margin_avg REAL NOT NULL DEFAULT 0,
    winning_margin_by_1 INTEGER NOT NULL DEFAULT 0,
    winning_margin_by_2_plus INTEGER NOT NULL DEFAULT 0,
    loss_margin_by_1 INTEGER NOT NULL DEFAULT 0,
    loss_margin_by_2_plus INTEGER NOT NULL DEFAULT 0,
    win_rate_vs_odds REAL NOT NULL DEFAULT 0,
    over_2_5_vs_odds REAL NOT NULL DEFAULT 0,
    btts_vs_odds REAL NOT NULL DEFAULT 0,
    variance_in_market_accuracy REAL NOT NULL DEFAULT 0,
    underdog_win_rate REAL NOT NULL DEFAULT 0,
    high_odds_accuracy REAL NOT NULL DEFAULT 0,
    low_odds_accuracy REAL NOT NULL DEFAULT 0,
    ht_win_rate REAL NOT NULL DEFAULT 0,
    ht_draw_rate REAL NOT NULL DEFAULT 0,
    ht_loss_rate REAL NOT NULL DEFAULT 0,
    ft_win_rate REAL NOT NULL DEFAULT 0,
    ft_draw_rate REAL NOT NULL DEFAULT 0,
    ft_loss_rate REAL NOT NULL DEFAULT 0,
    ht_ft_consistency_rate REAL NOT NULL DEFAULT 0,
    ht_lead_to_win_rate REAL NOT NULL DEFAULT 0,
    ht_draw_to_win_rate REAL NOT NULL DEFAULT 0,
    ht_loss_to_win_rate REAL NOT NULL DEFAULT 0,
    btts_yes_rate REAL NOT NULL DEFAULT 0,
    btts_no_rate REAL NOT NULL DEFAULT 0,
    btts_and_win_rate REAL NOT NULL DEFAULT 0,
    btts_and_loss_rate REAL NOT NULL DEFAULT 0,
    btts_and_over_2_5_rate REAL NOT NULL DEFAULT 0,
    btts_and_under_2_5_rate REAL NOT NULL DEFAULT 0,
    goals_scored INTEGER NOT NULL DEFAULT 0,
    goals_conceded INTEGER NOT NULL DEFAULT 0,
    avg_goals_scored REAL NOT NULL DEFAULT 0,
    avg_goals_conceded REAL NOT NULL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rating_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_stats_id INTEGER NOT NULL,
    home_team_rating REAL NOT NULL,
    away_team_rating REAL NOT NULL,
    home_win_prob REAL NOT NULL,
    draw_prob REAL NOT NULL,
    away_win_prob REAL NOT NULL,
    predicted_result TEXT NOT NULL,
    predicted_home_score REAL NOT NULL,
    predicted_away_score REAL NOT NULL,
    btts_prob REAL NOT NULL,
    over_2_5_prob REAL NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Add missing columns to existing basketball_stats table if they don't exist (database.db)
try {
  databaseSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN home_avg_points_q4 REAL NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN away_avg_points_q4 REAL NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}

// Add odds columns to match_stats table
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_1 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_x REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_2 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_1 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_x REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_2 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}

// Add 39 NEW feature columns to match_stats table
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_rate_home REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_rate_away REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_rate_home REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_rate_away REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_points_per_game REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_points_per_game REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_0_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_0_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_1_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_1_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_3_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_3_5_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_failed_to_score_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_failed_to_score_rate REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_goals_per_half_ratio REAL NOT NULL DEFAULT 1.0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_goals_per_half_ratio REAL NOT NULL DEFAULT 1.0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN relative_attack_strength REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN relative_defense_strength REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN momentum_difference REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN recent_goal_difference REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_win_ratio_home REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_win_ratio_away REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN win_to_odds_index_home REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN win_to_odds_index_away REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_1 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_x REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_2 REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN market_expected_goals_home REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN market_expected_goals_away REAL NOT NULL DEFAULT 0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_league_position REAL NOT NULL DEFAULT 10;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_league_position REAL NOT NULL DEFAULT 10;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_league_position_normalized REAL NOT NULL DEFAULT 0.5;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_league_position_normalized REAL NOT NULL DEFAULT 0.5;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_margin_ratio REAL NOT NULL DEFAULT 1.0;`);
} catch (e) {}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_margin_ratio REAL NOT NULL DEFAULT 1.0;`);
} catch (e) {}

// Add matchDate column to match_stats table for time-aware splitting
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN match_date INTEGER NOT NULL DEFAULT (unixepoch());`);
  console.log('✅ Added match_date column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add matchDate column to basketball_stats table for time-aware splitting
try {
  databaseSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN match_date INTEGER NOT NULL DEFAULT (unixepoch());`);
  console.log('✅ Added match_date column to basketball_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add half-time score prediction columns to match_predictions table
try {
  databaseSqlite.exec(`ALTER TABLE match_predictions ADD COLUMN pred_ht_home_score REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added pred_ht_home_score column to match_predictions table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_predictions ADD COLUMN pred_ht_away_score REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added pred_ht_away_score column to match_predictions table');
} catch (e) {
  // Column already exists, ignore
}

testerSqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    home_team_form_home_l5 REAL NOT NULL,
    away_team_form_away_l5 REAL NOT NULL,
    home_team_form_overall_l5 REAL NOT NULL,
    away_team_form_overall_l5 REAL NOT NULL,
    home_team_form_diff_overall REAL NOT NULL,
    home_team_win_rate_l8 REAL NOT NULL,
    away_team_win_rate_l8 REAL NOT NULL,
    home_team_draw_rate_l8 REAL NOT NULL,
    away_team_draw_rate_l8 REAL NOT NULL,
    home_team_loss_rate_l8 REAL NOT NULL,
    away_team_loss_rate_l8 REAL NOT NULL,
    home_team_to_nil_rate_l8 REAL NOT NULL,
    away_team_to_nil_rate_l8 REAL NOT NULL,
    home_team_winning_margin_1_goal_rate_l8 REAL NOT NULL,
    away_team_winning_margin_1_goal_rate_l8 REAL NOT NULL,
    home_team_winning_margin_2_goal_rate_l8 REAL NOT NULL,
    away_team_winning_margin_2_goal_rate_l8 REAL NOT NULL,
    home_team_first_half_goal_rate REAL NOT NULL,
    away_team_first_half_goal_rate REAL NOT NULL,
    home_team_second_half_goal_rate REAL NOT NULL,
    away_team_second_half_goal_rate REAL NOT NULL,
    home_team_btts_rate_l4 REAL NOT NULL,
    away_team_btts_rate_l4 REAL NOT NULL,
    home_team_scored_rate_l4 REAL NOT NULL,
    away_team_scored_rate_l4 REAL NOT NULL,
    home_team_scored_against_rate_l4 REAL NOT NULL,
    away_team_scored_against_rate_l4 REAL NOT NULL,
    home_team_ht_won_rate_l8 REAL NOT NULL,
    away_team_ht_won_rate_l8 REAL NOT NULL,
    home_team_ht_tied_rate_l8 REAL NOT NULL,
    away_team_ht_tied_rate_l8 REAL NOT NULL,
    home_team_ht_lost_rate_l8 REAL NOT NULL,
    away_team_ht_lost_rate_l8 REAL NOT NULL,
    league_home_wins REAL NOT NULL,
    league_draws REAL NOT NULL,
    league_away_wins REAL NOT NULL,
    league_under_2_5 REAL NOT NULL,
    league_over_2_5 REAL NOT NULL,
    league_avg_goals REAL NOT NULL,
    ft_home_score INTEGER,
    ft_away_score INTEGER,
    ht_home_score INTEGER,
    ht_away_score INTEGER,
    ft_result TEXT,
    btts_yes_no INTEGER,
    u_o_2_5_goals INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS match_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_stats_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    pred_home_win_prob REAL NOT NULL,
    pred_draw_prob REAL NOT NULL,
    pred_away_win_prob REAL NOT NULL,
    pred_result TEXT NOT NULL,
    pred_home_score REAL NOT NULL,
    pred_away_score REAL NOT NULL,
    pred_btts_prob REAL NOT NULL,
    pred_btts INTEGER NOT NULL,
    pred_over_2_5_prob REAL NOT NULL,
    pred_over_2_5 INTEGER NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS basketball_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    home_points_scored_per_game REAL NOT NULL,
    away_points_scored_per_game REAL NOT NULL,
    home_points_received_per_game REAL NOT NULL,
    away_points_received_per_game REAL NOT NULL,
    home_won INTEGER NOT NULL,
    away_won INTEGER NOT NULL,
    home_tied INTEGER NOT NULL,
    away_tied INTEGER NOT NULL,
    home_lost INTEGER NOT NULL,
    away_lost INTEGER NOT NULL,
    home_avg_points_q1 REAL NOT NULL,
    away_avg_points_q1 REAL NOT NULL,
    home_avg_points_q2 REAL NOT NULL,
    away_avg_points_q2 REAL NOT NULL,
    home_avg_points_q3 REAL NOT NULL,
    away_avg_points_q3 REAL NOT NULL,
    home_avg_points_q4 REAL NOT NULL,
    away_avg_points_q4 REAL NOT NULL,
    ft_home_points INTEGER,
    ft_away_points INTEGER,
    ft_result TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS basketball_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    basketball_stats_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    pred_home_win_prob REAL NOT NULL,
    pred_away_win_prob REAL NOT NULL,
    pred_result TEXT NOT NULL,
    pred_home_points REAL NOT NULL,
    pred_away_points REAL NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS team_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL UNIQUE,
    elo_rating REAL NOT NULL DEFAULT 1500,
    attack_rating REAL NOT NULL DEFAULT 1500,
    defense_rating REAL NOT NULL DEFAULT 1500,
    total_matches INTEGER NOT NULL DEFAULT 0,
    home_matches INTEGER NOT NULL DEFAULT 0,
    away_matches INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    performance_as_favorite REAL NOT NULL DEFAULT 0,
    performance_as_underdog REAL NOT NULL DEFAULT 0,
    performance_in_bad_form REAL NOT NULL DEFAULT 0,
    performance_after_loss REAL NOT NULL DEFAULT 0,
    performance_after_win REAL NOT NULL DEFAULT 0,
    performance_in_high_scoring_games REAL NOT NULL DEFAULT 0,
    performance_in_low_scoring_games REAL NOT NULL DEFAULT 0,
    home_streak INTEGER NOT NULL DEFAULT 0,
    away_streak INTEGER NOT NULL DEFAULT 0,
    unbeaten_streak INTEGER NOT NULL DEFAULT 0,
    losing_streak INTEGER NOT NULL DEFAULT 0,
    goal_margin_avg REAL NOT NULL DEFAULT 0,
    winning_margin_by_1 INTEGER NOT NULL DEFAULT 0,
    winning_margin_by_2_plus INTEGER NOT NULL DEFAULT 0,
    loss_margin_by_1 INTEGER NOT NULL DEFAULT 0,
    loss_margin_by_2_plus INTEGER NOT NULL DEFAULT 0,
    win_rate_vs_odds REAL NOT NULL DEFAULT 0,
    over_2_5_vs_odds REAL NOT NULL DEFAULT 0,
    btts_vs_odds REAL NOT NULL DEFAULT 0,
    variance_in_market_accuracy REAL NOT NULL DEFAULT 0,
    underdog_win_rate REAL NOT NULL DEFAULT 0,
    high_odds_accuracy REAL NOT NULL DEFAULT 0,
    low_odds_accuracy REAL NOT NULL DEFAULT 0,
    ht_win_rate REAL NOT NULL DEFAULT 0,
    ht_draw_rate REAL NOT NULL DEFAULT 0,
    ht_loss_rate REAL NOT NULL DEFAULT 0,
    ft_win_rate REAL NOT NULL DEFAULT 0,
    ft_draw_rate REAL NOT NULL DEFAULT 0,
    ft_loss_rate REAL NOT NULL DEFAULT 0,
    ht_ft_consistency_rate REAL NOT NULL DEFAULT 0,
    ht_lead_to_win_rate REAL NOT NULL DEFAULT 0,
    ht_draw_to_win_rate REAL NOT NULL DEFAULT 0,
    ht_loss_to_win_rate REAL NOT NULL DEFAULT 0,
    btts_yes_rate REAL NOT NULL DEFAULT 0,
    btts_no_rate REAL NOT NULL DEFAULT 0,
    btts_and_win_rate REAL NOT NULL DEFAULT 0,
    btts_and_loss_rate REAL NOT NULL DEFAULT 0,
    btts_and_over_2_5_rate REAL NOT NULL DEFAULT 0,
    btts_and_under_2_5_rate REAL NOT NULL DEFAULT 0,
    goals_scored INTEGER NOT NULL DEFAULT 0,
    goals_conceded INTEGER NOT NULL DEFAULT 0,
    avg_goals_scored REAL NOT NULL DEFAULT 0,
    avg_goals_conceded REAL NOT NULL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rating_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_stats_id INTEGER NOT NULL,
    home_team_rating REAL NOT NULL,
    away_team_rating REAL NOT NULL,
    home_win_prob REAL NOT NULL,
    draw_prob REAL NOT NULL,
    away_win_prob REAL NOT NULL,
    predicted_result TEXT NOT NULL,
    predicted_home_score REAL NOT NULL,
    predicted_away_score REAL NOT NULL,
    btts_prob REAL NOT NULL,
    over_2_5_prob REAL NOT NULL,
    confidence REAL NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Add missing columns to existing basketball_stats table if they don't exist (tester.db)
try {
  testerSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN home_avg_points_q4 REAL NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN away_avg_points_q4 REAL NOT NULL DEFAULT 0;`);
} catch (e) {
  // Column already exists, ignore
}

// Add matchDate column to match_stats table in tester database for time-aware splitting
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN match_date INTEGER NOT NULL DEFAULT (unixepoch());`);
  console.log('✅ Added match_date column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add matchDate column to basketball_stats table in tester database for time-aware splitting
try {
  testerSqlite.exec(`ALTER TABLE basketball_stats ADD COLUMN match_date INTEGER NOT NULL DEFAULT (unixepoch());`);
  console.log('✅ Added match_date column to tester basketball_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add half-time score prediction columns to tester match_predictions table
try {
  testerSqlite.exec(`ALTER TABLE match_predictions ADD COLUMN pred_ht_home_score REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added pred_ht_home_score column to tester match_predictions table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_predictions ADD COLUMN pred_ht_away_score REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added pred_ht_away_score column to tester match_predictions table');
} catch (e) {
  // Column already exists, ignore
}

// Add odds and probability columns to match_stats table (database.db)
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_1 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_1 column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_x REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_x column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_2 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_2 column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_1 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_1 column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_x REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_x column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  databaseSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_2 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_2 column to match_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add odds and probability columns to match_stats table (tester.db)
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_1 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_1 column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_x REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_x column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN odds_2 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added odds_2 column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_1 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_1 column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_x REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_x column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}
try {
  testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN prob_2 REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Added prob_2 column to tester match_stats table');
} catch (e) {
  // Column already exists, ignore
}

// Add 39 NEW feature columns to tester match_stats table
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_rate_home REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_rate_away REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_rate_home REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_rate_away REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_points_per_game REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_points_per_game REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_0_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_0_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_1_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_1_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_over_3_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_over_3_5_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_failed_to_score_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_failed_to_score_rate REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_goals_per_half_ratio REAL NOT NULL DEFAULT 1.0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_goals_per_half_ratio REAL NOT NULL DEFAULT 1.0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN relative_attack_strength REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN relative_defense_strength REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN momentum_difference REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN recent_goal_difference REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_win_ratio_home REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_win_ratio_away REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN win_to_odds_index_home REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN win_to_odds_index_away REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_1 REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_x REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN expected_value_2 REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN market_expected_goals_home REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN market_expected_goals_away REAL NOT NULL DEFAULT 0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_league_position REAL NOT NULL DEFAULT 10;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_league_position REAL NOT NULL DEFAULT 10;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_league_position_normalized REAL NOT NULL DEFAULT 0.5;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_league_position_normalized REAL NOT NULL DEFAULT 0.5;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN home_team_win_margin_ratio REAL NOT NULL DEFAULT 1.0;`); } catch (e) {}
try { testerSqlite.exec(`ALTER TABLE match_stats ADD COLUMN away_team_win_margin_ratio REAL NOT NULL DEFAULT 1.0;`); } catch (e) {}

console.log('✅ All 39 new feature columns added to both database and tester');

export const databaseDb = drizzle(databaseSqlite, { schema });
export const testerDb = drizzle(testerSqlite, { schema });

export const db = databaseDb;
