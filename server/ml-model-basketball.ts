import * as tf from '@tensorflow/tfjs-node';
import type { BasketballStats } from '@shared/schema';

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

export async function trainBasketballModel(
  matchStatsArray: BasketballStats[],
  trainingConfig: BasketballTrainingConfig,
  archConfig: BasketballModelArchitectureConfig
): Promise<{ model: tf.LayersModel; result: BasketballTrainingResult }> {
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

  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const numericalFeatures: number[][] = [];
  const winnerLabels: number[][] = [];
  const homePointsLabels: number[] = [];
  const awayPointsLabels: number[] = [];

  for (const stats of validMatches) {
    const categorical = prepareBasketballCategoricalInputs(stats);
    const numerical = prepareBasketballNumericalFeatures(stats);
    const labels = prepareBasketballLabels(stats);

    homeTeamIds.push(categorical.homeTeamId);
    awayTeamIds.push(categorical.awayTeamId);
    leagueIds.push(categorical.leagueId);
    countryIds.push(categorical.countryId);
    numericalFeatures.push(numerical);
    winnerLabels.push(labels.ftResult);
    homePointsLabels.push(labels.ftHomePoints);
    awayPointsLabels.push(labels.ftAwayPoints);
  }

  const homeTeamIdsTensor = tf.tensor2d(homeTeamIds, [homeTeamIds.length, 1], 'int32');
  const awayTeamIdsTensor = tf.tensor2d(awayTeamIds, [awayTeamIds.length, 1], 'int32');
  const leagueIdsTensor = tf.tensor2d(leagueIds, [leagueIds.length, 1], 'int32');
  const countryIdsTensor = tf.tensor2d(countryIds, [countryIds.length, 1], 'int32');
  const numericalTensor = tf.tensor2d(numericalFeatures);
  const winnerLabelsTensor = tf.tensor2d(winnerLabels);
  const homePointsLabelsTensor = tf.tensor2d(homePointsLabels, [homePointsLabels.length, 1]);
  const awayPointsLabelsTensor = tf.tensor2d(awayPointsLabels, [awayPointsLabels.length, 1]);

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

  const history = await model.fit(
    [homeTeamIdsTensor, awayTeamIdsTensor, leagueIdsTensor, countryIdsTensor, numericalTensor],
    [winnerLabelsTensor, homePointsLabelsTensor, awayPointsLabelsTensor],
    {
      epochs: trainingConfig.epochs,
      batchSize: trainingConfig.batchSize,
      validationSplit: trainingConfig.validationSplit,
      verbose: 1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss?.toFixed(4)}, winner_output_accuracy = ${logs?.winner_output_accuracy?.toFixed(4)}`);
        },
      },
    }
  );

  homeTeamIdsTensor.dispose();
  awayTeamIdsTensor.dispose();
  leagueIdsTensor.dispose();
  countryIdsTensor.dispose();
  numericalTensor.dispose();
  winnerLabelsTensor.dispose();
  homePointsLabelsTensor.dispose();
  awayPointsLabelsTensor.dispose();

  const trainingResult: BasketballTrainingResult = {
    history: {
      loss: history.history.loss as number[],
      accuracy: history.history.winner_output_acc as number[],
      valLoss: history.history.val_loss as number[],
      valAccuracy: history.history.val_winner_output_acc as number[],
    },
    finalMetrics: {
      trainingAccuracy: (history.history.winner_output_acc as number[]).slice(-1)[0],
      validationAccuracy: (history.history.val_winner_output_acc as number[]).slice(-1)[0],
      loss: (history.history.loss as number[]).slice(-1)[0],
    },
  };

  return { model, result: trainingResult };
}

export async function predictBasketball(
  model: tf.LayersModel,
  stats: BasketballStats
): Promise<BasketballPredictionResult> {
  const categorical = prepareBasketballCategoricalInputs(stats);
  const numerical = prepareBasketballNumericalFeatures(stats);

  const homeTeamIdTensor = tf.tensor2d([categorical.homeTeamId], [1, 1], 'int32');
  const awayTeamIdTensor = tf.tensor2d([categorical.awayTeamId], [1, 1], 'int32');
  const leagueIdTensor = tf.tensor2d([categorical.leagueId], [1, 1], 'int32');
  const countryIdTensor = tf.tensor2d([categorical.countryId], [1, 1], 'int32');
  const numericalTensor = tf.tensor2d([numerical], [1, 16]);

  const predictions = model.predict([
    homeTeamIdTensor,
    awayTeamIdTensor,
    leagueIdTensor,
    countryIdTensor,
    numericalTensor,
  ]) as tf.Tensor[];

  const [winnerPred, homePointsPred, awayPointsPred] = predictions;

  const winnerProbs = await winnerPred.data();
  const homePoints = (await homePointsPred.data())[0];
  const awayPoints = (await awayPointsPred.data())[0];

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

  return {
    winner: {
      home: homeWinProb,
      away: awayWinProb,
      predicted,
    },
    points: {
      homePoints: Math.max(0, homePoints),
      awayPoints: Math.max(0, awayPoints),
    },
    confidence,
  };
}

export async function saveBasketballModel(model: tf.LayersModel, path: string): Promise<void> {
  const fs = await import('fs/promises');
  await fs.mkdir(path, { recursive: true });
  await model.save(`file://${path}`);
}

export async function loadBasketballModel(path: string): Promise<tf.LayersModel> {
  return await tf.loadLayersModel(`file://${path}/model.json`);
}
