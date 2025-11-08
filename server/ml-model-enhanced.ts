import * as tf from '@tensorflow/tfjs-node';
import type { ModelArchitecture } from './ml-model-ratings';

/**
 * Build enhanced multi-task neural network with improved regularization:
 * 1. Batch normalization after each hidden layer
 * 2. Dropout (30% rate) for preventing overfitting
 * 3. L2 kernel regularization
 * 4. He initialization for better weight initialization
 */
export function buildEnhancedRatingModel(config: ModelArchitecture): tf.LayersModel {
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
  
  const model = tf.model({
    inputs: [homeTeamInput, awayTeamInput, leagueInput, countryInput, ratingFeaturesInput, numericalFeaturesInput],
    outputs: [result1x2, overUnder, btts, homeScore, awayScore],
  });
  
  return model;
}

/**
 * Documentation of regularization improvements:
 * 
 * 1. BATCH NORMALIZATION
 *    - Added after each hidden layer
 *    - Normalizes layer inputs to have zero mean and unit variance
 *    - Benefits:
 *      * Reduces internal covariate shift
 *      * Allows higher learning rates
 *      * Acts as a regularizer (reduces need for dropout)
 *      * Improves training stability
 * 
 * 2. DROPOUT (30% rate)
 *    - Applied after batch normalization
 *    - Randomly drops 30% of neurons during training
 *    - Only active during training, turned off during validation/testing
 *    - Prevents co-adaptation of neurons
 * 
 * 3. L2 REGULARIZATION
 *    - Kernel regularization: 0.001 (main layers)
 *    - Embedding regularization: 0.0001 (lighter for embeddings)
 *    - Adds penalty for large weights
 *    - Prevents overfitting
 * 
 * 4. HE INITIALIZATION
 *    - Uses He Normal initialization for ReLU activation
 *    - Better gradient flow in deep networks
 *    - Prevents vanishing/exploding gradients
 * 
 * WHY VALIDATION ACCURACY > TRAINING ACCURACY?
 * 
 * This is EXPECTED and GOOD because:
 * - Dropout is ACTIVE during training (making it harder)
 * - Dropout is INACTIVE during validation (making it easier)
 * - Batch normalization uses mini-batch statistics during training
 * - Batch normalization uses population statistics during validation
 * 
 * This difference indicates the model is NOT overfitting - it's properly
 * regularized and generalizes well to unseen data.
 */
