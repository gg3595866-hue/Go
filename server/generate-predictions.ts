import { databaseDb, testerDb } from './db';
import { DatabaseStorage } from './storage';
import { loadRatingModel, predictWithRatingModel } from './ml-model-ratings';
import type { MatchStats, TeamRating, RatingPrediction } from '@shared/schema';
import { readdir } from 'fs/promises';
import { join } from 'path';

interface PredictionWithMatch {
  match: MatchStats;
  homeTeam: string;
  awayTeam: string;
  league: string;
  prediction: {
    result: { home: number; draw: number; away: number; predicted: '1' | 'X' | '2' };
    scores: { homeScore: number; awayScore: number };
    overUnder25: { prob: number; predicted: boolean };
    btts: { prob: number; predicted: boolean };
    confidence: number;
  };
}

interface MarketPredictions {
  market: string;
  predictions: Array<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    prediction: string;
    probability: number;
    confidence: number;
  }>;
}

async function getLatestModel(): Promise<string | null> {
  try {
    const modelsDir = 'rating-models';
    const modelDirs = await readdir(modelsDir);
    
    // Sort by timestamp (model names are model_<timestamp>)
    const sortedDirs = modelDirs
      .filter(dir => dir.startsWith('model_'))
      .sort((a, b) => {
        const timestampA = parseInt(a.split('_')[1]);
        const timestampB = parseInt(b.split('_')[1]);
        return timestampB - timestampA; // Descending order
      });
    
    if (sortedDirs.length === 0) {
      return null;
    }
    
    return join(modelsDir, sortedDirs[0]);
  } catch (error) {
    console.error('Error finding latest model:', error);
    return null;
  }
}

async function generatePredictions() {
  console.log('\n🔮 GENERATING HIGH-CONFIDENCE MATCH PREDICTIONS\n');
  console.log('='.repeat(80));
  
  const storage = new DatabaseStorage(databaseDb, databaseDb);
  
  // Get latest model
  const modelPath = await getLatestModel();
  if (!modelPath) {
    console.log('❌ No trained model found. Please train a model first.');
    return;
  }
  
  console.log(`📊 Using model: ${modelPath}\n`);
  
  // Load the model
  const { model, normalizationStats } = await loadRatingModel(modelPath);
  
  // Get all matches
  const matches = await storage.getAllMatchStats();
  if (matches.length === 0) {
    console.log('❌ No matches found in database. Please add matches first.');
    return;
  }
  
  console.log(`📈 Found ${matches.length} matches to analyze\n`);
  
  // Generate predictions for all matches
  const allPredictions: PredictionWithMatch[] = [];
  
  for (const match of matches) {
    const homeRating = await storage.getTeamRating(match.homeTeamId);
    const awayRating = await storage.getTeamRating(match.awayTeamId);
    
    if (!homeRating || !awayRating) {
      continue;
    }
    
    // Skip matches with no history
    if (homeRating.totalMatches === 0 && awayRating.totalMatches === 0) {
      continue;
    }
    
    try {
      const prediction = await predictWithRatingModel(
        model,
        match,
        homeRating,
        awayRating,
        normalizationStats
      );
      
      // Get team and league names
      const homeTeam = await storage.getTeamById(match.homeTeamId);
      const awayTeam = await storage.getTeamById(match.awayTeamId);
      const league = await storage.getLeagueById(match.leagueId);
      
      if (!homeTeam || !awayTeam || !league) {
        continue;
      }
      
      allPredictions.push({
        match,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        league: league.name,
        prediction
      });
    } catch (error) {
      console.error(`Error predicting match ${match.id}:`, error);
    }
  }
  
  console.log(`✅ Generated predictions for ${allPredictions.length} matches\n`);
  console.log('='.repeat(80));
  
  // Filter and display predictions for each market
  
  // 1X2 Market (Home Win, Draw, Away Win)
  console.log('\n🎯 1X2 PREDICTIONS (Top 20 High Confidence)\n');
  console.log('-'.repeat(80));
  
  const x2Predictions = allPredictions
    .map(p => {
      let probability = 0;
      let prediction = '';
      
      if (p.prediction.result.predicted === '1') {
        probability = p.prediction.result.home;
        prediction = `${p.homeTeam} Win`;
      } else if (p.prediction.result.predicted === 'X') {
        probability = p.prediction.result.draw;
        prediction = 'Draw';
      } else {
        probability = p.prediction.result.away;
        prediction = `${p.awayTeam} Win`;
      }
      
      return {
        homeTeam: p.homeTeam,
        awayTeam: p.awayTeam,
        league: p.league,
        prediction,
        probability,
        confidence: p.prediction.confidence
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);
  
  x2Predictions.forEach((p, i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
    console.log(`    League: ${p.league}`);
    console.log(`    Prediction: ${p.prediction} (${(p.probability * 100).toFixed(1)}% confidence)`);
    console.log('');
  });
  
  // BTTS Market (Both Teams To Score)
  console.log('\n⚽ BTTS (BOTH TEAMS TO SCORE) PREDICTIONS (Top 20 High Confidence)\n');
  console.log('-'.repeat(80));
  
  const bttsPredictions = allPredictions
    .map(p => ({
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      league: p.league,
      prediction: p.prediction.btts.predicted ? 'Yes - Both Teams Score' : 'No - Not Both Teams',
      probability: p.prediction.btts.predicted ? p.prediction.btts.prob : (1 - p.prediction.btts.prob),
      confidence: p.prediction.confidence
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);
  
  bttsPredictions.forEach((p, i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
    console.log(`    League: ${p.league}`);
    console.log(`    Prediction: ${p.prediction} (${(p.probability * 100).toFixed(1)}% confidence)`);
    console.log('');
  });
  
  // Under 2.5 Goals Market
  console.log('\n📉 UNDER 2.5 GOALS PREDICTIONS (Top 20 High Confidence)\n');
  console.log('-'.repeat(80));
  
  const under25Predictions = allPredictions
    .map(p => ({
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      league: p.league,
      prediction: p.prediction.overUnder25.predicted ? 'Over 2.5 Goals' : 'Under 2.5 Goals',
      probability: p.prediction.overUnder25.predicted ? p.prediction.overUnder25.prob : (1 - p.prediction.overUnder25.prob),
      confidence: p.prediction.confidence,
      isUnder: !p.prediction.overUnder25.predicted
    }))
    .filter(p => p.isUnder) // Only show Under 2.5
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);
  
  under25Predictions.forEach((p, i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
    console.log(`    League: ${p.league}`);
    console.log(`    Prediction: ${p.prediction} (${(p.probability * 100).toFixed(1)}% confidence)`);
    console.log('');
  });
  
  // Full-Time Score Predictions
  console.log('\n🎲 FULL-TIME SCORE PREDICTIONS (Top 20 High Confidence)\n');
  console.log('-'.repeat(80));
  
  const ftScorePredictions = allPredictions
    .sort((a, b) => b.prediction.confidence - a.prediction.confidence)
    .slice(0, 20);
  
  ftScorePredictions.forEach((p, i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
    console.log(`    League: ${p.league}`);
    console.log(`    Predicted Score: ${p.prediction.scores.homeScore}-${p.prediction.scores.awayScore}`);
    console.log(`    Confidence: ${(p.prediction.confidence * 100).toFixed(1)}%`);
    console.log('');
  });
  
  // Half-Time Score Predictions
  console.log('\n⏱️  HALF-TIME SCORE PREDICTIONS (Top 20 High Confidence)\n');
  console.log('-'.repeat(80));
  
  const htScorePredictions = allPredictions
    .sort((a, b) => b.prediction.confidence - a.prediction.confidence)
    .slice(0, 20);
  
  htScorePredictions.forEach((p, i) => {
    // Estimate HT score as roughly 45% of FT score
    const htHome = Math.round(p.prediction.scores.homeScore * 0.45);
    const htAway = Math.round(p.prediction.scores.awayScore * 0.45);
    
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
    console.log(`    League: ${p.league}`);
    console.log(`    Predicted HT Score: ${htHome}-${htAway}`);
    console.log(`    Full Match Prediction: ${p.prediction.scores.homeScore}-${p.prediction.scores.awayScore}`);
    console.log(`    Confidence: ${(p.prediction.confidence * 100).toFixed(1)}%`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('\n✨ Prediction generation complete!\n');
}

// Run the script
generatePredictions().catch(console.error);
