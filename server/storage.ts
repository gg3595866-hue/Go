import { users, matchStats, type User, type InsertUser, type MatchStats, type InsertMatchStats } from "@shared/schema";
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
}

export class DatabaseStorage implements IStorage {
  private db: BetterSQLite3Database<typeof import("@shared/schema")>;

  constructor(db: BetterSQLite3Database<typeof import("@shared/schema")>) {
    this.db = db;
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
}

export const databaseStorage = new DatabaseStorage(databaseDb);
export const testerStorage = new DatabaseStorage(testerDb);

export const storage = databaseStorage;
