import { 
  users, 
  matchStats, 
  teams, 
  leagues, 
  countries,
  modelMetadata,
  matchPredictions,
  basketballStats,
  basketballModelMetadata,
  basketballPredictions,
  teamRatings,
  ratingPredictions,
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
  type InsertMatchPrediction,
  type BasketballStats,
  type InsertBasketballStats,
  type BasketballModelMetadata,
  type InsertBasketballModelMetadata,
  type BasketballPrediction,
  type InsertBasketballPrediction,
  type TeamRating,
  type InsertTeamRating,
  type RatingPrediction,
  type InsertRatingPrediction
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
  getTeamById(id: number): Promise<Team | undefined>;
  getLeagueById(id: number): Promise<League | undefined>;
  getCountryById(id: number): Promise<Country | undefined>;
  getAllTeams(): Promise<Team[]>;
  
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
  deleteAllPredictions(): Promise<boolean>;
  
  // Basketball Statistics methods
  getAllBasketballStats(): Promise<BasketballStats[]>;
  getBasketballStatsById(id: number): Promise<BasketballStats | undefined>;
  createBasketballStats(stats: InsertBasketballStats): Promise<BasketballStats>;
  updateBasketballStats(id: number, stats: Partial<InsertBasketballStats>): Promise<BasketballStats | undefined>;
  deleteBasketballStats(id: number): Promise<boolean>;
  deleteAllBasketballStats(): Promise<boolean>;
  
  // Basketball Model methods
  getAllBasketballModels(): Promise<BasketballModelMetadata[]>;
  getActiveBasketballModel(): Promise<BasketballModelMetadata | undefined>;
  createBasketballModel(model: InsertBasketballModelMetadata): Promise<BasketballModelMetadata>;
  setActiveBasketballModel(id: number): Promise<boolean>;
  deleteAllBasketballModels(): Promise<boolean>;
  
  // Basketball Prediction methods
  createBasketballPrediction(prediction: InsertBasketballPrediction): Promise<BasketballPrediction>;
  getBasketballPredictionsByStatsId(basketballStatsId: number): Promise<BasketballPrediction[]>;
  getAllBasketballPredictions(): Promise<BasketballPrediction[]>;
  deleteAllBasketballPredictions(): Promise<boolean>;
  
  // Team Rating methods
  getTeamRating(teamId: number): Promise<TeamRating | undefined>;
  getAllTeamRatings(): Promise<TeamRating[]>;
  createTeamRating(rating: InsertTeamRating): Promise<TeamRating>;
  updateTeamRating(teamId: number, rating: Partial<InsertTeamRating>): Promise<TeamRating | undefined>;
  deleteAllTeamRatings(): Promise<boolean>;
  
  // Rating Prediction methods
  createRatingPrediction(prediction: InsertRatingPrediction): Promise<RatingPrediction>;
  getRatingPredictionsByMatchStatsId(matchStatsId: number): Promise<RatingPrediction[]>;
  getAllRatingPredictions(): Promise<RatingPrediction[]>;
  deleteAllRatingPredictions(): Promise<boolean>;
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

  async getOrCreateLeagueId(competitionName: string): Promise<number> {
    // Extract country from competition name to ensure unique league names
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
      'canada': 'canada',
      'egypt': 'egypt',
      'ukraine': 'ukraine',
      'israel': 'israel',
      'european': 'europe',
      'uefa': 'europe',
      'champions league': 'europe',
      'europa league': 'europe',
      'conference league': 'europe',
    };
    
    const lowerComp = competitionName.toLowerCase().trim().replace(/\s+/g, ' ');
    let countryPrefix = '';
    
    // Try to match a known country
    for (const [key, value] of Object.entries(countryMap)) {
      if (lowerComp.includes(key)) {
        countryPrefix = value;
        break;
      }
    }
    
    // Normalize the league name to always include country prefix
    // This ensures "Premier League" from different countries get different IDs
    let normalizedName: string;
    
    if (countryPrefix) {
      // Check if the competition name already starts with the country
      const countryPrefixPattern = new RegExp(`^${countryPrefix}\\s*[-:]?\\s*`, 'i');
      if (countryPrefixPattern.test(lowerComp)) {
        // Already has country prefix, just normalize
        normalizedName = lowerComp;
      } else {
        // Add country prefix
        normalizedName = `${countryPrefix} - ${lowerComp}`;
      }
    } else {
      // No known country found, use the competition name as-is
      // This preserves uniqueness for unknown competitions
      normalizedName = lowerComp;
    }
    
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

  async getTeamById(id: number): Promise<Team | undefined> {
    const [team] = await this.mappingDb
      .select()
      .from(teams)
      .where(eq(teams.id, id));
    return team || undefined;
  }

  async getLeagueById(id: number): Promise<League | undefined> {
    const [league] = await this.mappingDb
      .select()
      .from(leagues)
      .where(eq(leagues.id, id));
    return league || undefined;
  }

  async getCountryById(id: number): Promise<Country | undefined> {
    const [country] = await this.mappingDb
      .select()
      .from(countries)
      .where(eq(countries.id, id));
    return country || undefined;
  }

  async getAllTeams(): Promise<Team[]> {
    return this.mappingDb.select().from(teams);
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

  async deleteAllPredictions(): Promise<boolean> {
    try {
      await this.db.delete(matchPredictions);
      return true;
    } catch (error) {
      console.error('Error deleting all predictions:', error);
      return false;
    }
  }
  
  // Basketball Statistics methods
  async getAllBasketballStats(): Promise<BasketballStats[]> {
    return this.db.select().from(basketballStats).orderBy(desc(basketballStats.createdAt));
  }

  async getBasketballStatsById(id: number): Promise<BasketballStats | undefined> {
    const [stats] = await this.db.select().from(basketballStats).where(eq(basketballStats.id, id));
    return stats || undefined;
  }

  async createBasketballStats(stats: InsertBasketballStats): Promise<BasketballStats> {
    const [created] = await this.db
      .insert(basketballStats)
      .values(stats)
      .returning();
    return created;
  }

  async updateBasketballStats(id: number, stats: Partial<InsertBasketballStats>): Promise<BasketballStats | undefined> {
    const [updated] = await this.db
      .update(basketballStats)
      .set(stats)
      .where(eq(basketballStats.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBasketballStats(id: number): Promise<boolean> {
    const result = await this.db
      .delete(basketballStats)
      .where(eq(basketballStats.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteAllBasketballStats(): Promise<boolean> {
    await this.db.delete(basketballStats);
    return true;
  }

  // Basketball Model methods
  async getAllBasketballModels(): Promise<BasketballModelMetadata[]> {
    return this.db.select().from(basketballModelMetadata).orderBy(desc(basketballModelMetadata.createdAt));
  }

  async getActiveBasketballModel(): Promise<BasketballModelMetadata | undefined> {
    const [model] = await this.db
      .select()
      .from(basketballModelMetadata)
      .where(eq(basketballModelMetadata.isActive, true))
      .limit(1);
    return model || undefined;
  }

  async createBasketballModel(model: InsertBasketballModelMetadata): Promise<BasketballModelMetadata> {
    const [created] = await this.db
      .insert(basketballModelMetadata)
      .values(model)
      .returning();
    return created;
  }

  async setActiveBasketballModel(id: number): Promise<boolean> {
    await this.db
      .update(basketballModelMetadata)
      .set({ isActive: false });
    
    const result = await this.db
      .update(basketballModelMetadata)
      .set({ isActive: true })
      .where(eq(basketballModelMetadata.id, id))
      .returning();
    
    return result.length > 0;
  }

  async deleteAllBasketballModels(): Promise<boolean> {
    try {
      await this.db.delete(basketballModelMetadata);
      return true;
    } catch (error) {
      console.error('Error deleting all basketball models:', error);
      return false;
    }
  }

  // Basketball Prediction methods
  async createBasketballPrediction(prediction: InsertBasketballPrediction): Promise<BasketballPrediction> {
    const [created] = await this.db
      .insert(basketballPredictions)
      .values(prediction)
      .returning();
    return created;
  }

  async getBasketballPredictionsByStatsId(basketballStatsId: number): Promise<BasketballPrediction[]> {
    return this.db
      .select()
      .from(basketballPredictions)
      .where(eq(basketballPredictions.basketballStatsId, basketballStatsId))
      .orderBy(desc(basketballPredictions.createdAt));
  }

  async getAllBasketballPredictions(): Promise<BasketballPrediction[]> {
    return this.db.select().from(basketballPredictions).orderBy(desc(basketballPredictions.createdAt));
  }

  async deleteAllBasketballPredictions(): Promise<boolean> {
    try {
      await this.db.delete(basketballPredictions);
      return true;
    } catch (error) {
      console.error('Error deleting all basketball predictions:', error);
      return false;
    }
  }
  
  // Team Rating methods
  async getTeamRating(teamId: number): Promise<TeamRating | undefined> {
    const [rating] = await this.db
      .select()
      .from(teamRatings)
      .where(eq(teamRatings.teamId, teamId));
    return rating || undefined;
  }
  
  async getAllTeamRatings(): Promise<TeamRating[]> {
    return this.db.select().from(teamRatings).orderBy(desc(teamRatings.eloRating));
  }
  
  async createTeamRating(rating: InsertTeamRating): Promise<TeamRating> {
    const [created] = await this.db
      .insert(teamRatings)
      .values(rating)
      .returning();
    return created;
  }
  
  async updateTeamRating(teamId: number, rating: Partial<InsertTeamRating>): Promise<TeamRating | undefined> {
    const [updated] = await this.db
      .update(teamRatings)
      .set({ ...rating, updatedAt: new Date() })
      .where(eq(teamRatings.teamId, teamId))
      .returning();
    return updated || undefined;
  }
  
  async deleteAllTeamRatings(): Promise<boolean> {
    try {
      await this.db.delete(teamRatings);
      return true;
    } catch (error) {
      console.error('Error deleting all team ratings:', error);
      return false;
    }
  }
  
  // Rating Prediction methods
  async createRatingPrediction(prediction: InsertRatingPrediction): Promise<RatingPrediction> {
    const [created] = await this.db
      .insert(ratingPredictions)
      .values(prediction)
      .returning();
    return created;
  }
  
  async getRatingPredictionsByMatchStatsId(matchStatsId: number): Promise<RatingPrediction[]> {
    return this.db
      .select()
      .from(ratingPredictions)
      .where(eq(ratingPredictions.matchStatsId, matchStatsId))
      .orderBy(desc(ratingPredictions.createdAt));
  }
  
  async getAllRatingPredictions(): Promise<RatingPrediction[]> {
    return this.db.select().from(ratingPredictions).orderBy(desc(ratingPredictions.createdAt));
  }
  
  async deleteAllRatingPredictions(): Promise<boolean> {
    try {
      await this.db.delete(ratingPredictions);
      return true;
    } catch (error) {
      console.error('Error deleting all rating predictions:', error);
      return false;
    }
  }
}

// Create storage instances - testerStorage uses databaseDb for entity mappings
// This ensures consistent IDs across both databases
export const databaseStorage = new DatabaseStorage(databaseDb);
export const testerStorage = new DatabaseStorage(testerDb, databaseDb);

export const storage = databaseStorage;
