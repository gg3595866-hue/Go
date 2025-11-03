import * as tf from '@tensorflow/tfjs-node';
import type { MatchStats } from '@shared/schema';

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  learningRate: number;
}

export interface ModelArchitectureConfig {
  numTeams: number;
  numLeagues: number;
  numCountries: number;
  teamEmbeddingSize: number;
  leagueEmbeddingSize: number;
  countryEmbeddingSize: number;
  hiddenLayers: number[];
}

export interface TrainingResult {
  history: {
    loss: number[];
    accuracy: number[];
    valLoss: number[];
    valAccuracy: number[];
  };
  finalMetrics: {
    trainingAccuracy: number;
    validationAccuracy: number;
    loss: number;
  };
}

export interface PredictionResult {
  ftResult: {
    home: number;
    draw: number;
    away: number;
    predicted: '1' | 'X' | '2';
  };
  scores: {
    homeScore: number;
    awayScore: number;
  };
  htScores: {
    homeScore: number;
    awayScore: number;
  };
  btts: {
    probability: number;
    predicted: boolean;
  };
  over25: {
    probability: number;
    predicted: boolean;
  };
  confidence: number;
}

/**
 * Prepare numerical features from match stats
 */
export function prepareNumericalFeatures(stats: MatchStats): number[] {
  return [
    // Form metrics
    stats.homeTeamFormHomeL5,
    stats.awayTeamFormAwayL5,
    stats.homeTeamFormOverallL5,
    stats.awayTeamFormOverallL5,
    stats.homeTeamFormDiffOverall,
    
    // Win/Draw/Loss rates
    stats.homeTeamWinRateL8,
    stats.awayTeamWinRateL8,
    stats.homeTeamDrawRateL8,
    stats.awayTeamDrawRateL8,
    stats.homeTeamLossRateL8,
    stats.awayTeamLossRateL8,
    
    // To Nil rates
    stats.homeTeamToNilRateL8,
    stats.awayTeamToNilRateL8,
    
    // Winning margin rates
    stats.homeTeamWinningMargin1GoalRateL8,
    stats.awayTeamWinningMargin1GoalRateL8,
    stats.homeTeamWinningMargin2GoalRateL8,
    stats.awayTeamWinningMargin2GoalRateL8,
    
    // Half goal rates
    stats.homeTeamFirstHalfGoalRate,
    stats.awayTeamFirstHalfGoalRate,
    stats.homeTeamSecondHalfGoalRate,
    stats.awayTeamSecondHalfGoalRate,
    
    // BTTS and scoring rates
    stats.homeTeamBttsRateL4,
    stats.awayTeamBttsRateL4,
    stats.homeTeamScoredRateL4,
    stats.awayTeamScoredRateL4,
    stats.homeTeamScoredAgainstRateL4,
    stats.awayTeamScoredAgainstRateL4,
    
    // Half-time rates
    stats.homeTeamHtWonRateL8,
    stats.awayTeamHtWonRateL8,
    stats.homeTeamHtTiedRateL8,
    stats.awayTeamHtTiedRateL8,
    stats.homeTeamHtLostRateL8,
    stats.awayTeamHtLostRateL8,
    
    // League statistics
    stats.leagueHomeWins,
    stats.leagueDraws,
    stats.leagueAwayWins,
    stats.leagueUnder25,
    stats.leagueOver25,
    stats.leagueAvgGoals,
  ];
}

/**
 * Prepare categorical ID inputs from match stats
 */
export function prepareCategoricalInputs(stats: MatchStats) {
  return {
    homeTeamId: stats.homeTeamId,
    awayTeamId: stats.awayTeamId,
    leagueId: stats.leagueId,
    countryId: stats.countryId,
  };
}

/**
 * Prepare target labels from match stats
 * Throws error if any label is missing (for training data validation)
 */
export function prepareLabels(stats: MatchStats) {
  // Validate that all required labels exist
  if (!stats.ftResult || stats.ftHomeScore === null || stats.ftAwayScore === null ||
      stats.htHomeScore === null || stats.htAwayScore === null ||
      stats.bttsYesNo === null || stats.uO25Goals === null) {
    throw new Error(`Match ${stats.id} is missing required label data. Only completed matches can be used for training.`);
  }
  
  // Convert ft_result to one-hot encoding
  let ftResultOneHot: number[];
  if (stats.ftResult === '1') {
    ftResultOneHot = [1, 0, 0]; // Home win
  } else if (stats.ftResult === 'X') {
    ftResultOneHot = [0, 1, 0]; // Draw
  } else if (stats.ftResult === '2') {
    ftResultOneHot = [0, 0, 1]; // Away win
  } else {
    throw new Error(`Invalid ftResult value: ${stats.ftResult}. Must be '1', 'X', or '2'.`);
  }
  
  return {
    ftResult: ftResultOneHot,
    ftHomeScore: stats.ftHomeScore,
    ftAwayScore: stats.ftAwayScore,
    htHomeScore: stats.htHomeScore,
    htAwayScore: stats.htAwayScore,
    btts: stats.bttsYesNo,
    over25: stats.uO25Goals,
  };
}

/**
 * Build multi-task neural network model with embeddings
 */
export function buildModel(config: ModelArchitectureConfig): tf.LayersModel {
  // Input layers
  const homeTeamInput = tf.input({ shape: [1], name: 'home_team_id', dtype: 'int32' });
  const awayTeamInput = tf.input({ shape: [1], name: 'away_team_id', dtype: 'int32' });
  const leagueInput = tf.input({ shape: [1], name: 'league_id', dtype: 'int32' });
  const countryInput = tf.input({ shape: [1], name: 'country_id', dtype: 'int32' });
  const numericalInput = tf.input({ shape: [39], name: 'numerical_features' });
  
  // Embedding layers with 40-15-10 configuration
  const homeTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    inputLength: 1,
    name: 'home_team_embedding'
  }).apply(homeTeamInput) as tf.SymbolicTensor;
  
  const awayTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    inputLength: 1,
    name: 'away_team_embedding'
  }).apply(awayTeamInput) as tf.SymbolicTensor;
  
  const leagueEmbedding = tf.layers.embedding({
    inputDim: config.numLeagues + 1,
    outputDim: config.leagueEmbeddingSize,
    inputLength: 1,
    name: 'league_embedding'
  }).apply(leagueInput) as tf.SymbolicTensor;
  
  const countryEmbedding = tf.layers.embedding({
    inputDim: config.numCountries + 1,
    outputDim: config.countryEmbeddingSize,
    inputLength: 1,
    name: 'country_embedding'
  }).apply(countryInput) as tf.SymbolicTensor;
  
  // Flatten embeddings
  const homeTeamFlat = tf.layers.flatten().apply(homeTeamEmbedding) as tf.SymbolicTensor;
  const awayTeamFlat = tf.layers.flatten().apply(awayTeamEmbedding) as tf.SymbolicTensor;
  const leagueFlat = tf.layers.flatten().apply(leagueEmbedding) as tf.SymbolicTensor;
  const countryFlat = tf.layers.flatten().apply(countryEmbedding) as tf.SymbolicTensor;
  
  // Concatenate all features
  const concatenated = tf.layers.concatenate().apply([
    homeTeamFlat,
    awayTeamFlat,
    leagueFlat,
    countryFlat,
    numericalInput
  ]) as tf.SymbolicTensor;
  
  // Shared hidden layers
  let hidden = concatenated;
  for (const units of config.hiddenLayers) {
    hidden = tf.layers.dense({
      units,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }).apply(hidden) as tf.SymbolicTensor;
    
    hidden = tf.layers.dropout({ rate: 0.3 }).apply(hidden) as tf.SymbolicTensor;
  }
  
  // Task-specific output layers
  const ftResultOutput = tf.layers.dense({
    units: 3,
    activation: 'softmax',
    name: 'ft_result'
  }).apply(hidden) as tf.SymbolicTensor;
  
  const ftScoresOutput = tf.layers.dense({
    units: 2,
    activation: 'relu',
    name: 'ft_scores'
  }).apply(hidden) as tf.SymbolicTensor;
  
  const htScoresOutput = tf.layers.dense({
    units: 2,
    activation: 'relu',
    name: 'ht_scores'
  }).apply(hidden) as tf.SymbolicTensor;
  
  const bttsOutput = tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'btts'
  }).apply(hidden) as tf.SymbolicTensor;
  
  const over25Output = tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'over_25'
  }).apply(hidden) as tf.SymbolicTensor;
  
  // Create model
  const model = tf.model({
    inputs: [homeTeamInput, awayTeamInput, leagueInput, countryInput, numericalInput],
    outputs: [ftResultOutput, ftScoresOutput, htScoresOutput, bttsOutput, over25Output]
  });
  
  return model;
}

/**
 * Perform time-aware split: older matches for training, newer matches for validation
 * This prevents data leakage by ensuring the model never sees "future" information during training
 */
function timeAwareSplit<T extends { matchDate: Date }>(
  data: T[],
  validationSplit: number = 0.2
): { train: T[]; validation: T[] } {
  // Sort by matchDate (oldest to newest)
  const sorted = [...data].sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());
  
  // Calculate split index
  const splitIndex = Math.floor(sorted.length * (1 - validationSplit));
  
  // Split: train on older matches, validate on newer matches
  const train = sorted.slice(0, splitIndex);
  const validation = sorted.slice(splitIndex);
  
  console.log(`Time-aware split: ${train.length} training samples (oldest), ${validation.length} validation samples (newest)`);
  if (train.length > 0 && validation.length > 0) {
    console.log(`Training date range: ${train[0].matchDate.toISOString().split('T')[0]} to ${train[train.length-1].matchDate.toISOString().split('T')[0]}`);
    console.log(`Validation date range: ${validation[0].matchDate.toISOString().split('T')[0]} to ${validation[validation.length-1].matchDate.toISOString().split('T')[0]}`);
  }
  
  return { train, validation };
}

/**
 * Train the model on match statistics data with time-aware splitting
 */
export async function trainModel(
  matchStatsArray: MatchStats[],
  config: TrainingConfig,
  archConfig: ModelArchitectureConfig
): Promise<{ model: tf.LayersModel; result: TrainingResult }> {
  console.log(`\n🔄 Training model with ${matchStatsArray.length} samples...`);
  
  // Filter matches with complete data first
  const validMatches: MatchStats[] = [];
  let skipped = 0;
  
  for (const stats of matchStatsArray) {
    try {
      prepareLabels(stats); // This will throw if data is incomplete
      validMatches.push(stats);
    } catch (error) {
      skipped++;
    }
  }
  
  console.log(`✅ ${validMatches.length} valid matches, ❌ ${skipped} skipped (incomplete data)`);
  
  if (validMatches.length < 100) {
    throw new Error(`Insufficient training data. Need at least 100 completed matches, found only ${validMatches.length}.`);
  }
  
  // ⚡ TIME-AWARE SPLIT: Train on old matches, validate on new matches
  const { train: trainMatches, validation: valMatches } = timeAwareSplit(validMatches, config.validationSplit);
  
  if (trainMatches.length < 50 || valMatches.length < 10) {
    throw new Error(`Time-aware split resulted in insufficient data: ${trainMatches.length} training, ${valMatches.length} validation. Need at least 50 training and 10 validation samples.`);
  }
  
  // Prepare training data
  const trainData = {
    homeTeamIds: [] as number[],
    awayTeamIds: [] as number[],
    leagueIds: [] as number[],
    countryIds: [] as number[],
    numericalFeatures: [] as number[][],
    ftResults: [] as number[][],
    ftScores: [] as number[][],
    htScores: [] as number[][],
    bttsLabels: [] as number[][],
    over25Labels: [] as number[][]
  };
  
  for (const stats of trainMatches) {
    const cats = prepareCategoricalInputs(stats);
    const nums = prepareNumericalFeatures(stats);
    const labels = prepareLabels(stats);
    
    trainData.homeTeamIds.push(cats.homeTeamId);
    trainData.awayTeamIds.push(cats.awayTeamId);
    trainData.leagueIds.push(cats.leagueId);
    trainData.countryIds.push(cats.countryId);
    trainData.numericalFeatures.push(nums);
    trainData.ftResults.push(labels.ftResult);
    trainData.ftScores.push([labels.ftHomeScore, labels.ftAwayScore]);
    trainData.htScores.push([labels.htHomeScore, labels.htAwayScore]);
    trainData.bttsLabels.push([labels.btts]);
    trainData.over25Labels.push([labels.over25]);
  }
  
  // Prepare validation data
  const valData = {
    homeTeamIds: [] as number[],
    awayTeamIds: [] as number[],
    leagueIds: [] as number[],
    countryIds: [] as number[],
    numericalFeatures: [] as number[][],
    ftResults: [] as number[][],
    ftScores: [] as number[][],
    htScores: [] as number[][],
    bttsLabels: [] as number[][],
    over25Labels: [] as number[][]
  };
  
  for (const stats of valMatches) {
    const cats = prepareCategoricalInputs(stats);
    const nums = prepareNumericalFeatures(stats);
    const labels = prepareLabels(stats);
    
    valData.homeTeamIds.push(cats.homeTeamId);
    valData.awayTeamIds.push(cats.awayTeamId);
    valData.leagueIds.push(cats.leagueId);
    valData.countryIds.push(cats.countryId);
    valData.numericalFeatures.push(nums);
    valData.ftResults.push(labels.ftResult);
    valData.ftScores.push([labels.ftHomeScore, labels.ftAwayScore]);
    valData.htScores.push([labels.htHomeScore, labels.htAwayScore]);
    valData.bttsLabels.push([labels.btts]);
    valData.over25Labels.push([labels.over25]);
  }
  
  // Create training tensors
  const trainXs = {
    home_team_id: tf.tensor2d(trainData.homeTeamIds.map(id => [id]), [trainData.homeTeamIds.length, 1], 'int32'),
    away_team_id: tf.tensor2d(trainData.awayTeamIds.map(id => [id]), [trainData.awayTeamIds.length, 1], 'int32'),
    league_id: tf.tensor2d(trainData.leagueIds.map(id => [id]), [trainData.leagueIds.length, 1], 'int32'),
    country_id: tf.tensor2d(trainData.countryIds.map(id => [id]), [trainData.countryIds.length, 1], 'int32'),
    numerical_features: tf.tensor2d(trainData.numericalFeatures, [trainData.numericalFeatures.length, 39])
  };
  
  const trainYs = {
    ft_result: tf.tensor2d(trainData.ftResults),
    ft_scores: tf.tensor2d(trainData.ftScores),
    ht_scores: tf.tensor2d(trainData.htScores),
    btts: tf.tensor2d(trainData.bttsLabels),
    over_25: tf.tensor2d(trainData.over25Labels)
  };
  
  // Create validation tensors
  const valXs = {
    home_team_id: tf.tensor2d(valData.homeTeamIds.map(id => [id]), [valData.homeTeamIds.length, 1], 'int32'),
    away_team_id: tf.tensor2d(valData.awayTeamIds.map(id => [id]), [valData.awayTeamIds.length, 1], 'int32'),
    league_id: tf.tensor2d(valData.leagueIds.map(id => [id]), [valData.leagueIds.length, 1], 'int32'),
    country_id: tf.tensor2d(valData.countryIds.map(id => [id]), [valData.countryIds.length, 1], 'int32'),
    numerical_features: tf.tensor2d(valData.numericalFeatures, [valData.numericalFeatures.length, 39])
  };
  
  const valYs = {
    ft_result: tf.tensor2d(valData.ftResults),
    ft_scores: tf.tensor2d(valData.ftScores),
    ht_scores: tf.tensor2d(valData.htScores),
    btts: tf.tensor2d(valData.bttsLabels),
    over_25: tf.tensor2d(valData.over25Labels)
  };
  
  // Build model with reduced embeddings
  const model = buildModel(archConfig);
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: {
      ft_result: 'categoricalCrossentropy',
      ft_scores: 'meanSquaredError',
      ht_scores: 'meanSquaredError',
      btts: 'binaryCrossentropy',
      over_25: 'binaryCrossentropy'
    },
    metrics: {
      ft_result: 'accuracy',
      btts: 'accuracy',
      over_25: 'accuracy'
    }
  });
  
  console.log(`\n🎯 Training with NO random shuffle - chronological split ensures no data leakage\n`);
  
  // Train model with time-aware validation data (NO SHUFFLE, NO BUILT-IN VALIDATION SPLIT)
  const history = await model.fit(trainXs, trainYs, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationData: [
      [valXs.home_team_id, valXs.away_team_id, valXs.league_id, valXs.country_id, valXs.numerical_features],
      [valYs.ft_result, valYs.ft_scores, valYs.ht_scores, valYs.btts, valYs.over_25]
    ],
    shuffle: false, // ⚠️ NO SHUFFLE to maintain time order
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const trainAcc = (logs?.ft_result_acc || 0) * 100;
        const valAcc = (logs?.val_ft_result_acc || 0) * 100;
        const gap = trainAcc - valAcc;
        console.log(
          `Epoch ${epoch + 1}/${config.epochs}: ` +
          `train_acc=${trainAcc.toFixed(1)}%, val_acc=${valAcc.toFixed(1)}%, ` +
          `gap=${gap.toFixed(1)}% ${gap > 20 ? '⚠️ MEMORIZING!' : gap > 10 ? '⚠️' : '✅'}`
        );
      }
    }
  });
  
  // Clean up tensors
  Object.values(trainXs).forEach(tensor => tensor.dispose());
  Object.values(trainYs).forEach(tensor => tensor.dispose());
  Object.values(valXs).forEach(tensor => tensor.dispose());
  Object.values(valYs).forEach(tensor => tensor.dispose());
  
  // Extract training metrics
  const lossHistory = history.history.loss as number[];
  const ftAccHistory = history.history.ft_result_acc as number[];
  const valLossHistory = history.history.val_loss as number[];
  const valFtAccHistory = history.history.val_ft_result_acc as number[];
  
  const finalTrainAcc = ftAccHistory[ftAccHistory.length - 1] || 0;
  const finalValAcc = valFtAccHistory[valFtAccHistory.length - 1] || 0;
  const generalizationGap = (finalTrainAcc - finalValAcc) * 100;
  
  console.log(`\n📊 Final Results:`);
  console.log(`   Training Accuracy: ${(finalTrainAcc * 100).toFixed(1)}%`);
  console.log(`   Validation Accuracy: ${(finalValAcc * 100).toFixed(1)}%`);
  console.log(`   Generalization Gap: ${generalizationGap.toFixed(1)}% ${generalizationGap > 20 ? '⚠️ HIGH - Model is memorizing!' : generalizationGap > 10 ? '⚠️ MODERATE' : '✅ GOOD'}`);
  
  const trainingResult: TrainingResult = {
    history: {
      loss: lossHistory,
      accuracy: ftAccHistory,
      valLoss: valLossHistory,
      valAccuracy: valFtAccHistory,
    },
    finalMetrics: {
      trainingAccuracy: finalTrainAcc,
      validationAccuracy: finalValAcc,
      loss: valLossHistory[valLossHistory.length - 1] || 0,
    }
  };
  
  return { model, result: trainingResult };
}

/**
 * Make predictions for a single match
 */
export async function predict(
  model: tf.LayersModel,
  stats: MatchStats
): Promise<PredictionResult> {
  const cats = prepareCategoricalInputs(stats);
  const nums = prepareNumericalFeatures(stats);
  
  // Create input tensors
  const xs = {
    home_team_id: tf.tensor2d([[cats.homeTeamId]], [1, 1], 'int32'),
    away_team_id: tf.tensor2d([[cats.awayTeamId]], [1, 1], 'int32'),
    league_id: tf.tensor2d([[cats.leagueId]], [1, 1], 'int32'),
    country_id: tf.tensor2d([[cats.countryId]], [1, 1], 'int32'),
    numerical_features: tf.tensor2d([nums], [1, 39])
  };
  
  // Make prediction
  const inputTensors = [
    xs.home_team_id,
    xs.away_team_id,
    xs.league_id,
    xs.country_id,
    xs.numerical_features
  ];
  const predictions = model.predict(inputTensors) as tf.Tensor[];
  
  // Extract prediction values
  const ftResultProbs = await predictions[0].data();
  const ftScoresData = await predictions[1].data();
  const htScoresData = await predictions[2].data();
  const bttsProb = await predictions[3].data();
  const over25Prob = await predictions[4].data();
  
  // Clean up tensors
  Object.values(xs).forEach(tensor => tensor.dispose());
  predictions.forEach(tensor => tensor.dispose());
  
  // Determine predicted result
  let predictedResult: '1' | 'X' | '2';
  if (ftResultProbs[0] > ftResultProbs[1] && ftResultProbs[0] > ftResultProbs[2]) {
    predictedResult = '1';
  } else if (ftResultProbs[1] > ftResultProbs[0] && ftResultProbs[1] > ftResultProbs[2]) {
    predictedResult = 'X';
  } else {
    predictedResult = '2';
  }
  
  // Calculate confidence
  const maxProb = Math.max(...Array.from(ftResultProbs).slice(0, 3));
  const confidence = maxProb;
  
  return {
    ftResult: {
      home: ftResultProbs[0],
      draw: ftResultProbs[1],
      away: ftResultProbs[2],
      predicted: predictedResult
    },
    scores: {
      homeScore: Math.round(ftScoresData[0]),
      awayScore: Math.round(ftScoresData[1])
    },
    htScores: {
      homeScore: Math.round(htScoresData[0]),
      awayScore: Math.round(htScoresData[1])
    },
    btts: {
      probability: bttsProb[0],
      predicted: bttsProb[0] > 0.5
    },
    over25: {
      probability: over25Prob[0],
      predicted: over25Prob[0] > 0.5
    },
    confidence
  };
}

/**
 * Save model to file system
 */
export async function saveModel(model: tf.LayersModel, path: string): Promise<void> {
  const fs = await import('fs/promises');
  await fs.mkdir(path, { recursive: true });
  await model.save(`file://${path}`);
}

/**
 * Load model from file system
 */
export async function loadModel(path: string): Promise<tf.LayersModel> {
  return await tf.loadLayersModel(`file://${path}/model.json`);
}
