
import * as tf from '@tensorflow/tfjs-node';
import type { MatchStats, TeamRating } from '@shared/schema';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

interface ModelArchitecture {
  numTeams: number;
  numLeagues: number;
  numCountries: number;
  teamEmbeddingSize: number;
  leagueEmbeddingSize: number;
  countryEmbeddingSize: number;
  hiddenLayers: number[];
}

interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  learningRate: number;
}

interface NormalizationStats {
  ratingFeatures: {
    mean: number[];
    std: number[];
  };
  numericalFeatures: {
    min: number[];
    max: number[];
  };
  targets: {
    homeScore: { mean: number; std: number };
    awayScore: { mean: number; std: number };
  };
}

interface TrainingResult {
  finalMetrics: {
    trainingAccuracy: number;
    validationAccuracy: number;
    loss: number;
  };
  history: {
    epoch: number;
    loss: number;
    accuracy: number;
    valLoss: number;
    valAccuracy: number;
  }[];
}

/**
 * Extract all 50+ rating features from TeamRating objects
 */
function extractRatingFeatures(homeRating: TeamRating, awayRating: TeamRating): number[] {
  return [
    // Core ratings (6 features)
    homeRating.eloRating,
    awayRating.eloRating,
    homeRating.attackRating,
    awayRating.attackRating,
    homeRating.defenseRating,
    awayRating.defenseRating,
    
    // Match statistics (14 features)
    homeRating.totalMatches,
    awayRating.totalMatches,
    homeRating.homeMatches,
    awayRating.awayMatches,
    homeRating.wins,
    awayRating.wins,
    homeRating.draws,
    awayRating.draws,
    homeRating.losses,
    awayRating.losses,
    homeRating.ftWinRate,
    awayRating.ftWinRate,
    homeRating.ftDrawRate,
    awayRating.ftDrawRate,
    
    // Streaks and momentum (8 features)
    homeRating.homeStreak,
    awayRating.awayStreak,
    homeRating.unbeatenStreak,
    awayRating.unbeatenStreak,
    homeRating.losingStreak,
    awayRating.losingStreak,
    homeRating.goalMarginAvg,
    awayRating.goalMarginAvg,
    
    // Goals (8 features)
    homeRating.avgGoalsScored,
    awayRating.avgGoalsScored,
    homeRating.avgGoalsConceded,
    awayRating.avgGoalsConceded,
    homeRating.goalsScored,
    awayRating.goalsScored,
    homeRating.goalsConceded,
    awayRating.goalsConceded,
    
    // Half-time performance (14 features)
    homeRating.htWinRate,
    awayRating.htWinRate,
    homeRating.htDrawRate,
    awayRating.htDrawRate,
    homeRating.htLossRate,
    awayRating.htLossRate,
    homeRating.htFtConsistencyRate,
    awayRating.htFtConsistencyRate,
    homeRating.htLeadToWinRate,
    awayRating.htLeadToWinRate,
    homeRating.htDrawToWinRate,
    awayRating.htDrawToWinRate,
    homeRating.htLossToWinRate,
    awayRating.htLossToWinRate,
    
    // BTTS metrics (8 features)
    homeRating.bttsYesRate,
    awayRating.bttsYesRate,
    homeRating.bttsAndWinRate,
    awayRating.bttsAndWinRate,
    homeRating.bttsAndLossRate,
    awayRating.bttsAndLossRate,
    homeRating.bttsAndOver25Rate,
    awayRating.bttsAndOver25Rate,
    
    // Pressure performance (8 features)
    homeRating.comebackRate,
    awayRating.comebackRate,
    homeRating.performanceInCloseGames,
    awayRating.performanceInCloseGames,
    homeRating.mentalStrength,
    awayRating.mentalStrength,
    homeRating.performanceWhenTrailing,
    awayRating.performanceWhenTrailing,
    
    // Mistake propensity (8 features)
    homeRating.leadBlownRate,
    awayRating.leadBlownRate,
    homeRating.cleanSheetRate,
    awayRating.cleanSheetRate,
    homeRating.lateCollapseRate,
    awayRating.lateCollapseRate,
    homeRating.defensiveErrors,
    awayRating.defensiveErrors,
    
    // Situational performance (4 features)
    homeRating.performanceInHighScoringGames,
    awayRating.performanceInHighScoringGames,
    homeRating.performanceInLowScoringGames,
    awayRating.performanceInLowScoringGames,
  ];
}

/**
 * Compute normalization statistics from training data
 */
export function computeRatingNormalizationStats(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>
): NormalizationStats {
  const ratingFeaturesList: number[][] = [];
  const numericalFeaturesList: number[][] = [];
  const homeScores: number[] = [];
  const awayScores: number[] = [];
  
  for (const match of matches) {
    const homeRating = ratings.get(match.homeTeamId);
    const awayRating = ratings.get(match.awayTeamId);
    
    if (!homeRating || !awayRating || match.ftHomeScore === null || match.ftAwayScore === null) {
      continue;
    }
    
    ratingFeaturesList.push(extractRatingFeatures(homeRating, awayRating));
    
    numericalFeaturesList.push([
      match.homeTeamFormOverallL5 || 50,
      match.awayTeamFormOverallL5 || 50,
      match.leagueAvgGoals || 2.7,
    ]);
    
    homeScores.push(match.ftHomeScore);
    awayScores.push(match.ftAwayScore);
  }
  
  // Calculate rating features mean and std
  const numRatingFeatures = ratingFeaturesList[0].length;
  const ratingMean = new Array(numRatingFeatures).fill(0);
  const ratingStd = new Array(numRatingFeatures).fill(0);
  
  for (let i = 0; i < numRatingFeatures; i++) {
    const values = ratingFeaturesList.map(f => f[i]);
    ratingMean[i] = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - ratingMean[i], 2), 0) / values.length;
    ratingStd[i] = Math.sqrt(variance) || 1;
  }
  
  // Calculate numerical features min and max
  const numNumericalFeatures = numericalFeaturesList[0].length;
  const numericalMin = new Array(numNumericalFeatures).fill(Infinity);
  const numericalMax = new Array(numNumericalFeatures).fill(-Infinity);
  
  for (let i = 0; i < numNumericalFeatures; i++) {
    const values = numericalFeaturesList.map(f => f[i]);
    numericalMin[i] = Math.min(...values);
    numericalMax[i] = Math.max(...values);
  }
  
  // Calculate target statistics
  const homeScoreMean = homeScores.reduce((a, b) => a + b, 0) / homeScores.length;
  const awayScoreMean = awayScores.reduce((a, b) => a + b, 0) / awayScores.length;
  const homeScoreStd = Math.sqrt(homeScores.reduce((sum, val) => sum + Math.pow(val - homeScoreMean, 2), 0) / homeScores.length) || 1;
  const awayScoreStd = Math.sqrt(awayScores.reduce((sum, val) => sum + Math.pow(val - awayScoreMean, 2), 0) / awayScores.length) || 1;
  
  return {
    ratingFeatures: { mean: ratingMean, std: ratingStd },
    numericalFeatures: { min: numericalMin, max: numericalMax },
    targets: {
      homeScore: { mean: homeScoreMean, std: homeScoreStd },
      awayScore: { mean: awayScoreMean, std: awayScoreStd },
    },
  };
}

/**
 * Build multi-task neural network with rating features
 */
function buildRatingModel(config: ModelArchitecture): tf.LayersModel {
  // Input layers
  const homeTeamInput = tf.input({ shape: [1], name: 'home_team_id', dtype: 'int32' });
  const awayTeamInput = tf.input({ shape: [1], name: 'away_team_id', dtype: 'int32' });
  const leagueInput = tf.input({ shape: [1], name: 'league_id', dtype: 'int32' });
  const countryInput = tf.input({ shape: [1], name: 'country_id', dtype: 'int32' });
  const ratingFeaturesInput = tf.input({ shape: [78], name: 'rating_features' }); // 50+ rating features
  const numericalFeaturesInput = tf.input({ shape: [3], name: 'numerical_features' });
  
  // Embedding layers
  const homeTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    name: 'home_team_embedding',
  }).apply(homeTeamInput) as tf.SymbolicTensor;
  
  const awayTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    name: 'away_team_embedding',
  }).apply(awayTeamInput) as tf.SymbolicTensor;
  
  const leagueEmbedding = tf.layers.embedding({
    inputDim: config.numLeagues + 1,
    outputDim: config.leagueEmbeddingSize,
    name: 'league_embedding',
  }).apply(leagueInput) as tf.SymbolicTensor;
  
  const countryEmbedding = tf.layers.embedding({
    inputDim: config.numCountries + 1,
    outputDim: config.countryEmbeddingSize,
    name: 'country_embedding',
  }).apply(countryInput) as tf.SymbolicTensor;
  
  // Flatten embeddings
  const homeFlat = tf.layers.flatten().apply(homeTeamEmbedding) as tf.SymbolicTensor;
  const awayFlat = tf.layers.flatten().apply(awayTeamEmbedding) as tf.SymbolicTensor;
  const leagueFlat = tf.layers.flatten().apply(leagueEmbedding) as tf.SymbolicTensor;
  const countryFlat = tf.layers.flatten().apply(countryEmbedding) as tf.SymbolicTensor;
  
  // Concatenate all features
  const concatenated = tf.layers.concatenate().apply([
    homeFlat,
    awayFlat,
    leagueFlat,
    countryFlat,
    ratingFeaturesInput,
    numericalFeaturesInput,
  ]) as tf.SymbolicTensor;
  
  // Shared hidden layers
  let hidden: tf.SymbolicTensor = concatenated;
  for (const units of config.hiddenLayers) {
    hidden = tf.layers.dense({
      units,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }).apply(hidden) as tf.SymbolicTensor;
    hidden = tf.layers.dropout({ rate: 0.3 }).apply(hidden) as tf.SymbolicTensor;
  }
  
  // Task-specific outputs
  const result1x2 = tf.layers.dense({
    units: 3,
    activation: 'softmax',
    name: 'result_1x2',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const overUnder = tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'over_under_2_5',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const btts = tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'btts',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const homeScore = tf.layers.dense({
    units: 1,
    activation: 'linear',
    name: 'home_score',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const awayScore = tf.layers.dense({
    units: 1,
    activation: 'linear',
    name: 'away_score',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const model = tf.model({
    inputs: [homeTeamInput, awayTeamInput, leagueInput, countryInput, ratingFeaturesInput, numericalFeaturesInput],
    outputs: [result1x2, overUnder, btts, homeScore, awayScore],
  });
  
  return model;
}

/**
 * Train the rating-based neural network model
 */
export async function trainRatingModel(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  trainingConfig: TrainingConfig,
  archConfig: ModelArchitecture
): Promise<{ model: tf.LayersModel; result: TrainingResult; normalizationStats: NormalizationStats }> {
  console.log('Building rating-based neural network model...');
  const model = buildRatingModel(archConfig);
  
  // Compute normalization stats
  console.log('Computing normalization statistics...');
  const normalizationStats = computeRatingNormalizationStats(matches, ratings);
  
  // Prepare training data
  console.log('Preparing training data with rating features...');
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
    
    // Normalize numerical features
    const numericalFeatures = [
      match.homeTeamFormOverallL5 || 50,
      match.awayTeamFormOverallL5 || 50,
      match.leagueAvgGoals || 2.7,
    ];
    const normalizedNumerical = numericalFeatures.map((val, i) =>
      (val - normalizationStats.numericalFeatures.min[i]) / 
      (normalizationStats.numericalFeatures.max[i] - normalizationStats.numericalFeatures.min[i])
    );
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
  
  console.log(`Prepared ${homeTeamIds.length} training samples with ${ratingFeaturesList[0].length} rating features`);
  
  // Create tensors
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
    },
  });
  
  // Train model
  console.log('Training rating-based model...');
  const history: TrainingResult['history'] = [];
  
  const trainResult = await model.fit(xs, ys, {
    epochs: trainingConfig.epochs,
    batchSize: trainingConfig.batchSize,
    validationSplit: trainingConfig.validationSplit,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss=${logs?.loss.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`);
        history.push({
          epoch: epoch + 1,
          loss: logs?.loss || 0,
          accuracy: logs?.acc || 0,
          valLoss: logs?.val_loss || 0,
          valAccuracy: logs?.val_acc || 0,
        });
      },
    },
  });
  
  // Cleanup tensors
  Object.values(xs).forEach(tensor => tensor.dispose());
  Object.values(ys).forEach(tensor => tensor.dispose());
  
  const finalMetrics = {
    trainingAccuracy: history[history.length - 1]?.accuracy || 0,
    validationAccuracy: history[history.length - 1]?.valAccuracy || 0,
    loss: history[history.length - 1]?.loss || 0,
  };
  
  return {
    model,
    result: { finalMetrics, history },
    normalizationStats,
  };
}

/**
 * Save model and normalization stats
 */
export async function saveRatingModel(
  model: tf.LayersModel,
  modelPath: string,
  normalizationStats: NormalizationStats
): Promise<void> {
  if (!existsSync(modelPath)) {
    await mkdir(modelPath, { recursive: true });
  }
  
  await model.save(`file://${modelPath}`);
  await writeFile(
    `${modelPath}/normalization.json`,
    JSON.stringify(normalizationStats, null, 2)
  );
  
  console.log(`Model saved to ${modelPath}`);
}

/**
 * Load model and normalization stats
 */
export async function loadRatingModel(
  modelPath: string
): Promise<{ model: tf.LayersModel; normalizationStats: NormalizationStats }> {
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  const normalizationData = await readFile(`${modelPath}/normalization.json`, 'utf-8');
  const normalizationStats = JSON.parse(normalizationData);
  
  return { model, normalizationStats };
}

/**
 * Make prediction using rating-based model
 */
export async function predictWithRatingModel(
  model: tf.LayersModel,
  match: MatchStats,
  homeRating: TeamRating,
  awayRating: TeamRating,
  normalizationStats: NormalizationStats
): Promise<{
  result: { home: number; draw: number; away: number; predicted: '1' | 'X' | '2' };
  overUnder25: { prob: number; predicted: boolean };
  btts: { prob: number; predicted: boolean };
  scores: { homeScore: number; awayScore: number };
  confidence: number;
}> {
  // Extract and normalize rating features
  const ratingFeatures = extractRatingFeatures(homeRating, awayRating);
  const normalizedRatingFeatures = ratingFeatures.map((val, i) =>
    (val - normalizationStats.ratingFeatures.mean[i]) / normalizationStats.ratingFeatures.std[i]
  );
  
  // Normalize numerical features
  const numericalFeatures = [
    match.homeTeamFormOverallL5 || 50,
    match.awayTeamFormOverallL5 || 50,
    match.leagueAvgGoals || 2.7,
  ];
  const normalizedNumerical = numericalFeatures.map((val, i) =>
    (val - normalizationStats.numericalFeatures.min[i]) /
    (normalizationStats.numericalFeatures.max[i] - normalizationStats.numericalFeatures.min[i])
  );
  
  // Create input tensors
  const inputs = {
    home_team_id: tf.tensor2d([[match.homeTeamId]]),
    away_team_id: tf.tensor2d([[match.awayTeamId]]),
    league_id: tf.tensor2d([[match.leagueId]]),
    country_id: tf.tensor2d([[match.countryId]]),
    rating_features: tf.tensor2d([normalizedRatingFeatures]),
    numerical_features: tf.tensor2d([normalizedNumerical]),
  };
  
  // Make prediction
  const outputs = model.predict(inputs) as tf.Tensor[];
  
  const [result1x2Data, overUnderData, bttsData, homeScoreData, awayScoreData] = await Promise.all([
    outputs[0].data(),
    outputs[1].data(),
    outputs[2].data(),
    outputs[3].data(),
    outputs[4].data(),
  ]);
  
  // Cleanup
  Object.values(inputs).forEach(tensor => tensor.dispose());
  outputs.forEach(tensor => tensor.dispose());
  
  // Denormalize scores
  const homeScore = homeScoreData[0] * normalizationStats.targets.homeScore.std + normalizationStats.targets.homeScore.mean;
  const awayScore = awayScoreData[0] * normalizationStats.targets.awayScore.std + normalizationStats.targets.awayScore.mean;
  
  // Get predicted result
  const maxProb = Math.max(result1x2Data[0], result1x2Data[1], result1x2Data[2]);
  let predictedResult: '1' | 'X' | '2';
  if (result1x2Data[0] === maxProb) predictedResult = '1';
  else if (result1x2Data[1] === maxProb) predictedResult = 'X';
  else predictedResult = '2';
  
  return {
    result: {
      home: result1x2Data[0],
      draw: result1x2Data[1],
      away: result1x2Data[2],
      predicted: predictedResult,
    },
    overUnder25: {
      prob: overUnderData[0],
      predicted: overUnderData[0] > 0.5,
    },
    btts: {
      prob: bttsData[0],
      predicted: bttsData[0] > 0.5,
    },
    scores: {
      homeScore: Math.max(0, Math.round(homeScore)),
      awayScore: Math.max(0, Math.round(awayScore)),
    },
    confidence: maxProb,
  };
}
