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
  
  // Embedding layers
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
    outputs: [ftResultOutput, ftScoresOutput, bttsOutput, over25Output]
  });
  
  return model;
}

/**
 * Train the model on match statistics data
 */
export async function trainModel(
  matchStatsArray: MatchStats[],
  config: TrainingConfig,
  archConfig: ModelArchitectureConfig
): Promise<{ model: tf.LayersModel; result: TrainingResult }> {
  console.log(`Training model with ${matchStatsArray.length} samples...`);
  
  // Prepare data and filter out matches without complete labels
  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const numericalFeatures: number[][] = [];
  const ftResults: number[][] = [];
  const ftScores: number[][] = [];
  const bttsLabels: number[][] = [];
  const over25Labels: number[][] = [];
  
  let skipped = 0;
  for (const stats of matchStatsArray) {
    try {
      const cats = prepareCategoricalInputs(stats);
      const nums = prepareNumericalFeatures(stats);
      const labels = prepareLabels(stats);
      
      homeTeamIds.push(cats.homeTeamId);
      awayTeamIds.push(cats.awayTeamId);
      leagueIds.push(cats.leagueId);
      countryIds.push(cats.countryId);
      numericalFeatures.push(nums);
      ftResults.push(labels.ftResult);
      ftScores.push([labels.ftHomeScore, labels.ftAwayScore]);
      bttsLabels.push([labels.btts]);
      over25Labels.push([labels.over25]);
    } catch (error) {
      // Skip matches with incomplete data
      skipped++;
      console.log(`Skipping match ${stats.id}: ${error instanceof Error ? error.message : 'Invalid data'}`);
    }
  }
  
  const validSamples = homeTeamIds.length;
  console.log(`Using ${validSamples} valid samples for training (skipped ${skipped} incomplete matches)`);
  
  if (validSamples < 100) {
    throw new Error(`Insufficient training data. Need at least 100 completed matches, found only ${validSamples}.`);
  }
  
  // Create tensors
  const xs = {
    home_team_id: tf.tensor2d(homeTeamIds.map(id => [id]), [homeTeamIds.length, 1], 'int32'),
    away_team_id: tf.tensor2d(awayTeamIds.map(id => [id]), [awayTeamIds.length, 1], 'int32'),
    league_id: tf.tensor2d(leagueIds.map(id => [id]), [leagueIds.length, 1], 'int32'),
    country_id: tf.tensor2d(countryIds.map(id => [id]), [countryIds.length, 1], 'int32'),
    numerical_features: tf.tensor2d(numericalFeatures, [numericalFeatures.length, 39])
  };
  
  const ys = {
    ft_result: tf.tensor2d(ftResults),
    ft_scores: tf.tensor2d(ftScores),
    btts: tf.tensor2d(bttsLabels),
    over_25: tf.tensor2d(over25Labels)
  };
  
  // Build model
  const model = buildModel(archConfig);
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: {
      ft_result: 'categoricalCrossentropy',
      ft_scores: 'meanSquaredError',
      btts: 'binaryCrossentropy',
      over_25: 'binaryCrossentropy'
    },
    metrics: {
      ft_result: 'accuracy',
      btts: 'accuracy',
      over_25: 'accuracy'
    }
  });
  
  // Train model
  const history = await model.fit(xs, ys, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationSplit: config.validationSplit,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}/${config.epochs}: loss=${logs?.loss?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}`);
      }
    }
  });
  
  // Clean up tensors
  Object.values(xs).forEach(tensor => tensor.dispose());
  Object.values(ys).forEach(tensor => tensor.dispose());
  
  // Extract training metrics
  const lossHistory = history.history.loss as number[];
  const ftAccHistory = history.history.ft_result_acc as number[];
  const valLossHistory = history.history.val_loss as number[];
  const valFtAccHistory = history.history.val_ft_result_acc as number[];
  
  const trainingResult: TrainingResult = {
    history: {
      loss: lossHistory,
      accuracy: ftAccHistory,
      valLoss: valLossHistory,
      valAccuracy: valFtAccHistory,
    },
    finalMetrics: {
      trainingAccuracy: ftAccHistory[ftAccHistory.length - 1] || 0,
      validationAccuracy: valFtAccHistory[valFtAccHistory.length - 1] || 0,
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
  const scoresData = await predictions[1].data();
  const bttsProb = await predictions[2].data();
  const over25Prob = await predictions[3].data();
  
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
      homeScore: Math.round(scoresData[0]),
      awayScore: Math.round(scoresData[1])
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
  await model.save(`file://${path}`);
}

/**
 * Load model from file system
 */
export async function loadModel(path: string): Promise<tf.LayersModel> {
  return await tf.loadLayersModel(`file://${path}/model.json`);
}
