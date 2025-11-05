import type { MatchDetails } from "@shared/schema";
import type { InsertMatchStats } from "@shared/schema";
import type { LeagueStats } from "./scraper";

// Helper function to calculate form score
function calculateFormScore(results: ('W' | 'L' | 'D')[]): number {
  return results.reduce((score, result) => {
    if (result === 'W') return score + 3;
    if (result === 'D') return score + 1;
    return score;
  }, 0);
}

// Extract features from match details for database upload (with target variables)
export function extractFeaturesForDatabase(
  matchDetails: MatchDetails,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  countryId: number,
  leagueStats?: LeagueStats
): InsertMatchStats {
  const { homeTeamForm, awayTeamForm, homeTeamStats, awayTeamStats, score, oddsData } = matchDetails;

  // Calculate target variables from actual scores
  const ftHomeScore = score.home ?? null;
  const ftAwayScore = score.away ?? null;
  const htHomeScore = score.halfTime?.home ?? null;
  const htAwayScore = score.halfTime?.away ?? null;

  let ftResult: string | null = null;
  if (ftHomeScore !== null && ftAwayScore !== null) {
    if (ftHomeScore > ftAwayScore) ftResult = '1';
    else if (ftHomeScore < ftAwayScore) ftResult = '2';
    else ftResult = 'X';
  }

  const bttsYesNo = (ftHomeScore !== null && ftAwayScore !== null && ftHomeScore > 0 && ftAwayScore > 0) ? 1 : 0;
  const totalGoals = (ftHomeScore ?? 0) + (ftAwayScore ?? 0);
  const uO25Goals = totalGoals >= 3 ? 1 : 0;

  // Use league statistics if provided, otherwise use default values
  const leagueHomeWins = leagueStats ? leagueStats.homeWins / 100 : 0.45;
  const leagueDraws = leagueStats ? leagueStats.draws / 100 : 0.27;
  const leagueAwayWins = leagueStats ? leagueStats.awayWins / 100 : 0.28;
  const leagueUnder25 = leagueStats ? leagueStats.under25 / 100 : 0.53;
  const leagueOver25 = leagueStats ? leagueStats.over25 / 100 : 0.47;
  const leagueAvgGoals = leagueStats ? leagueStats.avgGoals : 2.61;

  // NEW: Calculate derived features
  
  // Points per game (3 for win, 1 for draw, 0 for loss)
  const homeWinRate = (homeTeamStats.winPercentage ?? 0) / 100;
  const homeDrawRate = (homeTeamStats.drawPercentage ?? 0) / 100;
  const homeTeamPointsPerGame = (homeWinRate * 3) + (homeDrawRate * 1);
  
  const awayWinRate = (awayTeamStats.winPercentage ?? 0) / 100;
  const awayDrawRate = (awayTeamStats.drawPercentage ?? 0) / 100;
  const awayTeamPointsPerGame = (awayWinRate * 3) + (awayDrawRate * 1);
  
  // Over/Under rates from scraped data
  const homeTeamOver05Rate = (homeTeamStats.over05Percentage ?? 0) / 100;
  const awayTeamOver05Rate = (awayTeamStats.over05Percentage ?? 0) / 100;
  const homeTeamOver15Rate = (homeTeamStats.over15Percentage ?? 0) / 100;
  const awayTeamOver15Rate = (awayTeamStats.over15Percentage ?? 0) / 100;
  const homeTeamOver35Rate = (homeTeamStats.over35Percentage ?? 0) / 100;
  const awayTeamOver35Rate = (awayTeamStats.over35Percentage ?? 0) / 100;
  
  // Failed to score rate (100% - scored percentage)
  const homeScoredRate = (homeTeamStats.scoredPercent?.overall?.percentage ?? 0) / 100;
  const awayScoredRate = (awayTeamStats.scoredPercent?.overall?.percentage ?? 0) / 100;
  const homeTeamFailedToScoreRate = 1 - homeScoredRate;
  const awayTeamFailedToScoreRate = 1 - awayScoredRate;
  
  // Goals per half ratio (1H goals / 2H goals)
  const homeFirstHalfGoals = (homeTeamStats.goalsInFirstHalf?.percentage ?? 50) / 100;
  const homeSecondHalfGoals = (homeTeamStats.goalsInSecondHalf?.percentage ?? 50) / 100;
  const homeTeamGoalsPerHalfRatio = homeSecondHalfGoals > 0 ? homeFirstHalfGoals / homeSecondHalfGoals : 1.0;
  
  const awayFirstHalfGoals = (awayTeamStats.goalsInFirstHalf?.percentage ?? 50) / 100;
  const awaySecondHalfGoals = (awayTeamStats.goalsInSecondHalf?.percentage ?? 50) / 100;
  const awayTeamGoalsPerHalfRatio = awaySecondHalfGoals > 0 ? awayFirstHalfGoals / awaySecondHalfGoals : 1.0;
  
  // Comparative metrics
  const homeGoalsScored = homeTeamStats.goalsScored ?? 1;
  const homeGoalsConceded = homeTeamStats.goalsConceded ?? 1;
  const awayGoalsScored = awayTeamStats.goalsScored ?? 1;
  const awayGoalsConceded = awayTeamStats.goalsConceded ?? 1;
  
  const relativeAttackStrength = homeGoalsScored / (awayGoalsConceded || 1);
  const relativeDefenseStrength = homeGoalsConceded / (awayGoalsScored || 1);
  
  const homeFormOverall = homeTeamForm.overallForm ?? 0;
  const awayFormOverall = awayTeamForm.overallForm ?? 0;
  const momentumDifference = homeFormOverall - awayFormOverall;
  
  const recentGoalDifference = (homeGoalsScored - homeGoalsConceded) - (awayGoalsScored - awayGoalsConceded);
  
  // Market-specific features
  const odds1 = oddsData?.odds1 ?? 2.0;
  const oddsX = oddsData?.oddsX ?? 3.0;
  const odds2 = oddsData?.odds2 ?? 3.5;
  const prob1 = oddsData?.prob1 ?? 0.33;
  const probX = oddsData?.probX ?? 0.27;
  const prob2 = oddsData?.prob2 ?? 0.4;
  
  const impliedProb1 = odds1 > 0 ? 1 / odds1 : 0;
  const impliedProb2 = odds2 > 0 ? 1 / odds2 : 0;
  
  const expectedWinRatioHome = homeWinRate / (impliedProb1 || 0.01);
  const expectedWinRatioAway = awayWinRate / (impliedProb2 || 0.01);
  
  const winToOddsIndexHome = homeWinRate * odds1;
  const winToOddsIndexAway = awayWinRate * odds2;
  
  const expectedValue1 = (prob1 * odds1) - 1;
  const expectedValueX = (probX * oddsX) - 1;
  const expectedValue2 = (prob2 * odds2) - 1;
  
  const marketExpectedGoalsHome = impliedProb1 * leagueAvgGoals;
  const marketExpectedGoalsAway = impliedProb2 * leagueAvgGoals;
  
  // League position normalized (0-1 where 0 is 1st place, 1 is last place)
  const homePosition = matchDetails.homeTeamLeaguePosition ?? 10;
  const awayPosition = matchDetails.awayTeamLeaguePosition ?? 10;
  const totalTeams = matchDetails.totalTeamsInLeague ?? 20;
  const homePositionNormalized = totalTeams > 1 ? (homePosition - 1) / (totalTeams - 1) : 0;
  const awayPositionNormalized = totalTeams > 1 ? (awayPosition - 1) / (totalTeams - 1) : 0;
  
  // Win margin ratio (by 1 goal / by 2+ goals)
  const homeWinBy1 = (homeTeamStats.winByOneGoal?.percentage ?? 50) / 100;
  const homeWinBy2Plus = (homeTeamStats.winByTwoPlusGoals?.percentage ?? 50) / 100;
  const homeTeamWinMarginRatio = homeWinBy2Plus > 0 ? homeWinBy1 / homeWinBy2Plus : 1.0;
  
  const awayWinBy1 = (awayTeamStats.winByOneGoal?.percentage ?? 50) / 100;
  const awayWinBy2Plus = (awayTeamStats.winByTwoPlusGoals?.percentage ?? 50) / 100;
  const awayTeamWinMarginRatio = awayWinBy2Plus > 0 ? awayWinBy1 / awayWinBy2Plus : 1.0;
  
  // Home/Away-specific win rates
  const homeTeamWinRateHome = (homeTeamStats.winPercentageHome ?? homeTeamStats.winPercentage ?? 0) / 100;
  const homeTeamWinRateAway = (homeTeamStats.winPercentageAway ?? homeTeamStats.winPercentage ?? 0) / 100;
  const awayTeamWinRateHome = (awayTeamStats.winPercentageHome ?? awayTeamStats.winPercentage ?? 0) / 100;
  const awayTeamWinRateAway = (awayTeamStats.winPercentageAway ?? awayTeamStats.winPercentage ?? 0) / 100;

  return {
    homeTeamId,
    awayTeamId,
    leagueId,
    countryId,

    // Form metrics
    homeTeamFormHomeL5: homeTeamForm.homeForm ?? 0,
    awayTeamFormAwayL5: awayTeamForm.awayForm ?? 0,
    homeTeamFormOverallL5: homeTeamForm.overallForm ?? 0,
    awayTeamFormOverallL5: awayTeamForm.overallForm ?? 0,
    homeTeamFormDiffOverall: (homeTeamForm.overallForm ?? 0) - (awayTeamForm.overallForm ?? 0),

    // Win/Draw/Loss rates
    homeTeamWinRateL8: (homeTeamStats.winPercentage ?? 0) / 100,
    awayTeamWinRateL8: (awayTeamStats.winPercentage ?? 0) / 100,
    homeTeamDrawRateL8: (homeTeamStats.drawPercentage ?? 0) / 100,
    awayTeamDrawRateL8: (awayTeamStats.drawPercentage ?? 0) / 100,
    homeTeamLossRateL8: (homeTeamStats.lossPercentage ?? 0) / 100,
    awayTeamLossRateL8: (awayTeamStats.lossPercentage ?? 0) / 100,

    // To Nil rates
    homeTeamToNilRateL8: (homeTeamStats.winToNil?.percentage ?? 0) / 100,
    awayTeamToNilRateL8: (awayTeamStats.winToNil?.percentage ?? 0) / 100,

    // Winning margin rates
    homeTeamWinningMargin1GoalRateL8: (homeTeamStats.winByOneGoal?.percentage ?? 0) / 100,
    awayTeamWinningMargin1GoalRateL8: (awayTeamStats.winByOneGoal?.percentage ?? 0) / 100,
    homeTeamWinningMargin2GoalRateL8: (homeTeamStats.winByTwoPlusGoals?.percentage ?? 0) / 100,
    awayTeamWinningMargin2GoalRateL8: (awayTeamStats.winByTwoPlusGoals?.percentage ?? 0) / 100,

    // Half goal rates
    homeTeamFirstHalfGoalRate: (homeTeamStats.goalsInFirstHalf?.percentage ?? 0) / 100,
    awayTeamFirstHalfGoalRate: (awayTeamStats.goalsInFirstHalf?.percentage ?? 0) / 100,
    homeTeamSecondHalfGoalRate: (homeTeamStats.goalsInSecondHalf?.percentage ?? 0) / 100,
    awayTeamSecondHalfGoalRate: (awayTeamStats.goalsInSecondHalf?.percentage ?? 0) / 100,

    // BTTS and scoring rates
    homeTeamBttsRateL4: (homeTeamStats.btts?.overall?.percentage ?? 0) / 100,
    awayTeamBttsRateL4: (awayTeamStats.btts?.overall?.percentage ?? 0) / 100,
    homeTeamScoredRateL4: (homeTeamStats.scoredPercent?.overall?.percentage ?? 0) / 100,
    awayTeamScoredRateL4: (awayTeamStats.scoredPercent?.overall?.percentage ?? 0) / 100,
    homeTeamScoredAgainstRateL4: (homeTeamStats.scoredAgainstPercent?.overall?.percentage ?? 0) / 100,
    awayTeamScoredAgainstRateL4: (awayTeamStats.scoredAgainstPercent?.overall?.percentage ?? 0) / 100,

    // Half-time rates
    homeTeamHtWonRateL8: (homeTeamStats.halftimeStats?.wonFirstHalf?.percentage ?? 0) / 100,
    awayTeamHtWonRateL8: (awayTeamStats.halftimeStats?.wonFirstHalf?.percentage ?? 0) / 100,
    homeTeamHtTiedRateL8: (homeTeamStats.halftimeStats?.tiedFirstHalf?.percentage ?? 0) / 100,
    awayTeamHtTiedRateL8: (awayTeamStats.halftimeStats?.tiedFirstHalf?.percentage ?? 0) / 100,
    homeTeamHtLostRateL8: (homeTeamStats.halftimeStats?.lostFirstHalf?.percentage ?? 0) / 100,
    awayTeamHtLostRateL8: (awayTeamStats.halftimeStats?.lostFirstHalf?.percentage ?? 0) / 100,

    // NEW: Home/Away-specific win rates
    homeTeamWinRateHome,
    homeTeamWinRateAway,
    awayTeamWinRateHome,
    awayTeamWinRateAway,
    
    // NEW: Points per game
    homeTeamPointsPerGame,
    awayTeamPointsPerGame,
    
    // NEW: Over/Under goal percentages
    homeTeamOver05Rate,
    awayTeamOver05Rate,
    homeTeamOver15Rate,
    awayTeamOver15Rate,
    homeTeamOver35Rate,
    awayTeamOver35Rate,
    
    // NEW: Failed to score percentage
    homeTeamFailedToScoreRate,
    awayTeamFailedToScoreRate,
    
    // NEW: Goals per half ratio
    homeTeamGoalsPerHalfRatio,
    awayTeamGoalsPerHalfRatio,
    
    // NEW: Comparative metrics
    relativeAttackStrength,
    relativeDefenseStrength,
    momentumDifference,
    recentGoalDifference,
    
    // NEW: Market-specific features
    expectedWinRatioHome,
    expectedWinRatioAway,
    winToOddsIndexHome,
    winToOddsIndexAway,
    expectedValue1,
    expectedValueX,
    expectedValue2,
    marketExpectedGoalsHome,
    marketExpectedGoalsAway,
    
    // NEW: League position
    homeTeamLeaguePosition: homePosition,
    awayTeamLeaguePosition: awayPosition,
    homeTeamLeaguePositionNormalized: homePositionNormalized,
    awayTeamLeaguePositionNormalized: awayPositionNormalized,
    
    // NEW: Win margin ratio
    homeTeamWinMarginRatio,
    awayTeamWinMarginRatio,

    // League statistics
    leagueHomeWins,
    leagueDraws,
    leagueAwayWins,
    leagueUnder25,
    leagueOver25,
    leagueAvgGoals,

    // Betting odds and probabilities
    odds1: oddsData?.odds1 ?? 0,
    oddsX: oddsData?.oddsX ?? 0,
    odds2: oddsData?.odds2 ?? 0,
    prob1: oddsData?.prob1 ?? 0,
    probX: oddsData?.probX ?? 0,
    prob2: oddsData?.prob2 ?? 0,

    // Target variables
    ftHomeScore,
    ftAwayScore,
    htHomeScore,
    htAwayScore,
    ftResult,
    bttsYesNo,
    uO25Goals,
  };
}

// Extract features for tester upload (without target variables)
export function extractFeaturesForTester(
  matchDetails: MatchDetails,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  countryId: number,
  leagueStats?: LeagueStats
): InsertMatchStats {
  const features = extractFeaturesForDatabase(matchDetails, homeTeamId, awayTeamId, leagueId, countryId, leagueStats);

  // Remove target variables for tester data
  return {
    ...features,
    ftHomeScore: null,
    ftAwayScore: null,
    htHomeScore: null,
    htAwayScore: null,
    ftResult: null,
    bttsYesNo: null,
    uO25Goals: null,
  };
}

// Generate team ID from team name (simple hash function)
export function generateTeamId(teamName: string): number {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    const char = teamName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate league ID from competition name
export function generateLeagueId(competitionName: string): number {
  let hash = 0;
  for (let i = 0; i < competitionName.length; i++) {
    const char = competitionName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate country ID (simple mapping or hash)
export function generateCountryId(competitionName: string): number {
  // Simple country extraction from competition name
  const countryMap: Record<string, number> = {
    'spain': 1,
    'england': 2,
    'germany': 3,
    'italy': 4,
    'france': 5,
    'portugal': 6,
  };

  const lowerComp = competitionName.toLowerCase();
  for (const [country, id] of Object.entries(countryMap)) {
    if (lowerComp.includes(country)) {
      return id;
    }
  }

  // Default hash if no match found
  return Math.abs(competitionName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 100;
}

// Validation function to check if basketball match data is complete and valid
export function validateBasketballMatchData(basketballMatchDetails: any): { valid: boolean; reason?: string } {
  const { stats, homeScore, awayScore, quarterScores } = basketballMatchDetails;

  // Check if scores exist and are valid
  if (homeScore === null || awayScore === null) {
    return { valid: false, reason: 'Missing final scores' };
  }

  // Basketball scores should be realistic (at least 40 points per team typically)
  if (homeScore < 30 || awayScore < 30) {
    return { valid: false, reason: 'Unrealistic scores (too low for basketball)' };
  }

  // Check if stats object exists and has minimum required data
  if (!stats || !stats.pointStats || !stats.teamStats) {
    return { valid: false, reason: 'Missing stats data' };
  }

  // Check if both teams have point stats
  const homePointsScoredPerGame = stats?.pointStats?.home?.pointsScoredPerGame;
  const awayPointsScoredPerGame = stats?.pointStats?.away?.pointsScoredPerGame;
  
  if (!homePointsScoredPerGame || !awayPointsScoredPerGame || 
      homePointsScoredPerGame === 0 || awayPointsScoredPerGame === 0) {
    return { valid: false, reason: 'Missing or invalid points per game stats' };
  }

  // Check for team stats
  const homeWinsPercent = stats?.teamStats?.home?.winsPercent;
  const awayWinsPercent = stats?.teamStats?.away?.winsPercent;
  
  if (homeWinsPercent === undefined || awayWinsPercent === undefined) {
    return { valid: false, reason: 'Missing team win percentage stats' };
  }

  return { valid: true };
}

// Validation function to check if football match data is complete and valid
export function validateFootballMatchData(matchDetails: MatchDetails): { valid: boolean; reason?: string } {
  const { score, homeTeamStats, awayTeamStats, oddsData } = matchDetails;

  // Check if scores exist
  if (score.home === null || score.away === null) {
    return { valid: false, reason: 'Missing final scores' };
  }

  // Check if half-time scores exist
  if (!score.halfTime || score.halfTime.home === null || score.halfTime.away === null) {
    return { valid: false, reason: 'Missing half-time scores' };
  }

  // Check if team stats exist and have minimum required data
  if (!homeTeamStats || !awayTeamStats) {
    return { valid: false, reason: 'Missing team stats' };
  }

  // Check for unrealistic patterns - all stats being exactly 0 indicates incomplete scraping
  const homeStatsCount = [
    homeTeamStats.winPercentage,
    homeTeamStats.drawPercentage,
    homeTeamStats.lossPercentage
  ].filter(val => val !== undefined && val !== null && val !== 0).length;

  const awayStatsCount = [
    awayTeamStats.winPercentage,
    awayTeamStats.drawPercentage,
    awayTeamStats.lossPercentage
  ].filter(val => val !== undefined && val !== null && val !== 0).length;

  if (homeStatsCount === 0 || awayStatsCount === 0) {
    return { valid: false, reason: 'Team statistics are all zeros - incomplete data' };
  }

  // Check if odds data exists (important for predictions)
  if (!oddsData || !oddsData.odds1 || !oddsData.oddsX || !oddsData.odds2) {
    return { valid: false, reason: 'Missing betting odds data' };
  }

  // Validate odds are realistic (should be > 1.0)
  if (oddsData.odds1 <= 1.0 || oddsData.oddsX <= 1.0 || oddsData.odds2 <= 1.0) {
    return { valid: false, reason: 'Invalid betting odds (unrealistic values)' };
  }

  return { valid: true };
}

// Extract basketball features for database upload (with target variables)
export function extractBasketballFeaturesForDatabase(
  basketballMatchDetails: any,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  countryId: number
): any {
  const { stats, homeScore, awayScore, quarterScores } = basketballMatchDetails;

  // Calculate target variables from actual scores
  const ftHomePoints = homeScore ?? null;
  const ftAwayPoints = awayScore ?? null;

  let ftResult: string | null = null;
  if (ftHomePoints !== null && ftAwayPoints !== null) {
    if (ftHomePoints > ftAwayPoints) ftResult = 'H';
    else if (ftHomePoints < ftAwayPoints) ftResult = 'A';
    // Basketball rarely has ties, but if it does, we'll skip it for training
    else ftResult = null;
  }

  // Extract stats with defaults
  const homePointsScoredPerGame = stats?.pointStats?.home?.pointsScoredPerGame ?? 0;
  const awayPointsScoredPerGame = stats?.pointStats?.away?.pointsScoredPerGame ?? 0;
  const homePointsReceivedPerGame = stats?.pointStats?.home?.pointsReceivedPerGame ?? 0;
  const awayPointsReceivedPerGame = stats?.pointStats?.away?.pointsReceivedPerGame ?? 0;

  // Win/Tie/Loss records based on percentages
  const homeWinsPercent = stats?.teamStats?.home?.winsPercent ?? 50;
  const awayWinsPercent = stats?.teamStats?.away?.winsPercent ?? 50;
  const homeLossesPercent = stats?.teamStats?.home?.lossesPercent ?? 50;
  const awayLossesPercent = stats?.teamStats?.away?.lossesPercent ?? 50;

  // Estimate counts from percentages (assuming 10 recent games)
  const gamesPlayed = 10;
  const homeWon = Math.round((homeWinsPercent / 100) * gamesPlayed);
  const awayWon = Math.round((awayWinsPercent / 100) * gamesPlayed);
  const homeLost = Math.round((homeLossesPercent / 100) * gamesPlayed);
  const awayLost = Math.round((awayLossesPercent / 100) * gamesPlayed);
  
  // Basketball typically has very few ties
  const homeTied = gamesPlayed - homeWon - homeLost;
  const awayTied = gamesPlayed - awayWon - awayLost;

  // Average points per quarter from percentages
  const totalAvgHome = homePointsScoredPerGame || 100;
  const totalAvgAway = awayPointsScoredPerGame || 100;

  const homeAvgPointsQ1 = totalAvgHome * (stats?.avgPointsPerQuarter?.home?.q1Percent ?? 25) / 100;
  const awayAvgPointsQ1 = totalAvgAway * (stats?.avgPointsPerQuarter?.away?.q1Percent ?? 25) / 100;
  const homeAvgPointsQ2 = totalAvgHome * (stats?.avgPointsPerQuarter?.home?.q2Percent ?? 25) / 100;
  const awayAvgPointsQ2 = totalAvgAway * (stats?.avgPointsPerQuarter?.away?.q2Percent ?? 25) / 100;
  const homeAvgPointsQ3 = totalAvgHome * (stats?.avgPointsPerQuarter?.home?.q3Percent ?? 25) / 100;
  const awayAvgPointsQ3 = totalAvgAway * (stats?.avgPointsPerQuarter?.away?.q3Percent ?? 25) / 100;
  const homeAvgPointsQ4 = totalAvgHome * (stats?.avgPointsPerQuarter?.home?.q4Percent ?? 25) / 100;
  const awayAvgPointsQ4 = totalAvgAway * (stats?.avgPointsPerQuarter?.away?.q4Percent ?? 25) / 100;

  return {
    homeTeamId,
    awayTeamId,
    leagueId,
    countryId,

    // Points per game
    homePointsScoredPerGame,
    awayPointsScoredPerGame,
    homePointsReceivedPerGame,
    awayPointsReceivedPerGame,

    // Win/Tie/Loss records
    homeWon: Math.max(0, homeWon),
    awayWon: Math.max(0, awayWon),
    homeTied: Math.max(0, homeTied),
    awayTied: Math.max(0, awayTied),
    homeLost: Math.max(0, homeLost),
    awayLost: Math.max(0, awayLost),

    // Average points per quarter
    homeAvgPointsQ1,
    awayAvgPointsQ1,
    homeAvgPointsQ2,
    awayAvgPointsQ2,
    homeAvgPointsQ3,
    awayAvgPointsQ3,
    homeAvgPointsQ4,
    awayAvgPointsQ4,

    // Target variables
    ftHomePoints,
    ftAwayPoints,
    ftResult,
  };
}

// Extract basketball features for tester upload (without target variables)
export function extractBasketballFeaturesForTester(
  basketballMatchDetails: any,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  countryId: number
): any {
  const features = extractBasketballFeaturesForDatabase(
    basketballMatchDetails,
    homeTeamId,
    awayTeamId,
    leagueId,
    countryId
  );

  // Remove target variables for tester data
  return {
    ...features,
    ftHomePoints: null,
    ftAwayPoints: null,
    ftResult: null,
  };
}
