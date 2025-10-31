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
`);

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
`);

export const databaseDb = drizzle(databaseSqlite, { schema });
export const testerDb = drizzle(testerSqlite, { schema });

export const db = databaseDb;
