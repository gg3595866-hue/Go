import type { MatchStats, TeamRating, InsertTeamRating } from '@shared/schema';

export interface RatingUpdateResult {
  homeTeamNewRating: number;
  awayTeamNewRating: number;
  ratingChange: number;
}

export interface MatchPrediction {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  predictedResult: '1' | 'X' | '2';
  predictedHomeScore: number;
  predictedAwayScore: number;
  predictedHtHomeScore: number;
  predictedHtAwayScore: number;
  bttsProb: number;
  predictedBtts: boolean;
  over25Prob: number;
  predictedOver25: boolean;
  confidence: number;
}

// K-factor for Elo rating changes (higher = more volatile)
const K_FACTOR = 32;
const HOME_ADVANTAGE = 100; // Home team gets +100 rating points
const LEAGUE_AVG_GOALS = 2.7; // Average total goals per match in football

/**
 * Calculate Poisson probability: P(X = k) = (λ^k * e^-λ) / k!
 * Used to calculate the probability of a team scoring exactly k goals
 */
function poissonProbability(lambda: number, k: number): number {
  if (k < 0) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  
  // Calculate k! (factorial)
  let factorial = 1;
  for (let i = 2; i <= k; i++) {
    factorial *= i;
  }
  
  // P(X = k) = (λ^k * e^-λ) / k!
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial;
}

/**
 * Calculate factorial (helper for Poisson)
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate expected score using Elo formula
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update Elo rating based on match result
 */
export function updateEloRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = K_FACTOR
): number {
  return currentRating + kFactor * (actualScore - expectedScore);
}

/**
 * Calculate match prediction probabilities based on team ratings
 * Uses Poisson distribution for goal-based market predictions
 */
export function calculateMatchProbabilities(
  homeRating: number,
  awayRating: number,
  homeAttack: number,
  awayAttack: number,
  homeDefense: number,
  awayDefense: number
): MatchPrediction {
  // Step 1: Calculate expected goals using attack/defense ratings
  // Convert ratings to strength indices (1500 is average)
  const homeAttackStrength = homeAttack / 1500;
  const homeDefenseStrength = homeDefense / 1500;
  const awayAttackStrength = awayAttack / 1500;
  const awayDefenseStrength = awayDefense / 1500;
  
  // Calculate expected goals using attack vs defense
  // Home team benefits from playing at home (1.15x multiplier)
  const homeExpectedGoals = Math.max(0.3, (homeAttackStrength / awayDefenseStrength) * (LEAGUE_AVG_GOALS / 2) * 1.15);
  const awayExpectedGoals = Math.max(0.3, (awayAttackStrength / homeDefenseStrength) * (LEAGUE_AVG_GOALS / 2) * 0.95);
  
  // Step 2: Use Poisson distribution to calculate probabilities for all reasonable scores
  // Calculate probabilities for scores from 0-5 goals for each team
  const maxGoals = 6;
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let bttsProb = 0;
  let over25Prob = 0;
  
  // Track most likely score
  let mostLikelyScore = { home: 0, away: 0, prob: 0 };
  
  for (let homeGoals = 0; homeGoals < maxGoals; homeGoals++) {
    const homeProb = poissonProbability(homeExpectedGoals, homeGoals);
    
    for (let awayGoals = 0; awayGoals < maxGoals; awayGoals++) {
      const awayProb = poissonProbability(awayExpectedGoals, awayGoals);
      const scoreProbability = homeProb * awayProb;
      
      // Track most likely scoreline
      if (scoreProbability > mostLikelyScore.prob) {
        mostLikelyScore = { home: homeGoals, away: awayGoals, prob: scoreProbability };
      }
      
      // Accumulate 1X2 probabilities
      if (homeGoals > awayGoals) {
        homeWinProb += scoreProbability;
      } else if (homeGoals < awayGoals) {
        awayWinProb += scoreProbability;
      } else {
        drawProb += scoreProbability;
      }
      
      // BTTS: Both teams score at least 1
      if (homeGoals >= 1 && awayGoals >= 1) {
        bttsProb += scoreProbability;
      }
      
      // Over 2.5: Total goals >= 3
      if (homeGoals + awayGoals >= 3) {
        over25Prob += scoreProbability;
      }
    }
  }
  
  // Normalize probabilities (they might not sum to exactly 1 due to truncation at maxGoals)
  const total1X2 = homeWinProb + drawProb + awayWinProb;
  const normalizedHomeWin = homeWinProb / total1X2;
  const normalizedDraw = drawProb / total1X2;
  const normalizedAwayWin = awayWinProb / total1X2;
  
  // Predict result based on highest probability
  let predictedResult: '1' | 'X' | '2';
  if (normalizedHomeWin > normalizedDraw && normalizedHomeWin > normalizedAwayWin) {
    predictedResult = '1';
  } else if (normalizedAwayWin > normalizedDraw) {
    predictedResult = '2';
  } else {
    predictedResult = 'X';
  }
  
  // Half-time predictions: Use 45% of full-time expected goals
  // First half typically sees slightly fewer goals (42-45% of total)
  const htHomeExpectedGoals = homeExpectedGoals * 0.45;
  const htAwayExpectedGoals = awayExpectedGoals * 0.45;
  
  // Find most likely HT score using Poisson
  let mostLikelyHtScore = { home: 0, away: 0, prob: 0 };
  const maxHtGoals = 4; // Lower max for half-time
  
  for (let homeGoals = 0; homeGoals < maxHtGoals; homeGoals++) {
    const homeProb = poissonProbability(htHomeExpectedGoals, homeGoals);
    for (let awayGoals = 0; awayGoals < maxHtGoals; awayGoals++) {
      const awayProb = poissonProbability(htAwayExpectedGoals, awayGoals);
      const scoreProbability = homeProb * awayProb;
      
      if (scoreProbability > mostLikelyHtScore.prob) {
        mostLikelyHtScore = { home: homeGoals, away: awayGoals, prob: scoreProbability };
      }
    }
  }
  
  // Confidence based on probability spread
  const maxProb = Math.max(normalizedHomeWin, normalizedDraw, normalizedAwayWin);
  const confidence = Math.min(0.95, maxProb);
  
  // Determine predictions based on probabilities
  const predictedBtts = bttsProb > 0.5;
  const predictedOver25 = over25Prob > 0.5;
  
  return {
    homeWinProb: normalizedHomeWin,
    drawProb: normalizedDraw,
    awayWinProb: normalizedAwayWin,
    predictedResult,
    predictedHomeScore: mostLikelyScore.home,
    predictedAwayScore: mostLikelyScore.away,
    predictedHtHomeScore: mostLikelyHtScore.home,
    predictedHtAwayScore: mostLikelyHtScore.away,
    bttsProb,
    predictedBtts,
    over25Prob,
    predictedOver25,
    confidence,
  };
}

/**
 * Update team rating based on match result
 */
export function updateTeamRatingFromMatch(
  teamRating: TeamRating,
  opponentRating: TeamRating,
  match: MatchStats,
  isHome: boolean
): Partial<InsertTeamRating> {
  const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
  const teamScore = isHome ? match.ftHomeScore : match.ftAwayScore;
  const opponentScore = isHome ? match.ftAwayScore : match.ftHomeScore;
  const htTeamScore = isHome ? match.htHomeScore : match.htAwayScore;
  const htOpponentScore = isHome ? match.htAwayScore : match.htHomeScore;
  
  if (teamScore === null || opponentScore === null) {
    return {};
  }
  
  // Determine result
  let actualScore: number;
  let isWin = false;
  let isDraw = false;
  let isLoss = false;
  
  if (teamScore > opponentScore) {
    actualScore = 1;
    isWin = true;
  } else if (teamScore === opponentScore) {
    actualScore = 0.5;
    isDraw = true;
  } else {
    actualScore = 0;
    isLoss = true;
  }
  
  // Calculate expected score based on team ratings (apply home advantage if home team)
  const teamElo = isHome ? teamRating.eloRating + HOME_ADVANTAGE : teamRating.eloRating;
  const opponentElo = !isHome ? opponentRating.eloRating + HOME_ADVANTAGE : opponentRating.eloRating;
  const expectedScore = calculateExpectedScore(teamElo, opponentElo);
  
  // Update Elo rating
  const newEloRating = updateEloRating(teamRating.eloRating, expectedScore, actualScore);
  
  // Update attack and defense ratings
  const goalDiff = teamScore - opponentScore;
  const newAttackRating = teamRating.attackRating + (teamScore * 5) - (opponentScore * 2);
  const newDefenseRating = teamRating.defenseRating - (opponentScore * 5) + (teamScore * 2);
  
  // Update match counts
  const newTotalMatches = teamRating.totalMatches + 1;
  const newHomeMatches = isHome ? teamRating.homeMatches + 1 : teamRating.homeMatches;
  const newAwayMatches = !isHome ? teamRating.awayMatches + 1 : teamRating.awayMatches;
  const newWins = isWin ? teamRating.wins + 1 : teamRating.wins;
  const newDraws = isDraw ? teamRating.draws + 1 : teamRating.draws;
  const newLosses = isLoss ? teamRating.losses + 1 : teamRating.losses;
  
  // Update streaks
  let newUnbeatenStreak = teamRating.unbeatenStreak;
  let newLosingStreak = teamRating.losingStreak;
  let newHomeStreak = teamRating.homeStreak;
  let newAwayStreak = teamRating.awayStreak;
  
  if (isWin || isDraw) {
    newUnbeatenStreak += 1;
    newLosingStreak = 0;
  } else {
    newUnbeatenStreak = 0;
    newLosingStreak += 1;
  }
  
  if (isHome && isWin) {
    newHomeStreak += 1;
  } else if (isHome) {
    newHomeStreak = 0;
  }
  
  if (!isHome && isWin) {
    newAwayStreak += 1;
  } else if (!isHome) {
    newAwayStreak = 0;
  }
  
  // Update goals
  const newGoalsScored = teamRating.goalsScored + teamScore;
  const newGoalsConceded = teamRating.goalsConceded + opponentScore;
  const newAvgGoalsScored = newGoalsScored / newTotalMatches;
  const newAvgGoalsConceded = newGoalsConceded / newTotalMatches;
  
  // Update goal margin
  const newGoalMarginAvg = ((teamRating.goalMarginAvg * teamRating.totalMatches) + goalDiff) / newTotalMatches;
  
  // Update winning margins
  let newWinningMarginBy1 = teamRating.winningMarginBy1;
  let newWinningMarginBy2Plus = teamRating.winningMarginBy2Plus;
  let newLossMarginBy1 = teamRating.lossMarginBy1;
  let newLossMarginBy2Plus = teamRating.lossMarginBy2Plus;
  
  if (isWin) {
    if (goalDiff === 1) newWinningMarginBy1 += 1;
    if (goalDiff >= 2) newWinningMarginBy2Plus += 1;
  } else if (isLoss) {
    if (Math.abs(goalDiff) === 1) newLossMarginBy1 += 1;
    if (Math.abs(goalDiff) >= 2) newLossMarginBy2Plus += 1;
  }
  
  // Update win rates
  const newFtWinRate = newWins / newTotalMatches;
  const newFtDrawRate = newDraws / newTotalMatches;
  const newFtLossRate = newLosses / newTotalMatches;
  
  // Update HT stats if available
  let newHtWinRate = teamRating.htWinRate;
  let newHtDrawRate = teamRating.htDrawRate;
  let newHtLossRate = teamRating.htLossRate;
  let newHtFtConsistencyRate = teamRating.htFtConsistencyRate;
  let newHtLeadToWinRate = teamRating.htLeadToWinRate;
  let newHtDrawToWinRate = teamRating.htDrawToWinRate;
  let newHtLossToWinRate = teamRating.htLossToWinRate;
  
  if (htTeamScore !== null && htOpponentScore !== null) {
    const htWin = htTeamScore > htOpponentScore;
    const htDraw = htTeamScore === htOpponentScore;
    const htLoss = htTeamScore < htOpponentScore;
    
    const htWins = htWin ? 1 : 0;
    const htDraws = htDraw ? 1 : 0;
    const htLosses = htLoss ? 1 : 0;
    
    newHtWinRate = ((teamRating.htWinRate * teamRating.totalMatches) + htWins) / newTotalMatches;
    newHtDrawRate = ((teamRating.htDrawRate * teamRating.totalMatches) + htDraws) / newTotalMatches;
    newHtLossRate = ((teamRating.htLossRate * teamRating.totalMatches) + htLosses) / newTotalMatches;
    
    // HT-FT consistency
    const consistent = (htWin && isWin) || (htDraw && isDraw) || (htLoss && isLoss) ? 1 : 0;
    newHtFtConsistencyRate = ((teamRating.htFtConsistencyRate * teamRating.totalMatches) + consistent) / newTotalMatches;
    
    // HT lead to FT win
    if (htWin) {
      newHtLeadToWinRate = ((teamRating.htLeadToWinRate * teamRating.totalMatches) + (isWin ? 1 : 0)) / newTotalMatches;
    }
    if (htDraw) {
      newHtDrawToWinRate = ((teamRating.htDrawToWinRate * teamRating.totalMatches) + (isWin ? 1 : 0)) / newTotalMatches;
    }
    if (htLoss) {
      newHtLossToWinRate = ((teamRating.htLossToWinRate * teamRating.totalMatches) + (isWin ? 1 : 0)) / newTotalMatches;
    }
  }
  
  // Update BTTS stats
  const btts = teamScore > 0 && opponentScore > 0 ? 1 : 0;
  const newBttsYesRate = ((teamRating.bttsYesRate * teamRating.totalMatches) + btts) / newTotalMatches;
  const newBttsNoRate = 1 - newBttsYesRate;
  
  let newBttsAndWinRate = teamRating.bttsAndWinRate;
  let newBttsAndLossRate = teamRating.bttsAndLossRate;
  let newBttsAndOver25Rate = teamRating.bttsAndOver25Rate;
  let newBttsAndUnder25Rate = teamRating.bttsAndUnder25Rate;
  
  if (btts) {
    newBttsAndWinRate = ((teamRating.bttsAndWinRate * teamRating.totalMatches) + (isWin ? 1 : 0)) / newTotalMatches;
    newBttsAndLossRate = ((teamRating.bttsAndLossRate * teamRating.totalMatches) + (isLoss ? 1 : 0)) / newTotalMatches;
    
    const totalGoals = teamScore + opponentScore;
    const over25 = totalGoals > 2 ? 1 : 0;
    newBttsAndOver25Rate = ((teamRating.bttsAndOver25Rate * teamRating.totalMatches) + over25) / newTotalMatches;
    newBttsAndUnder25Rate = ((teamRating.bttsAndUnder25Rate * teamRating.totalMatches) + (over25 ? 0 : 1)) / newTotalMatches;
  }
  
  // Update situational performance (simplified - would need odds data for full implementation)
  const totalGoals = teamScore + opponentScore;
  const highScoring = totalGoals > 2 ? 1 : 0;
  const lowScoring = totalGoals < 2 ? 1 : 0;
  
  const newPerformanceInHighScoringGames = ((teamRating.performanceInHighScoringGames * teamRating.totalMatches) + (highScoring && isWin ? 1 : 0)) / newTotalMatches;
  const newPerformanceInLowScoringGames = ((teamRating.performanceInLowScoringGames * teamRating.totalMatches) + (lowScoring && isWin ? 1 : 0)) / newTotalMatches;
  
  // Calculate Pressure Metrics
  let newComebackRate = teamRating.comebackRate;
  let newPerformanceWhenTrailing = teamRating.performanceWhenTrailing;
  let newPerformanceInCloseGames = teamRating.performanceInCloseGames;
  let newMentalStrength = teamRating.mentalStrength;
  
  // Comeback rate - winning/drawing after losing at HT
  if (htTeamScore !== null && htOpponentScore !== null && htTeamScore < htOpponentScore) {
    const comeback = (isWin || isDraw) ? 1 : 0;
    newComebackRate = ((teamRating.comebackRate * teamRating.totalMatches) + comeback) / newTotalMatches;
    
    // Performance when trailing (points gained: 3 for win, 1 for draw)
    const pointsGained = isWin ? 3 : (isDraw ? 1 : 0);
    newPerformanceWhenTrailing = ((teamRating.performanceWhenTrailing * teamRating.totalMatches) + pointsGained) / newTotalMatches;
  }
  
  // Performance in close games (1-goal margin)
  if (Math.abs(goalDiff) === 1) {
    const closeGameWin = isWin ? 1 : 0;
    newPerformanceInCloseGames = ((teamRating.performanceInCloseGames * teamRating.totalMatches) + closeGameWin) / newTotalMatches;
  }
  
  // Mental strength - ability to hold leads (win when leading at HT)
  if (htTeamScore !== null && htOpponentScore !== null && htTeamScore > htOpponentScore) {
    const heldLead = isWin ? 1 : 0;
    newMentalStrength = ((teamRating.mentalStrength * teamRating.totalMatches) + heldLead) / newTotalMatches;
  }
  
  // Calculate Mistake Propensity Metrics
  let newLeadBlownRate = teamRating.leadBlownRate;
  let newLateCollapseRate = teamRating.lateCollapseRate;
  let newDefensiveErrors = teamRating.defensiveErrors;
  const newCleanSheetRate = opponentScore === 0 ? ((teamRating.cleanSheetRate * teamRating.totalMatches) + 1) / newTotalMatches : (teamRating.cleanSheetRate * teamRating.totalMatches) / newTotalMatches;
  
  // Lead blown rate - dropping points after leading at HT
  if (htTeamScore !== null && htOpponentScore !== null && htTeamScore > htOpponentScore) {
    const droppedPoints = (isDraw || isLoss) ? 1 : 0;
    newLeadBlownRate = ((teamRating.leadBlownRate * teamRating.totalMatches) + droppedPoints) / newTotalMatches;
    
    // Late collapse - losing/drawing after leading by 1 at HT (narrow lead blown)
    if ((htTeamScore - htOpponentScore) === 1 && (isDraw || isLoss)) {
      newLateCollapseRate = ((teamRating.lateCollapseRate * teamRating.totalMatches) + 1) / newTotalMatches;
    } else if ((htTeamScore - htOpponentScore) === 1) {
      newLateCollapseRate = (teamRating.lateCollapseRate * teamRating.totalMatches) / newTotalMatches;
    }
  }
  
  // Defensive errors - goals conceded from winning positions
  if (htTeamScore !== null && htOpponentScore !== null && htTeamScore > htOpponentScore && opponentScore > htOpponentScore) {
    const errorsInSecondHalf = opponentScore - htOpponentScore;
    newDefensiveErrors = teamRating.defensiveErrors + errorsInSecondHalf;
  }
  
  return {
    teamId: teamRating.teamId,
    eloRating: newEloRating,
    attackRating: newAttackRating,
    defenseRating: newDefenseRating,
    totalMatches: newTotalMatches,
    homeMatches: newHomeMatches,
    awayMatches: newAwayMatches,
    wins: newWins,
    draws: newDraws,
    losses: newLosses,
    homeStreak: newHomeStreak,
    awayStreak: newAwayStreak,
    unbeatenStreak: newUnbeatenStreak,
    losingStreak: newLosingStreak,
    goalMarginAvg: newGoalMarginAvg,
    winningMarginBy1: newWinningMarginBy1,
    winningMarginBy2Plus: newWinningMarginBy2Plus,
    lossMarginBy1: newLossMarginBy1,
    lossMarginBy2Plus: newLossMarginBy2Plus,
    ftWinRate: newFtWinRate,
    ftDrawRate: newFtDrawRate,
    ftLossRate: newFtLossRate,
    htWinRate: newHtWinRate,
    htDrawRate: newHtDrawRate,
    htLossRate: newHtLossRate,
    htFtConsistencyRate: newHtFtConsistencyRate,
    htLeadToWinRate: newHtLeadToWinRate,
    htDrawToWinRate: newHtDrawToWinRate,
    htLossToWinRate: newHtLossToWinRate,
    bttsYesRate: newBttsYesRate,
    bttsNoRate: newBttsNoRate,
    bttsAndWinRate: newBttsAndWinRate,
    bttsAndLossRate: newBttsAndLossRate,
    bttsAndOver25Rate: newBttsAndOver25Rate,
    bttsAndUnder25Rate: newBttsAndUnder25Rate,
    goalsScored: newGoalsScored,
    goalsConceded: newGoalsConceded,
    avgGoalsScored: newAvgGoalsScored,
    avgGoalsConceded: newAvgGoalsConceded,
    performanceInHighScoringGames: newPerformanceInHighScoringGames,
    performanceInLowScoringGames: newPerformanceInLowScoringGames,
    comebackRate: newComebackRate,
    performanceInCloseGames: newPerformanceInCloseGames,
    mentalStrength: newMentalStrength,
    performanceWhenTrailing: newPerformanceWhenTrailing,
    leadBlownRate: newLeadBlownRate,
    cleanSheetRate: newCleanSheetRate,
    lateCollapseRate: newLateCollapseRate,
    defensiveErrors: newDefensiveErrors,
  };
}

/**
 * Initialize default team rating
 */
export function createDefaultTeamRating(teamId: number): InsertTeamRating {
  return {
    teamId,
    eloRating: 1500,
    attackRating: 1500,
    defenseRating: 1500,
    totalMatches: 0,
    homeMatches: 0,
    awayMatches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    performanceAsFavorite: 0,
    performanceAsUnderdog: 0,
    performanceInBadForm: 0,
    performanceAfterLoss: 0,
    performanceAfterWin: 0,
    performanceInHighScoringGames: 0,
    performanceInLowScoringGames: 0,
    homeStreak: 0,
    awayStreak: 0,
    unbeatenStreak: 0,
    losingStreak: 0,
    goalMarginAvg: 0,
    winningMarginBy1: 0,
    winningMarginBy2Plus: 0,
    lossMarginBy1: 0,
    lossMarginBy2Plus: 0,
    winRateVsOdds: 0,
    over25VsOdds: 0,
    bttsVsOdds: 0,
    varianceInMarketAccuracy: 0,
    underdogWinRate: 0,
    highOddsAccuracy: 0,
    lowOddsAccuracy: 0,
    htWinRate: 0,
    htDrawRate: 0,
    htLossRate: 0,
    ftWinRate: 0,
    ftDrawRate: 0,
    ftLossRate: 0,
    htFtConsistencyRate: 0,
    htLeadToWinRate: 0,
    htDrawToWinRate: 0,
    htLossToWinRate: 0,
    bttsYesRate: 0,
    bttsNoRate: 0,
    bttsAndWinRate: 0,
    bttsAndLossRate: 0,
    bttsAndOver25Rate: 0,
    bttsAndUnder25Rate: 0,
    goalsScored: 0,
    goalsConceded: 0,
    avgGoalsScored: 0,
    avgGoalsConceded: 0,
    comebackRate: 0,
    performanceInCloseGames: 0,
    mentalStrength: 0,
    performanceWhenTrailing: 0,
    leadBlownRate: 0,
    cleanSheetRate: 0,
    lateCollapseRate: 0,
    defensiveErrors: 0,
  };
}
