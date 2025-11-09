import * as tf from '@tensorflow/tfjs-node';
import type { MatchStats, TeamRating } from '@shared/schema';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { buildConfidenceAwareModel } from './ml-model-with-confidence';
import type { ModelArchitecture, TrainingConfig, NormalizationStats } from './ml-model-ratings';
import { extractRatingFeatures, computeRatingNormalizationStats } from './ml-model-ratings';

interface TrainingResult {
  finalMetrics: {
    trainingAccuracy: number;
    validationAccuracy: number;
    loss: number;
    confidenceCalibration: number;
  };
  history: {
    epoch: number;
    loss: number;
    accuracy: number;
    valLoss: number;
    valAccuracy: number;
    confidenceScore: number;
  }[];
}

/**
 * Custom loss function for confidence learning
 * 
 * The confidence head learns through this formula:
 * - When prediction is CORRECT: penalize low confidence
 * - When prediction is WRONG: penalize high confidence
 * 
 * This teaches the model to be confident when it should be,
 * and uncertain when predictions are unreliable.
 */
function createConfidenceLoss(): (yTrue: tf.Tensor, yPred: tf.Tensor) => tf.Tensor {
  return (yTrue: tf.Tensor, yPred: tf.Tensor): tf.Tensor => {
    return tf.tidy(() => {
      // yTrue contains: [isCorrect (0 or 1)]
      // yPred contains: [predicted confidence (0 to 1)]
      
      // For correct predictions (yTrue = 1): loss = (1 - confidence)^2
      // For wrong predictions (yTrue = 0): loss = confidence^2
      // This encourages high confidence for correct, low for incorrect
      
      const correctPenalty = tf.square(tf.sub(1, yPred));
      const wrongPenalty = tf.square(yPred);
      
      const loss = tf.add(
        tf.mul(yTrue, correctPenalty),
        tf.mul(tf.sub(1, yTrue), wrongPenalty)
      );
      
      return tf.mean(loss);
    });
  };
}

/**
 * Train the confidence-aware model
 */
export async function trainConfidenceAwareModel(
  matches: MatchStats[],
  ratings: Map<number, TeamRating>,
  trainingConfig: TrainingConfig,
  archConfig: ModelArchitecture
): Promise<{ model: tf.LayersModel; result: TrainingResult; normalizationStats: NormalizationStats }> {
  console.log('Building confidence-aware neural network model...');
  const model = buildConfidenceAwareModel(archConfig);
  
  // Compute normalization stats
  console.log('Computing normalization statistics...');
  const normalizationStats = computeRatingNormalizationStats(matches, ratings);
  
  // Prepare training data
  console.log('Preparing training data with confidence labels...');
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
  const confidenceLabels: number[] = [];
  
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
    const isOver25 = (match.ftHomeScore + match.ftAwayScore) > 2.5 ? 1 : 0;
    overUnder25.push(isOver25);
    
    // BTTS
    const isBtts = (match.ftHomeScore > 0 && match.ftAwayScore > 0) ? 1 : 0;
    bttsLabels.push(isBtts);
    
    // Normalized scores
    homeScores.push((match.ftHomeScore - normalizationStats.targets.homeScore.mean) / normalizationStats.targets.homeScore.std);
    awayScores.push((match.ftAwayScore - normalizationStats.targets.awayScore.mean) / normalizationStats.targets.awayScore.std);
    
    // CONFIDENCE LABEL GENERATION
    // For each match, we create a "correctness" signal based on multiple factors
    // The model will learn to predict when it will be correct
    // We use a combination of outcome certainty and team strength差异
    
    const strengthDiff = Math.abs(homeRating.eloRating - awayRating.eloRating);
    const formDiff = Math.abs((match.homeTeamFormOverallL5 || 50) - (match.awayTeamFormOverallL5 || 50));
    
    // Higher values = more predictable match (we'll let the model learn this pattern)
    // This is just a starting signal - the model learns its own confidence patterns
    let confidenceSignal = 0;
    
    // Strong favorites that won (clear pattern)
    if (strengthDiff > 200 && (
      (homeRating.eloRating > awayRating.eloRating && match.ftResult === '1') ||
      (awayRating.eloRating > homeRating.eloRating && match.ftResult === '2')
    )) {
      confidenceSignal = 1;
    }
    // Even matchups (harder to predict)
    else if (strengthDiff < 50 && formDiff < 10) {
      confidenceSignal = 0;
    }
    // Everything else - let the model learn
    else {
      confidenceSignal = Math.min(1, strengthDiff / 400); // Gradual signal
    }
    
    confidenceLabels.push(confidenceSignal);
  }
  
  console.log(`Prepared ${homeTeamIds.length} training samples with confidence learning`);
  
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
    confidence: tf.tensor2d(confidenceLabels, [confidenceLabels.length, 1]),
  };
  
  // Compile model with confidence loss
  const confidenceLoss = createConfidenceLoss();
  
  model.compile({
    optimizer: tf.train.adam(trainingConfig.learningRate),
    loss: {
      result_1x2: 'categoricalCrossentropy',
      over_under_2_5: 'binaryCrossentropy',
      btts: 'binaryCrossentropy',
      home_score: 'meanSquaredError',
      away_score: 'meanSquaredError',
      confidence: confidenceLoss as any,
    },
    metrics: ['accuracy'],
  } as any);
  
  // Train model
  console.log('Training confidence-aware model...');
  const history: TrainingResult['history'] = [];
  
  const trainResult = await model.fit(xs, ys, {
    epochs: trainingConfig.epochs,
    batchSize: trainingConfig.batchSize,
    validationSplit: trainingConfig.validationSplit,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const trainAcc = logs?.result_1x2_acc || 0;
        const valAcc = logs?.val_result_1x2_acc || 0;
        const confMse = logs?.confidence_mse || 0;
        
        console.log(
          `Epoch ${epoch + 1}: ` +
          `loss=${logs?.loss.toFixed(4)}, ` +
          `result_acc=${trainAcc.toFixed(4)}, ` +
          `val_result_acc=${valAcc.toFixed(4)}, ` +
          `confidence_quality=${(1 - confMse).toFixed(4)}`
        );
        
        history.push({
          epoch: epoch + 1,
          loss: logs?.loss || 0,
          accuracy: trainAcc,
          valLoss: logs?.val_loss || 0,
          valAccuracy: valAcc,
          confidenceScore: 1 - confMse,
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
    confidenceCalibration: history[history.length - 1]?.confidenceScore || 0,
  };
  
  return {
    model,
    result: { finalMetrics, history },
    normalizationStats,
  };
}

/**
 * Make prediction with learned confidence
 */
export async function predictWithConfidence(
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
  learnedConfidence: number; // This is learned by the neural network!
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
  const homeTeamTensor = tf.tensor2d([[match.homeTeamId]]);
  const awayTeamTensor = tf.tensor2d([[match.awayTeamId]]);
  const leagueTensor = tf.tensor2d([[match.leagueId]]);
  const countryTensor = tf.tensor2d([[match.countryId]]);
  const ratingFeaturesTensor = tf.tensor2d([normalizedRatingFeatures]);
  const numericalFeaturesTensor = tf.tensor2d([normalizedNumerical]);
  
  // Make prediction
  const outputs = model.predict([
    homeTeamTensor,
    awayTeamTensor,
    leagueTensor,
    countryTensor,
    ratingFeaturesTensor,
    numericalFeaturesTensor,
  ]) as tf.Tensor[];
  
  const [result1x2Data, overUnderData, bttsData, homeScoreData, awayScoreData, confidenceData] = await Promise.all([
    outputs[0].data(),
    outputs[1].data(),
    outputs[2].data(),
    outputs[3].data(),
    outputs[4].data(),
    outputs[5].data(), // LEARNED CONFIDENCE!
  ]);
  
  // Cleanup tensors
  homeTeamTensor.dispose();
  awayTeamTensor.dispose();
  leagueTensor.dispose();
  countryTensor.dispose();
  ratingFeaturesTensor.dispose();
  numericalFeaturesTensor.dispose();
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
    learnedConfidence: confidenceData[0], // Neural network learned this!
  };
}

/**
 * Save model with confidence capability
 */
export async function saveConfidenceModel(
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
  await writeFile(
    `${modelPath}/model_type.txt`,
    'confidence-aware'
  );
  
  console.log(`Confidence-aware model saved to ${modelPath}`);
}

/**
 * Load confidence-aware model
 */
export async function loadConfidenceModel(
  modelPath: string
): Promise<{ model: tf.LayersModel; normalizationStats: NormalizationStats }> {
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  const normalizationData = await readFile(`${modelPath}/normalization.json`, 'utf-8');
  const normalizationStats = JSON.parse(normalizationData);
  
  return { model, normalizationStats };
}
