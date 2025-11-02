import * as tf from '@tensorflow/tfjs-node';
import type { BasketballStats } from '@shared/schema';
import { prepareBasketballNumericalFeatures } from './ml-model-basketball';

export interface BasketballFeatureImportanceResult {
  featureName: string;
  importance: number;
  rank: number;
  category: 'categorical' | 'numerical';
}

export interface BasketballFeatureImportanceReport {
  overall: BasketballFeatureImportanceResult[];
  categoricalFeatures: {
    teamIds: number;
    leagueIds: number;
    countryIds: number;
  };
  numericalFeatures: {
    totalImportance: number;
    topFeatures: BasketballFeatureImportanceResult[];
  };
  analysis: {
    categoricalDominance: number;
    warning: string | null;
  };
}

const BASKETBALL_FEATURE_NAMES = [
  'homePointsScoredPerGame',
  'awayPointsScoredPerGame',
  'homePointsReceivedPerGame',
  'awayPointsReceivedPerGame',
  'homeWon',
  'awayWon',
  'homeTied',
  'awayTied',
  'homeLost',
  'awayLost',
  'homeAvgPointsQ1',
  'awayAvgPointsQ1',
  'homeAvgPointsQ2',
  'awayAvgPointsQ2',
  'homeAvgPointsQ3',
  'awayAvgPointsQ3',
];

export async function computeBasketballPermutationImportance(
  model: tf.LayersModel,
  validationData: BasketballStats[],
  numIterations: number = 3
): Promise<BasketballFeatureImportanceReport> {
  console.log('\n🏀 Computing basketball feature importance...');
  
  const baselineAccuracy = await evaluateBasketballModel(model, validationData);
  console.log(`📊 Baseline accuracy: ${(baselineAccuracy * 100).toFixed(2)}%`);
  
  const importanceScores: Map<string, number[]> = new Map();
  
  console.log('\n🔄 Testing Team ID importance...');
  const teamIdImportance = await testBasketballCategoricalFeature(
    model,
    validationData,
    'teamIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('teamIds', teamIdImportance);
  
  console.log('🔄 Testing League ID importance...');
  const leagueIdImportance = await testBasketballCategoricalFeature(
    model,
    validationData,
    'leagueIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('leagueIds', leagueIdImportance);
  
  console.log('🔄 Testing Country ID importance...');
  const countryIdImportance = await testBasketballCategoricalFeature(
    model,
    validationData,
    'countryIds',
    baselineAccuracy,
    numIterations
  );
  importanceScores.set('countryIds', countryIdImportance);
  
  console.log('🔄 Testing numerical features importance...');
  for (let i = 0; i < BASKETBALL_FEATURE_NAMES.length; i++) {
    const featureName = BASKETBALL_FEATURE_NAMES[i];
    const importance = await testBasketballNumericalFeature(
      model,
      validationData,
      i,
      baselineAccuracy,
      numIterations
    );
    importanceScores.set(featureName, importance);
  }
  
  const avgImportance: BasketballFeatureImportanceResult[] = [];
  
  for (const [featureName, scores] of Array.from(importanceScores.entries())) {
    const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    avgImportance.push({
      featureName,
      importance: avgScore,
      rank: 0,
      category: ['teamIds', 'leagueIds', 'countryIds'].includes(featureName) 
        ? 'categorical' 
        : 'numerical'
    });
  }
  
  avgImportance.sort((a, b) => b.importance - a.importance);
  avgImportance.forEach((item, index) => {
    item.rank = index + 1;
  });
  
  const categoricalImportance = avgImportance
    .filter(f => f.category === 'categorical')
    .reduce((sum, f) => sum + f.importance, 0);
  
  const numericalImportance = avgImportance
    .filter(f => f.category === 'numerical')
    .reduce((sum, f) => sum + f.importance, 0);
  
  const totalImportance = categoricalImportance + numericalImportance;
  const categoricalDominance = (categoricalImportance / totalImportance) * 100;
  
  let warning: string | null = null;
  if (categoricalDominance > 60) {
    warning = 'HIGH RISK: Basketball model relies heavily on team/league/country IDs (memorization risk).';
  } else if (categoricalDominance > 40) {
    warning = 'MODERATE RISK: Categorical features have significant influence on basketball predictions.';
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

async function evaluateBasketballModel(
  model: tf.LayersModel,
  data: BasketballStats[]
): Promise<number> {
  const homeTeamIds: number[] = [];
  const awayTeamIds: number[] = [];
  const leagueIds: number[] = [];
  const countryIds: number[] = [];
  const numericalFeatures: number[][] = [];
  const labels: number[][] = [];
  
  for (const stats of data) {
    homeTeamIds.push(stats.homeTeamId);
    awayTeamIds.push(stats.awayTeamId);
    leagueIds.push(stats.leagueId);
    countryIds.push(stats.countryId);
    numericalFeatures.push(prepareBasketballNumericalFeatures(stats));
    
    if (stats.ftResult === 'H') {
      labels.push([1, 0]);
    } else {
      labels.push([0, 1]);
    }
  }
  
  const homeTeamIdTensor = tf.tensor2d(homeTeamIds.map(id => [id]), [homeTeamIds.length, 1], 'int32');
  const awayTeamIdTensor = tf.tensor2d(awayTeamIds.map(id => [id]), [awayTeamIds.length, 1], 'int32');
  const leagueIdTensor = tf.tensor2d(leagueIds.map(id => [id]), [leagueIds.length, 1], 'int32');
  const countryIdTensor = tf.tensor2d(countryIds.map(id => [id]), [countryIds.length, 1], 'int32');
  const numericalTensor = tf.tensor2d(numericalFeatures);
  
  const labelsTensor = tf.tensor2d(labels);
  
  const predictions = model.predict([
    homeTeamIdTensor,
    awayTeamIdTensor,
    leagueIdTensor,
    countryIdTensor,
    numericalTensor
  ]) as tf.Tensor | tf.Tensor[];
  const winnerPred = Array.isArray(predictions) ? predictions[0] : predictions;
  
  const predClasses = (winnerPred as tf.Tensor).argMax(-1);
  const trueClasses = labelsTensor.argMax(-1);
  
  const correct = predClasses.equal(trueClasses).sum();
  const total = data.length;
  const accuracy = await correct.data().then(d => d[0] / total);
  
  homeTeamIdTensor.dispose();
  awayTeamIdTensor.dispose();
  leagueIdTensor.dispose();
  countryIdTensor.dispose();
  numericalTensor.dispose();
  labelsTensor.dispose();
  winnerPred.dispose();
  predClasses.dispose();
  trueClasses.dispose();
  correct.dispose();
  if (Array.isArray(predictions)) {
    predictions.forEach(p => p !== winnerPred && p.dispose());
  }
  
  return accuracy;
}

async function testBasketballCategoricalFeature(
  model: tf.LayersModel,
  data: BasketballStats[],
  featureType: 'teamIds' | 'leagueIds' | 'countryIds',
  baselineAccuracy: number,
  numIterations: number
): Promise<number[]> {
  const importanceScores: number[] = [];
  
  for (let iter = 0; iter < numIterations; iter++) {
    const shuffledData = data.map(stats => {
      const shuffled = { ...stats };
      
      if (featureType === 'teamIds') {
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
    
    const shuffledAccuracy = await evaluateBasketballModel(model, shuffledData);
    const importanceScore = baselineAccuracy - shuffledAccuracy;
    importanceScores.push(importanceScore);
  }
  
  return importanceScores;
}

async function testBasketballNumericalFeature(
  model: tf.LayersModel,
  data: BasketballStats[],
  featureIndex: number,
  baselineAccuracy: number,
  numIterations: number
): Promise<number[]> {
  const importanceScores: number[] = [];
  
  for (let iter = 0; iter < numIterations; iter++) {
    const shuffledData = data.map((stats) => {
      const shuffled = { ...stats };
      const randomIdx = Math.floor(Math.random() * data.length);
      
      const featureMap = [
        'homePointsScoredPerGame', 'awayPointsScoredPerGame',
        'homePointsReceivedPerGame', 'awayPointsReceivedPerGame',
        'homeWon', 'awayWon', 'homeTied', 'awayTied', 'homeLost', 'awayLost',
        'homeAvgPointsQ1', 'awayAvgPointsQ1', 'homeAvgPointsQ2', 'awayAvgPointsQ2',
        'homeAvgPointsQ3', 'awayAvgPointsQ3'
      ];
      
      const propertyName = featureMap[featureIndex] as keyof BasketballStats;
      (shuffled as any)[propertyName] = (data[randomIdx] as any)[propertyName];
      
      return shuffled;
    });
    
    const shuffledAccuracy = await evaluateBasketballModel(model, shuffledData);
    const importanceScore = baselineAccuracy - shuffledAccuracy;
    importanceScores.push(importanceScore);
  }
  
  return importanceScores;
}

export function printBasketballFeatureImportanceReport(report: BasketballFeatureImportanceReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('🏀 BASKETBALL FEATURE IMPORTANCE ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  console.log('\n🔍 CATEGORICAL FEATURES (Team/League/Country IDs):');
  console.log(`  Team IDs:    ${(report.categoricalFeatures.teamIds * 100).toFixed(2)}% importance`);
  console.log(`  League IDs:  ${(report.categoricalFeatures.leagueIds * 100).toFixed(2)}% importance`);
  console.log(`  Country IDs: ${(report.categoricalFeatures.countryIds * 100).toFixed(2)}% importance`);
  console.log(`  TOTAL:       ${(report.analysis.categoricalDominance).toFixed(2)}% of all importance`);
  
  console.log('\n📈 TOP NUMERICAL FEATURES:');
  report.numericalFeatures.topFeatures.forEach((feature, idx) => {
    console.log(`  ${idx + 1}. ${feature.featureName.padEnd(35)} ${(feature.importance * 100).toFixed(2)}%`);
  });
  
  console.log('\n⚠️  ANALYSIS:');
  if (report.analysis.warning) {
    console.log(`  ${report.analysis.warning}`);
  } else {
    console.log('  ✅ Basketball model shows balanced reliance on features.');
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (report.analysis.categoricalDominance > 60) {
    console.log('  1. Reduce team embedding size');
    console.log('  2. Add more statistical features (rebounds, assists, etc.)');
    console.log('  3. Consider removing less important categorical features');
  } else if (report.analysis.categoricalDominance > 40) {
    console.log('  1. Monitor performance on new teams');
    console.log('  2. Ensure training data diversity');
  } else {
    console.log('  ✅ Model architecture is well-balanced');
  }
  
  console.log('='.repeat(80) + '\n');
}
