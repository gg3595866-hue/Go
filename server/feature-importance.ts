import * as tf from '@tensorflow/tfjs-node';
import type { MatchStats } from '@shared/schema';
import { prepareNumericalFeatures, prepareCategoricalInputs } from './ml-model';

export interface FeatureImportanceResult {
  featureName: string;
  importance: number;
  rank: number;
  category: 'categorical' | 'numerical';
}

export interface FeatureImportanceReport {
  overall: FeatureImportanceResult[];
  categoricalFeatures: {
    teamIds: number;
    leagueIds: number;
    countryIds: number;
  };
  numericalFeatures: {
    totalImportance: number;
    topFeatures: FeatureImportanceResult[];
  };
  analysis: {
    categoricalDominance: number; // Percentage of importance from categorical features
    warning: string | null;
  };
}

const NUMERICAL_FEATURE_NAMES = [
  'homeTeamFormHomeL5',
  'awayTeamFormAwayL5',
  'homeTeamFormOverallL5',
  'awayTeamFormOverallL5',
  'homeTeamFormDiffOverall',
  'homeTeamWinRateL8',
  'awayTeamWinRateL8',
  'homeTeamDrawRateL8',
  'awayTeamDrawRateL8',
  'homeTeamLossRateL8',
  'awayTeamLossRateL8',
  'homeTeamToNilRateL8',
  'awayTeamToNilRateL8',
  'homeTeamWinningMargin1GoalRateL8',
  'awayTeamWinningMargin1GoalRateL8',
  'homeTeamWinningMargin2GoalRateL8',
  'awayTeamWinningMargin2GoalRateL8',
  'homeTeamFirstHalfGoalRate',
  'awayTeamFirstHalfGoalRate',
  'homeTeamSecondHalfGoalRate',
  'awayTeamSecondHalfGoalRate',
  'homeTeamBttsRateL4',
  'awayTeamBttsRateL4',
  'homeTeamScoredRateL4',
  'awayTeamScoredRateL4',
  'homeTeamScoredAgainstRateL4',
  'awayTeamScoredAgainstRateL4',
  'homeTeamHtWonRateL8',
  'awayTeamHtWonRateL8',
  'homeTeamHtTiedRateL8',
  'awayTeamHtTiedRateL8',
  'homeTeamHtLostRateL8',
  'awayTeamHtLostRateL8',
  'leagueHomeWins',
  'leagueDraws',
  'leagueAwayWins',
  'leagueUnder25',
  'leagueOver25',
  'leagueAvgGoals',
];

/**
 * Compute permutation importance for features
 * This measures how much the model's performance drops when a feature is randomly shuffled
 */
export async function computePermutationImportance(
  model: tf.LayersModel,
  validationData: MatchStats[],
  numIterations: number = 3
): Promise<FeatureImportanceReport> {
  console.log('\n🔍 Computing feature importance...');
  
  // Get baseline performance (original data)
  const baselineAccuracy = await evaluateModel(model, validationData);
  console.log(`📊 Baseline accuracy: ${(baselineAccuracy * 100).toFixed(2)}%`);
  
  const importanceScores: Map<string, number[]> = new Map();
  
  // 1. Test importance of categorical features (Team IDs)
  console.log('\n🔄 Testing Team ID importance...');
  const teamIdImportance = await testCategoricalFeature(
    model,
    validationData,
    'teamIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('teamIds', teamIdImportance);
  
  // 2. Test importance of League IDs
  console.log('🔄 Testing League ID importance...');
  const leagueIdImportance = await testCategoricalFeature(
    model,
    validationData,
    'leagueIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('leagueIds', leagueIdImportance);
  
  // 3. Test importance of Country IDs
  console.log('🔄 Testing Country ID importance...');
  const countryIdImportance = await testCategoricalFeature(
    model,
    validationData,
    'countryIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('countryIds', countryIdImportance);
  
  // 4. Test importance of each numerical feature
  console.log('🔄 Testing numerical features importance...');
  for (let i = 0; i < NUMERICAL_FEATURE_NAMES.length; i++) {
    const featureName = NUMERICAL_FEATURE_NAMES[i];
    const importance = await testNumericalFeature(
      model,
      validationData,
      i,
      baselineAccuracy,
      numIterations
    );
    importanceScores.set(featureName, importance);
  }
  
  // Calculate average importance for each feature
  const avgImportance: FeatureImportanceResult[] = [];
  
  for (const [featureName, scores] of Array.from(importanceScores.entries())) {
    const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    avgImportance.push({
      featureName,
      importance: avgScore,
      rank: 0, // Will be set after sorting
      category: ['teamIds', 'leagueIds', 'countryIds'].includes(featureName) 
        ? 'categorical' 
        : 'numerical'
    });
  }
  
  // Sort by importance and assign ranks
  avgImportance.sort((a, b) => b.importance - a.importance);
  avgImportance.forEach((item, index) => {
    item.rank = index + 1;
  });
  
  // Calculate categorical vs numerical importance
  const categoricalImportance = avgImportance
    .filter(f => f.category === 'categorical')
    .reduce((sum, f) => sum + f.importance, 0);
  
  const numericalImportance = avgImportance
    .filter(f => f.category === 'numerical')
    .reduce((sum, f) => sum + f.importance, 0);
  
  const totalImportance = categoricalImportance + numericalImportance;
  const categoricalDominance = (categoricalImportance / totalImportance) * 100;
  
  // Generate warning if categorical features dominate
  let warning: string | null = null;
  if (categoricalDominance > 60) {
    warning = 'HIGH RISK: Model relies heavily on team/league/country IDs (memorization risk). Consider reducing embedding sizes or using only numerical features.';
  } else if (categoricalDominance > 40) {
    warning = 'MODERATE RISK: Categorical features have significant influence. Monitor for overfitting on specific teams.';
  }
  
  const teamIdsFeature = avgImportance.find(f => f.featureName === 'teamIds');
  const leagueIdsFeature = avgImportance.find(f => f.featureName === 'leagueIds');
  const countryIdsFeature = avgImportance.find(f => f.featureName === 'countryIds');
  
  return {
    overall: avgImportance,
    categoricalFeatures: {
      teamIds: teamIdsFeature?.importance || 0,
      leagueIds: leagueIdsFeature?.importance || 0,
      countryIds: countryIdsFeature?.importance || 0,
    },
    numericalFeatures: {
      totalImportance: numericalImportance,
      topFeatures: avgImportance
        .filter(f => f.category === 'numerical')
        .slice(0, 10)
    },
    analysis: {
      categoricalDominance,
      warning
    }
  };
}

/**
 * Evaluate model accuracy on validation data
 */
async function evaluateModel(
  model: tf.LayersModel,
  data: MatchStats[]
): Promise<number> {
  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const numericalFeatures: number[][] = [];
  const labels: number[][] = [];
  
  for (const stats of data) {
    const cats = prepareCategoricalInputs(stats);
    const nums = prepareNumericalFeatures(stats);
    
    homeTeamIds.push(cats.homeTeamId);
    awayTeamIds.push(cats.awayTeamId);
    leagueIds.push(cats.leagueId);
    countryIds.push(cats.countryId);
    numericalFeatures.push(nums);
    
    // Get label (just using FT result for simplicity)
    if (stats.ftResult === '1') {
      labels.push([1, 0, 0]);
    } else if (stats.ftResult === 'X') {
      labels.push([0, 1, 0]);
    } else {
      labels.push([0, 0, 1]);
    }
  }
  
  const homeTeamIdTensor = tf.tensor2d(homeTeamIds.map(id => [id]), [homeTeamIds.length, 1], 'int32');
  const awayTeamIdTensor = tf.tensor2d(awayTeamIds.map(id => [id]), [awayTeamIds.length, 1], 'int32');
  const leagueIdTensor = tf.tensor2d(leagueIds.map(id => [id]), [leagueIds.length, 1], 'int32');
  const countryIdTensor = tf.tensor2d(countryIds.map(id => [id]), [countryIds.length, 1], 'int32');
  const numericalTensor = tf.tensor2d(numericalFeatures);
  
  const labelsTensor = tf.tensor2d(labels);
  
  // Pass inputs as array in the same order as model inputs
  const predictions = model.predict([
    homeTeamIdTensor,
    awayTeamIdTensor,
    leagueIdTensor,
    countryIdTensor,
    numericalTensor
  ]) as tf.Tensor | tf.Tensor[];
  const ftResultPred = Array.isArray(predictions) ? predictions[0] : predictions;
  
  const predClasses = (ftResultPred as tf.Tensor).argMax(-1);
  const trueClasses = labelsTensor.argMax(-1);
  
  const correct = predClasses.equal(trueClasses).sum();
  const total = data.length;
  const accuracy = await correct.data().then(d => d[0] / total);
  
  // Cleanup
  homeTeamIdTensor.dispose();
  awayTeamIdTensor.dispose();
  leagueIdTensor.dispose();
  countryIdTensor.dispose();
  numericalTensor.dispose();
  labelsTensor.dispose();
  ftResultPred.dispose();
  predClasses.dispose();
  trueClasses.dispose();
  correct.dispose();
  if (Array.isArray(predictions)) {
    predictions.forEach(p => p !== ftResultPred && p.dispose());
  }
  
  return accuracy;
}

/**
 * Test importance of categorical feature by shuffling it
 */
async function testCategoricalFeature(
  model: tf.LayersModel,
  data: MatchStats[],
  featureType: 'teamIds' | 'leagueIds' | 'countryIds',
  baselineAccuracy: number,
  numIterations: number
): Promise<number[]> {
  const importanceScores: number[] = [];
  
  for (let iter = 0; iter < numIterations; iter++) {
    // Create shuffled data
    const shuffledData = data.map(stats => {
      const shuffled = { ...stats };
      
      if (featureType === 'teamIds') {
        // Shuffle both home and away team IDs
        const randomIdx = Math.floor(Math.random() * data.length);
        shuffled.homeTeamId = data[randomIdx].homeTeamId;
        shuffled.awayTeamId = data[randomIdx].awayTeamId;
      } else if (featureType === 'leagueIds') {
        const randomIdx = Math.floor(Math.random() * data.length);
        shuffled.leagueId = data[randomIdx].leagueId;
      } else if (featureType === 'countryIds') {
        const randomIdx = Math.floor(Math.random() * data.length);
        shuffled.countryId = data[randomIdx].countryId;
      }
      
      return shuffled;
    });
    
    const shuffledAccuracy = await evaluateModel(model, shuffledData);
    const importanceScore = baselineAccuracy - shuffledAccuracy;
    importanceScores.push(importanceScore);
  }
  
  return importanceScores;
}

/**
 * Test importance of a numerical feature by shuffling it
 */
async function testNumericalFeature(
  model: tf.LayersModel,
  data: MatchStats[],
  featureIndex: number,
  baselineAccuracy: number,
  numIterations: number
): Promise<number[]> {
  const importanceScores: number[] = [];
  
  for (let iter = 0; iter < numIterations; iter++) {
    // Create data with shuffled feature
    const shuffledData = data.map((stats, idx) => {
      const shuffled = { ...stats };
      const randomIdx = Math.floor(Math.random() * data.length);
      const originalFeatures = prepareNumericalFeatures(stats);
      const randomFeatures = prepareNumericalFeatures(data[randomIdx]);
      
      // Replace one feature with random value
      originalFeatures[featureIndex] = randomFeatures[featureIndex];
      
      // Map back to stats object (this is a bit hacky but works)
      // We'll need to reconstruct the stats object with the shuffled feature
      return reconstructStatsWithFeatures(stats, originalFeatures, featureIndex);
    });
    
    const shuffledAccuracy = await evaluateModel(model, shuffledData);
    const importanceScore = baselineAccuracy - shuffledAccuracy;
    importanceScores.push(importanceScore);
  }
  
  return importanceScores;
}

/**
 * Reconstruct stats object with shuffled numerical feature
 */
function reconstructStatsWithFeatures(
  original: MatchStats,
  features: number[],
  changedIndex: number
): MatchStats {
  const shuffled = { ...original };
  
  // Map features back to stats properties
  const featureMap = [
    'homeTeamFormHomeL5', 'awayTeamFormAwayL5', 'homeTeamFormOverallL5', 
    'awayTeamFormOverallL5', 'homeTeamFormDiffOverall', 'homeTeamWinRateL8',
    'awayTeamWinRateL8', 'homeTeamDrawRateL8', 'awayTeamDrawRateL8',
    'homeTeamLossRateL8', 'awayTeamLossRateL8', 'homeTeamToNilRateL8',
    'awayTeamToNilRateL8', 'homeTeamWinningMargin1GoalRateL8',
    'awayTeamWinningMargin1GoalRateL8', 'homeTeamWinningMargin2GoalRateL8',
    'awayTeamWinningMargin2GoalRateL8', 'homeTeamFirstHalfGoalRate',
    'awayTeamFirstHalfGoalRate', 'homeTeamSecondHalfGoalRate',
    'awayTeamSecondHalfGoalRate', 'homeTeamBttsRateL4', 'awayTeamBttsRateL4',
    'homeTeamScoredRateL4', 'awayTeamScoredRateL4', 'homeTeamScoredAgainstRateL4',
    'awayTeamScoredAgainstRateL4', 'homeTeamHtWonRateL8', 'awayTeamHtWonRateL8',
    'homeTeamHtTiedRateL8', 'awayTeamHtTiedRateL8', 'homeTeamHtLostRateL8',
    'awayTeamHtLostRateL8', 'leagueHomeWins', 'leagueDraws', 'leagueAwayWins',
    'leagueUnder25', 'leagueOver25', 'leagueAvgGoals'
  ];
  
  const propertyName = featureMap[changedIndex] as keyof MatchStats;
  (shuffled as any)[propertyName] = features[changedIndex];
  
  return shuffled;
}

/**
 * Print feature importance report
 */
export function printFeatureImportanceReport(report: FeatureImportanceReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 FEATURE IMPORTANCE ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  console.log('\n🔍 CATEGORICAL FEATURES (Team/League/Country IDs):');
  console.log(`  Team IDs:    ${(report.categoricalFeatures.teamIds * 100).toFixed(2)}% importance`);
  console.log(`  League IDs:  ${(report.categoricalFeatures.leagueIds * 100).toFixed(2)}% importance`);
  console.log(`  Country IDs: ${(report.categoricalFeatures.countryIds * 100).toFixed(2)}% importance`);
  console.log(`  TOTAL:       ${(report.analysis.categoricalDominance).toFixed(2)}% of all importance`);
  
  console.log('\n📈 TOP 10 NUMERICAL FEATURES:');
  report.numericalFeatures.topFeatures.forEach((feature, idx) => {
    console.log(`  ${idx + 1}. ${feature.featureName.padEnd(35)} ${(feature.importance * 100).toFixed(2)}%`);
  });
  
  console.log('\n⚠️  ANALYSIS:');
  if (report.analysis.warning) {
    console.log(`  ${report.analysis.warning}`);
  } else {
    console.log('  ✅ Model shows balanced reliance on features. Low memorization risk.');
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (report.analysis.categoricalDominance > 60) {
    console.log('  1. Reduce team embedding size from 8 to 4');
    console.log('  2. Consider removing country IDs entirely');
    console.log('  3. Add more numerical features from team statistics');
    console.log('  4. Increase dropout rate to prevent overfitting');
  } else if (report.analysis.categoricalDominance > 40) {
    console.log('  1. Monitor validation performance on unseen teams');
    console.log('  2. Consider reducing embedding sizes');
    console.log('  3. Ensure sufficient training data diversity');
  } else {
    console.log('  ✅ Current architecture looks good');
    console.log('  ✅ Model is learning from generalizable patterns');
  }
  
  console.log('='.repeat(80) + '\n');
}
