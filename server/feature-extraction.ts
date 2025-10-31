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
  const { homeTeamForm, awayTeamForm, homeTeamStats, awayTeamStats, score } = matchDetails;

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

    // League statistics
    leagueHomeWins,
    leagueDraws,
    leagueAwayWins,
    leagueUnder25,
    leagueOver25,
    leagueAvgGoals,

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

// Extract basketball features for database upload (with target variables)
export function extractBasketballFeaturesForDatabase(
  basketballMatchDetails: any,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  countryId: number
): any {
  const { pointStats, quarterStats, teamStats, score, quarterScores } = basketballMatchDetails;

  // Calculate target variables from actual scores
  const ftHomePoints = score.home ?? null;
  const ftAwayPoints = score.away ?? null;

  let ftResult: string | null = null;
  if (ftHomePoints !== null && ftAwayPoints !== null) {
    if (ftHomePoints > ftAwayPoints) ftResult = '1';
    else if (ftHomePoints < ftAwayPoints) ftResult = '2';
    else ftResult = 'X';
  }

  // Extract stats with defaults
  const homePointsScoredPerGame = pointStats?.home?.pointsScoredPerGame ?? 0;
  const awayPointsScoredPerGame = pointStats?.away?.pointsScoredPerGame ?? 0;
  const homePointsReceivedPerGame = pointStats?.home?.pointsReceivedPerGame ?? 0;
  const awayPointsReceivedPerGame = pointStats?.away?.pointsReceivedPerGame ?? 0;

  // Win/Tie/Loss records based on percentages
  const homeWinsPercent = teamStats?.home?.winsPercent ?? 50;
  const awayWinsPercent = teamStats?.away?.winsPercent ?? 50;
  const homeLossesPercent = teamStats?.home?.lossesPercent ?? 50;
  const awayLossesPercent = teamStats?.away?.lossesPercent ?? 50;

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

  const homeAvgPointsQ1 = totalAvgHome * (basketballMatchDetails.avgPointsPerQuarter?.home?.q1Percent ?? 25) / 100;
  const awayAvgPointsQ1 = totalAvgAway * (basketballMatchDetails.avgPointsPerQuarter?.away?.q1Percent ?? 25) / 100;
  const homeAvgPointsQ2 = totalAvgHome * (basketballMatchDetails.avgPointsPerQuarter?.home?.q2Percent ?? 25) / 100;
  const awayAvgPointsQ2 = totalAvgAway * (basketballMatchDetails.avgPointsPerQuarter?.away?.q2Percent ?? 25) / 100;
  const homeAvgPointsQ3 = totalAvgHome * (basketballMatchDetails.avgPointsPerQuarter?.home?.q3Percent ?? 25) / 100;
  const awayAvgPointsQ3 = totalAvgAway * (basketballMatchDetails.avgPointsPerQuarter?.away?.q3Percent ?? 25) / 100;
  const homeAvgPointsQ4 = totalAvgHome * (basketballMatchDetails.avgPointsPerQuarter?.home?.q4Percent ?? 25) / 100;
  const awayAvgPointsQ4 = totalAvgAway * (basketballMatchDetails.avgPointsPerQuarter?.away?.q4Percent ?? 25) / 100;

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
