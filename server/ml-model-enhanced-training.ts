import * as tf from '@tensorflow/tfjs-node';
import type { MatchStats, TeamRating } from '@shared/schema';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { 
  buildRatingModel, 
  extractRatingFeatures, 
  computeRatingNormalizationStats,
  type ModelArchitecture,
  type TrainingConfig,
  type NormalizationStats 
} from './ml-model-ratings';
import { buildEnhancedRatingModel } from './ml-model-enhanced';
import { 
  buildTimeAwareRatings, 
  getRatingsForMatch,
  validateTimeAwareRatings,
  type HistoricalRatingSnapshot 
} from './time-aware-ratings';

interface StratifiedSplit {
  train: MatchStats[];
  validation: MatchStats[];
  test: MatchStats[];
}

interface FoldData {
  train: MatchStats[];
  validation: MatchStats[];
}

interface CrossValidationResult {
  foldResults: {
    fold: number;
    trainAccuracy: number;
    valAccuracy: number;
    trainLoss: number;
    valLoss: number;
  }[];
  avgTrainAccuracy: number;
  avgValAccuracy: number;
  stdValAccuracy: number;
}

interface EnhancedTrainingResult {
  model: tf.LayersModel;
  normalizationStats: NormalizationStats;
  trainingMetrics: {
    finalTrainAccuracy: number;
    finalValAccuracy: number;
    finalTestAccuracy: number;
    finalLoss: number;
  };
  learningCurves: {
    epoch: number;
    trainLoss: number;
    trainAccuracy: number;
    valLoss: number;
    valAccuracy: number;
    trainBttsAccuracy?: number;
    valBttsAccuracy?: number;
    trainOver25Accuracy?: number;
    valOver25Accuracy?: number;
  }[];
  crossValidation?: CrossValidationResult;
  testSetMetrics: {
    accuracy: number;
    bttsAccuracy: number;
    over25Accuracy: number;
    loss: number;
  };
}

/**
 * Create stratification key for a match based on:
 * - Match outcome (1, X, 2)
 * - League ID (to preserve league distribution)
 * - Team strength bucket (based on average rating)
 */
function getStratificationKey(
  match: MatchStats,
  homeRating: TeamRating | undefined,
  awayRating: TeamRating | undefined
): string {
  const result = match.ftResult || 'unknown';
  const leagueId = match.leagueId;
  
  // Calculate average team strength bucket (low/medium/high)
  let strengthBucket = 'medium';
  if (homeRating && awayRating) {
    const avgElo = (homeRating.eloRating + awayRating.eloRating) / 2;
    if (avgElo < 1400) strengthBucket = 'low';
    else if (avgElo > 1600) strengthBucket = 'high';
  }
  
  return `${result}_L${leagueId}_${strengthBucket}`;
}

/**
 * Stratified data split ensuring balanced representation across:
 * - Match outcomes (1, X, 2)
 * - League distribution
 * - Team strength levels
 */
export function stratifiedSplit(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  trainRatio = 0.70,
  valRatio = 0.15,
  testRatio = 0.15
): StratifiedSplit {
  console.log('\n🎯 Performing stratified data split...');
  
  // First, shuffle all matches to prevent temporal ordering bias
  const shuffledMatches = [...matches].sort(() => Math.random() - 0.5);
  
  // Group by stratification key (outcome + league + strength)
  const strataBuckets = new Map<string, MatchStats[]>();
  
  for (const match of shuffledMatches) {
    const homeRating = ratings.get(match.homeTeamId);
    const awayRating = ratings.get(match.awayTeamId);
    const key = getStratificationKey(match, homeRating, awayRating);
    
    if (!strataBuckets.has(key)) {
      strataBuckets.set(key, []);
    }
    strataBuckets.get(key)!.push(match);
  }
  
  console.log(`  Created ${strataBuckets.size} strata buckets`);
  
  const train: MatchStats[] = [];
  const validation: MatchStats[] = [];
  const test: MatchStats[] = [];
  
  // Split each stratum proportionally
  for (const [key, strataMatches] of Array.from(strataBuckets.entries())) {
    // Shuffle within stratum
    const shuffled = [...strataMatches].sort(() => Math.random() - 0.5);
    
    const nTrain = Math.floor(shuffled.length * trainRatio);
    const nVal = Math.floor(shuffled.length * valRatio);
    
    train.push(...shuffled.slice(0, nTrain));
    validation.push(...shuffled.slice(nTrain, nTrain + nVal));
    test.push(...shuffled.slice(nTrain + nVal));
  }
  
  // Final shuffle to mix strata
  train.sort(() => Math.random() - 0.5);
  validation.sort(() => Math.random() - 0.5);
  test.sort(() => Math.random() - 0.5);
  
  // Verify distributions
  const trainResults = { '1': 0, 'X': 0, '2': 0 };
  const valResults = { '1': 0, 'X': 0, '2': 0 };
  const testResults = { '1': 0, 'X': 0, '2': 0 };
  
  train.forEach(m => m.ftResult && trainResults[m.ftResult as '1'|'X'|'2']++);
  validation.forEach(m => m.ftResult && valResults[m.ftResult as '1'|'X'|'2']++);
  test.forEach(m => m.ftResult && testResults[m.ftResult as '1'|'X'|'2']++);
  
  console.log(`  Split: Train=${train.length}, Val=${validation.length}, Test=${test.length}`);
  console.log(`  Train: 1=${trainResults['1']}, X=${trainResults['X']}, 2=${trainResults['2']}`);
  console.log(`  Val: 1=${valResults['1']}, X=${valResults['X']}, 2=${valResults['2']}`);
  console.log(`  Test: 1=${testResults['1']}, X=${testResults['X']}, 2=${testResults['2']}`);
  
  return { train, validation, test };
}

/**
 * Create k folds for cross-validation with proper stratification and shuffling.
 * Ensures each match appears in exactly ONE validation fold.
 */
export function createStratifiedKFolds(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  k = 5
): FoldData[] {
  console.log(`\n📊 Creating ${k} stratified folds for cross-validation...`);
  
  // First shuffle ALL matches to break any temporal ordering
  const shuffledMatches = [...matches].sort(() => Math.random() - 0.5);
  
  // Group by stratification key
  const strataBuckets = new Map<string, MatchStats[]>();
  
  for (const match of shuffledMatches) {
    const homeRating = ratings.get(match.homeTeamId);
    const awayRating = ratings.get(match.awayTeamId);
    const key = getStratificationKey(match, homeRating, awayRating);
    
    if (!strataBuckets.has(key)) {
      strataBuckets.set(key, []);
    }
    strataBuckets.get(key)!.push(match);
  }
  
  // Shuffle ONCE within each stratum, then assign to folds deterministically
  const shuffledStrata = new Map<string, MatchStats[]>();
  for (const [key, strataMatches] of Array.from(strataBuckets.entries())) {
    shuffledStrata.set(key, [...strataMatches].sort(() => Math.random() - 0.5));
  }
  
  const folds: FoldData[] = [];
  
  for (let i = 0; i < k; i++) {
    const validation: MatchStats[] = [];
    const train: MatchStats[] = [];
    
    // For each stratum, assign matches to THIS fold (no re-shuffling)
    for (const strataMatches of Array.from(shuffledStrata.values())) {
      const foldSize = Math.floor(strataMatches.length / k);
      const start = i * foldSize;
      const end = i === k - 1 ? strataMatches.length : (i + 1) * foldSize;
      
      // Each match is assigned to exactly one fold
      validation.push(...strataMatches.slice(start, end));
      train.push(...strataMatches.slice(0, start), ...strataMatches.slice(end));
    }
    
    // Final shuffle to mix strata
    validation.sort(() => Math.random() - 0.5);
    train.sort(() => Math.random() - 0.5);
    
    folds.push({ train, validation });
    console.log(`  Fold ${i + 1}: Train=${train.length}, Val=${validation.length}`);
  }
  
  // Verify that each match appears in exactly one validation fold
  const allValidationMatches = folds.flatMap(f => f.validation.map(m => m.id));
  const uniqueValidationMatches = new Set(allValidationMatches);
  
  if (allValidationMatches.length !== uniqueValidationMatches.size) {
    const duplicateCount = allValidationMatches.length - uniqueValidationMatches.size;
    throw new Error(
      `K-fold validation failure: ${duplicateCount} matches appear in multiple validation folds. ` +
      `Total: ${allValidationMatches.length}, Unique: ${uniqueValidationMatches.size}`
    );
  }
  
  console.log(`  ✅ Verified: Each match appears in exactly one validation fold`);
  
  return folds;
}

/**
 * Prepare tensors from match data (backward compatible version using current ratings)
 */
function prepareTensors(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  normalizationStats: NormalizationStats
) {
  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const ratingFeaturesList: number[][] = [];
  const numericalFeaturesList: number[][] = [];
  const results1x2: number[][] = [];
  const overUnder25: number[] = [];
  const bttsLabels: number[] = [];
  const homeScores: number[] = [];
  const awayScores: number[] = [];
  
  for (const match of matches) {
    const homeRating = ratings.get(match.homeTeamId);
    const awayRating = ratings.get(match.awayTeamId);
    
    if (!homeRating || !awayRating || 
        match.ftHomeScore === null || match.ftAwayScore === null ||
        match.ftResult === null) {
      continue;
    }
    
    homeTeamIds.push(match.homeTeamId);
    awayTeamIds.push(match.awayTeamId);
    leagueIds.push(match.leagueId);
    countryIds.push(match.countryId);
    
    // Extract and normalize rating features
    const ratingFeatures = extractRatingFeatures(homeRating, awayRating);
    const normalizedRatingFeatures = ratingFeatures.map((val, i) => 
      (val - normalizationStats.ratingFeatures.mean[i]) / normalizationStats.ratingFeatures.std[i]
    );
    ratingFeaturesList.push(normalizedRatingFeatures);
    
    // Normalize numerical features with epsilon to prevent division by zero
    const numericalFeatures = [
      match.homeTeamFormOverallL5 || 50,
      match.awayTeamFormOverallL5 || 50,
      match.leagueAvgGoals || 2.7,
    ];
    const normalizedNumerical = numericalFeatures.map((val, i) => {
      const range = normalizationStats.numericalFeatures.max[i] - normalizationStats.numericalFeatures.min[i];
      // Add epsilon to prevent division by zero
      const epsilon = 1e-8;
      return range > epsilon 
        ? (val - normalizationStats.numericalFeatures.min[i]) / range
        : 0; // If constant, set to 0
    });
    numericalFeaturesList.push(normalizedNumerical);
    
    // 1x2 result (one-hot encoded)
    const resultOneHot = [0, 0, 0];
    if (match.ftResult === '1') resultOneHot[0] = 1;
    else if (match.ftResult === 'X') resultOneHot[1] = 1;
    else if (match.ftResult === '2') resultOneHot[2] = 1;
    results1x2.push(resultOneHot);
    
    // Over/Under 2.5
    overUnder25.push((match.ftHomeScore + match.ftAwayScore) > 2.5 ? 1 : 0);
    
    // BTTS
    bttsLabels.push((match.ftHomeScore > 0 && match.ftAwayScore > 0) ? 1 : 0);
    
    // Normalized scores
    homeScores.push((match.ftHomeScore - normalizationStats.targets.homeScore.mean) / normalizationStats.targets.homeScore.std);
    awayScores.push((match.ftAwayScore - normalizationStats.targets.awayScore.mean) / normalizationStats.targets.awayScore.std);
  }
  
  const xs = {
    home_team_id: tf.tensor2d(homeTeamIds.map(id => [id])),
    away_team_id: tf.tensor2d(awayTeamIds.map(id => [id])),
    league_id: tf.tensor2d(leagueIds.map(id => [id])),
    country_id: tf.tensor2d(countryIds.map(id => [id])),
    rating_features: tf.tensor2d(ratingFeaturesList),
    numerical_features: tf.tensor2d(numericalFeaturesList),
  };
  
  const ys = {
    result_1x2: tf.tensor2d(results1x2),
    over_under_2_5: tf.tensor2d(overUnder25, [overUnder25.length, 1]),
    btts: tf.tensor2d(bttsLabels, [bttsLabels.length, 1]),
    home_score: tf.tensor2d(homeScores, [homeScores.length, 1]),
    away_score: tf.tensor2d(awayScores, [awayScores.length, 1]),
  };
  
  return { xs, ys };
}

/**
 * Prepare tensors from match data using time-aware historical ratings.
 * Each match uses the team ratings that existed BEFORE the match was played.
 */
function prepareTimeAwareTensors(
  matches: MatchStats[],
  historicalSnapshots: Map<number, HistoricalRatingSnapshot>,
  normalizationStats: NormalizationStats
) {
  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const ratingFeaturesList: number[][] = [];
  const numericalFeaturesList: number[][] = [];
  const results1x2: number[][] = [];
  const overUnder25: number[] = [];
  const bttsLabels: number[] = [];
  const homeScores: number[] = [];
  const awayScores: number[] = [];
  
  for (const match of matches) {
    // Get historical ratings (pre-match ratings)
    const { homeRating, awayRating } = getRatingsForMatch(match.id, historicalSnapshots);
    
    if (!homeRating || !awayRating || 
        match.ftHomeScore === null || match.ftAwayScore === null ||
        match.ftResult === null) {
      continue;
    }
    
    homeTeamIds.push(match.homeTeamId);
    awayTeamIds.push(match.awayTeamId);
    leagueIds.push(match.leagueId);
    countryIds.push(match.countryId);
    
    // Extract and normalize rating features
    const ratingFeatures = extractRatingFeatures(homeRating, awayRating);
    const normalizedRatingFeatures = ratingFeatures.map((val, i) => 
      (val - normalizationStats.ratingFeatures.mean[i]) / normalizationStats.ratingFeatures.std[i]
    );
    ratingFeaturesList.push(normalizedRatingFeatures);
    
    // Normalize numerical features with epsilon to prevent division by zero
    const numericalFeatures = [
      match.homeTeamFormOverallL5 || 50,
      match.awayTeamFormOverallL5 || 50,
      match.leagueAvgGoals || 2.7,
    ];
    const normalizedNumerical = numericalFeatures.map((val, i) => {
      const range = normalizationStats.numericalFeatures.max[i] - normalizationStats.numericalFeatures.min[i];
      // Add epsilon to prevent division by zero
      const epsilon = 1e-8;
      return range > epsilon 
        ? (val - normalizationStats.numericalFeatures.min[i]) / range
        : 0; // If constant, set to 0
    });
    numericalFeaturesList.push(normalizedNumerical);
    
    // 1x2 result (one-hot encoded)
    const resultOneHot = [0, 0, 0];
    if (match.ftResult === '1') resultOneHot[0] = 1;
    else if (match.ftResult === 'X') resultOneHot[1] = 1;
    else if (match.ftResult === '2') resultOneHot[2] = 1;
    results1x2.push(resultOneHot);
    
    // Over/Under 2.5
    overUnder25.push((match.ftHomeScore + match.ftAwayScore) > 2.5 ? 1 : 0);
    
    // BTTS
    bttsLabels.push((match.ftHomeScore > 0 && match.ftAwayScore > 0) ? 1 : 0);
    
    // Normalized scores
    homeScores.push((match.ftHomeScore - normalizationStats.targets.homeScore.mean) / normalizationStats.targets.homeScore.std);
    awayScores.push((match.ftAwayScore - normalizationStats.targets.awayScore.mean) / normalizationStats.targets.awayScore.std);
  }
  
  const xs = {
    home_team_id: tf.tensor2d(homeTeamIds.map(id => [id])),
    away_team_id: tf.tensor2d(awayTeamIds.map(id => [id])),
    league_id: tf.tensor2d(leagueIds.map(id => [id])),
    country_id: tf.tensor2d(countryIds.map(id => [id])),
    rating_features: tf.tensor2d(ratingFeaturesList),
    numerical_features: tf.tensor2d(numericalFeaturesList),
  };
  
  const ys = {
    result_1x2: tf.tensor2d(results1x2),
    over_under_2_5: tf.tensor2d(overUnder25, [overUnder25.length, 1]),
    btts: tf.tensor2d(bttsLabels, [bttsLabels.length, 1]),
    home_score: tf.tensor2d(homeScores, [homeScores.length, 1]),
    away_score: tf.tensor2d(awayScores, [awayScores.length, 1]),
  };
  
  return { xs, ys };
}

/**
 * Evaluate model on a dataset
 */
async function evaluateModel(
  model: tf.LayersModel,
  xs: any,
  ys: any
): Promise<{ accuracy: number; bttsAccuracy: number; over25Accuracy: number; loss: number }> {
  const evaluation = model.evaluate(xs, ys) as tf.Scalar[];
  
  const loss = await evaluation[0].data();
  const result1x2Acc = await evaluation[1].data();
  const over25Acc = await evaluation[2].data();
  const bttsAcc = await evaluation[3].data();
  
  // Cleanup
  evaluation.forEach(tensor => tensor.dispose());
  
  return {
    accuracy: result1x2Acc[0],
    bttsAccuracy: bttsAcc[0],
    over25Accuracy: over25Acc[0],
    loss: loss[0],
  };
}

/**
 * Perform k-fold cross-validation
 */
export async function performCrossValidation(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  trainingConfig: TrainingConfig,
  archConfig: ModelArchitecture,
  k = 5
): Promise<CrossValidationResult> {
  console.log('\n🔄 Starting K-Fold Cross-Validation...');
  
  const folds = createStratifiedKFolds(matches, ratings, k);
  const foldResults: CrossValidationResult['foldResults'] = [];
  
  for (let i = 0; i < k; i++) {
    console.log(`\n--- Fold ${i + 1}/${k} ---`);
    
    const { train, validation } = folds[i];
    
    // Build model for this fold
    const model = buildRatingModel(archConfig);
    
    // Compute normalization stats from training data only
    const normalizationStats = computeRatingNormalizationStats(train, ratings);
    
    // Prepare tensors
    const trainData = prepareTensors(train, ratings, normalizationStats);
    const valData = prepareTensors(validation, ratings, normalizationStats);
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(trainingConfig.learningRate),
      loss: {
        result_1x2: 'categoricalCrossentropy',
        over_under_2_5: 'binaryCrossentropy',
        btts: 'binaryCrossentropy',
        home_score: 'meanSquaredError',
        away_score: 'meanSquaredError',
      },
      metrics: {
        result_1x2: ['accuracy'],
        over_under_2_5: ['accuracy'],
        btts: ['accuracy'],
      } as any,
    });
    
    // Train
    const history = await model.fit(trainData.xs as any, trainData.ys as any, {
      epochs: Math.min(trainingConfig.epochs, 50), // Limit epochs for CV
      batchSize: trainingConfig.batchSize,
      validationData: [valData.xs, valData.ys] as any,
      verbose: 0,
    });
    
    const trainAcc = history.history.result_1x2_acc[history.history.result_1x2_acc.length - 1] as number;
    const valAcc = history.history.val_result_1x2_acc[history.history.val_result_1x2_acc.length - 1] as number;
    const trainLoss = history.history.loss[history.history.loss.length - 1] as number;
    const valLoss = history.history.val_loss[history.history.val_loss.length - 1] as number;
    
    foldResults.push({
      fold: i + 1,
      trainAccuracy: trainAcc,
      valAccuracy: valAcc,
      trainLoss,
      valLoss,
    });
    
    console.log(`  Fold ${i + 1} Results: TrainAcc=${(trainAcc * 100).toFixed(2)}%, ValAcc=${(valAcc * 100).toFixed(2)}%`);
    
    // Cleanup
    Object.values(trainData.xs).forEach(tensor => tensor.dispose());
    Object.values(trainData.ys).forEach(tensor => tensor.dispose());
    Object.values(valData.xs).forEach(tensor => tensor.dispose());
    Object.values(valData.ys).forEach(tensor => tensor.dispose());
    model.dispose();
  }
  
  // Calculate statistics
  const avgTrainAccuracy = foldResults.reduce((sum, r) => sum + r.trainAccuracy, 0) / k;
  const avgValAccuracy = foldResults.reduce((sum, r) => sum + r.valAccuracy, 0) / k;
  const varianceVal = foldResults.reduce((sum, r) => sum + Math.pow(r.valAccuracy - avgValAccuracy, 2), 0) / k;
  const stdValAccuracy = Math.sqrt(varianceVal);
  
  console.log(`\n✅ Cross-Validation Complete:`);
  console.log(`  Average Training Accuracy: ${(avgTrainAccuracy * 100).toFixed(2)}%`);
  console.log(`  Average Validation Accuracy: ${(avgValAccuracy * 100).toFixed(2)}% ± ${(stdValAccuracy * 100).toFixed(2)}%`);
  
  return {
    foldResults,
    avgTrainAccuracy,
    avgValAccuracy,
    stdValAccuracy,
  };
}

/**
 * Train model with all enhancements:
 * 1. Stratified train/val/test split
 * 2. K-fold cross-validation (optional)
 * 3. Optimized regularization
 * 4. Learning curve tracking
 * 5. Separate test set evaluation
 */
export async function trainEnhancedModel(
  allMatches: MatchStats[],
  ratings: Map<number, TeamRating>,
  trainingConfig: TrainingConfig,
  archConfig: ModelArchitecture,
  options: {
    performCrossValidation?: boolean;
    kFolds?: number;
    exportLearningCurves?: boolean;
  } = {}
): Promise<EnhancedTrainingResult> {
  console.log('\n🚀 Starting Enhanced Training Pipeline...');
  console.log('='.repeat(80));
  
  // Step 1: Stratified Split (with ratings for team strength stratification)
  const { train, validation, test } = stratifiedSplit(allMatches, ratings, 0.70, 0.15, 0.15);
  
  // Step 2: Optional Cross-Validation
  let crossValidation: CrossValidationResult | undefined;
  if (options.performCrossValidation) {
    // Combine train and validation for cross-validation
    const cvData = [...train, ...validation];
    crossValidation = await performCrossValidation(
      cvData,
      ratings,
      trainingConfig,
      archConfig,
      options.kFolds || 5
    );
  }
  
  // Step 3: Build and train final model
  console.log('\n🏗️  Building final model with optimized regularization...');
  console.log('  Features: Batch Normalization + Dropout + L2 Regularization + He Initialization');
  const model = buildEnhancedRatingModel(archConfig);
  
  // Compute normalization stats from training data only
  const normalizationStats = computeRatingNormalizationStats(train, ratings);
  
  // Prepare datasets
  console.log('Preparing datasets...');
  const trainData = prepareTensors(train, ratings, normalizationStats);
  const valData = prepareTensors(validation, ratings, normalizationStats);
  const testData = prepareTensors(test, ratings, normalizationStats);
  
  console.log(`  Training samples: ${train.length}`);
  console.log(`  Validation samples: ${validation.length}`);
  console.log(`  Test samples: ${test.length}`);
  
  // Compile with optimized settings
  model.compile({
    optimizer: tf.train.adam(trainingConfig.learningRate),
    loss: {
      result_1x2: 'categoricalCrossentropy',
      over_under_2_5: 'binaryCrossentropy',
      btts: 'binaryCrossentropy',
      home_score: 'meanSquaredError',
      away_score: 'meanSquaredError',
    },
    metrics: {
      result_1x2: ['accuracy'],
      over_under_2_5: ['accuracy'],
      btts: ['accuracy'],
    } as any,
  });
  
  // Step 4: Train with learning curve tracking
  console.log('\n🎓 Training model...');
  const learningCurves: EnhancedTrainingResult['learningCurves'] = [];
  
  const history = await model.fit(trainData.xs as any, trainData.ys as any, {
    epochs: trainingConfig.epochs,
    batchSize: trainingConfig.batchSize,
    validationData: [valData.xs, valData.ys] as any,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const trainAcc = logs?.result_1x2_acc || 0;
        const valAcc = logs?.val_result_1x2_acc || 0;
        const trainBttsAcc = logs?.btts_acc || 0;
        const valBttsAcc = logs?.val_btts_acc || 0;
        const trainOver25Acc = logs?.over_under_2_5_acc || 0;
        const valOver25Acc = logs?.val_over_under_2_5_acc || 0;
        
        learningCurves.push({
          epoch: epoch + 1,
          trainLoss: logs?.loss || 0,
          trainAccuracy: trainAcc,
          valLoss: logs?.val_loss || 0,
          valAccuracy: valAcc,
          trainBttsAccuracy: trainBttsAcc,
          valBttsAccuracy: valBttsAcc,
          trainOver25Accuracy: trainOver25Acc,
          valOver25Accuracy: valOver25Acc,
        });
        
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(`  Epoch ${epoch + 1}/${trainingConfig.epochs}: ` +
            `loss=${logs?.loss.toFixed(4)}, acc=${(trainAcc * 100).toFixed(2)}%, ` +
            `val_loss=${logs?.val_loss?.toFixed(4)}, val_acc=${(valAcc * 100).toFixed(2)}%`);
        }
      },
    },
  });
  
  // Step 5: Evaluate on test set
  console.log('\n📊 Evaluating on test set...');
  const testMetrics = await evaluateModel(model, testData.xs, testData.ys);
  
  console.log(`  Test Accuracy (1X2): ${(testMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`  Test Accuracy (BTTS): ${(testMetrics.bttsAccuracy * 100).toFixed(2)}%`);
  console.log(`  Test Accuracy (Over 2.5): ${(testMetrics.over25Accuracy * 100).toFixed(2)}%`);
  console.log(`  Test Loss: ${testMetrics.loss.toFixed(4)}`);
  
  const finalTrainAcc = learningCurves[learningCurves.length - 1].trainAccuracy;
  const finalValAcc = learningCurves[learningCurves.length - 1].valAccuracy;
  
  // Cleanup tensors
  Object.values(trainData.xs).forEach(tensor => tensor.dispose());
  Object.values(trainData.ys).forEach(tensor => tensor.dispose());
  Object.values(valData.xs).forEach(tensor => tensor.dispose());
  Object.values(valData.ys).forEach(tensor => tensor.dispose());
  Object.values(testData.xs).forEach(tensor => tensor.dispose());
  Object.values(testData.ys).forEach(tensor => tensor.dispose());
  
  console.log('\n✅ Enhanced training complete!');
  console.log('='.repeat(80));
  
  return {
    model,
    normalizationStats,
    trainingMetrics: {
      finalTrainAccuracy: finalTrainAcc,
      finalValAccuracy: finalValAcc,
      finalTestAccuracy: testMetrics.accuracy,
      finalLoss: learningCurves[learningCurves.length - 1].trainLoss,
    },
    learningCurves,
    crossValidation,
    testSetMetrics: testMetrics,
  };
}

/**
 * Train model with TIME-AWARE ratings to prevent temporal data leakage.
 * 
 * Key differences from standard training:
 * 1. Builds ratings chronologically - each match uses only pre-match team ratings
 * 2. Validates temporal consistency - ensures ratings evolve correctly over time
 * 3. Prevents data leakage - no future information used to predict past matches
 * 
 * This ensures the model learns from data available AT THE TIME each prediction would have been made.
 */
export async function trainTimeAwareModel(
  allMatches: MatchStats[],
  trainingConfig: TrainingConfig,
  archConfig: ModelArchitecture,
  options: {
    performCrossValidation?: boolean;
    kFolds?: number;
    exportLearningCurves?: boolean;
  } = {}
): Promise<EnhancedTrainingResult> {
  console.log('\n⏰ Starting TIME-AWARE Training Pipeline...');
  console.log('='.repeat(80));
  console.log('  🔒 Temporal data leakage prevention ENABLED');
  console.log('  📅 Processing matches chronologically');
  console.log('  📸 Using historical rating snapshots');
  
  // Step 1: Build time-aware ratings chronologically
  console.log('\n📊 Building time-aware team ratings...');
  const { historicalSnapshots, finalRatings } = buildTimeAwareRatings(allMatches);
  
  // Step 2: Validate temporal consistency
  console.log('\n🔍 Validating temporal consistency...');
  const validation = validateTimeAwareRatings(allMatches, historicalSnapshots);
  
  if (!validation.isValid) {
    console.warn('⚠️  WARNING: Temporal consistency issues detected:');
    validation.issues.slice(0, 5).forEach(issue => console.warn(`  - ${issue}`));
    if (validation.issues.length > 5) {
      console.warn(`  ... and ${validation.issues.length - 5} more issues`);
    }
  } else {
    console.log('  ✅ Temporal consistency validated');
  }
  
  console.log(`  📈 Avg matches at first appearance: ${validation.stats.avgMatchesAtFirstAppearance.toFixed(1)}`);
  console.log(`  📈 Avg matches at last appearance: ${validation.stats.avgMatchesAtLastAppearance.toFixed(1)}`);
  console.log(`  📈 Avg ELO growth: ${validation.stats.avgEloGrowth > 0 ? '+' : ''}${validation.stats.avgEloGrowth.toFixed(1)}`);
  
  // Step 3: Chronological split (keeping temporal order)
  // Filter matches that have historical snapshots
  const matchesWithRatings = allMatches.filter(m => historicalSnapshots.has(m.id));
  
  // Sort chronologically (oldest first)
  const sortedMatches = [...matchesWithRatings].sort((a, b) => {
    const dateA = a.matchDate ? new Date(a.matchDate).getTime() : 0;
    const dateB = b.matchDate ? new Date(b.matchDate).getTime() : 0;
    return dateA - dateB;
  });
  
  // Split chronologically: 70% train, 15% validation, 15% test
  const trainSize = Math.floor(sortedMatches.length * 0.70);
  const valSize = Math.floor(sortedMatches.length * 0.15);
  
  const train = sortedMatches.slice(0, trainSize);
  const validation = sortedMatches.slice(trainSize, trainSize + valSize);
  const test = sortedMatches.slice(trainSize + valSize);
  
  console.log(`\n📦 Chronological split:`);
  console.log(`  Train: ${train.length} matches (oldest)`);
  console.log(`  Validation: ${validation.length} matches (middle)`);
  console.log(`  Test: ${test.length} matches (most recent)`);
  
  if (train.length > 0 && test.length > 0) {
    const trainStart = train[0].matchDate ? new Date(train[0].matchDate).toISOString().split('T')[0] : 'unknown';
    const trainEnd = train[train.length - 1].matchDate ? new Date(train[train.length - 1].matchDate).toISOString().split('T')[0] : 'unknown';
    const testStart = test[0].matchDate ? new Date(test[0].matchDate).toISOString().split('T')[0] : 'unknown';
    const testEnd = test[test.length - 1].matchDate ? new Date(test[test.length - 1].matchDate).toISOString().split('T')[0] : 'unknown';
    
    console.log(`  Train period: ${trainStart} to ${trainEnd}`);
    console.log(`  Test period: ${testStart} to ${testEnd}`);
  }
  
  // Step 4: Build model
  console.log('\n🏗️  Building model with time-aware features...');
  const model = buildEnhancedRatingModel(archConfig);
  
  // Compute normalization stats from training data only
  const normalizationStats = computeRatingNormalizationStats(train, finalRatings);
  
  // Prepare datasets using historical ratings
  console.log('Preparing time-aware datasets...');
  const trainData = prepareTimeAwareTensors(train, historicalSnapshots, normalizationStats);
  const valData = prepareTimeAwareTensors(validation, historicalSnapshots, normalizationStats);
  const testData = prepareTimeAwareTensors(test, historicalSnapshots, normalizationStats);
  
  console.log(`  Training samples: ${train.length}`);
  console.log(`  Validation samples: ${validation.length}`);
  console.log(`  Test samples: ${test.length}`);
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(trainingConfig.learningRate),
    loss: {
      result_1x2: 'categoricalCrossentropy',
      over_under_2_5: 'binaryCrossentropy',
      btts: 'binaryCrossentropy',
      home_score: 'meanSquaredError',
      away_score: 'meanSquaredError',
    },
    metrics: {
      result_1x2: ['accuracy'],
      over_under_2_5: ['accuracy'],
      btts: ['accuracy'],
    } as any,
  });
  
  // Step 5: Train with learning curve tracking
  console.log('\n🎓 Training time-aware model...');
  const learningCurves: EnhancedTrainingResult['learningCurves'] = [];
  
  const history = await model.fit(trainData.xs as any, trainData.ys as any, {
    epochs: trainingConfig.epochs,
    batchSize: trainingConfig.batchSize,
    validationData: [valData.xs, valData.ys] as any,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const trainAcc = logs?.result_1x2_acc || 0;
        const valAcc = logs?.val_result_1x2_acc || 0;
        const trainBttsAcc = logs?.btts_acc || 0;
        const valBttsAcc = logs?.val_btts_acc || 0;
        const trainOver25Acc = logs?.over_under_2_5_acc || 0;
        const valOver25Acc = logs?.val_over_under_2_5_acc || 0;
        
        learningCurves.push({
          epoch: epoch + 1,
          trainLoss: logs?.loss || 0,
          trainAccuracy: trainAcc,
          valLoss: logs?.val_loss || 0,
          valAccuracy: valAcc,
          trainBttsAccuracy: trainBttsAcc,
          valBttsAccuracy: valBttsAcc,
          trainOver25Accuracy: trainOver25Acc,
          valOver25Accuracy: valOver25Acc,
        });
        
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(`  Epoch ${epoch + 1}/${trainingConfig.epochs}: ` +
            `loss=${logs?.loss.toFixed(4)}, acc=${(trainAcc * 100).toFixed(2)}%, ` +
            `val_loss=${logs?.val_loss?.toFixed(4)}, val_acc=${(valAcc * 100).toFixed(2)}%`);
        }
      },
    },
  });
  
  // Step 6: Evaluate on test set
  console.log('\n📊 Evaluating on chronologically-held-out test set...');
  const testMetrics = await evaluateModel(model, testData.xs, testData.ys);
  
  console.log(`  Test Accuracy (1X2): ${(testMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`  Test Accuracy (BTTS): ${(testMetrics.bttsAccuracy * 100).toFixed(2)}%`);
  console.log(`  Test Accuracy (Over 2.5): ${(testMetrics.over25Accuracy * 100).toFixed(2)}%`);
  console.log(`  Test Loss: ${testMetrics.loss.toFixed(4)}`);
  
  const finalTrainAcc = learningCurves[learningCurves.length - 1].trainAccuracy;
  const finalValAcc = learningCurves[learningCurves.length - 1].valAccuracy;
  
  // Cleanup tensors
  Object.values(trainData.xs).forEach(tensor => tensor.dispose());
  Object.values(trainData.ys).forEach(tensor => tensor.dispose());
  Object.values(valData.xs).forEach(tensor => tensor.dispose());
  Object.values(valData.ys).forEach(tensor => tensor.dispose());
  Object.values(testData.xs).forEach(tensor => tensor.dispose());
  Object.values(testData.ys).forEach(tensor => tensor.dispose());
  
  console.log('\n✅ Time-aware training complete!');
  console.log('  🎯 Model trained without temporal data leakage');
  console.log('  📅 Ratings evolved chronologically through training');
  console.log('='.repeat(80));
  
  return {
    model,
    normalizationStats,
    trainingMetrics: {
      finalTrainAccuracy: finalTrainAcc,
      finalValAccuracy: finalValAcc,
      finalTestAccuracy: testMetrics.accuracy,
      finalLoss: learningCurves[learningCurves.length - 1].trainLoss,
    },
    learningCurves,
    crossValidation: undefined,
    testSetMetrics: testMetrics,
  };
}

/**
 * Export learning curves and metrics to JSON
 */
export async function exportTrainingMetrics(
  result: EnhancedTrainingResult,
  modelPath: string
): Promise<void> {
  const metricsPath = `${modelPath}/training_metrics.json`;
  
  const metrics = {
    finalMetrics: result.trainingMetrics,
    testSetMetrics: result.testSetMetrics,
    learningCurves: result.learningCurves,
    crossValidation: result.crossValidation,
    timestamp: new Date().toISOString(),
  };
  
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`📈 Training metrics exported to ${metricsPath}`);
}
