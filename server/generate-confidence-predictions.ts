import { databaseDb } from './db';
import { DatabaseStorage } from './storage';
import { loadConfidenceModel, predictWithConfidence } from './ml-model-confidence-training';
import type { MatchStats } from '@shared/schema';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function getLatestConfidenceModel(): Promise<string | null> {
  try {
    const modelsDir = 'rating-models';
    const modelDirs = await readdir(modelsDir);
    
    // Find confidence-aware models
    const confidenceModels: string[] = [];
    for (const dir of modelDirs) {
      if (!dir.startsWith('model_')) continue;
      
      const modelPath = join(modelsDir, dir);
      try {
        const typeFile = await readFile(join(modelPath, 'model_type.txt'), 'utf-8');
        if (typeFile.trim() === 'confidence-aware') {
          confidenceModels.push(dir);
        }
      } catch {
        // Not a confidence model
      }
    }
    
    if (confidenceModels.length === 0) {
      return null;
    }
    
    // Sort by timestamp
    const sortedDirs = confidenceModels.sort((a, b) => {
      const timestampA = parseInt(a.split('_')[1]);
      const timestampB = parseInt(b.split('_')[1]);
      return timestampB - timestampA;
    });
    
    return join(modelsDir, sortedDirs[0]);
  } catch (error) {
    console.error('Error finding latest model:', error);
    return null;
  }
}

async function generatePredictions() {
  console.log('\n🔮 GENERATING PREDICTIONS WITH LEARNED CONFIDENCE\n');
  console.log('='.repeat(80));
  
  const storage = new DatabaseStorage(databaseDb, databaseDb);
  
  // Get latest confidence-aware model
  const modelPath = await getLatestConfidenceModel();
  if (!modelPath) {
    console.log('❌ No confidence-aware model found.');
    console.log('   Please train one first using: tsx server/train-confidence-model.ts');
    return;
  }
  
  console.log(`📊 Using model: ${modelPath}\n`);
  
  // Load the model
  const { model, normalizationStats } = await loadConfidenceModel(modelPath);
  
  // Get all matches
  const matches = await storage.getAllMatchStats();
  if (matches.length === 0) {
    console.log('❌ No matches found in database.');
    return;
  }
  
  console.log(`📈 Analyzing ${matches.length} matches...\n`);
  
  // Generate predictions
  interface PredictionResult {
    homeTeam: string;
    awayTeam: string;
    league: string;
    prediction: string;
    probability: number;
    learnedConfidence: number;
    trustLevel: string;
  }
  
  const allPredictions: PredictionResult[] = [];
  
  for (const match of matches) {
    const homeRating = await storage.getTeamRating(match.homeTeamId);
    const awayRating = await storage.getTeamRating(match.awayTeamId);
    
    if (!homeRating || !awayRating) continue;
    if (homeRating.totalMatches === 0 && awayRating.totalMatches === 0) continue;
    
    try {
      const prediction = await predictWithConfidence(
        model,
        match,
        homeRating,
        awayRating,
        normalizationStats
      );
      
      const homeTeam = await storage.getTeamById(match.homeTeamId);
      const awayTeam = await storage.getTeamById(match.awayTeamId);
      const league = await storage.getLeagueById(match.leagueId);
      
      if (!homeTeam || !awayTeam || !league) continue;
      
      // Determine prediction string and probability
      let predictionStr = '';
      let probability = 0;
      
      if (prediction.result.predicted === '1') {
        predictionStr = `${homeTeam.name} Win`;
        probability = prediction.result.home;
      } else if (prediction.result.predicted === 'X') {
        predictionStr = 'Draw';
        probability = prediction.result.draw;
      } else {
        predictionStr = `${awayTeam.name} Win`;
        probability = prediction.result.away;
      }
      
      // Trust level based on learned confidence
      let trustLevel = '';
      if (prediction.learnedConfidence >= 0.8) trustLevel = '🟢 HIGH TRUST';
      else if (prediction.learnedConfidence >= 0.6) trustLevel = '🟡 MEDIUM TRUST';
      else if (prediction.learnedConfidence >= 0.4) trustLevel = '🟠 LOW TRUST';
      else trustLevel = '🔴 VERY LOW TRUST';
      
      allPredictions.push({
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        league: league.name,
        prediction: predictionStr,
        probability,
        learnedConfidence: prediction.learnedConfidence,
        trustLevel,
      });
    } catch (error) {
      console.error(`Error predicting match ${match.id}:`, error);
    }
  }
  
  console.log(`✅ Generated ${allPredictions.length} predictions\n`);
  console.log('='.repeat(80));
  
  // HIGH CONFIDENCE PREDICTIONS (Model is very confident)
  console.log('\n🎯 HIGH CONFIDENCE PREDICTIONS (Model Says: Trust These!)\n');
  console.log('-'.repeat(80));
  
  const highConfidence = allPredictions
    .filter(p => p.learnedConfidence >= 0.7)
    .sort((a, b) => b.learnedConfidence - a.learnedConfidence)
    .slice(0, 20);
  
  if (highConfidence.length === 0) {
    console.log('No high confidence predictions available.');
  } else {
    highConfidence.forEach((p, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
      console.log(`    League: ${p.league}`);
      console.log(`    Prediction: ${p.prediction}`);
      console.log(`    Probability: ${(p.probability * 100).toFixed(1)}%`);
      console.log(`    ${p.trustLevel} - Learned Confidence: ${(p.learnedConfidence * 100).toFixed(1)}%`);
      console.log('');
    });
  }
  
  // MEDIUM CONFIDENCE PREDICTIONS
  console.log('\n🎲 MEDIUM CONFIDENCE PREDICTIONS (Model Says: Proceed with Caution)\n');
  console.log('-'.repeat(80));
  
  const mediumConfidence = allPredictions
    .filter(p => p.learnedConfidence >= 0.5 && p.learnedConfidence < 0.7)
    .sort((a, b) => b.learnedConfidence - a.learnedConfidence)
    .slice(0, 15);
  
  if (mediumConfidence.length === 0) {
    console.log('No medium confidence predictions available.');
  } else {
    mediumConfidence.forEach((p, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
      console.log(`    League: ${p.league}`);
      console.log(`    Prediction: ${p.prediction}`);
      console.log(`    Probability: ${(p.probability * 100).toFixed(1)}%`);
      console.log(`    ${p.trustLevel} - Learned Confidence: ${(p.learnedConfidence * 100).toFixed(1)}%`);
      console.log('');
    });
  }
  
  // LOW CONFIDENCE PREDICTIONS
  console.log('\n⚠️  LOW CONFIDENCE PREDICTIONS (Model Says: Don\'t Trust These)\n');
  console.log('-'.repeat(80));
  
  const lowConfidence = allPredictions
    .filter(p => p.learnedConfidence < 0.5)
    .sort((a, b) => a.learnedConfidence - b.learnedConfidence)
    .slice(0, 10);
  
  if (lowConfidence.length === 0) {
    console.log('No low confidence predictions available.');
  } else {
    lowConfidence.forEach((p, i) => {
      console.log(`${(i + 1).toString().padStart(2, ' ')}. ${p.homeTeam} vs ${p.awayTeam}`);
      console.log(`    League: ${p.league}`);
      console.log(`    Prediction: ${p.prediction}`);
      console.log(`    Probability: ${(p.probability * 100).toFixed(1)}%`);
      console.log(`    ${p.trustLevel} - Learned Confidence: ${(p.learnedConfidence * 100).toFixed(1)}%`);
      console.log('');
    });
  }
  
  // STATISTICS
  console.log('\n📊 CONFIDENCE DISTRIBUTION\n');
  console.log('-'.repeat(80));
  
  const highCount = allPredictions.filter(p => p.learnedConfidence >= 0.7).length;
  const mediumCount = allPredictions.filter(p => p.learnedConfidence >= 0.5 && p.learnedConfidence < 0.7).length;
  const lowCount = allPredictions.filter(p => p.learnedConfidence < 0.5).length;
  
  console.log(`🟢 High Confidence (≥70%): ${highCount} predictions (${((highCount / allPredictions.length) * 100).toFixed(1)}%)`);
  console.log(`🟡 Medium Confidence (50-70%): ${mediumCount} predictions (${((mediumCount / allPredictions.length) * 100).toFixed(1)}%)`);
  console.log(`🔴 Low Confidence (<50%): ${lowCount} predictions (${((lowCount / allPredictions.length) * 100).toFixed(1)}%)`);
  
  const avgConfidence = allPredictions.reduce((sum, p) => sum + p.learnedConfidence, 0) / allPredictions.length;
  console.log(`\nAverage Learned Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✨ The model has learned when to trust its predictions!');
  console.log('   Focus on high confidence predictions for best results.\n');
}

generatePredictions().catch(console.error);
