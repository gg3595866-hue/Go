import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrapeFixtures, scrapeMatchDetails, scrapeLeagueStats } from "./scraper";
import { storage, databaseStorage, testerStorage } from "./storage";
import { insertMatchStatsSchema } from "@shared/schema";
import {
  extractFeaturesForDatabase,
  extractFeaturesForTester,
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

  app.get("/api/match-stats/database", async (req, res) => {
    try {
      const stats = await databaseStorage.getAllMatchStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching database match stats:", error);
      res.status(500).json({ error: "Failed to fetch database match statistics" });
    }
  });

  app.get("/api/match-stats/tester", async (req, res) => {
    try {
      const stats = await testerStorage.getAllMatchStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching tester match stats:", error);
      res.status(500).json({ error: "Failed to fetch tester match statistics" });
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

  app.delete("/api/match-stats/database/clear", async (req, res) => {
    try {
      await databaseStorage.deleteAllMatchStats();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing database match stats:", error);
      res.status(500).json({ error: "Failed to clear database match statistics" });
    }
  });

  app.delete("/api/match-stats/tester/clear", async (req, res) => {
    try {
      await testerStorage.deleteAllMatchStats();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing tester match stats:", error);
      res.status(500).json({ error: "Failed to clear tester match statistics" });
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
      const existingStats = await databaseStorage.getAllMatchStats();
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

          // Get or create IDs using database mapping (ensures consistency)
          const homeTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await databaseStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await databaseStorage.getOrCreateCountryId(matchDetails.competition);

          // Fetch league statistics
          const leagueStats = await scrapeLeagueStats(matchDetails.competition);

          // Extract features
          const features = extractFeaturesForDatabase(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId,
            leagueStats
          );

          // Check if all required data is present (scores must exist for database)
          if (
            features.ftHomeScore === null ||
            features.ftAwayScore === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores`);
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
          await databaseStorage.createMatchStats(features);
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

      // Load existing stats once at the beginning for duplicate checking
      const existingStats = await testerStorage.getAllMatchStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}`)
      );

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

          // Get or create IDs using database mapping (ensures consistency)
          // Note: testerStorage uses databaseDb for mapping, ensuring same IDs
          const homeTeamId = await testerStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await testerStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await testerStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await testerStorage.getOrCreateCountryId(matchDetails.competition);

          // Fetch league statistics
          const leagueStats = await scrapeLeagueStats(matchDetails.competition);

          // Extract features without target variables
          const features = extractFeaturesForTester(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId,
            leagueStats
          );

          // For tester data, we don't need to validate form (0 is acceptable)

          // Check for duplicates using the pre-loaded set
          const matchKey = `${homeTeamId}-${awayTeamId}`;
          if (existingKeys.has(matchKey)) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          // Store in tester database
          await testerStorage.createMatchStats(features);
          existingKeys.add(matchKey); // Add to set to prevent duplicates within this batch
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

  // League-Based Bulk Upload (Database only, for training data)
  app.post("/api/bulk-upload/league", async (req, res) => {
    const { competition, year } = req.body;

    if (!competition || !year) {
      return res.status(400).json({ error: "Competition name and year are required" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent({
        status: 'starting',
        message: `Fetching matches for ${competition} ${year}...`,
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });

      // Scrape all matches for the league and year
      const { scrapeLeagueMatches } = await import('./scraper');
      const matches = await scrapeLeagueMatches(
        competition,
        year,
        (message, matchCount) => {
          sendEvent({
            status: 'fetching',
            message,
            totalMatches: matchCount,
            processed: 0,
            stored: 0,
          });
        }
      );

      sendEvent({
        status: 'processing',
        message: `Processing ${matches.length} matches...`,
        totalMatches: matches.length,
        processed: 0,
        stored: 0,
      });

      let processed = 0;
      let stored = 0;

      // Load existing stats once at the beginning for duplicate checking
      const existingStats = await databaseStorage.getAllMatchStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}-${stat.ftHomeScore}-${stat.ftAwayScore}`)
      );

      // Process each match
      for (const match of matches) {
        try {
          sendEvent({
            status: 'processing',
            message: `Processing ${match.homeTeam} vs ${match.awayTeam}...`,
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

          // Get or create IDs using database mapping (ensures consistency)
          const homeTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await databaseStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await databaseStorage.getOrCreateCountryId(matchDetails.competition);

          // Fetch league statistics
          const leagueStats = await scrapeLeagueStats(matchDetails.competition);

          // Extract features
          const features = extractFeaturesForDatabase(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId,
            leagueStats
          );

          // Check if all required data is present (scores must exist for database)
          if (
            features.ftHomeScore === null ||
            features.ftAwayScore === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores`);
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
          await databaseStorage.createMatchStats(features);
          existingKeys.add(matchKey); // Add to set to prevent duplicates within this batch
          stored++;
          processed++;

          sendEvent({
            status: 'processing',
            message: `Processed ${processed}/${matches.length} matches`,
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
        message: `Completed! Stored ${stored} matches for ${competition} ${year}`,
        totalMatches: matches.length,
        processed,
        stored,
      });

      res.end();
    } catch (error) {
      console.error("Error in league bulk upload:", error);
      sendEvent({
        status: 'error',
        error: `Failed to process league bulk upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: 'An error occurred during the bulk upload',
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });
      res.end();
    }
  });

  // Test endpoint to examine league page HTML structure
  app.get("/api/test/league-page", async (req, res) => {
    const { competition, year } = req.query;

    if (!competition || !year) {
      return res.status(400).json({ error: "Competition name and year are required" });
    }

    try {
      const { extractLeagueSlug } = await import('./scraper');
      const cloudscraper = (await import('cloudscraper')).default;
      const cheerio = await import('cheerio');
      
      const leagueSlug = extractLeagueSlug(competition as string);
      const seasonFormat = `${year}-${parseInt(year as string) + 1}`;
      const baseUrl = `https://sportstats365.com/football/${leagueSlug}/${seasonFormat}`;
      
      console.log(`\n=== TESTING LEAGUE PAGE ACCESS ===`);
      console.log(`Competition: ${competition}`);
      console.log(`Year: ${year}`);
      console.log(`League Slug: ${leagueSlug}`);
      console.log(`Season Format: ${seasonFormat}`);
      console.log(`Base URL: ${baseUrl}`);
      
      const html: string = await new Promise((resolve, reject) => {
        cloudscraper.get({
          uri: baseUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }, (error: any, response: any, body: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(body);
          }
        });
      });
      
      const $ = cheerio.load(html);
      
      // Extract key information
      const pageTitle = $('title').text();
      const h1Text = $('h1').first().text();
      const fixturesTabExists = $('a[href*="fixtures"], button[hx-target*="fixtures"]').length > 0;
      const weekNavigationButtons = $('button[hx-get*="week"], a[hx-get*="week"]').length;
      const hxGetUrls: string[] = [];
      $('button[hx-get], a[hx-get]').each((_, el) => {
        const hxGet = $(el).attr('hx-get');
        if (hxGet) hxGetUrls.push(hxGet);
      });
      
      const matchCount = $('.list-group-item a[href*="/compare/"]').length;
      
      console.log(`Page Title: ${pageTitle}`);
      console.log(`H1 Text: ${h1Text}`);
      console.log(`Fixtures Tab Exists: ${fixturesTabExists}`);
      console.log(`Week Navigation Buttons: ${weekNavigationButtons}`);
      console.log(`Match Items Found: ${matchCount}`);
      console.log(`hx-get URLs found: ${hxGetUrls.length}`);
      console.log(`First 10 hx-get URLs:`, hxGetUrls.slice(0, 10));
      
      return res.json({
        success: true,
        url: baseUrl,
        leagueSlug,
        seasonFormat,
        pageInfo: {
          title: pageTitle,
          h1: h1Text,
          fixturesTabExists,
          weekNavigationButtons,
          matchCount,
          hxGetUrlsCount: hxGetUrls.length,
          sampleHxGetUrls: hxGetUrls.slice(0, 20)
        },
        htmlPreview: html.substring(0, 3000)
      });
    } catch (error: any) {
      console.error("Error testing league page:", error);
      return res.status(500).json({
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
