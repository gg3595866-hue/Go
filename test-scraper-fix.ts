import { scrapeMatchDetails } from './server/scraper';

async function testScraperFix() {
  const matchUrl = 'https://sportstats365.com/football/serie-a-br/2025/compare/sao-paulo/bragantino/1019632';
  
  console.log('Testing scraper with:', matchUrl);
  console.log('='.repeat(80));
  
  try {
    const matchDetails = await scrapeMatchDetails(matchUrl);
    
    console.log('\n=== MATCH INFO ===');
    console.log('Home Team:', matchDetails.homeTeam);
    console.log('Away Team:', matchDetails.awayTeam);
    console.log('Score:', `${matchDetails.score.home} - ${matchDetails.score.away}`);
    console.log('Status:', matchDetails.status);
    
    console.log('\n=== GOALS SCORED/CONCEDED ===');
    console.log('Home Goals Scored:', matchDetails.homeTeamStats.goalsScored);
    console.log('Home Goals Conceded:', matchDetails.homeTeamStats.goalsConceded);
    console.log('Away Goals Scored:', matchDetails.awayTeamStats.goalsScored);
    console.log('Away Goals Conceded:', matchDetails.awayTeamStats.goalsConceded);
    
    console.log('\n=== OVER/UNDER STATISTICS (HOME) ===');
    console.log('Over 0.5%:', matchDetails.homeTeamStats.over05Percentage);
    console.log('Over 1.5%:', matchDetails.homeTeamStats.over15Percentage);
    console.log('Over 2.5%:', matchDetails.homeTeamStats.over25Percentage);
    console.log('Over 3.5%:', matchDetails.homeTeamStats.over35Percentage);
    
    console.log('\n=== OVER/UNDER STATISTICS (AWAY) ===');
    console.log('Over 0.5%:', matchDetails.awayTeamStats.over05Percentage);
    console.log('Over 1.5%:', matchDetails.awayTeamStats.over15Percentage);
    console.log('Over 2.5%:', matchDetails.awayTeamStats.over25Percentage);
    console.log('Over 3.5%:', matchDetails.awayTeamStats.over35Percentage);
    
    console.log('\n=== WIN RATES ===');
    console.log('Home Win %:', matchDetails.homeTeamStats.winPercentage);
    console.log('Home Draw %:', matchDetails.homeTeamStats.drawPercentage);
    console.log('Home Loss %:', matchDetails.homeTeamStats.lossPercentage);
    console.log('Away Win %:', matchDetails.awayTeamStats.winPercentage);
    console.log('Away Draw %:', matchDetails.awayTeamStats.drawPercentage);
    console.log('Away Loss %:', matchDetails.awayTeamStats.lossPercentage);
    
    console.log('\n=== HOME/AWAY SPECIFIC WIN RATES ===');
    console.log('Home Team Win % (Home games):', matchDetails.homeTeamStats.winPercentageHome);
    console.log('Home Team Win % (Away games):', matchDetails.homeTeamStats.winPercentageAway);
    console.log('Away Team Win % (Home games):', matchDetails.awayTeamStats.winPercentageHome);
    console.log('Away Team Win % (Away games):', matchDetails.awayTeamStats.winPercentageAway);
    
    console.log('\n=== ODDS DATA ===');
    console.log('Odds:', matchDetails.oddsData);
    
    console.log('\n=== LEAGUE POSITIONS ===');
    console.log('Home Team Position:', matchDetails.homeTeamLeaguePosition);
    console.log('Away Team Position:', matchDetails.awayTeamLeaguePosition);
    console.log('Total Teams:', matchDetails.totalTeamsInLeague);
    
    // Check if critical data is missing (all zeros)
    const criticalChecks = {
      'Over/Under stats': matchDetails.homeTeamStats.over05Percentage || matchDetails.homeTeamStats.over15Percentage || matchDetails.homeTeamStats.over25Percentage,
      'Goals scored': matchDetails.homeTeamStats.goalsScored || matchDetails.awayTeamStats.goalsScored,
      'Odds data': matchDetails.oddsData?.odds1 || matchDetails.oddsData?.oddsX || matchDetails.oddsData?.odds2,
    };
    
    console.log('\n=== CRITICAL DATA CHECK ===');
    for (const [check, value] of Object.entries(criticalChecks)) {
      console.log(`${check}:`, value ? '✓ PRESENT' : '✗ MISSING');
    }
    
    console.log('\n=== SUCCESS ===');
    
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

testScraperFix().then(() => {
  process.exit(0);
});
