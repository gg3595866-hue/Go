import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Generate ASCII art visualization of learning curves
 */
function generateASCIIPlot(
  data: number[],
  label: string,
  height = 15,
  width = 60
): string[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const lines: string[] = [];
  
  // Header
  lines.push(`${label} (${min.toFixed(3)} - ${max.toFixed(3)})`);
  lines.push('─'.repeat(width + 10));
  
  // Plot
  for (let row = 0; row < height; row++) {
    const threshold = max - (row / height) * range;
    let line = `${threshold.toFixed(2)} │ `;
    
    for (let col = 0; col < width; col++) {
      const dataIndex = Math.floor((col / width) * data.length);
      const value = data[dataIndex];
      
      if (Math.abs(value - threshold) < range / height) {
        line += '●';
      } else if (value > threshold) {
        line += ' ';
      } else {
        line += ' ';
      }
    }
    
    lines.push(line);
  }
  
  // X-axis
  lines.push(' '.repeat(9) + '└' + '─'.repeat(width));
  lines.push(' '.repeat(10) + `Epoch 1${' '.repeat(width - 15)}Epoch ${data.length}`);
  
  return lines;
}

/**
 * Load and visualize training metrics
 */
export async function visualizeTrainingMetrics(modelPath: string): Promise<void> {
  const metricsPath = `${modelPath}/training_metrics.json`;
  
  if (!existsSync(metricsPath)) {
    console.log(`❌ No metrics found at ${metricsPath}`);
    return;
  }
  
  const metricsData = await readFile(metricsPath, 'utf-8');
  const metrics = JSON.parse(metricsData);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 TRAINING METRICS VISUALIZATION');
  console.log('='.repeat(80));
  
  // Final metrics summary
  console.log('\n📈 FINAL METRICS SUMMARY\n');
  console.log(`  Training Accuracy (1X2):    ${(metrics.finalMetrics.finalTrainAccuracy * 100).toFixed(2)}%`);
  console.log(`  Validation Accuracy (1X2):  ${(metrics.finalMetrics.finalValAccuracy * 100).toFixed(2)}%`);
  console.log(`  Test Accuracy (1X2):        ${(metrics.finalMetrics.finalTestAccuracy * 100).toFixed(2)}%`);
  console.log(`  Final Loss:                 ${metrics.finalMetrics.finalLoss.toFixed(4)}`);
  
  // Test set detailed metrics
  console.log('\n🎯 TEST SET PERFORMANCE\n');
  console.log(`  1X2 Accuracy:      ${(metrics.testSetMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`  BTTS Accuracy:     ${(metrics.testSetMetrics.bttsAccuracy * 100).toFixed(2)}%`);
  console.log(`  Over 2.5 Accuracy: ${(metrics.testSetMetrics.over25Accuracy * 100).toFixed(2)}%`);
  console.log(`  Loss:              ${metrics.testSetMetrics.loss.toFixed(4)}`);
  
  // Cross-validation results (if available)
  if (metrics.crossValidation) {
    console.log('\n🔄 K-FOLD CROSS-VALIDATION RESULTS\n');
    console.log(`  Average Training Accuracy:   ${(metrics.crossValidation.avgTrainAccuracy * 100).toFixed(2)}%`);
    console.log(`  Average Validation Accuracy: ${(metrics.crossValidation.avgValAccuracy * 100).toFixed(2)}% ± ${(metrics.crossValidation.stdValAccuracy * 100).toFixed(2)}%`);
    
    console.log('\n  Per-Fold Results:');
    metrics.crossValidation.foldResults.forEach((fold: any) => {
      console.log(`    Fold ${fold.fold}: Train=${(fold.trainAccuracy * 100).toFixed(2)}%, Val=${(fold.valAccuracy * 100).toFixed(2)}%`);
    });
  }
  
  // Learning curves
  const trainLosses = metrics.learningCurves.map((c: any) => c.trainLoss);
  const valLosses = metrics.learningCurves.map((c: any) => c.valLoss);
  const trainAccs = metrics.learningCurves.map((c: any) => c.trainAccuracy * 100);
  const valAccs = metrics.learningCurves.map((c: any) => c.valAccuracy * 100);
  
  console.log('\n📉 TRAINING LOSS CURVE\n');
  const trainLossPlot = generateASCIIPlot(trainLosses, 'Training Loss');
  trainLossPlot.forEach(line => console.log(line));
  
  console.log('\n📉 VALIDATION LOSS CURVE\n');
  const valLossPlot = generateASCIIPlot(valLosses, 'Validation Loss');
  valLossPlot.forEach(line => console.log(line));
  
  console.log('\n📈 ACCURACY COMPARISON\n');
  console.log('  Epoch   Train Acc   Val Acc   Gap');
  console.log('  ' + '─'.repeat(45));
  
  // Show every 5th epoch for readability
  for (let i = 0; i < metrics.learningCurves.length; i += Math.max(1, Math.floor(metrics.learningCurves.length / 20))) {
    const curve = metrics.learningCurves[i];
    const gap = (curve.valAccuracy - curve.trainAccuracy) * 100;
    const gapStr = gap >= 0 ? `+${gap.toFixed(2)}%` : `${gap.toFixed(2)}%`;
    
    console.log(`  ${curve.epoch.toString().padStart(5)}   ${(curve.trainAccuracy * 100).toFixed(2)}%    ${(curve.valAccuracy * 100).toFixed(2)}%   ${gapStr}`);
  }
  
  // Analysis and recommendations
  console.log('\n💡 ANALYSIS & RECOMMENDATIONS\n');
  
  const finalTrainAcc = metrics.finalMetrics.finalTrainAccuracy;
  const finalValAcc = metrics.finalMetrics.finalValAccuracy;
  const finalTestAcc = metrics.finalMetrics.finalTestAccuracy;
  const gap = (finalValAcc - finalTrainAcc) * 100;
  
  if (gap > 5) {
    console.log('  ✅ EXCELLENT: Validation accuracy > Training accuracy by ' + gap.toFixed(2) + '%');
    console.log('     This indicates:');
    console.log('     - Model is NOT overfitting');
    console.log('     - Regularization (dropout, batch norm) is working properly');
    console.log('     - Model generalizes well to unseen data');
    console.log('     - This is EXPECTED behavior with dropout active during training');
  } else if (gap > -5) {
    console.log('  ✅ GOOD: Training and validation accuracy are balanced');
    console.log('     - Model is well-regularized');
    console.log('     - No significant overfitting or underfitting');
  } else {
    console.log('  ⚠️  WARNING: Training accuracy > Validation accuracy by ' + Math.abs(gap).toFixed(2) + '%');
    console.log('     Potential overfitting detected. Consider:');
    console.log('     - Increasing dropout rate');
    console.log('     - Adding more L2 regularization');
    console.log('     - Using more training data');
    console.log('     - Reducing model complexity');
  }
  
  // Test set validation
  const testValGap = Math.abs(finalTestAcc - finalValAcc) * 100;
  if (testValGap < 3) {
    console.log('\n  ✅ Test set accuracy aligns well with validation accuracy');
    console.log('     - Model performance is consistent across different data splits');
    console.log('     - Predictions on new data should be reliable');
  } else {
    console.log('\n  ⚠️  Test set accuracy differs from validation by ' + testValGap.toFixed(2) + '%');
    console.log('     - May indicate data distribution differences');
    console.log('     - Consider stratified sampling for better balance');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✨ Visualization complete!');
  console.log('='.repeat(80) + '\n');
}

// Run visualization if executed directly
if (require.main === module) {
  const modelPath = process.argv[2] || 'rating-models/model_latest';
  visualizeTrainingMetrics(modelPath).catch(console.error);
}
