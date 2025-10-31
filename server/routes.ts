import type { Express } from "express";
import { createServer, type Server } from "http";
import { scrapeFixtures, scrapeBasketballFixtures, scrapeMatchDetails, scrapeBasketballMatchDetails, scrapeLeagueStats } from "./scraper";
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

  // Get basketball fixtures for a specific date
  app.get("/api/basketball/fixtures/:date", async (req, res) => {
    try {
      const dateString = req.params.date;
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const matches = await scrapeBasketballFixtures(date);
      
      res.json({
        date: dateString,
        matches,
      });
    } catch (error) {
      console.error("Error fetching basketball fixtures:", error);
      res.status(500).json({ error: "Failed to fetch basketball fixtures" });
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

  // Get basketball match details by URL
  app.post("/api/basketball/match-details", async (req, res) => {
    try {
      const { matchUrl } = req.body;
      
      if (!matchUrl || typeof matchUrl !== 'string') {
        return res.status(400).json({ error: "matchUrl is required" });
      }
      
      const matchDetails = await scrapeBasketballMatchDetails(matchUrl);
      
      res.json(matchDetails);
    } catch (error) {
      console.error("Error fetching basketball match details:", error);
      res.status(500).json({ error: "Failed to fetch basketball match details" });
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
      
      // Enrich stats with team names
      const enrichedStats = await Promise.all(
        stats.map(async (stat) => {
          const homeTeam = await testerStorage.getTeamById(stat.homeTeamId);
          const awayTeam = await testerStorage.getTeamById(stat.awayTeamId);
          
          return {
            ...stat,
            homeTeamName: homeTeam?.name || 'Unknown',
            awayTeamName: awayTeam?.name || 'Unknown'
          };
        })
      );
      
      res.json(enrichedStats);
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
      // Clear predictions first (they reference match_stats)
      await testerStorage.deleteAllPredictions();
      // Then clear match stats
      await testerStorage.deleteAllMatchStats();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing tester data:", error);
      res.status(500).json({ error: "Failed to clear tester data" });
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

          // Check if all required data is present (scores and complete features must exist for database)
          if (
            features.ftHomeScore === null ||
            features.ftAwayScore === null ||
            features.htHomeScore === null ||
            features.htAwayScore === null ||
            features.ftResult === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores or incomplete features`);
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

          // Check if all required data is present (scores and complete features must exist for database)
          if (
            features.ftHomeScore === null ||
            features.ftAwayScore === null ||
            features.htHomeScore === null ||
            features.htAwayScore === null ||
            features.ftResult === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores or incomplete features`);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendEvent({
        status: 'error',
        error: errorMessage,
        message: `Failed to upload ${competition}: ${errorMessage}`,
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });
      res.end();
    }
  });

  // ML Training endpoint
  app.post("/api/ml/train", async (req, res) => {
    try {
      const {
        epochs = 30,
        batchSize = 32,
        validationSplit = 0.2,
        learningRate = 0.001,
        teamEmbeddingSize = 50,
        leagueEmbeddingSize = 20,
        countryEmbeddingSize = 10,
        hiddenLayers = [128, 64]
      } = req.body;

      console.log('Starting model training...');
      
      // Get all training data from database
      const matchStatsArray = await databaseStorage.getAllMatchStats();
      
      if (matchStatsArray.length < 100) {
        return res.status(400).json({
          error: 'Insufficient training data',
          message: 'At least 100 completed matches are required for training'
        });
      }

      // Import ML functions
      const { trainModel, saveModel } = await import('./ml-model');
      
      // Determine unique counts for embeddings
      const uniqueTeams = new Set<number>();
      const uniqueLeagues = new Set<number>();
      const uniqueCountries = new Set<number>();
      
      matchStatsArray.forEach(stats => {
        uniqueTeams.add(stats.homeTeamId);
        uniqueTeams.add(stats.awayTeamId);
        uniqueLeagues.add(stats.leagueId);
        uniqueCountries.add(stats.countryId);
      });
      
      const archConfig = {
        numTeams: Math.max(...Array.from(uniqueTeams)),
        numLeagues: Math.max(...Array.from(uniqueLeagues)),
        numCountries: Math.max(...Array.from(uniqueCountries)),
        teamEmbeddingSize,
        leagueEmbeddingSize,
        countryEmbeddingSize,
        hiddenLayers
      };
      
      const trainingConfig = {
        epochs,
        batchSize,
        validationSplit,
        learningRate
      };
      
      // Train model
      const { model, result } = await trainModel(
        matchStatsArray,
        trainingConfig,
        archConfig
      );
      
      // Save model
      const modelPath = `./models/model_${Date.now()}`;
      await saveModel(model, modelPath);
      
      // Save model metadata
      const modelMetadata = await databaseStorage.createModel({
        modelName: 'Multi-Task Football Predictor',
        version: '1.0',
        architecture: JSON.stringify({ trainingConfig, archConfig }),
        trainingAccuracy: result.finalMetrics.trainingAccuracy,
        validationAccuracy: result.finalMetrics.validationAccuracy,
        loss: result.finalMetrics.loss,
        trainingDate: new Date(),
        totalEpochs: epochs,
        totalSamples: matchStatsArray.length,
        isActive: true,
        modelPath
      });
      
      // Set as active model
      await databaseStorage.setActiveModel(modelMetadata.id);
      
      console.log('Model training completed successfully');
      
      res.json({
        success: true,
        modelId: modelMetadata.id,
        metrics: result.finalMetrics,
        history: result.history,
        totalSamples: matchStatsArray.length
      });
      
    } catch (error) {
      console.error('Error training model:', error);
      res.status(500).json({
        error: 'Failed to train model',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all models
  app.get("/api/ml/models", async (req, res) => {
    try {
      const models = await databaseStorage.getAllModels();
      res.json(models);
    } catch (error) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  // Get active model
  app.get("/api/ml/models/active", async (req, res) => {
    try {
      const model = await databaseStorage.getActiveModel();
      if (!model) {
        return res.status(404).json({ error: 'No active model found' });
      }
      res.json(model);
    } catch (error) {
      console.error('Error fetching active model:', error);
      res.status(500).json({ error: 'Failed to fetch active model' });
    }
  });

  // Set active model
  app.post("/api/ml/models/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await databaseStorage.setActiveModel(parseInt(id));
      if (!success) {
        return res.status(404).json({ error: 'Model not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error activating model:', error);
      res.status(500).json({ error: 'Failed to activate model' });
    }
  });

  // Delete all models
  app.delete("/api/ml/models", async (req, res) => {
    try {
      const success = await databaseStorage.deleteAllModels();
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete models' });
      }
      res.json({ success: true, message: 'All models deleted successfully' });
    } catch (error) {
      console.error('Error deleting all models:', error);
      res.status(500).json({ error: 'Failed to delete models' });
    }
  });

  // Predict matches in tester database
  app.post("/api/ml/predict", async (req, res) => {
    try {
      console.log('Starting predictions for tester matches...');
      
      // Get active model
      const activeModel = await databaseStorage.getActiveModel();
      if (!activeModel) {
        return res.status(404).json({
          error: 'No active model found',
          message: 'Please train a model first'
        });
      }

      // Load the model
      const { loadModel, predict } = await import('./ml-model');
      const model = await loadModel(activeModel.modelPath!);
      
      // Get all matches from tester database
      const testerMatches = await testerStorage.getAllMatchStats();
      
      if (testerMatches.length === 0) {
        return res.status(400).json({
          error: 'No matches to predict',
          message: 'Please add matches to the Tester tab first'
        });
      }

      const predictions = [];
      
      for (const match of testerMatches) {
        try {
          const prediction = await predict(model, match);
          
          // Store prediction in database
          const savedPrediction = await testerStorage.createPrediction({
            matchStatsId: match.id,
            modelId: activeModel.id,
            predHomeWinProb: prediction.ftResult.home,
            predDrawProb: prediction.ftResult.draw,
            predAwayWinProb: prediction.ftResult.away,
            predResult: prediction.ftResult.predicted,
            predHomeScore: prediction.scores.homeScore,
            predAwayScore: prediction.scores.awayScore,
            predHtHomeScore: prediction.htScores.homeScore,
            predHtAwayScore: prediction.htScores.awayScore,
            predBttsProb: prediction.btts.probability,
            predBtts: prediction.btts.predicted,
            predOver25Prob: prediction.over25.probability,
            predOver25: prediction.over25.predicted,
            confidence: prediction.confidence
          });
          
          predictions.push({
            matchId: match.id,
            prediction: savedPrediction
          });
        } catch (error) {
          console.error(`Error predicting match ${match.id}:`, error);
        }
      }
      
      console.log(`Predictions completed: ${predictions.length}/${testerMatches.length}`);
      
      res.json({
        success: true,
        totalMatches: testerMatches.length,
        predictions: predictions.length,
        results: predictions
      });
      
    } catch (error) {
      console.error('Error making predictions:', error);
      res.status(500).json({
        error: 'Failed to make predictions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get predictions for a specific match
  app.get("/api/ml/predictions/:matchStatsId", async (req, res) => {
    try {
      const { matchStatsId } = req.params;
      const predictions = await testerStorage.getPredictionsByMatchStatsId(parseInt(matchStatsId));
      res.json(predictions);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      res.status(500).json({ error: 'Failed to fetch predictions' });
    }
  });

  // Get all predictions
  app.get("/api/ml/predictions", async (req, res) => {
    try {
      const predictions = await testerStorage.getAllPredictions();
      res.json(predictions);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      res.status(500).json({ error: 'Failed to fetch predictions' });
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

  // ========== Basketball API Routes ==========
  
  // Get all basketball stats from database
  app.get("/api/basketball-stats/database", async (req, res) => {
    try {
      const stats = await databaseStorage.getAllBasketballStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching basketball database stats:', error);
      res.status(500).json({ error: 'Failed to fetch basketball database stats' });
    }
  });

  // Clear all basketball stats from database
  app.delete("/api/basketball-stats/database/clear", async (req, res) => {
    try {
      await databaseStorage.deleteAllBasketballStats();
      res.json({ success: true, message: 'Basketball database cleared successfully' });
    } catch (error) {
      console.error('Error clearing basketball database:', error);
      res.status(500).json({ error: 'Failed to clear basketball database' });
    }
  });

  // Get all basketball stats from tester with enriched team names
  app.get("/api/basketball-stats/tester", async (req, res) => {
    try {
      const stats = await testerStorage.getAllBasketballStats();
      
      const enrichedStats = await Promise.all(
        stats.map(async (stat) => {
          const homeTeam = await databaseStorage.getTeamById(stat.homeTeamId);
          const awayTeam = await databaseStorage.getTeamById(stat.awayTeamId);
          
          return {
            ...stat,
            homeTeamName: homeTeam?.name || `Team ${stat.homeTeamId}`,
            awayTeamName: awayTeam?.name || `Team ${stat.awayTeamId}`,
          };
        })
      );
      
      res.json(enrichedStats);
    } catch (error) {
      console.error('Error fetching basketball tester stats:', error);
      res.status(500).json({ error: 'Failed to fetch basketball tester stats' });
    }
  });

  // Clear all basketball stats from tester
  app.delete("/api/basketball-stats/tester/clear", async (req, res) => {
    try {
      await testerStorage.deleteAllBasketballStats();
      await testerStorage.deleteAllBasketballPredictions();
      res.json({ success: true, message: 'Basketball tester cleared successfully' });
    } catch (error) {
      console.error('Error clearing basketball tester:', error);
      res.status(500).json({ error: 'Failed to clear basketball tester' });
    }
  });

  // Basketball ML Training endpoint
  app.post("/api/basketball/ml/train", async (req, res) => {
    try {
      const {
        epochs = 30,
        batchSize = 32,
        validationSplit = 0.2,
        learningRate = 0.001,
        teamEmbeddingSize = 50,
        leagueEmbeddingSize = 20,
        countryEmbeddingSize = 10,
        hiddenLayers = [128, 64]
      } = req.body;

      console.log('Starting basketball model training...');
      
      const basketballStatsArray = await databaseStorage.getAllBasketballStats();
      
      if (basketballStatsArray.length < 100) {
        return res.status(400).json({
          error: 'Insufficient training data',
          message: 'At least 100 completed basketball matches are required for training'
        });
      }

      const { trainBasketballModel, saveBasketballModel } = await import('./ml-model-basketball');
      
      const uniqueTeams = new Set<number>();
      const uniqueLeagues = new Set<number>();
      const uniqueCountries = new Set<number>();
      
      basketballStatsArray.forEach(stats => {
        uniqueTeams.add(stats.homeTeamId);
        uniqueTeams.add(stats.awayTeamId);
        uniqueLeagues.add(stats.leagueId);
        uniqueCountries.add(stats.countryId);
      });
      
      const archConfig = {
        numTeams: Math.max(...Array.from(uniqueTeams)),
        numLeagues: Math.max(...Array.from(uniqueLeagues)),
        numCountries: Math.max(...Array.from(uniqueCountries)),
        teamEmbeddingSize,
        leagueEmbeddingSize,
        countryEmbeddingSize,
        hiddenLayers
      };
      
      const trainingConfig = {
        epochs,
        batchSize,
        validationSplit,
        learningRate
      };
      
      const { model, result } = await trainBasketballModel(
        basketballStatsArray,
        trainingConfig,
        archConfig
      );
      
      const modelPath = `./basketball-models/model_${Date.now()}`;
      await saveBasketballModel(model, modelPath);
      
      const modelMetadata = await databaseStorage.createBasketballModel({
        modelName: 'Basketball Predictor',
        version: '1.0',
        architecture: JSON.stringify({ trainingConfig, archConfig }),
        trainingAccuracy: result.finalMetrics.trainingAccuracy,
        validationAccuracy: result.finalMetrics.validationAccuracy,
        loss: result.finalMetrics.loss,
        trainingDate: new Date(),
        totalEpochs: epochs,
        totalSamples: basketballStatsArray.length,
        isActive: true,
        modelPath
      });
      
      await databaseStorage.setActiveBasketballModel(modelMetadata.id);
      
      res.json({
        success: true,
        modelId: modelMetadata.id,
        trainingMetrics: result.finalMetrics,
        history: result.history
      });
      
    } catch (error) {
      console.error('Error training basketball model:', error);
      res.status(500).json({
        error: 'Failed to train basketball model',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Basketball Prediction endpoint
  app.post("/api/basketball/ml/predict", async (req, res) => {
    try {
      console.log('Starting basketball predictions...');
      
      const activeModel = await databaseStorage.getActiveBasketballModel();
      
      if (!activeModel || !activeModel.modelPath) {
        return res.status(400).json({
          error: 'No active basketball model found',
          message: 'Please train a basketball model first'
        });
      }
      
      const { loadBasketballModel, predictBasketball } = await import('./ml-model-basketball');
      const model = await loadBasketballModel(activeModel.modelPath);
      
      const testerMatches = await testerStorage.getAllBasketballStats();
      
      if (testerMatches.length === 0) {
        return res.status(400).json({
          error: 'No basketball matches in tester',
          message: 'Load basketball matches into the tester first'
        });
      }
      
      await testerStorage.deleteAllBasketballPredictions();
      
      const predictions = [];
      
      for (const match of testerMatches) {
        try {
          const prediction = await predictBasketball(model, match);
          
          const savedPrediction = await testerStorage.createBasketballPrediction({
            basketballStatsId: match.id,
            modelId: activeModel.id,
            predHomeWinProb: prediction.winner.home,
            predAwayWinProb: prediction.winner.away,
            predResult: prediction.winner.predicted,
            predHomePoints: prediction.points.homePoints,
            predAwayPoints: prediction.points.awayPoints,
            confidence: prediction.confidence
          });
          
          predictions.push(savedPrediction);
        } catch (error) {
          console.error(`Error predicting basketball match ${match.id}:`, error);
        }
      }
      
      console.log(`Basketball predictions completed: ${predictions.length}/${testerMatches.length}`);
      
      res.json({
        success: true,
        totalMatches: testerMatches.length,
        predictions: predictions.length,
        results: predictions
      });
      
    } catch (error) {
      console.error('Error making basketball predictions:', error);
      res.status(500).json({
        error: 'Failed to make basketball predictions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all basketball predictions
  app.get("/api/basketball/ml/predictions", async (req, res) => {
    try {
      const predictions = await testerStorage.getAllBasketballPredictions();
      res.json(predictions);
    } catch (error) {
      console.error('Error fetching basketball predictions:', error);
      res.status(500).json({ error: 'Failed to fetch basketball predictions' });
    }
  });

  // Basketball League-Based Bulk Upload (Database only, for training data)
  app.post("/api/basketball/bulk-upload/league", async (req, res) => {
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
        message: `Fetching basketball matches for ${competition} ${year}...`,
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });

      // Scrape all basketball matches for the league and year
      const { scrapeBasketballLeagueMatches } = await import('./scraper');
      const matches = await scrapeBasketballLeagueMatches(
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
        message: `Processing ${matches.length} basketball matches...`,
        totalMatches: matches.length,
        processed: 0,
        stored: 0,
      });

      let processed = 0;
      let stored = 0;

      // Load existing basketball stats once at the beginning for duplicate checking
      const existingStats = await databaseStorage.getAllBasketballStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}-${stat.ftHomePoints}-${stat.ftAwayPoints}`)
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

          // Fetch basketball match details
          const matchDetails = await scrapeBasketballMatchDetails(match.matchUrl);

          // Get or create IDs using database mapping (ensures consistency)
          const homeTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await databaseStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await databaseStorage.getOrCreateCountryId(matchDetails.competition);

          // Extract basketball features
          const { extractBasketballFeaturesForDatabase } = await import('./feature-extraction');
          const features = extractBasketballFeaturesForDatabase(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId
          );

          // Check if all required data is present (scores must exist for database)
          if (
            features.ftHomePoints === null ||
            features.ftAwayPoints === null ||
            features.ftResult === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores or incomplete features`);
            processed++;
            continue;
          }

          // Check for duplicates using the pre-loaded set
          const matchKey = `${homeTeamId}-${awayTeamId}-${features.ftHomePoints}-${features.ftAwayPoints}`;
          if (existingKeys.has(matchKey)) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          // Store in database
          await databaseStorage.createBasketballStats(features);
          existingKeys.add(matchKey); // Add to set to prevent duplicates within this batch
          stored++;
          processed++;

          sendEvent({
            status: 'processing',
            message: `Stored ${match.homeTeam} vs ${match.awayTeam}`,
            totalMatches: matches.length,
            processed,
            stored,
          });

          // Add delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Error processing basketball match ${match.homeTeam} vs ${match.awayTeam}:`, error);
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
      console.error("Error in basketball league bulk upload:", error);
      sendEvent({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to process basketball league bulk upload',
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });
      res.end();
    }
  });

  // Basketball Database Bulk Upload (SSE endpoint)
  app.post("/api/basketball/bulk-upload/database", async (req, res) => {
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
      sendEvent({
        status: 'starting',
        message: `Fetching basketball fixtures for ${date}...`,
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });

      const dateObj = new Date(date);
      const matches = await scrapeBasketballFixtures(dateObj);

      sendEvent({
        status: 'processing',
        message: `Processing ${matches.length} basketball matches...`,
        totalMatches: matches.length,
        processed: 0,
        stored: 0,
      });

      let processed = 0;
      let stored = 0;

      // Load existing basketball stats once at the beginning for duplicate checking
      const existingStats = await databaseStorage.getAllBasketballStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}-${stat.ftHomePoints}-${stat.ftAwayPoints}`)
      );

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

          const matchDetails = await scrapeBasketballMatchDetails(match.matchUrl);

          const homeTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await databaseStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await databaseStorage.getOrCreateCountryId(matchDetails.competition);

          const { extractBasketballFeaturesForDatabase } = await import('./feature-extraction');
          const features = extractBasketballFeaturesForDatabase(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId
          );

          if (
            features.ftHomePoints === null ||
            features.ftAwayPoints === null ||
            features.ftResult === null
          ) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - missing scores`);
            processed++;
            continue;
          }

          const matchKey = `${homeTeamId}-${awayTeamId}-${features.ftHomePoints}-${features.ftAwayPoints}`;
          if (existingKeys.has(matchKey)) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          await databaseStorage.createBasketballStats(features);
          existingKeys.add(matchKey);
          stored++;
          processed++;

          sendEvent({
            status: 'processing',
            message: `Stored ${match.homeTeam} vs ${match.awayTeam}`,
            totalMatches: matches.length,
            processed,
            stored,
          });

          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Error processing basketball match ${match.homeTeam} vs ${match.awayTeam}:`, error);
          processed++;
        }
      }

      sendEvent({
        status: 'completed',
        totalMatches: matches.length,
        processed,
        stored,
      });

      res.end();
    } catch (error) {
      console.error("Error in basketball database bulk upload:", error);
      sendEvent({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to process basketball database bulk upload',
        totalMatches: 0,
        processed: 0,
        stored: 0,
      });
      res.end();
    }
  });

  // Basketball Tester Bulk Upload (SSE endpoint)
  app.post("/api/basketball/bulk-upload/tester", async (req, res) => {
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
      sendEvent({
        status: 'starting',
        message: `Fetching basketball fixtures for ${date}...`,
        totalMatches: 0,
        processed: 0,
        loaded: 0,
      });

      const dateObj = new Date(date);
      const matches = await scrapeBasketballFixtures(dateObj);

      sendEvent({
        status: 'processing',
        message: `Processing ${matches.length} basketball matches...`,
        totalMatches: matches.length,
        processed: 0,
        loaded: 0,
      });

      let processed = 0;
      let loaded = 0;

      // Load existing tester basketball stats for duplicate checking
      const existingStats = await testerStorage.getAllBasketballStats();
      const existingKeys = new Set(
        existingStats.map((stat) => `${stat.homeTeamId}-${stat.awayTeamId}`)
      );

      for (const match of matches) {
        try {
          sendEvent({
            status: 'processing',
            message: `Processing ${match.homeTeam} vs ${match.awayTeam}...`,
            totalMatches: matches.length,
            processed,
            loaded,
            currentMatch: `${match.homeTeam} vs ${match.awayTeam}`,
          });

          if (!match.matchUrl) {
            processed++;
            continue;
          }

          const matchDetails = await scrapeBasketballMatchDetails(match.matchUrl);

          const homeTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.homeTeam);
          const awayTeamId = await databaseStorage.getOrCreateTeamId(matchDetails.awayTeam);
          const leagueId = await databaseStorage.getOrCreateLeagueId(matchDetails.competition);
          const countryId = await databaseStorage.getOrCreateCountryId(matchDetails.competition);

          const { extractBasketballFeaturesForTester } = await import('./feature-extraction');
          const features = extractBasketballFeaturesForTester(
            matchDetails,
            homeTeamId,
            awayTeamId,
            leagueId,
            countryId
          );

          const matchKey = `${homeTeamId}-${awayTeamId}`;
          if (existingKeys.has(matchKey)) {
            console.log(`Skipping ${match.homeTeam} vs ${match.awayTeam} - duplicate`);
            processed++;
            continue;
          }

          await testerStorage.createBasketballStats(features);
          existingKeys.add(matchKey);
          loaded++;
          processed++;

          sendEvent({
            status: 'processing',
            message: `Loaded ${match.homeTeam} vs ${match.awayTeam}`,
            totalMatches: matches.length,
            processed,
            loaded,
          });

          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error(`Error processing basketball match ${match.homeTeam} vs ${match.awayTeam}:`, error);
          processed++;
        }
      }

      sendEvent({
        status: 'completed',
        totalMatches: matches.length,
        processed,
        loaded,
      });

      res.end();
    } catch (error) {
      console.error("Error in basketball tester bulk upload:", error);
      sendEvent({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to process basketball tester bulk upload',
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
