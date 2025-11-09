import { databaseDb } from './db';
import { DatabaseStorage } from './storage';
import { trainConfidenceAwareModel, saveConfidenceModel } from './ml-model-confidence-training';
import type { ModelArchitecture, TrainingConfig } from './ml-model-ratings';

async function trainModel() {
  console.log('\n🧠 TRAINING CONFIDENCE-AWARE PREDICTION MODEL\n');
  console.log('This model learns to predict match outcomes AND confidence scores');
  console.log('No hand-crafted rules - pure learned behavior!\n');
  console.log('='.repeat(80));
  
  const storage = new DatabaseStorage(databaseDb, databaseDb);
  
  // Get all matches and ratings
  const matches = await storage.getAllMatchStats();
  console.log(`📊 Loaded ${matches.length} matches`);
  
  if (matches.length === 0) {
    console.log('❌ No matches found. Please scrape data first.');
    return;
  }
  
  // Get all team ratings
  const teams = await storage.getAllTeams();
  const ratings = new Map();
  
  for (const team of teams) {
    const rating = await storage.getTeamRating(team.id);
    if (rating) {
      ratings.set(team.id, rating);
    }
  }
  
  console.log(`📈 Loaded ${ratings.size} team ratings`);
  
  // Get unique counts
  const uniqueTeams = new Set(matches.flatMap(m => [m.homeTeamId, m.awayTeamId])).size;
  const uniqueLeagues = new Set(matches.map(m => m.leagueId)).size;
  const uniqueCountries = new Set(matches.map(m => m.countryId)).size;
  
  console.log(`\n📊 Dataset Statistics:`);
  console.log(`   Teams: ${uniqueTeams}`);
  console.log(`   Leagues: ${uniqueLeagues}`);
  console.log(`   Countries: ${uniqueCountries}`);
  console.log('');
  
  // Model architecture
  const archConfig: ModelArchitecture = {
    numTeams: uniqueTeams,
    numLeagues: uniqueLeagues,
    numCountries: uniqueCountries,
    teamEmbeddingSize: 32,
    leagueEmbeddingSize: 8,
    countryEmbeddingSize: 8,
    hiddenLayers: [256, 128, 64],
  };
  
  // Training configuration
  const trainingConfig: TrainingConfig = {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    learningRate: 0.001,
  };
  
  console.log('🏗️  Model Architecture:');
  console.log(`   Hidden Layers: ${archConfig.hiddenLayers.join(' → ')}`);
  console.log(`   Team Embedding: ${archConfig.teamEmbeddingSize}D`);
  console.log(`   League Embedding: ${archConfig.leagueEmbeddingSize}D`);
  console.log(`   Total Outputs: 6 (1x2, O/U, BTTS, Scores, Confidence)`);
  console.log('');
  
  console.log('⚙️  Training Configuration:');
  console.log(`   Epochs: ${trainingConfig.epochs}`);
  console.log(`   Batch Size: ${trainingConfig.batchSize}`);
  console.log(`   Validation Split: ${trainingConfig.validationSplit * 100}%`);
  console.log(`   Learning Rate: ${trainingConfig.learningRate}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('\n🚀 Starting Training...\n');
  
  // Train the model
  const { model, result, normalizationStats } = await trainConfidenceAwareModel(
    matches,
    ratings,
    trainingConfig,
    archConfig
  );
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Training Complete!\n');
  console.log('📊 Final Metrics:');
  console.log(`   Training Accuracy: ${(result.finalMetrics.trainingAccuracy * 100).toFixed(2)}%`);
  console.log(`   Validation Accuracy: ${(result.finalMetrics.validationAccuracy * 100).toFixed(2)}%`);
  console.log(`   Final Loss: ${result.finalMetrics.loss.toFixed(4)}`);
  console.log(`   Confidence Calibration: ${(result.finalMetrics.confidenceCalibration * 100).toFixed(2)}%`);
  console.log('');
  
  // Save the model
  const modelPath = `rating-models/model_${Date.now()}`;
  await saveConfidenceModel(model, modelPath, normalizationStats);
  
  console.log(`💾 Model saved to: ${modelPath}`);
  console.log('\n✨ The model now predicts outcomes WITH learned confidence scores!');
  console.log('   Use generate-confidence-predictions.ts to see it in action.\n');
  console.log('='.repeat(80));
}

trainModel().catch(console.error);
