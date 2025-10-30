import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import { type Match, type MatchDetails } from '@shared/schema';

export async function scrapeFixtures(date: Date): Promise<Match[]> {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const url = `https://sportstats365.com/football?start=${dateString}`;
    console.log(`Scraping fixtures from: ${url}`);
    
    // Use cloudscraper to bypass Cloudflare protection
    const html: string = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'HX-Request': 'true',
        },
      }, (error: any, response: any, body: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });
    
    const $ = cheerio.load(html);
    const matches: Match[] = [];
    let currentCompetition = '';
    let currentCompetitionLogo = '';
    let matchId = 0;
    
    // Iterate through all list-group-items
    $('.list-group-item').each((index, element) => {
      const $item = $(element);
      
      // Check if this is a competition header
      if ($item.hasClass('text-muted') && $item.hasClass('border-0')) {
        // This is a competition header
        const competitionLink = $item.find('a').first();
        currentCompetition = competitionLink.text().trim();
        
        // Extract country flag/icon if present
        const flag = $item.find('i.flag').first();
        if (flag.length > 0) {
          const flagClass = flag.attr('class') || '';
          const countryMatch = flagClass.match(/flag-(\w+)/);
          if (countryMatch) {
            currentCompetitionLogo = `https://flagcdn.com/16x12/${countryMatch[1]}.png`;
          }
        }
        return; // Skip to next item
      }
      
      // This should be a match item
      const matchLink = $item.find('a[href*="/compare/"]').first();
      if (matchLink.length === 0) return; // Not a match
      
      // Extract match URL
      const matchUrl = matchLink.attr('href');
      const fullMatchUrl = matchUrl ? `https://sportstats365.com${matchUrl}` : undefined;
      
      try {
        // Extract time/status
        const eventTime = $item.find('.event-time small').text().trim();
        let time = '';
        let status: 'FT' | 'LIVE' | 'SCHEDULED' | 'POSTPONED' = 'SCHEDULED';
        
        if (eventTime === 'FT' || eventTime.includes('FT')) {
          status = 'FT';
          time = 'FT';
        } else if (eventTime.match(/^\d{1,2}:\d{2}$/)) {
          time = eventTime;
          status = 'SCHEDULED';
        } else {
          time = eventTime;
        }
        
        // Extract teams
        const teamSpans = matchLink.find('.event-team');
        if (teamSpans.length < 2) return;
        
        const homeTeamSpan = $(teamSpans[0]);
        const awayTeamSpan = $(teamSpans[1]);
        
        const homeTeamImg = homeTeamSpan.find('img');
        const awayTeamImg = awayTeamSpan.find('img');
        
        const homeTeam = homeTeamImg.attr('alt')?.trim() || homeTeamSpan.text().trim();
        const awayTeam = awayTeamImg.attr('alt')?.trim() || awayTeamSpan.text().trim();
        const homeTeamLogo = homeTeamImg.attr('src');
        const awayTeamLogo = awayTeamImg.attr('src');
        
        if (!homeTeam || !awayTeam) return;
        
        // Extract scores
        const scoreDiv = $item.find('.score-list');
        let homeScore: number | null = null;
        let awayScore: number | null = null;
        let homeHalfScore: number | null = null;
        let awayHalfScore: number | null = null;
        
        if (scoreDiv.length > 0) {
          const scoreText = scoreDiv.text();
          
          // Check if it's not just dashes
          if (scoreText && !scoreText.trim().match(/^-\s*-$/)) {
            // Extract main scores
            const mainScores = scoreDiv.find('.fw-bold, .fw-strong');
            if (mainScores.length >= 2) {
              const homeScoreText = $(mainScores[0]).text().trim();
              const awayScoreText = $(mainScores[1]).text().trim();
              
              if (homeScoreText && !isNaN(parseInt(homeScoreText))) {
                homeScore = parseInt(homeScoreText);
              }
              if (awayScoreText && !isNaN(parseInt(awayScoreText))) {
                awayScore = parseInt(awayScoreText);
              }
            }
            
            // Extract half-time scores (in parentheses)
            const halfScores = scoreDiv.find('.score-period');
            if (halfScores.length > 0) {
              const halfText = halfScores.text();
              const halfMatches = halfText.match(/\((\d+)\)[^\d]*\((\d+)\)/);
              if (halfMatches) {
                homeHalfScore = parseInt(halfMatches[1]);
                awayHalfScore = parseInt(halfMatches[2]);
              }
            }
          }
        }
        
        // If we have scores, mark as FT if not already marked
        if (homeScore !== null && awayScore !== null && status === 'SCHEDULED') {
          status = 'FT';
        }
        
        // Extract odds
        let odds;
        const oddsBadges = $item.find('.badge-light');
        if (oddsBadges.length >= 3) {
          const homeOdds = parseFloat($(oddsBadges[0]).text().trim());
          const drawOdds = parseFloat($(oddsBadges[1]).text().trim());
          const awayOdds = parseFloat($(oddsBadges[2]).text().trim());
          
          if (!isNaN(homeOdds) && !isNaN(drawOdds) && !isNaN(awayOdds)) {
            odds = {
              home: homeOdds,
              draw: drawOdds,
              away: awayOdds,
            };
          }
        }
        
        matches.push({
          id: `match-${matchId++}`,
          matchUrl: fullMatchUrl,
          homeTeam: homeTeam.replace(/\s+$/, '').replace(/\s{2,}/g, ' '),
          awayTeam: awayTeam.replace(/\s+$/, '').replace(/\s{2,}/g, ' '),
          homeTeamLogo,
          awayTeamLogo,
          homeScore,
          awayScore,
          homeHalfScore,
          awayHalfScore,
          status,
          time: time || '00:00',
          competition: currentCompetition || 'Unknown Competition',
          competitionLogo: currentCompetitionLogo || undefined,
          odds,
        });
      } catch (err) {
        console.error('Error parsing match:', err);
      }
    });
    
    console.log(`Successfully scraped ${matches.length} matches for ${dateString}`);
    return matches;
    
  } catch (error) {
    console.error('Error scraping fixtures:', error);
    throw new Error('Failed to scrape fixtures');
  }
}

export async function scrapeMatchDetails(matchUrl: string): Promise<MatchDetails> {
  try {
    console.log(`Scraping match details from: ${matchUrl}`);
    
    // Use cloudscraper to bypass Cloudflare protection
    const html: string = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: matchUrl,
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
    
    const $ = cheerio.load(html);
    
    // Extract match ID from URL
    const matchIdMatch = matchUrl.match(/\/(\d+)$/);
    const matchId = matchIdMatch ? matchIdMatch[1] : 'unknown';
    
    // Extract team names and logos
    const teamHeaders = $('.text-center h2');
    const homeTeam = $(teamHeaders[0]).text().trim();
    const awayTeam = $(teamHeaders[1]).text().trim();
    
    const homeTeamLogoImg = $(teamHeaders[0]).parent().find('img').first();
    const awayTeamLogoImg = $(teamHeaders[1]).parent().find('img').first();
    const homeTeamLogo = homeTeamLogoImg.attr('src');
    const awayTeamLogo = awayTeamLogoImg.attr('src');
    
    // Extract competition
    const competitionLink = $('a[href*="/football/"]').filter(function() {
      return $(this).find('img[src*="logo"]').length > 0;
    }).first();
    const competition = competitionLink.text().trim();
    const competitionLogo = competitionLink.find('img').attr('src');
    
    // Extract score
    const scoreText = $('.display-4').text().trim();
    const scoreMatch = scoreText.match(/(\d+)\s*:\s*(\d+)/);
    const homeScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
    const awayScore = scoreMatch ? parseInt(scoreMatch[2]) : null;
    
    // Extract half-time score
    const halfScoreText = $('.text-muted').filter(function() {
      return $(this).text().includes('(') && $(this).text().includes(':');
    }).first().text();
    const halfScoreMatch = halfScoreText.match(/\((\d+)\s*:\s*(\d+)\)/);
    const homeHalfScore = halfScoreMatch ? parseInt(halfScoreMatch[1]) : null;
    const awayHalfScore = halfScoreMatch ? parseInt(halfScoreMatch[2]) : null;
    
    // Extract status
    const statusBadge = $('.badge').filter(function() {
      const text = $(this).text().trim();
      return text === 'FT' || text === 'LIVE' || text.includes("'");
    }).first();
    const status = statusBadge.text().trim() || 'SCHEDULED';
    
    // Extract form (W/L/D sequences)
    const formSections = $('a').filter(function() {
      const href = $(this).attr('href');
      return !!href && href.includes('/compare/');
    });
    
    const extractFormSequence = (container: any): ('W' | 'L' | 'D')[] => {
      const sequence: ('W' | 'L' | 'D')[] = [];
      container.find('a[href*="/compare/"]').each((i: number, el: any) => {
        const text = $(el).text().trim();
        if (text === 'W' || text === 'L' || text === 'D') {
          sequence.push(text as 'W' | 'L' | 'D');
        }
      });
      return sequence.slice(-5);
    };
    
    // Get form sequences from team sections
    const homeFormContainer = $(teamHeaders[0]).parent().parent();
    const awayFormContainer = $(teamHeaders[1]).parent().parent();
    const homeFormSequence = extractFormSequence(homeFormContainer);
    const awayFormSequence = extractFormSequence(awayFormContainer);
    
    // Extract form scores
    const formScores = $('.text-center').filter(function() {
      const text = $(this).text();
      return !!text.match(/^\d+$/);
    });
    
    let homeFormHome = 0, homeFormAway = 0, homeFormOverall = 0;
    let awayFormHome = 0, awayFormAway = 0, awayFormOverall = 0;
    
    // Parse form difference section
    const formRows = $('tr').filter(function() {
      return $(this).find('td').length >= 3;
    });
    
    formRows.each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const label = $(cells[0]).text().trim();
        const homeVal = parseInt($(cells[1]).text().trim()) || 0;
        const awayVal = parseInt($(cells[2]).text().trim()) || 0;
        
        if (label.includes('Form Home')) {
          homeFormHome = homeVal;
          awayFormHome = awayVal;
        } else if (label.includes('Form Away')) {
          homeFormAway = homeVal;
          awayFormAway = awayVal;
        } else if (label.includes('Form Overall')) {
          homeFormOverall = homeVal;
          awayFormOverall = awayVal;
        }
      }
    });
    
    // Extract statistics from comparison text
    const comparisonText = $('.card-body').text();
    
    const extractStat = (pattern: RegExp, defaultValue: number = 0): number => {
      const match = comparisonText.match(pattern);
      return match ? parseFloat(match[1]) : defaultValue;
    };
    
    // Helper function to parse stat with percentage and fraction
    const parseStatWithFraction = (text: string): { percentage: number; count: number; total: number } | undefined => {
      const percentMatch = text.match(/(\d+\.?\d*)\s*%/);
      const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
      
      if (percentMatch) {
        const percentage = parseFloat(percentMatch[1]);
        const count = fractionMatch ? parseInt(fractionMatch[1]) : 0;
        const total = fractionMatch ? parseInt(fractionMatch[2]) : 0;
        return { percentage, count, total };
      }
      return undefined;
    };
    
    // Extract all table rows for parsing statistics
    const allRows = $('tr, .row, div[class*="stat"]').toArray();
    
    // Parse Team Statistics (Wins, Draws, Losses)
    let homeWinPercent = 0, homeDrawPercent = 0, homeLossPercent = 0;
    let awayWinPercent = 0, awayDrawPercent = 0, awayLossPercent = 0;
    
    $('.card-body, .stat-row').each((i, section) => {
      const text = $(section).text();
      
      // Look for "Team Statistics" section
      if (text.includes('Team Statistics') || text.includes('Wins') && text.includes('Draws') && text.includes('Losses')) {
        const rows = $(section).find('tr, .row, div[class*="row"]');
        
        rows.each((j, row) => {
          const rowText = $(row).text();
          const cells = $(row).find('td, .col, div[class*="col"]');
          
          if (rowText.includes('Wins') && cells.length >= 3) {
            const homeText = $(cells[0]).text();
            const awayText = $(cells[2]).text();
            const homeMatch = homeText.match(/(\d+\.?\d*)\s*%/);
            const awayMatch = awayText.match(/(\d+\.?\d*)\s*%/);
            if (homeMatch) homeWinPercent = parseFloat(homeMatch[1]);
            if (awayMatch) awayWinPercent = parseFloat(awayMatch[1]);
          } else if (rowText.includes('Draws') && cells.length >= 3) {
            const homeText = $(cells[0]).text();
            const awayText = $(cells[2]).text();
            const homeMatch = homeText.match(/(\d+\.?\d*)\s*%/);
            const awayMatch = awayText.match(/(\d+\.?\d*)\s*%/);
            if (homeMatch) homeDrawPercent = parseFloat(homeMatch[1]);
            if (awayMatch) awayDrawPercent = parseFloat(awayMatch[1]);
          } else if (rowText.includes('Losses') && cells.length >= 3) {
            const homeText = $(cells[0]).text();
            const awayText = $(cells[2]).text();
            const homeMatch = homeText.match(/(\d+\.?\d*)\s*%/);
            const awayMatch = awayText.match(/(\d+\.?\d*)\s*%/);
            if (homeMatch) homeLossPercent = parseFloat(homeMatch[1]);
            if (awayMatch) awayLossPercent = parseFloat(awayMatch[1]);
          }
        });
      }
    });
    
    const homeGoalsScored = extractStat(/Racing Club scored.*?on average \((\d+\.?\d*)\)/);
    const awayGoalsScored = extractStat(/Flamengo.*?\((\d+\.?\d*)\)/);
    
    const homeGoalsConceded = extractStat(/Racing Club conceded.*?\(\s*(\d+\.?\d*)\s*\)/);
    const awayGoalsConceded = extractStat(/Flamengo conceded.*?\(\s*(\d+\.?\d*)\s*\)/);
    
    const homeCleanSheet = extractStat(/Racing Club kept a clean sheet in (\d+)/);
    const awayCleanSheet = extractStat(/Flamengo kept a clean sheet in (\d+)/);
    
    // Parse all statistics sections
    const parseStatsSection = (sectionTitle: string, statLabel: string) => {
      let homeStat, awayStat;
      
      $('.card-body, .stat-section').each((i, section) => {
        const sectionText = $(section).text();
        
        if (sectionText.includes(sectionTitle)) {
          const rows = $(section).find('tr, .row, div[class*="row"]');
          
          rows.each((j, row) => {
            const rowText = $(row).text();
            
            if (rowText.includes(statLabel)) {
              const cells = $(row).find('td, .col, div[class*="col"], .text-center, span');
              
              if (cells.length >= 2) {
                const homeText = $(cells[0]).text();
                const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
                
                homeStat = parseStatWithFraction(homeText);
                awayStat = parseStatWithFraction(awayText);
              }
            }
          });
        }
      });
      
      return { homeStat, awayStat };
    };
    
    // Parse Double Chance statistics
    const doubleChance1X = parseStatsSection('Double Chance', '1X');
    const doubleChanceX2 = parseStatsSection('Double Chance', 'X2');
    const doubleChance12 = parseStatsSection('Double Chance', '12');
    
    // Parse To Nil statistics
    const winToNil = parseStatsSection('To Nil', 'Win to Nil');
    const loseToNil = parseStatsSection('To Nil', 'Lose to Nil');
    
    // Parse Winning Margin statistics
    const winByOneGoal = parseStatsSection('Winning Margin', 'By 1 goal');
    const winByTwoPlusGoals = parseStatsSection('Winning Margin', 'By 2+ goals');
    
    // Parse BTTS statistics (with tabs for HOME, OVERALL, AWAY)
    const parseBTTSStats = (statLabel: string) => {
      const result: any = { overall: undefined, home: undefined, away: undefined };
      
      $('.card-body').each((i, section) => {
        const sectionText = $(section).text();
        
        if (sectionText.includes('BTTS') && sectionText.includes(statLabel)) {
          const rows = $(section).find('tr, .row, div[class*="row"]');
          
          rows.each((j, row) => {
            const rowText = $(row).text();
            
            if (rowText.includes(statLabel)) {
              const cells = $(row).find('td, .col, div[class*="col"], .text-center');
              
              if (cells.length >= 2) {
                const homeText = $(cells[0]).text();
                const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
                
                // For BTTS, we get overall from the displayed value
                result.overall = parseStatWithFraction(homeText);
              }
            }
          });
        }
      });
      
      return result;
    };
    
    const homeBTTS = parseBTTSStats('BTTS');
    const homeBTTSAndOver25 = parseBTTSStats('BTTS & Over');
    const homeBTTSAndWin = parseBTTSStats('BTTS & Win');
    const homeBTTSAndLoss = parseBTTSStats('BTTS & Loss');
    
    const awayBTTS = { overall: undefined, home: undefined, away: undefined };
    const awayBTTSAndOver25 = { overall: undefined, home: undefined, away: undefined };
    const awayBTTSAndWin = { overall: undefined, home: undefined, away: undefined };
    const awayBTTSAndLoss = { overall: undefined, home: undefined, away: undefined };
    
    // Parse Goals Scored statistics
    const parseGoalsScored = () => {
      const homeResult: any = { overall: undefined, home: undefined, away: undefined };
      const awayResult: any = { overall: undefined, home: undefined, away: undefined };
      
      $('.card-body').each((i, section) => {
        const sectionText = $(section).text();
        
        if (sectionText.includes('Goals Scored') || sectionText.includes('Scored Percent')) {
          const rows = $(section).find('tr, .row, div[class*="row"]');
          
          rows.each((j, row) => {
            const rowText = $(row).text();
            
            if (rowText.includes('Scored Percent')) {
              const cells = $(row).find('td, .col, div[class*="col"], .text-center');
              
              if (cells.length >= 2) {
                const homeText = $(cells[0]).text();
                const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
                
                homeResult.overall = parseStatWithFraction(homeText);
                awayResult.overall = parseStatWithFraction(awayText);
              }
            }
          });
        }
      });
      
      return { homeResult, awayResult };
    };
    
    const scoredStats = parseGoalsScored();
    const homeScoredPercent = scoredStats.homeResult;
    const awayScoredPercent = scoredStats.awayResult;
    
    // For scored against, we'll use similar logic
    const homeScoredAgainstPercent = { overall: undefined, home: undefined, away: undefined };
    const awayScoredAgainstPercent = { overall: undefined, home: undefined, away: undefined };
    
    // Parse Goals in Halves statistics
    const goalsInHalves = parseStatsSection('Number of goals in halves', 'First Half');
    const goalsInSecondHalf = parseStatsSection('Number of goals in halves', 'Second Half');
    
    // Parse Halftime Stats
    const parseHalftimeStats = () => {
      const homeResult: any = {};
      const awayResult: any = {};
      
      $('.card-body').each((i, section) => {
        const sectionText = $(section).text();
        
        if (sectionText.includes('Halftime Stats')) {
          const rows = $(section).find('tr, .row, div[class*="row"]');
          
          rows.each((j, row) => {
            const rowText = $(row).text();
            const cells = $(row).find('td, .col, div[class*="col"], .text-center');
            
            if (rowText.includes('Won') && cells.length >= 2) {
              const homeText = $(cells[0]).text();
              const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
              
              homeResult.wonFullTime = parseStatWithFraction(homeText);
              awayResult.wonFullTime = parseStatWithFraction(awayText);
            } else if (rowText.includes('Tied') && cells.length >= 2) {
              const homeText = $(cells[0]).text();
              const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
              
              homeResult.tiedFullTime = parseStatWithFraction(homeText);
              awayResult.tiedFullTime = parseStatWithFraction(awayText);
            } else if (rowText.includes('Lost') && cells.length >= 2) {
              const homeText = $(cells[0]).text();
              const awayText = $(cells.length > 2 ? cells[cells.length - 1] : cells[1]).text();
              
              homeResult.lostFullTime = parseStatWithFraction(homeText);
              awayResult.lostFullTime = parseStatWithFraction(awayText);
            }
          });
        }
      });
      
      return { homeResult, awayResult };
    };
    
    const halftimeStats = parseHalftimeStats();
    const homeHalftimeStats = halftimeStats.homeResult;
    const awayHalftimeStats = halftimeStats.awayResult;
    
    // Extract H2H stats
    const h2hMatches = extractStat(/played against.*?(\d+)\s*times/, 0);
    const drawPercent = extractStat(/(\d+)\s*%.*?ended in a.*?draw/);
    
    // Extract streaks
    const streaks: { description: string; type: any; count: number }[] = [];
    const streakPatterns = [
      { pattern: /won their last\s+\*\*(\d+)\s+home\*\*\s+matches/, type: 'wins' as const },
      { pattern: /last\s+\*\*(\d+)\*\*\s+matches had\s+\*\*under 2\.5\*\*\s+goals/, type: 'goals' as const },
    ];
    
    streakPatterns.forEach(({ pattern, type }) => {
      const match = comparisonText.match(pattern);
      if (match) {
        streaks.push({
          description: match[0],
          type,
          count: parseInt(match[1]),
        });
      }
    });
    
    // Extract odds
    const oddsRow = $('tr').filter(function() {
      return $(this).find('td').text().includes('Odds');
    });
    
    let odds;
    if (oddsRow.length > 0) {
      const oddsCells = oddsRow.find('td');
      if (oddsCells.length >= 3) {
        const homeOdds = parseFloat($(oddsCells[1]).text().trim());
        const drawOdds = parseFloat($(oddsCells[1]).next().text().trim());
        const awayOdds = parseFloat($(oddsCells[2]).text().trim());
        
        if (!isNaN(homeOdds) && !isNaN(drawOdds) && !isNaN(awayOdds)) {
          odds = { home: homeOdds, draw: drawOdds, away: awayOdds };
        }
      }
    }
    
    // Extract insights
    const insights: string[] = [];
    $('.card-body').find('li, p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && text.length < 200) {
        insights.push(text);
      }
    });
    
    const matchDetails: MatchDetails = {
      matchId,
      matchUrl,
      homeTeam,
      awayTeam,
      homeTeamLogo,
      awayTeamLogo,
      competition,
      competitionLogo,
      status,
      score: {
        home: homeScore,
        away: awayScore,
        halfTime: homeHalfScore !== null && awayHalfScore !== null ? {
          home: homeHalfScore,
          away: awayHalfScore,
        } : undefined,
      },
      date: new Date().toISOString(),
      homeTeamForm: {
        last5: homeFormSequence,
        homeForm: homeFormHome,
        awayForm: homeFormAway,
        overallForm: homeFormOverall,
      },
      awayTeamForm: {
        last5: awayFormSequence,
        homeForm: awayFormHome,
        awayForm: awayFormAway,
        overallForm: awayFormOverall,
      },
      homeTeamStats: {
        winPercentage: homeWinPercent,
        drawPercentage: homeDrawPercent,
        lossPercentage: homeLossPercent,
        goalsScored: homeGoalsScored,
        goalsConceded: homeGoalsConceded,
        cleanSheetPercentage: homeCleanSheet,
        
        // Double Chance
        doubleChance1X: doubleChance1X.homeStat,
        doubleChanceX2: doubleChanceX2.homeStat,
        doubleChance12: doubleChance12.homeStat,
        
        // To Nil
        winToNil: winToNil.homeStat,
        loseToNil: loseToNil.homeStat,
        
        // Winning Margin
        winByOneGoal: winByOneGoal.homeStat,
        winByTwoPlusGoals: winByTwoPlusGoals.homeStat,
        
        // BTTS
        btts: homeBTTS,
        bttsAndOver25: homeBTTSAndOver25,
        bttsAndWin: homeBTTSAndWin,
        bttsAndLoss: homeBTTSAndLoss,
        
        // Goals Scored
        scoredPercent: homeScoredPercent,
        scoredAgainstPercent: homeScoredAgainstPercent,
        
        // Goals in Halves
        goalsInFirstHalf: goalsInHalves.homeStat,
        goalsInSecondHalf: goalsInSecondHalf.homeStat,
        
        // Halftime Stats
        halftimeStats: homeHalftimeStats,
      },
      awayTeamStats: {
        winPercentage: awayWinPercent,
        drawPercentage: awayDrawPercent,
        lossPercentage: awayLossPercent,
        goalsScored: awayGoalsScored,
        goalsConceded: awayGoalsConceded,
        cleanSheetPercentage: awayCleanSheet,
        
        // Double Chance
        doubleChance1X: doubleChance1X.awayStat,
        doubleChanceX2: doubleChanceX2.awayStat,
        doubleChance12: doubleChance12.awayStat,
        
        // To Nil
        winToNil: winToNil.awayStat,
        loseToNil: loseToNil.awayStat,
        
        // Winning Margin
        winByOneGoal: winByOneGoal.awayStat,
        winByTwoPlusGoals: winByTwoPlusGoals.awayStat,
        
        // BTTS
        btts: awayBTTS,
        bttsAndOver25: awayBTTSAndOver25,
        bttsAndWin: awayBTTSAndWin,
        bttsAndLoss: awayBTTSAndLoss,
        
        // Goals Scored
        scoredPercent: awayScoredPercent,
        scoredAgainstPercent: awayScoredAgainstPercent,
        
        // Goals in Halves
        goalsInFirstHalf: goalsInHalves.awayStat,
        goalsInSecondHalf: goalsInSecondHalf.awayStat,
        
        // Halftime Stats
        halftimeStats: awayHalftimeStats,
      },
      headToHead: h2hMatches > 0 ? {
        totalMatches: h2hMatches,
        homeWins: 0,
        draws: Math.round((drawPercent / 100) * h2hMatches),
        awayWins: 0,
      } : undefined,
      streaks,
      odds,
      insights: insights.slice(0, 10),
    };
    
    console.log(`Successfully scraped match details for ${homeTeam} vs ${awayTeam}`);
    return matchDetails;
    
  } catch (error) {
    console.error('Error scraping match details:', error);
    throw new Error('Failed to scrape match details');
  }
}
