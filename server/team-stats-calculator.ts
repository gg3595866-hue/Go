import type { TeamMatchSummary } from './scraper';
import type { MatchDetails } from '@shared/schema';

/**
 * Calculate team statistics from raw match history
 * This replaces the website's pre-calculated statistics with our own calculations
 * based on the team's last 7 (or available) matches
 */

interface CalculatedTeamStats {
  // Basic stats
  winPercentage: number;
  drawPercentage: number;
  lossPercentage: number;
  goalsScored: number;
  goalsScoredHome: number;
  goalsScoredAway: number;
  goalsConceded: number;
  goalsConcededHome: number;
  goalsConcededAway: number;
  cleanSheetPercentage: number;

  // Home/Away-specific win rates
  winPercentageHome: number;
  winPercentageAway: number;
  drawPercentageHome: number;
  drawPercentageAway: number;
  lossPercentageHome: number;
  lossPercentageAway: number;

  // Over/Under percentages
  over05Percentage: number;
  over15Percentage: number;
  over25Percentage: number;
  over35Percentage: number;
  under05Percentage: number;
  under15Percentage: number;
  under25Percentage: number;
  under35Percentage: number;

  // Double Chance stats
  doubleChance1X: { percentage: number; count: number; total: number };
  doubleChanceX2: { percentage: number; count: number; total: number };
  doubleChance12: { percentage: number; count: number; total: number };

  // To Nil stats
  winToNil: { percentage: number; count: number; total: number };
  loseToNil: { percentage: number; count: number; total: number };

  // Winning Margin
  winByOneGoal: { percentage: number; count: number; total: number };
  winByTwoPlusGoals: { percentage: number; count: number; total: number };

  // BTTS (Both Teams To Score) stats
  btts: {
    overall: { percentage: number; count: number; total: number };
  };
  bttsAndOver25: {
    overall: { percentage: number; count: number; total: number };
  };
  bttsAndWin: {
    overall: { percentage: number; count: number; total: number };
  };
  bttsAndLoss: {
    overall: { percentage: number; count: number; total: number };
  };

  // Goals Scored stats
  scoredPercent: {
    overall: { percentage: number; count: number; total: number };
  };
  scoredAgainstPercent: {
    overall: { percentage: number; count: number; total: number };
  };

  // Goals in Halves
  goalsInFirstHalf: { percentage: number; count: number; total: number };
  goalsInSecondHalf: { percentage: number; count: number; total: number };

  // Halftime Stats
  halftimeStats: {
    wonFirstHalf: { percentage: number; count: number; total: number };
    tiedFirstHalf: { percentage: number; count: number; total: number };
    lostFirstHalf: { percentage: number; count: number; total: number };
  };
}

interface CalculatedTeamForm {
  last5: ('W' | 'L' | 'D')[];
  homeForm: number;
  awayForm: number;
  overallForm: number;
}

/**
 * Calculate all team statistics from match history
 */
export function calculateTeamStats(matches: TeamMatchSummary[]): CalculatedTeamStats {
  if (matches.length === 0) {
    return getDefaultStats();
  }

  const total = matches.length;
  const homeMatches = matches.filter(m => m.isHome);
  const awayMatches = matches.filter(m => !m.isHome);
  
  // Count wins, draws, losses
  const wins = matches.filter(m => m.result === 'W').length;
  const draws = matches.filter(m => m.result === 'D').length;
  const losses = matches.filter(m => m.result === 'L').length;
  
  const winsHome = homeMatches.filter(m => m.result === 'W').length;
  const drawsHome = homeMatches.filter(m => m.result === 'D').length;
  const lossesHome = homeMatches.filter(m => m.result === 'L').length;
  
  const winsAway = awayMatches.filter(m => m.result === 'W').length;
  const drawsAway = awayMatches.filter(m => m.result === 'D').length;
  const lossesAway = awayMatches.filter(m => m.result === 'L').length;
  
  // Calculate goals
  const totalGoalsScored = matches.reduce((sum, m) => sum + m.goalsScored, 0);
  const totalGoalsConceded = matches.reduce((sum, m) => sum + m.goalsConceded, 0);
  const totalGoalsScoredHome = homeMatches.reduce((sum, m) => sum + m.goalsScored, 0);
  const totalGoalsScoredAway = awayMatches.reduce((sum, m) => sum + m.goalsScored, 0);
  const totalGoalsConcededHome = homeMatches.reduce((sum, m) => sum + m.goalsConceded, 0);
  const totalGoalsConcededAway = awayMatches.reduce((sum, m) => sum + m.goalsConceded, 0);
  
  // Clean sheets
  const cleanSheets = matches.filter(m => m.goalsConceded === 0).length;
  
  // Over/Under calculations
  const matchesOver05 = matches.filter(m => m.goalsScored + m.goalsConceded > 0.5).length;
  const matchesOver15 = matches.filter(m => m.goalsScored + m.goalsConceded > 1.5).length;
  const matchesOver25 = matches.filter(m => m.goalsScored + m.goalsConceded > 2.5).length;
  const matchesOver35 = matches.filter(m => m.goalsScored + m.goalsConceded > 3.5).length;
  
  // Win margins
  const winBy1 = matches.filter(m => m.result === 'W' && (m.goalsScored - m.goalsConceded) === 1).length;
  const winBy2Plus = matches.filter(m => m.result === 'W' && (m.goalsScored - m.goalsConceded) >= 2).length;
  
  // BTTS calculations
  const bttsMatches = matches.filter(m => m.goalsScored > 0 && m.goalsConceded > 0).length;
  const bttsAndOver25 = matches.filter(m => 
    m.goalsScored > 0 && m.goalsConceded > 0 && (m.goalsScored + m.goalsConceded) > 2.5
  ).length;
  const bttsAndWin = matches.filter(m => 
    m.result === 'W' && m.goalsScored > 0 && m.goalsConceded > 0
  ).length;
  const bttsAndLoss = matches.filter(m => 
    m.result === 'L' && m.goalsScored > 0 && m.goalsConceded > 0
  ).length;
  
  // Scored/Conceded percentages
  const scoredMatches = matches.filter(m => m.goalsScored > 0).length;
  const concededMatches = matches.filter(m => m.goalsConceded > 0).length;
  
  // To Nil stats
  const winToNilCount = matches.filter(m => m.result === 'W' && m.goalsConceded === 0).length;
  const loseToNilCount = matches.filter(m => m.result === 'L' && m.goalsScored === 0).length;
  
  // Double Chance (1X, X2, 12)
  const doubleChance1X = wins + draws; // Home win or draw
  const doubleChanceX2 = draws + losses; // Draw or away win
  const doubleChance12 = wins + losses; // Either team wins
  
  // Goals in halves
  const matchesWithHT = matches.filter(m => m.htGoalsScored !== null && m.htGoalsConceded !== null);
  const totalHT = matchesWithHT.length;
  
  let firstHalfGoals = 0;
  let secondHalfGoals = 0;
  let htWon = 0;
  let htDraw = 0;
  let htLost = 0;
  
  matchesWithHT.forEach(m => {
    const htScored = m.htGoalsScored ?? 0;
    const htConceded = m.htGoalsConceded ?? 0;
    const secondHalfScored = m.goalsScored - htScored;
    const secondHalfConceded = m.goalsConceded - htConceded;
    
    firstHalfGoals += htScored;
    secondHalfGoals += secondHalfScored;
    
    if (htScored > htConceded) htWon++;
    else if (htScored < htConceded) htLost++;
    else htDraw++;
  });
  
  const totalGoalsInHalves = firstHalfGoals + secondHalfGoals;
  
  // Helper to create stat object
  const createStat = (count: number, total: number) => ({
    percentage: total > 0 ? (count / total) * 100 : 0,
    count,
    total,
  });
  
  return {
    // Basic stats
    winPercentage: (wins / total) * 100,
    drawPercentage: (draws / total) * 100,
    lossPercentage: (losses / total) * 100,
    goalsScored: totalGoalsScored / total,
    goalsScoredHome: homeMatches.length > 0 ? totalGoalsScoredHome / homeMatches.length : 0,
    goalsScoredAway: awayMatches.length > 0 ? totalGoalsScoredAway / awayMatches.length : 0,
    goalsConceded: totalGoalsConceded / total,
    goalsConcededHome: homeMatches.length > 0 ? totalGoalsConcededHome / homeMatches.length : 0,
    goalsConcededAway: awayMatches.length > 0 ? totalGoalsConcededAway / awayMatches.length : 0,
    cleanSheetPercentage: (cleanSheets / total) * 100,
    
    // Home/Away-specific win rates
    winPercentageHome: homeMatches.length > 0 ? (winsHome / homeMatches.length) * 100 : 0,
    winPercentageAway: awayMatches.length > 0 ? (winsAway / awayMatches.length) * 100 : 0,
    drawPercentageHome: homeMatches.length > 0 ? (drawsHome / homeMatches.length) * 100 : 0,
    drawPercentageAway: awayMatches.length > 0 ? (drawsAway / awayMatches.length) * 100 : 0,
    lossPercentageHome: homeMatches.length > 0 ? (lossesHome / homeMatches.length) * 100 : 0,
    lossPercentageAway: awayMatches.length > 0 ? (lossesAway / awayMatches.length) * 100 : 0,
    
    // Over/Under percentages
    over05Percentage: (matchesOver05 / total) * 100,
    over15Percentage: (matchesOver15 / total) * 100,
    over25Percentage: (matchesOver25 / total) * 100,
    over35Percentage: (matchesOver35 / total) * 100,
    under05Percentage: ((total - matchesOver05) / total) * 100,
    under15Percentage: ((total - matchesOver15) / total) * 100,
    under25Percentage: ((total - matchesOver25) / total) * 100,
    under35Percentage: ((total - matchesOver35) / total) * 100,
    
    // Double Chance stats
    doubleChance1X: createStat(doubleChance1X, total),
    doubleChanceX2: createStat(doubleChanceX2, total),
    doubleChance12: createStat(doubleChance12, total),
    
    // To Nil stats
    winToNil: createStat(winToNilCount, total),
    loseToNil: createStat(loseToNilCount, total),
    
    // Winning Margin
    winByOneGoal: createStat(winBy1, total),
    winByTwoPlusGoals: createStat(winBy2Plus, total),
    
    // BTTS stats
    btts: {
      overall: createStat(bttsMatches, total),
    },
    bttsAndOver25: {
      overall: createStat(bttsAndOver25, total),
    },
    bttsAndWin: {
      overall: createStat(bttsAndWin, total),
    },
    bttsAndLoss: {
      overall: createStat(bttsAndLoss, total),
    },
    
    // Goals Scored stats
    scoredPercent: {
      overall: createStat(scoredMatches, total),
    },
    scoredAgainstPercent: {
      overall: createStat(concededMatches, total),
    },
    
    // Goals in Halves
    goalsInFirstHalf: createStat(
      firstHalfGoals, 
      totalGoalsInHalves || 1 // Avoid division by zero
    ),
    goalsInSecondHalf: createStat(
      secondHalfGoals, 
      totalGoalsInHalves || 1
    ),
    
    // Halftime Stats
    halftimeStats: {
      wonFirstHalf: createStat(htWon, totalHT || 1),
      tiedFirstHalf: createStat(htDraw, totalHT || 1),
      lostFirstHalf: createStat(htLost, totalHT || 1),
    },
  };
}

/**
 * Calculate team form from match history
 */
export function calculateTeamForm(matches: TeamMatchSummary[]): CalculatedTeamForm {
  if (matches.length === 0) {
    return {
      last5: [],
      homeForm: 0,
      awayForm: 0,
      overallForm: 0,
    };
  }

  // Take last 5 matches for form sequence
  const last5Matches = matches.slice(0, Math.min(5, matches.length));
  const last5 = last5Matches.map(m => m.result);
  
  // Calculate form scores (W=3, D=1, L=0)
  const calculateFormScore = (matches: TeamMatchSummary[]): number => {
    return matches.reduce((score, match) => {
      if (match.result === 'W') return score + 3;
      if (match.result === 'D') return score + 1;
      return score;
    }, 0);
  };
  
  const homeMatches = matches.filter(m => m.isHome);
  const awayMatches = matches.filter(m => !m.isHome);
  
  // Take last 5 for each venue
  const homeForm = calculateFormScore(homeMatches.slice(0, Math.min(5, homeMatches.length)));
  const awayForm = calculateFormScore(awayMatches.slice(0, Math.min(5, awayMatches.length)));
  const overallForm = calculateFormScore(last5Matches);
  
  return {
    last5,
    homeForm,
    awayForm,
    overallForm,
  };
}

/**
 * Get default stats when no matches are available
 */
function getDefaultStats(): CalculatedTeamStats {
  const defaultStat = { percentage: 0, count: 0, total: 0 };
  
  return {
    winPercentage: 0,
    drawPercentage: 0,
    lossPercentage: 0,
    goalsScored: 0,
    goalsScoredHome: 0,
    goalsScoredAway: 0,
    goalsConceded: 0,
    goalsConcededHome: 0,
    goalsConcededAway: 0,
    cleanSheetPercentage: 0,
    
    winPercentageHome: 0,
    winPercentageAway: 0,
    drawPercentageHome: 0,
    drawPercentageAway: 0,
    lossPercentageHome: 0,
    lossPercentageAway: 0,
    
    over05Percentage: 0,
    over15Percentage: 0,
    over25Percentage: 0,
    over35Percentage: 0,
    under05Percentage: 0,
    under15Percentage: 0,
    under25Percentage: 0,
    under35Percentage: 0,
    
    doubleChance1X: defaultStat,
    doubleChanceX2: defaultStat,
    doubleChance12: defaultStat,
    
    winToNil: defaultStat,
    loseToNil: defaultStat,
    
    winByOneGoal: defaultStat,
    winByTwoPlusGoals: defaultStat,
    
    btts: { overall: defaultStat },
    bttsAndOver25: { overall: defaultStat },
    bttsAndWin: { overall: defaultStat },
    bttsAndLoss: { overall: defaultStat },
    
    scoredPercent: { overall: defaultStat },
    scoredAgainstPercent: { overall: defaultStat },
    
    goalsInFirstHalf: defaultStat,
    goalsInSecondHalf: defaultStat,
    
    halftimeStats: {
      wonFirstHalf: defaultStat,
      tiedFirstHalf: defaultStat,
      lostFirstHalf: defaultStat,
    },
  };
}

/**
 * Export the calculated stats types for use in other modules
 */
export type { CalculatedTeamStats, CalculatedTeamForm };
