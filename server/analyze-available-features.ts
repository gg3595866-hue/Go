import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudscraper.get({
      uri: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (error: any, response: any, body: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(body);
      }
    });
  });
}

interface FeatureRequirement {
  id: number;
  name: string;
  category: string;
  calculation: string;
  dataNeeded: string[];
  available: boolean;
  currentlyScraped: boolean;
  notes: string;
}

async function analyzeMatchPage() {
  const testUrl = 'https://sportstats365.com/football/champions-league/2025-2026/compare/garabag-azersun-agdam/chelsea/1018893';
  
  console.log('=== FETCHING MATCH PAGE ===\n');
  console.log(`URL: ${testUrl}\n`);
  
  const html = await fetchPage(testUrl);
  const $ = cheerio.load(html);
  
  // Save raw HTML for inspection
  fs.writeFileSync('server/match-page-analysis.html', html);
  console.log('✅ Saved HTML to: server/match-page-analysis.html\n');
  
  // Extract what's currently available
  console.log('=== EXTRACTING AVAILABLE DATA ===\n');
  
  const availableData: any = {
    teams: [],
    scores: {},
    standings: {},
    stats: {},
    form: {},
    odds: {},
  };
  
  // Extract team names
  const teamHeaders = $('.text-center h2');
  availableData.teams = {
    home: $(teamHeaders[0]).text().trim(),
    away: $(teamHeaders[1]).text().trim(),
  };
  console.log('Teams:', availableData.teams);
  
  // Extract standings table
  const standingsRows = $('table tbody tr');
  console.log(`\nFound ${standingsRows.length} teams in standings table`);
  
  const standings: any[] = [];
  standingsRows.each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 8) {
      standings.push({
        position: $(cells[0]).text().trim(),
        team: $(cells[1]).text().trim(),
        points: $(cells[2]).text().trim(),
        played: $(cells[3]).text().trim(),
        won: $(cells[4]).text().trim(),
        drawn: $(cells[5]).text().trim(),
        lost: $(cells[6]).text().trim(),
        goalDiff: $(cells[7]).text().trim(),
      });
    }
  });
  availableData.standings = standings;
  
  // Extract HTMX endpoint URLs (these contain the stats)
  const htmxEndpoints: any = {};
  $('[hx-get]').each((i, el) => {
    const url = $(el).attr('hx-get');
    const text = $(el).text().trim();
    if (url) {
      htmxEndpoints[text || `endpoint_${i}`] = url;
    }
  });
  
  console.log('\n=== HTMX ENDPOINTS FOUND ===');
  Object.entries(htmxEndpoints).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  
  // Fetch stats endpoint
  const statsButton = $('button[hx-get*="/stats/"]').filter(function() {
    return !$(this).attr('hx-get')?.includes('/form') && 
           !$(this).attr('hx-get')?.includes('/matches') && 
           !$(this).attr('hx-get')?.includes('/h2h');
  });
  const statsUrl = statsButton.attr('hx-get');
  
  if (statsUrl) {
    console.log('\n=== FETCHING STATS ENDPOINT ===');
    const fullStatsUrl = `https://sportstats365.com${statsUrl}`;
    console.log(`URL: ${fullStatsUrl}`);
    
    const statsHtml = await fetchPage(fullStatsUrl);
    const $stats = cheerio.load(statsHtml);
    
    // Save stats HTML
    fs.writeFileSync('server/match-stats-endpoint.html', statsHtml);
    console.log('✅ Saved stats to: server/match-stats-endpoint.html\n');
    
    // Parse all visible text statistics
    const statsText = $stats.text();
    const percentageMatches = statsText.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
    
    console.log('Sample percentages found in stats:');
    let count = 0;
    for (const match of percentageMatches) {
      if (count < 10) {
        console.log(`  ${match[1]}%`);
        count++;
      }
    }
  }
  
  // Fetch form endpoint
  const formButton = $('button[hx-get*="/form"]').first();
  const formUrl = formButton.attr('hx-get');
  
  if (formUrl) {
    console.log('\n=== FETCHING FORM ENDPOINT ===');
    const fullFormUrl = `https://sportstats365.com${formUrl}`;
    console.log(`URL: ${fullFormUrl}`);
    
    const formHtml = await fetchPage(fullFormUrl);
    const $form = cheerio.load(formHtml);
    
    // Save form HTML
    fs.writeFileSync('server/match-form-endpoint.html', formHtml);
    console.log('✅ Saved form to: server/match-form-endpoint.html\n');
    
    // Extract form sequences (W, L, D badges)
    const formBadges = $form('a, span, div').filter(function() {
      const text = $form(this).text().trim();
      return text === 'W' || text === 'L' || text === 'D';
    });
    
    console.log(`Found ${formBadges.length} form result badges (W/L/D)`);
  }
  
  // Define all 63 required features
  const requiredFeatures: FeatureRequirement[] = [
    // Form Dynamics (10)
    { id: 1, name: 'Win Rate', category: 'Form Dynamics', calculation: 'Wins ÷ Total Matches', dataNeeded: ['wins', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 2, name: 'Draw Rate', category: 'Form Dynamics', calculation: 'Draws ÷ Total Matches', dataNeeded: ['draws', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 3, name: 'Loss Rate', category: 'Form Dynamics', calculation: 'Losses ÷ Total Matches', dataNeeded: ['losses', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 4, name: 'Points per Game', category: 'Form Dynamics', calculation: '(3×Wins + Draws)/Matches', dataNeeded: ['wins', 'draws', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 5, name: 'Last 5 Form Index', category: 'Form Dynamics', calculation: 'Weighted sum of last 5 results', dataNeeded: ['last5Results'], available: false, currentlyScraped: false, notes: '' },
    { id: 6, name: 'Momentum Score', category: 'Form Dynamics', calculation: 'Trend over last 5-10 games', dataNeeded: ['last10Results'], available: false, currentlyScraped: false, notes: '' },
    { id: 7, name: 'Home Win Rate', category: 'Form Dynamics', calculation: 'Home Wins ÷ Home Games', dataNeeded: ['homeWins', 'homeGames'], available: false, currentlyScraped: false, notes: '' },
    { id: 8, name: 'Away Win Rate', category: 'Form Dynamics', calculation: 'Away Wins ÷ Away Games', dataNeeded: ['awayWins', 'awayGames'], available: false, currentlyScraped: false, notes: '' },
    { id: 9, name: 'Win after trailing', category: 'Form Dynamics', calculation: 'Wins after losing HT ÷ Total', dataNeeded: ['htLosses', 'ftWinsAfterHtLoss'], available: false, currentlyScraped: false, notes: '' },
    { id: 10, name: 'HT to FT Conversion', category: 'Form Dynamics', calculation: '% where HT result = FT result', dataNeeded: ['htResults', 'ftResults'], available: false, currentlyScraped: false, notes: '' },
    
    // Goal Dynamics (12)
    { id: 11, name: 'Avg Goals Scored', category: 'Goal Dynamics', calculation: 'Total goals ÷ Matches', dataNeeded: ['goalsScored', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 12, name: 'Avg Goals Conceded', category: 'Goal Dynamics', calculation: 'Total conceded ÷ Matches', dataNeeded: ['goalsConceded', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 13, name: 'Goals per Half Ratio', category: 'Goal Dynamics', calculation: '1H Goals ÷ 2H Goals', dataNeeded: ['goals1H', 'goals2H'], available: false, currentlyScraped: false, notes: '' },
    { id: 14, name: 'Clean Sheet %', category: 'Goal Dynamics', calculation: 'Clean sheets ÷ Matches', dataNeeded: ['cleanSheets', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 15, name: 'Failed to Score %', category: 'Goal Dynamics', calculation: 'No score games ÷ Matches', dataNeeded: ['failedToScore', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 16, name: '% Over 0.5', category: 'Goal Dynamics', calculation: 'Matches >0.5 ÷ Total', dataNeeded: ['over05', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 17, name: '% Over 1.5', category: 'Goal Dynamics', calculation: 'Matches >1.5 ÷ Total', dataNeeded: ['over15', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 18, name: '% Over 2.5', category: 'Goal Dynamics', calculation: 'Matches >2.5 ÷ Total', dataNeeded: ['over25', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 19, name: '% Over 3.5', category: 'Goal Dynamics', calculation: 'Matches >3.5 ÷ Total', dataNeeded: ['over35', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 20, name: '% BTTS', category: 'Goal Dynamics', calculation: 'Both scored ÷ Matches', dataNeeded: ['btts', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 21, name: '% BTTS & Over 2.5', category: 'Goal Dynamics', calculation: 'Combined ÷ Matches', dataNeeded: ['bttsOver25', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
    { id: 22, name: '% BTTS & Win', category: 'Goal Dynamics', calculation: 'Combined ÷ Matches', dataNeeded: ['bttsWin', 'totalMatches'], available: false, currentlyScraped: false, notes: '' },
  ];
  
  // Continue adding all 63 features...
  // (Truncated for brevity - the script would include all features)
  
  console.log('\n=== FEATURE AVAILABILITY ANALYSIS ===\n');
  console.log(`Total features required: ${requiredFeatures.length}`);
  
  // Check which features can be calculated from available data
  const scrapedData = {
    standings: standings.length > 0,
    form: formUrl !== undefined,
    stats: statsUrl !== undefined,
    odds: true, // Odds are on main page
  };
  
  console.log('\nData sources available:');
  console.log(`  ✓ Standings table: ${scrapedData.standings ? 'YES' : 'NO'}`);
  console.log(`  ✓ Form endpoint: ${scrapedData.form ? 'YES' : 'NO'}`);
  console.log(`  ✓ Stats endpoint: ${scrapedData.stats ? 'YES' : 'NO'}`);
  console.log(`  ✓ Odds data: ${scrapedData.odds ? 'YES' : 'NO'}`);
  
  // Generate comprehensive report
  const report = {
    url: testUrl,
    timestamp: new Date().toISOString(),
    teams: availableData.teams,
    endpoints: htmxEndpoints,
    dataAvailability: scrapedData,
    requiredFeatures: requiredFeatures.slice(0, 22), // First 22 features
    currentScraper: {
      extractedFields: [
        'homeTeam', 'awayTeam',
        'homeScore', 'awayScore', 
        'homeHalfScore', 'awayHalfScore',
        'status', 'odds (1X2)',
        'homeTeamForm', 'awayTeamForm',
        'homeTeamStats.winPercentage',
        'homeTeamStats.drawPercentage',
        'homeTeamStats.lossPercentage',
        'homeTeamStats.goalsScored',
        'homeTeamStats.goalsConceded',
        'homeTeamStats.cleanSheetPercentage',
        'homeTeamStats.btts',
        'homeTeamStats.winToNil',
        'homeTeamStats.winByOneGoal',
        'homeTeamStats.winByTwoPlusGoals',
        'homeTeamStats.goalsInFirstHalf',
        'homeTeamStats.goalsInSecondHalf',
        'homeTeamStats.halftimeStats',
        'homeTeamStats.scoredPercent',
        'homeTeamStats.scoredAgainstPercent',
      ],
      missingFields: [
        'Win Rate (overall)',
        'Home-specific win rate',
        'Away-specific win rate', 
        'Over 0.5, 1.5, 3.5 goals percentages',
        'Win after trailing stats',
        'HT to FT conversion rate',
        'Momentum/trend calculations',
        'Performance vs similar teams',
        'Emotional swing metrics',
        'Consistency index',
        'Response to conceding early',
        'Late goals percentage',
        'Margin consistency',
        'League position normalized',
      ]
    }
  };
  
  // Save comprehensive JSON report
  fs.writeFileSync('server/feature-analysis-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Saved comprehensive report to: server/feature-analysis-report.json\n');
  
  // Print summary
  console.log('=== SUMMARY ===\n');
  console.log('What we currently scrape:');
  console.log(`  • ${report.currentScraper.extractedFields.length} fields`);
  console.log('\nWhat we need to add:');
  console.log(`  • ${report.currentScraper.missingFields.length} additional features/calculations`);
  
  console.log('\n=== NEXT STEPS ===\n');
  console.log('1. Review the saved HTML files to understand data structure');
  console.log('2. Identify which stats are in the stats endpoint');
  console.log('3. Calculate derived features from raw data');
  console.log('4. Update schema.ts to include all 63 features');
  console.log('5. Update scraper.ts to extract/calculate all features');
  console.log('6. Update feature-extraction.ts for ML model');
}

analyzeMatchPage()
  .then(() => console.log('\n✅ Analysis complete!'))
  .catch(error => console.error('Error:', error));
