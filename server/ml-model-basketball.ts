import * as tf from '@tensorflow/tfjs-node';
import type { BasketballStats } from '@shared/schema';

export interface BasketballNormalizationStats {
  numericalFeatures: {
    min: number[];
    max: number[];
  };
  targets: {
    homePoints: { min: number; max: number };
    awayPoints: { min: number; max: number };
  };
}

export interface BasketballTrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  learningRate: number;
}

export interface BasketballModelArchitectureConfig {
  numTeams: number;
  numLeagues: number;
  numCountries: number;
  teamEmbeddingSize: number;
  leagueEmbeddingSize: number;
  countryEmbeddingSize: number;
  hiddenLayers: number[];
}

export interface BasketballTrainingResult {
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

export interface BasketballPredictionResult {
  winner: {
    home: number;
    away: number;
    predicted: 'H' | 'A';
  };
  points: {
    homePoints: number;
    awayPoints: number;
  };
  confidence: number;
}

export function prepareBasketballNumericalFeatures(stats: BasketballStats): number[] {
  return [
    stats.homePointsScoredPerGame,
    stats.awayPointsScoredPerGame,
    stats.homePointsReceivedPerGame,
    stats.awayPointsReceivedPerGame,
    stats.homeWon,
    stats.awayWon,
    stats.homeTied,
    stats.awayTied,
    stats.homeLost,
    stats.awayLost,
    stats.homeAvgPointsQ1,
    stats.awayAvgPointsQ1,
    stats.homeAvgPointsQ2,
    stats.awayAvgPointsQ2,
    stats.homeAvgPointsQ3,
    stats.awayAvgPointsQ3,
  ];
}

export function computeNormalizationStats(
  matchStatsArray: BasketballStats[]
): BasketballNormalizationStats {
  const numericalFeaturesArray: number[][] = [];
  const homePointsArray: number[] = [];
  const awayPointsArray: number[] = [];

  for (const stats of matchStatsArray) {
    numericalFeaturesArray.push(prepareBasketballNumericalFeatures(stats));
    if (stats.ftHomePoints !== null) homePointsArray.push(stats.ftHomePoints);
    if (stats.ftAwayPoints !== null) awayPointsArray.push(stats.ftAwayPoints);
  }

  const numFeatures = numericalFeaturesArray[0].length;
  const min: number[] = [];
  const max: number[] = [];

  for (let i = 0; i < numFeatures; i++) {
    const values = numericalFeaturesArray.map(features => features[i]);
    min.push(Math.min(...values));
    max.push(Math.max(...values));
  }

  return {
    numericalFeatures: { min, max },
    targets: {
      homePoints: {
        min: Math.min(...homePointsArray),
        max: Math.max(...homePointsArray),
      },
      awayPoints: {
        min: Math.min(...awayPointsArray),
        max: Math.max(...awayPointsArray),
      },
    },
  };
}

export function normalizeFeatures(
  features: number[],
  stats: BasketballNormalizationStats
): number[] {
  return features.map((value, i) => {
    const min = stats.numericalFeatures.min[i];
    const max = stats.numericalFeatures.max[i];
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  });
}

export function normalizeTarget(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function denormalizeTarget(
  normalizedValue: number,
  min: number,
  max: number
): number {
  return normalizedValue * (max - min) + min;
}

export function prepareBasketballCategoricalInputs(stats: BasketballStats) {
  return {
    homeTeamId: stats.homeTeamId,
    awayTeamId: stats.awayTeamId,
    leagueId: stats.leagueId,
    countryId: stats.countryId,
  };
}

export function prepareBasketballLabels(stats: BasketballStats) {
  if (!stats.ftResult || stats.ftHomePoints === null || stats.ftAwayPoints === null) {
    throw new Error(`Basketball match ${stats.id} is missing required label data. Only completed matches can be used for training.`);
  }
  
  let ftResultOneHot: number[];
  if (stats.ftResult === 'H') {
    ftResultOneHot = [1, 0];
  } else if (stats.ftResult === 'A') {
    ftResultOneHot = [0, 1];
  } else {
    throw new Error(`Invalid ftResult value: ${stats.ftResult}. Must be 'H' or 'A'.`);
  }
  
  return {
    ftResult: ftResultOneHot,
    ftHomePoints: stats.ftHomePoints,
    ftAwayPoints: stats.ftAwayPoints,
  };
}

export function buildBasketballModel(config: BasketballModelArchitectureConfig): tf.LayersModel {
  const homeTeamInput = tf.input({ shape: [1], name: 'home_team_id', dtype: 'int32' });
  const awayTeamInput = tf.input({ shape: [1], name: 'away_team_id', dtype: 'int32' });
  const leagueInput = tf.input({ shape: [1], name: 'league_id', dtype: 'int32' });
  const countryInput = tf.input({ shape: [1], name: 'country_id', dtype: 'int32' });
  const numericalInput = tf.input({ shape: [16], name: 'numerical_features' });

  const homeTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    inputLength: 1,
    name: 'home_team_embedding',
  }).apply(homeTeamInput) as tf.SymbolicTensor;

  const awayTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    inputLength: 1,
    name: 'away_team_embedding',
  }).apply(awayTeamInput) as tf.SymbolicTensor;

  const leagueEmbedding = tf.layers.embedding({
    inputDim: config.numLeagues + 1,
    outputDim: config.leagueEmbeddingSize,
    inputLength: 1,
    name: 'league_embedding',
  }).apply(leagueInput) as tf.SymbolicTensor;

  const countryEmbedding = tf.layers.embedding({
    inputDim: config.numCountries + 1,
    outputDim: config.countryEmbeddingSize,
    inputLength: 1,
    name: 'country_embedding',
  }).apply(countryInput) as tf.SymbolicTensor;

  const homeTeamFlat = tf.layers.flatten().apply(homeTeamEmbedding) as tf.SymbolicTensor;
  const awayTeamFlat = tf.layers.flatten().apply(awayTeamEmbedding) as tf.SymbolicTensor;
  const leagueFlat = tf.layers.flatten().apply(leagueEmbedding) as tf.SymbolicTensor;
  const countryFlat = tf.layers.flatten().apply(countryEmbedding) as tf.SymbolicTensor;

  const concatenated = tf.layers.concatenate().apply([
    homeTeamFlat,
    awayTeamFlat,
    leagueFlat,
    countryFlat,
    numericalInput,
  ]) as tf.SymbolicTensor;

  let sharedLayer: tf.SymbolicTensor = concatenated;
  for (const units of config.hiddenLayers) {
    sharedLayer = tf.layers.dense({
      units,
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }).apply(sharedLayer) as tf.SymbolicTensor;
    
    sharedLayer = tf.layers.dropout({ rate: 0.3 }).apply(sharedLayer) as tf.SymbolicTensor;
  }

  const winnerOutput = tf.layers.dense({
    units: 2,
    activation: 'softmax',
    name: 'winner_output',
  }).apply(sharedLayer) as tf.SymbolicTensor;

  const homePointsOutput = tf.layers.dense({
    units: 1,
    activation: 'relu',
    name: 'home_points_output',
  }).apply(sharedLayer) as tf.SymbolicTensor;

  const awayPointsOutput = tf.layers.dense({
    units: 1,
    activation: 'relu',
    name: 'away_points_output',
  }).apply(sharedLayer) as tf.SymbolicTensor;

  const model = tf.model({
    inputs: [homeTeamInput, awayTeamInput, leagueInput, countryInput, numericalInput],
    outputs: [winnerOutput, homePointsOutput, awayPointsOutput],
  });

  return model;
}

/**
 * Time-aware split for basketball matches
 */
function timeAwareBasketballSplit<T extends { matchDate: Date }>(
  data: T[],
  validationSplit: number = 0.2
): { train: T[]; validation: T[] } {
  const sorted = [...data].sort((a, b) => a.matchDate.getTime() - b.matchDate.getTime());
  const splitIndex = Math.floor(sorted.length * (1 - validationSplit));
  
  const train = sorted.slice(0, splitIndex);
  const validation = sorted.slice(splitIndex);
  
  console.log(`Basketball time-aware split: ${train.length} training, ${validation.length} validation`);
  if (train.length > 0 && validation.length > 0) {
    console.log(`Training: ${train[0].matchDate.toISOString().split('T')[0]} to ${train[train.length-1].matchDate.toISOString().split('T')[0]}`);
    console.log(`Validation: ${validation[0].matchDate.toISOString().split('T')[0]} to ${validation[validation.length-1].matchDate.toISOString().split('T')[0]}`);
  }
  
  return { train, validation };
}

export async function trainBasketballModel(
  matchStatsArray: BasketballStats[],
  trainingConfig: BasketballTrainingConfig,
  archConfig: BasketballModelArchitectureConfig
): Promise<{ model: tf.LayersModel; result: BasketballTrainingResult; normalizationStats: BasketballNormalizationStats }> {
  console.log(`\n🏀 Training basketball model with ${matchStatsArray.length} samples...`);
  
  const validMatches = matchStatsArray.filter(stats => {
    try {
      prepareBasketballLabels(stats);
      return true;
    } catch {
      return false;
    }
  });

  if (validMatches.length === 0) {
    throw new Error('No valid matches found for training. All matches must have complete result data.');
  }
  
  console.log(`✅ ${validMatches.length} valid matches`);

  // ⚡ TIME-AWARE SPLIT: older matches for training, newer for validation
  const { train: trainMatches, validation: valMatches } = timeAwareBasketballSplit(validMatches, trainingConfig.validationSplit);
  
  if (trainMatches.length < 50 || valMatches.length < 10) {
    throw new Error(`Time-aware split resulted in insufficient data: ${trainMatches.length} training, ${valMatches.length} validation. Need at least 50 training and 10 validation samples.`);
  }
  
  // ⚠️ CRITICAL: Compute normalization stats ONLY from training data to prevent data leakage
  const normalizationStats = computeNormalizationStats(trainMatches);

  // Prepare training data
  const trainData = {
    homeTeamIds: [] as number[],
    awayTeamIds: [] as number[],
    leagueIds: [] as number[],
    countryIds: [] as number[],
    numericalFeatures: [] as number[][],
    winnerLabels: [] as number[][],
    homePointsLabels: [] as number[],
    awayPointsLabels: [] as number[]
  };

  for (const stats of trainMatches) {
    const categorical = prepareBasketballCategoricalInputs(stats);
    const numerical = prepareBasketballNumericalFeatures(stats);
    const normalizedNumerical = normalizeFeatures(numerical, normalizationStats);
    const labels = prepareBasketballLabels(stats);

    trainData.homeTeamIds.push(categorical.homeTeamId);
    trainData.awayTeamIds.push(categorical.awayTeamId);
    trainData.leagueIds.push(categorical.leagueId);
    trainData.countryIds.push(categorical.countryId);
    trainData.numericalFeatures.push(normalizedNumerical);
    trainData.winnerLabels.push(labels.ftResult);
    trainData.homePointsLabels.push(
      normalizeTarget(labels.ftHomePoints, normalizationStats.targets.homePoints.min, normalizationStats.targets.homePoints.max)
    );
    trainData.awayPointsLabels.push(
      normalizeTarget(labels.ftAwayPoints, normalizationStats.targets.awayPoints.min, normalizationStats.targets.awayPoints.max)
    );
  }
  
  // Prepare validation data
  const valData = {
    homeTeamIds: [] as number[],
    awayTeamIds: [] as number[],
    leagueIds: [] as number[],
    countryIds: [] as number[],
    numericalFeatures: [] as number[][],
    winnerLabels: [] as number[][],
    homePointsLabels: [] as number[],
    awayPointsLabels: [] as number[]
  };

  for (const stats of valMatches) {
    const categorical = prepareBasketballCategoricalInputs(stats);
    const numerical = prepareBasketballNumericalFeatures(stats);
    const normalizedNumerical = normalizeFeatures(numerical, normalizationStats);
    const labels = prepareBasketballLabels(stats);

    valData.homeTeamIds.push(categorical.homeTeamId);
    valData.awayTeamIds.push(categorical.awayTeamId);
    valData.leagueIds.push(categorical.leagueId);
    valData.countryIds.push(categorical.countryId);
    valData.numericalFeatures.push(normalizedNumerical);
    valData.winnerLabels.push(labels.ftResult);
    valData.homePointsLabels.push(
      normalizeTarget(labels.ftHomePoints, normalizationStats.targets.homePoints.min, normalizationStats.targets.homePoints.max)
    );
    valData.awayPointsLabels.push(
      normalizeTarget(labels.ftAwayPoints, normalizationStats.targets.awayPoints.min, normalizationStats.targets.awayPoints.max)
    );
  }

  // Create tensors
  const trainXs = [
    tf.tensor2d(trainData.homeTeamIds, [trainData.homeTeamIds.length, 1], 'int32'),
    tf.tensor2d(trainData.awayTeamIds, [trainData.awayTeamIds.length, 1], 'int32'),
    tf.tensor2d(trainData.leagueIds, [trainData.leagueIds.length, 1], 'int32'),
    tf.tensor2d(trainData.countryIds, [trainData.countryIds.length, 1], 'int32'),
    tf.tensor2d(trainData.numericalFeatures)
  ];
  
  const trainYs = [
    tf.tensor2d(trainData.winnerLabels),
    tf.tensor2d(trainData.homePointsLabels, [trainData.homePointsLabels.length, 1]),
    tf.tensor2d(trainData.awayPointsLabels, [trainData.awayPointsLabels.length, 1])
  ];
  
  const valXs = [
    tf.tensor2d(valData.homeTeamIds, [valData.homeTeamIds.length, 1], 'int32'),
    tf.tensor2d(valData.awayTeamIds, [valData.awayTeamIds.length, 1], 'int32'),
    tf.tensor2d(valData.leagueIds, [valData.leagueIds.length, 1], 'int32'),
    tf.tensor2d(valData.countryIds, [valData.countryIds.length, 1], 'int32'),
    tf.tensor2d(valData.numericalFeatures)
  ];
  
  const valYs = [
    tf.tensor2d(valData.winnerLabels),
    tf.tensor2d(valData.homePointsLabels, [valData.homePointsLabels.length, 1]),
    tf.tensor2d(valData.awayPointsLabels, [valData.awayPointsLabels.length, 1])
  ];

  const model = buildBasketballModel(archConfig);

  model.compile({
    optimizer: tf.train.adam(trainingConfig.learningRate),
    loss: {
      winner_output: 'categoricalCrossentropy',
      home_points_output: 'meanSquaredError',
      away_points_output: 'meanSquaredError',
    },
    metrics: {
      winner_output: 'accuracy',
      home_points_output: 'mae',
      away_points_output: 'mae',
    },
  });

  console.log(`\n🎯 Training with NO random shuffle - chronological split ensures no data leakage\n`);

  const history = await model.fit(
    trainXs,
    trainYs,
    {
      epochs: trainingConfig.epochs,
      batchSize: trainingConfig.batchSize,
      validationData: [valXs, valYs],
      shuffle: false, // ⚠️ NO SHUFFLE
      verbose: 1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const trainAcc = (logs?.winner_output_acc || 0) * 100;
          const valAcc = (logs?.val_winner_output_acc || 0) * 100;
          const gap = trainAcc - valAcc;
          console.log(
            `Epoch ${epoch + 1}/${trainingConfig.epochs}: ` +
            `train_acc=${trainAcc.toFixed(1)}%, val_acc=${valAcc.toFixed(1)}%, ` +
            `gap=${gap.toFixed(1)}% ${gap > 20 ? '⚠️ MEMORIZING!' : gap > 10 ? '⚠️' : '✅'}`
          );
        },
      },
    }
  );

  // Clean up tensors
  trainXs.forEach(t => t.dispose());
  trainYs.forEach(t => t.dispose());
  valXs.forEach(t => t.dispose());
  valYs.forEach(t => t.dispose());

  const finalTrainAcc = (history.history.winner_output_acc as number[]).slice(-1)[0];
  const finalValAcc = (history.history.val_winner_output_acc as number[]).slice(-1)[0];
  const generalizationGap = (finalTrainAcc - finalValAcc) * 100;
  
  console.log(`\n📊 Final Results:`);
  console.log(`   Training Accuracy: ${(finalTrainAcc * 100).toFixed(1)}%`);
  console.log(`   Validation Accuracy: ${(finalValAcc * 100).toFixed(1)}%`);
  console.log(`   Generalization Gap: ${generalizationGap.toFixed(1)}% ${generalizationGap > 20 ? '⚠️ HIGH' : generalizationGap > 10 ? '⚠️ MODERATE' : '✅ GOOD'}`);

  const trainingResult: BasketballTrainingResult = {
    history: {
      loss: history.history.loss as number[],
      accuracy: history.history.winner_output_acc as number[],
      valLoss: history.history.val_loss as number[],
      valAccuracy: history.history.val_winner_output_acc as number[],
    },
    finalMetrics: {
      trainingAccuracy: finalTrainAcc,
      validationAccuracy: finalValAcc,
      loss: (history.history.loss as number[]).slice(-1)[0],
    },
  };

  return { model, result: trainingResult, normalizationStats };
}

export async function predictBasketball(
  model: tf.LayersModel,
  stats: BasketballStats,
  normalizationStats: BasketballNormalizationStats
): Promise<BasketballPredictionResult> {
  const categorical = prepareBasketballCategoricalInputs(stats);
  const numerical = prepareBasketballNumericalFeatures(stats);
  const normalizedNumerical = normalizeFeatures(numerical, normalizationStats);

  const homeTeamIdTensor = tf.tensor2d([categorical.homeTeamId], [1, 1], 'int32');
  const awayTeamIdTensor = tf.tensor2d([categorical.awayTeamId], [1, 1], 'int32');
  const leagueIdTensor = tf.tensor2d([categorical.leagueId], [1, 1], 'int32');
  const countryIdTensor = tf.tensor2d([categorical.countryId], [1, 1], 'int32');
  const numericalTensor = tf.tensor2d([normalizedNumerical], [1, 16]);

  const predictions = model.predict([
    homeTeamIdTensor,
    awayTeamIdTensor,
    leagueIdTensor,
    countryIdTensor,
    numericalTensor,
  ]) as tf.Tensor[];

  const [winnerPred, homePointsPred, awayPointsPred] = predictions;

  const winnerProbs = await winnerPred.data();
  const normalizedHomePoints = (await homePointsPred.data())[0];
  const normalizedAwayPoints = (await awayPointsPred.data())[0];

  homeTeamIdTensor.dispose();
  awayTeamIdTensor.dispose();
  leagueIdTensor.dispose();
  countryIdTensor.dispose();
  numericalTensor.dispose();
  winnerPred.dispose();
  homePointsPred.dispose();
  awayPointsPred.dispose();

  const homeWinProb = winnerProbs[0];
  const awayWinProb = winnerProbs[1];

  const predicted = homeWinProb > awayWinProb ? 'H' : 'A';
  const confidence = Math.max(homeWinProb, awayWinProb);

  const homePoints = denormalizeTarget(
    normalizedHomePoints,
    normalizationStats.targets.homePoints.min,
    normalizationStats.targets.homePoints.max
  );
  const awayPoints = denormalizeTarget(
    normalizedAwayPoints,
    normalizationStats.targets.awayPoints.min,
    normalizationStats.targets.awayPoints.max
  );

  return {
    winner: {
      home: homeWinProb,
      away: awayWinProb,
      predicted,
    },
    points: {
      homePoints: Math.max(0, Math.round(homePoints)),
      awayPoints: Math.max(0, Math.round(awayPoints)),
    },
    confidence,
  };
}

export async function saveBasketballModel(
  model: tf.LayersModel,
  path: string,
  normalizationStats: BasketballNormalizationStats
): Promise<void> {
  const fs = await import('fs/promises');
  try {
    await fs.mkdir(path, { recursive: true });
    console.log(`Created directory: ${path}`);
    
    await model.save(`file://${path}`);
    console.log(`Saved model to: ${path}/model.json`);
    
    const normalizationJson = JSON.stringify(normalizationStats, null, 2);
    await fs.writeFile(
      `${path}/normalization.json`,
      normalizationJson
    );
    console.log(`Saved normalization stats to: ${path}/normalization.json`);
  } catch (error) {
    console.error(`Error saving basketball model to ${path}:`, error);
    throw error;
  }
}

export async function loadBasketballModel(path: string): Promise<{
  model: tf.LayersModel;
  normalizationStats: BasketballNormalizationStats;
}> {
  const model = await tf.loadLayersModel(`file://${path}/model.json`);
  const fs = await import('fs/promises');
  const normalizationJson = await fs.readFile(`${path}/normalization.json`, 'utf-8');
  const normalizationStats: BasketballNormalizationStats = JSON.parse(normalizationJson);
  return { model, normalizationStats };
}
