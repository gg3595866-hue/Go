import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrapeFixtures, scrapeMatchDetails } from "./scraper";
import { storage } from "./storage";
import { insertMatchStatsSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get fixtures for a specific date
  app.get("/api/fixtures/:date", async (req, res) => {
    try {
      const dateString = req.params.date;
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const matches = await scrapeFixtures(date);
      
      res.json({
        date: dateString,
        matches,
      });
    } catch (error) {
      console.error("Error fetching fixtures:", error);
      res.status(500).json({ error: "Failed to fetch fixtures" });
    }
  });

  // Get match details by URL
  app.post("/api/match-details", async (req, res) => {
    try {
      const { matchUrl } = req.body;
      
      if (!matchUrl || typeof matchUrl !== 'string') {
        return res.status(400).json({ error: "matchUrl is required" });
      }
      
      const matchDetails = await scrapeMatchDetails(matchUrl);
      
      res.json(matchDetails);
    } catch (error) {
      console.error("Error fetching match details:", error);
      res.status(500).json({ error: "Failed to fetch match details" });
    }
  });

  // Match Statistics API Routes
  app.get("/api/match-stats", async (req, res) => {
    try {
      const stats = await storage.getAllMatchStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching match stats:", error);
      res.status(500).json({ error: "Failed to fetch match statistics" });
    }
  });

  app.get("/api/match-stats/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      
      const stats = await storage.getMatchStatsById(id);
      if (!stats) {
        return res.status(404).json({ error: "Match statistics not found" });
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching match stat:", error);
      res.status(500).json({ error: "Failed to fetch match statistic" });
    }
  });

  app.post("/api/match-stats", async (req, res) => {
    try {
      const validatedData = insertMatchStatsSchema.parse(req.body);
      const created = await storage.createMatchStats(validatedData);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating match stats:", error);
      res.status(400).json({ error: "Invalid match statistics data" });
    }
  });

  app.put("/api/match-stats/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      
      const updated = await storage.updateMatchStats(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Match statistics not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating match stats:", error);
      res.status(500).json({ error: "Failed to update match statistics" });
    }
  });

  app.delete("/api/match-stats/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      
      const deleted = await storage.deleteMatchStats(id);
      if (!deleted) {
        return res.status(404).json({ error: "Match statistics not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting match stats:", error);
      res.status(500).json({ error: "Failed to delete match statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
