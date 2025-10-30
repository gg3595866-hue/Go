import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrapeFixtures, scrapeMatchDetails } from "./scraper";

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

  const httpServer = createServer(app);
  return httpServer;
}
