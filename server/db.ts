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

export const databaseDb = drizzle(databaseSqlite, { schema });
export const testerDb = drizzle(testerSqlite, { schema });

export const db = databaseDb;
