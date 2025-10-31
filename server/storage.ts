import { 
  users, 
  matchStats, 
  teams, 
  leagues, 
  countries,
  modelMetadata,
  matchPredictions,
  type User, 
  type InsertUser, 
  type MatchStats, 
  type InsertMatchStats,
  type Team,
  type League,
  type Country,
  type ModelMetadata,
  type InsertModelMetadata,
  type MatchPrediction,
  type InsertMatchPrediction
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
  
  // ML Model methods
  getAllModels(): Promise<ModelMetadata[]>;
  getActiveModel(): Promise<ModelMetadata | undefined>;
  createModel(model: InsertModelMetadata): Promise<ModelMetadata>;
  setActiveModel(id: number): Promise<boolean>;
  deleteAllModels(): Promise<boolean>;
  
  // Prediction methods
  createPrediction(prediction: InsertMatchPrediction): Promise<MatchPrediction>;
  getPredictionsByMatchStatsId(matchStatsId: number): Promise<MatchPrediction[]>;
  getAllPredictions(): Promise<MatchPrediction[]>;
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
    // Normalize team name (lowercase, trim, and collapse multiple spaces)
    const normalizedName = teamName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    
    // Try to find existing team in mapping database
    const [existingTeam] = await this.mappingDb
      .select()
      .from(teams)
      .where(eq(teams.name, normalizedName));
    
    if (existingTeam) {
      return existingTeam.id;
    }
    
    // Create new team in mapping database
    try {
      const [newTeam] = await this.mappingDb
        .insert(teams)
        .values({ name: normalizedName })
        .returning();
      
      return newTeam.id;
    } catch (error) {
      // Handle race condition: if another request created the team concurrently
      const [existingTeam] = await this.mappingDb
        .select()
        .from(teams)
        .where(eq(teams.name, normalizedName));
      
      if (existingTeam) {
        return existingTeam.id;
      }
      throw error;
    }
  }

  async getOrCreateLeagueId(leagueName: string): Promise<number> {
    // Normalize league name (lowercase, trim, and collapse multiple spaces)
    const normalizedName = leagueName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    
    // Try to find existing league in mapping database
    const [existingLeague] = await this.mappingDb
      .select()
      .from(leagues)
      .where(eq(leagues.name, normalizedName));
    
    if (existingLeague) {
      return existingLeague.id;
    }
    
    // Create new league in mapping database
    try {
      const [newLeague] = await this.mappingDb
        .insert(leagues)
        .values({ name: normalizedName })
        .returning();
      
      return newLeague.id;
    } catch (error) {
      // Handle race condition: if another request created the league concurrently
      const [existingLeague] = await this.mappingDb
        .select()
        .from(leagues)
        .where(eq(leagues.name, normalizedName));
      
      if (existingLeague) {
        return existingLeague.id;
      }
      throw error;
    }
  }

  async getOrCreateCountryId(competitionName: string): Promise<number> {
    // Extract country from competition name using common patterns
    const countryMap: Record<string, string> = {
      'spain': 'spain',
      'england': 'england',
      'germany': 'germany',
      'italy': 'italy',
      'france': 'france',
      'portugal': 'portugal',
      'netherlands': 'netherlands',
      'belgium': 'belgium',
      'scotland': 'scotland',
      'turkey': 'turkey',
      'brazil': 'brazil',
      'argentina': 'argentina',
      'mexico': 'mexico',
      'usa': 'usa',
      'united states': 'usa',
      'european': 'europe',
      'uefa': 'europe',
      'champions league': 'europe',
      'europa league': 'europe',
    };
    
    const lowerComp = competitionName.toLowerCase().trim();
    let countryName = 'unknown';
    
    // Try to match a known country
    for (const [key, value] of Object.entries(countryMap)) {
      if (lowerComp.includes(key)) {
        countryName = value;
        break;
      }
    }
    
    // If no match found, use the normalized competition name as country
    if (countryName === 'unknown') {
      countryName = lowerComp.replace(/\s+/g, ' ');
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
    try {
      const [newCountry] = await this.mappingDb
        .insert(countries)
        .values({ name: countryName })
        .returning();
      
      return newCountry.id;
    } catch (error) {
      // Handle race condition: if another request created the country concurrently
      const [existingCountry] = await this.mappingDb
        .select()
        .from(countries)
        .where(eq(countries.name, countryName));
      
      if (existingCountry) {
        return existingCountry.id;
      }
      throw error;
    }
  }

  // ML Model methods
  async getAllModels(): Promise<ModelMetadata[]> {
    return this.db.select().from(modelMetadata).orderBy(desc(modelMetadata.createdAt));
  }

  async getActiveModel(): Promise<ModelMetadata | undefined> {
    const [model] = await this.db
      .select()
      .from(modelMetadata)
      .where(eq(modelMetadata.isActive, true))
      .limit(1);
    return model || undefined;
  }

  async createModel(model: InsertModelMetadata): Promise<ModelMetadata> {
    const [created] = await this.db
      .insert(modelMetadata)
      .values(model)
      .returning();
    return created;
  }

  async setActiveModel(id: number): Promise<boolean> {
    // First, deactivate all models
    await this.db
      .update(modelMetadata)
      .set({ isActive: false });
    
    // Then activate the specified model
    const result = await this.db
      .update(modelMetadata)
      .set({ isActive: true })
      .where(eq(modelMetadata.id, id))
      .returning();
    
    return result.length > 0;
  }

  async deleteAllModels(): Promise<boolean> {
    try {
      await this.db.delete(modelMetadata);
      return true;
    } catch (error) {
      console.error('Error deleting all models:', error);
      return false;
    }
  }

  // Prediction methods
  async createPrediction(prediction: InsertMatchPrediction): Promise<MatchPrediction> {
    const [created] = await this.db
      .insert(matchPredictions)
      .values(prediction)
      .returning();
    return created;
  }

  async getPredictionsByMatchStatsId(matchStatsId: number): Promise<MatchPrediction[]> {
    return this.db
      .select()
      .from(matchPredictions)
      .where(eq(matchPredictions.matchStatsId, matchStatsId))
      .orderBy(desc(matchPredictions.createdAt));
  }

  async getAllPredictions(): Promise<MatchPrediction[]> {
    return this.db.select().from(matchPredictions).orderBy(desc(matchPredictions.createdAt));
  }
}

// Create storage instances - testerStorage uses databaseDb for entity mappings
// This ensures consistent IDs across both databases
export const databaseStorage = new DatabaseStorage(databaseDb);
export const testerStorage = new DatabaseStorage(testerDb, databaseDb);

export const storage = databaseStorage;
