import * as tf from '@tensorflow/tfjs-node';
import type { ModelArchitecture } from './ml-model-ratings';

/**
 * Enhanced model with learned confidence prediction
 * 
 * The model learns to predict its own confidence through a dedicated output head.
 * No hand-crafted rules - the network learns when to be confident based on:
 * - Feature patterns that historically led to correct predictions
 * - Data uncertainty and ambiguity
 * - Strength of learned patterns
 */
export function buildConfidenceAwareModel(config: ModelArchitecture): tf.LayersModel {
  // Input layers
  const homeTeamInput = tf.input({ shape: [1], name: 'home_team_id', dtype: 'int32' });
  const awayTeamInput = tf.input({ shape: [1], name: 'away_team_id', dtype: 'int32' });
  const leagueInput = tf.input({ shape: [1], name: 'league_id', dtype: 'int32' });
  const countryInput = tf.input({ shape: [1], name: 'country_id', dtype: 'int32' });
  const ratingFeaturesInput = tf.input({ shape: [78], name: 'rating_features' });
  const numericalFeaturesInput = tf.input({ shape: [3], name: 'numerical_features' });
  
  // Embedding layers with L2 regularization
  const homeTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
    name: 'home_team_embedding',
  }).apply(homeTeamInput) as tf.SymbolicTensor;
  
  const awayTeamEmbedding = tf.layers.embedding({
    inputDim: config.numTeams + 1,
    outputDim: config.teamEmbeddingSize,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
    name: 'away_team_embedding',
  }).apply(awayTeamInput) as tf.SymbolicTensor;
  
  const leagueEmbedding = tf.layers.embedding({
    inputDim: config.numLeagues + 1,
    outputDim: config.leagueEmbeddingSize,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
    name: 'league_embedding',
  }).apply(leagueInput) as tf.SymbolicTensor;
  
  const countryEmbedding = tf.layers.embedding({
    inputDim: config.numCountries + 1,
    outputDim: config.countryEmbeddingSize,
    embeddingsRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
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
  
  // Shared hidden layers with batch normalization and dropout
  let hidden: tf.SymbolicTensor = concatenated;
  for (let i = 0; i < config.hiddenLayers.length; i++) {
    const units = config.hiddenLayers[i];
    
    // Dense layer with He initialization and L2 regularization
    hidden = tf.layers.dense({
      units,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      name: `hidden_${i}`,
    }).apply(hidden) as tf.SymbolicTensor;
    
    // Batch normalization for training stability
    hidden = tf.layers.batchNormalization({
      name: `batch_norm_${i}`,
    }).apply(hidden) as tf.SymbolicTensor;
    
    // Dropout for regularization
    hidden = tf.layers.dropout({ 
      rate: 0.3,
      name: `dropout_${i}`,
    }).apply(hidden) as tf.SymbolicTensor;
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
  
  // LEARNED CONFIDENCE HEAD
  // This head learns to predict how reliable each prediction is
  // It outputs a value between 0 and 1 indicating prediction trustworthiness
  // The network learns this through training - no manual rules
  const confidenceHidden = tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'confidence_hidden',
  }).apply(hidden) as tf.SymbolicTensor;
  
  const confidenceOutput = tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    name: 'confidence',
  }).apply(confidenceHidden) as tf.SymbolicTensor;
  
  const model = tf.model({
    inputs: [homeTeamInput, awayTeamInput, leagueInput, countryInput, ratingFeaturesInput, numericalFeaturesInput],
    outputs: [result1x2, overUnder, btts, homeScore, awayScore, confidenceOutput],
  });
  
  return model;
}

/**
 * CONFIDENCE LEARNING MECHANISM
 * 
 * The confidence head learns through a custom loss function that rewards:
 * 1. High confidence when predictions are correct
 * 2. Low confidence when predictions are incorrect
 * 
 * This creates a meta-learning loop where the model learns to assess
 * its own prediction quality based on feature patterns.
 * 
 * No hand-crafted rules - pure learned behavior.
 */
