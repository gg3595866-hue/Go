import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrapeFixtures, scrapeMatchDetails } from "./scraper";
import { storage } from "./storage";
import { insertMatchStatsSchema } from "@shared/schema";
import {
  extractFeaturesForDatabase,
  extractFeaturesForTester,
  generateTeamId,
  generateLeagueId,
  generateCountryId,
} from "./feature-extraction";

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

  // Bulk Upload Routes with Server-Sent Events
  app.post("/api/bulk-upload/database", async (req, res) => {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Fetch fixtures for the date
      const fixturesDate = new Date(date);
      const matches = await scrapeFixtures(fixturesDate);

      sendEvent({
        status: 'processing',
        totalMatches: matches.length,
        processed: 0,
        stored: 0,
      });

      let processed = 0;
      let stored = 0;

      // Load existing stats once at the beginning for duplicate checking
      const existingStats = await storage.getAllMatchStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}-${stat.ftHomeScore}-${stat.ftAwayScore}`)
      );

      // Process each match
      for (const match of matches) {
        try {
          sendEvent({
            status: 'processing',
            totalMatches: matches.length,
            processed,
            stored,
            currentMatch: `${match.homeTeam} vs ${match.awayTeam}`,
          });

          // Only process finished matches for database
          if (match.status !== 'FT' || !match.matchUrl) {
            processed++;
            continue;
          }

          // Fetch match details
          const matchDetails = await scrapeMatchDetails(match.matchUrl);

          // Generate IDs
          const homeTeamId = generateTeamId(matchDetails.homeTeam);
          const awayTeamId = generateTeamId(matchDetails.awayTeam);
          const leagueId = generateLeagueId(matchDetails.competition);
          const countryId = generateCountryId(matchDetails.competition);

          // Extract features
          const features = extractFeaturesForDatabase(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId
          );

          // Check if all required data is present
          if (
            features.ftHomeScore === null ||
            features.ftAwayScore === null ||
            features.homeTeamFormOverallL5 === 0 ||
            features.awayTeamFormOverallL5 === 0
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - incomplete data`);
            processed++;
            continue;
          }

          // Check for duplicates using the pre-loaded set
          const matchKey = `${homeTeamId}-${awayTeamId}-${features.ftHomeScore}-${features.ftAwayScore}`;
          if (existingKeys.has(matchKey)) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          // Store in database
          await storage.createMatchStats(features);
          existingKeys.add(matchKey); // Add to set to prevent duplicates within this batch
          stored++;
          processed++;

          sendEvent({
            status: 'processing',
            totalMatches: matches.length,
            processed,
            stored,
          });
        } catch (error) {
          console.error(`Error processing match ${match.homeTeam} vs ${match.awayTeam}:`, error);
          processed++;
        }
      }

      // Send completion event
      sendEvent({
        status: 'completed',
        totalMatches: matches.length,
        processed,
        stored,
      });

      res.end();
    } catch (error) {
      console.error("Error in bulk upload:", error);
      sendEvent({
        status: 'error',
        error: 'Failed to process bulk upload',
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });
      res.end();
    }
  });

  app.post("/api/bulk-upload/tester", async (req, res) => {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Fetch fixtures for the date
      const fixturesDate = new Date(date);
      const matches = await scrapeFixtures(fixturesDate);

      sendEvent({
        status: 'processing',
        totalMatches: matches.length,
        processed: 0,
        loaded: 0,
      });

      let processed = 0;
      let loaded = 0;

      // Process each match
      for (const match of matches) {
        try {
          sendEvent({
            status: 'processing',
            totalMatches: matches.length,
            processed,
            loaded,
            currentMatch: `${match.homeTeam} vs ${match.awayTeam}`,
          });

          // Only process scheduled/upcoming matches for tester
          if (!match.matchUrl) {
            processed++;
            continue;
          }

          // Fetch match details
          const matchDetails = await scrapeMatchDetails(match.matchUrl);

          // Generate IDs
          const homeTeamId = generateTeamId(matchDetails.homeTeam);
          const awayTeamId = generateTeamId(matchDetails.awayTeam);
          const leagueId = generateLeagueId(matchDetails.competition);
          const countryId = generateCountryId(matchDetails.competition);

          // Extract features without target variables
          const features = extractFeaturesForTester(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId
          );

          // Check if required statistical data is present
          if (
            features.homeTeamFormOverallL5 === 0 ||
            features.awayTeamFormOverallL5 === 0
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - incomplete data`);
            processed++;
            continue;
          }

          // Check for duplicates
          const existingStats = await storage.getAllMatchStats();
          const isDuplicate = existingStats.some(
            (stat) =>
              stat.homeTeamId === homeTeamId &&
              stat.awayTeamId === awayTeamId &&
              stat.ftHomeScore === null &&
              stat.ftAwayScore === null
          );

          if (isDuplicate) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          // Store in database
          await storage.createMatchStats(features);
          loaded++;
          processed++;

          sendEvent({
            status: 'processing',
            totalMatches: matches.length,
            processed,
            loaded,
          });
        } catch (error) {
          console.error(`Error processing match ${match.homeTeam} vs ${match.awayTeam}:`, error);
          processed++;
        }
      }

      // Send completion event
      sendEvent({
        status: 'completed',
        totalMatches: matches.length,
        processed,
        loaded,
      });

      res.end();
    } catch (error) {
      console.error("Error in test loading:", error);
      sendEvent({
        status: 'error',
        error: 'Failed to process test loading',
        totalMatches: 0,
        processed: 0,
        loaded: 0,
      });
      res.end();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
