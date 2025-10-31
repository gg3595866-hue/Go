import { 
  users, 
  matchStats, 
  teams, 
  leagues, 
  countries,
  type User, 
  type InsertUser, 
  type MatchStats, 
  type InsertMatchStats,
  type Team,
  type League,
  type Country
} from "@shared/schema";
import { databaseDb, testerDb } from "./db";
import { eq, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllMatchStats(): Promise<MatchStats[]>;
  getMatchStatsById(id: number): Promise<MatchStats | undefined>;
  createMatchStats(stats: InsertMatchStats): Promise<MatchStats>;
  updateMatchStats(id: number, stats: Partial<InsertMatchStats>): Promise<MatchStats | undefined>;
  deleteMatchStats(id: number): Promise<boolean>;
  
  // Entity ID mapping methods - ensures consistent IDs across database and tester
  getOrCreateTeamId(teamName: string): Promise<number>;
  getOrCreateLeagueId(leagueName: string): Promise<number>;
  getOrCreateCountryId(countryName: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  private db: BetterSQLite3Database<typeof import("@shared/schema")>;
  private mappingDb: BetterSQLite3Database<typeof import("@shared/schema")>;

  constructor(
    db: BetterSQLite3Database<typeof import("@shared/schema")>,
    mappingDb?: BetterSQLite3Database<typeof import("@shared/schema")>
  ) {
    this.db = db;
    // Use the main database for mapping if not specified (ensures shared IDs)
    this.mappingDb = mappingDb || db;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllMatchStats(): Promise<MatchStats[]> {
    return this.db.select().from(matchStats).orderBy(desc(matchStats.createdAt));
  }

  async getMatchStatsById(id: number): Promise<MatchStats | undefined> {
    const [stats] = await this.db.select().from(matchStats).where(eq(matchStats.id, id));
    return stats || undefined;
  }

  async createMatchStats(stats: InsertMatchStats): Promise<MatchStats> {
    const [created] = await this.db
      .insert(matchStats)
      .values(stats)
      .returning();
    return created;
  }

  async updateMatchStats(id: number, stats: Partial<InsertMatchStats>): Promise<MatchStats | undefined> {
    const [updated] = await this.db
      .update(matchStats)
      .set(stats)
      .where(eq(matchStats.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMatchStats(id: number): Promise<boolean> {
    const result = await this.db
      .delete(matchStats)
      .where(eq(matchStats.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteAllMatchStats(): Promise<boolean> {
    await this.db.delete(matchStats);
    return true;
  }

  // Entity ID mapping methods - ensures consistent IDs across database and tester
  // These use mappingDb to ensure IDs are shared between database and tester
  async getOrCreateTeamId(teamName: string): Promise<number> {
    // Normalize team name (trim and handle case)
    const normalizedName = teamName.trim();
    
    // Try to find existing team in mapping database
    const [existingTeam] = await this.mappingDb
      .select()
      .from(teams)
      .where(eq(teams.name, normalizedName));
    
    if (existingTeam) {
      return existingTeam.id;
    }
    
    // Create new team in mapping database
    const [newTeam] = await this.mappingDb
      .insert(teams)
      .values({ name: normalizedName })
      .returning();
    
    return newTeam.id;
  }

  async getOrCreateLeagueId(leagueName: string): Promise<number> {
    // Normalize league name (trim and handle case)
    const normalizedName = leagueName.trim();
    
    // Try to find existing league in mapping database
    const [existingLeague] = await this.mappingDb
      .select()
      .from(leagues)
      .where(eq(leagues.name, normalizedName));
    
    if (existingLeague) {
      return existingLeague.id;
    }
    
    // Create new league in mapping database
    const [newLeague] = await this.mappingDb
      .insert(leagues)
      .values({ name: normalizedName })
      .returning();
    
    return newLeague.id;
  }

  async getOrCreateCountryId(competitionName: string): Promise<number> {
    // Extract country from competition name using common patterns
    const countryMap: Record<string, string> = {
      'spain': 'Spain',
      'england': 'England',
      'germany': 'Germany',
      'italy': 'Italy',
      'france': 'France',
      'portugal': 'Portugal',
      'netherlands': 'Netherlands',
      'belgium': 'Belgium',
      'scotland': 'Scotland',
      'turkey': 'Turkey',
      'brazil': 'Brazil',
      'argentina': 'Argentina',
      'mexico': 'Mexico',
      'usa': 'USA',
      'united states': 'USA',
      'european': 'Europe',
      'uefa': 'Europe',
      'champions league': 'Europe',
      'europa league': 'Europe',
    };
    
    const lowerComp = competitionName.toLowerCase();
    let countryName = 'Unknown';
    
    // Try to match a known country
    for (const [key, value] of Object.entries(countryMap)) {
      if (lowerComp.includes(key)) {
        countryName = value;
        break;
      }
    }
    
    // If no match found, use the competition name itself as country
    if (countryName === 'Unknown') {
      countryName = competitionName.trim();
    }
    
    // Try to find existing country in mapping database
    const [existingCountry] = await this.mappingDb
      .select()
      .from(countries)
      .where(eq(countries.name, countryName));
    
    if (existingCountry) {
      return existingCountry.id;
    }
    
    // Create new country in mapping database
    const [newCountry] = await this.mappingDb
      .insert(countries)
      .values({ name: countryName })
      .returning();
    
    return newCountry.id;
  }
}

// Create storage instances - testerStorage uses databaseDb for entity mappings
// This ensures consistent IDs across both databases
export const databaseStorage = new DatabaseStorage(databaseDb);
export const testerStorage = new DatabaseStorage(testerDb, databaseDb);

export const storage = databaseStorage;
