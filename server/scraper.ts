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
    
    // Extract score-like patterns and status from body text for fallback
    const bodyText = $('body').text();
    const scorePattern = /(\d+)\s*[:\-]\s*(\d+)/g;
    const foundScores = bodyText.match(scorePattern);
    const hasFT = bodyText.includes('FT');
    const hasLive = bodyText.includes('LIVE');
    
    // Extract the stats URL from HTMX attributes
    const statsButton = $('button[hx-get*="/stats/"]').filter(function() {
      return !$(this).attr('hx-get')?.includes('/form') && 
             !$(this).attr('hx-get')?.includes('/matches') && 
             !$(this).attr('hx-get')?.includes('/h2h');
    });
    const statsUrl = statsButton.attr('hx-get');
    
    // Extract the form URL from HTMX attributes
    const formButton = $('button[hx-get*="/form"]').first();
    const formUrl = formButton.attr('hx-get');
    
    // Fetch the stats content from HTMX endpoint
    let statsHtml = '';
    if (statsUrl) {
      const fullStatsUrl = `https://sportstats365.com${statsUrl}`;
      console.log(`Fetching stats from HTMX endpoint: ${fullStatsUrl}`);
      
      statsHtml = await new Promise((resolve, reject) => {
        cloudscraper.get({
          uri: fullStatsUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'HX-Request': 'true',
          },
        }, (error: any, response: any, body: string) => {
          if (error) {
            console.warn('Failed to fetch stats HTML:', error.message);
            resolve('');
          } else {
            resolve(body);
          }
        });
      });
      
      // Load the stats HTML into the main document
      if (statsHtml) {
        $('#htmx_content').html(statsHtml);
      }
    }
    
    // Fetch the form content from HTMX endpoint
    let formHtml = '';
    if (formUrl) {
      const fullFormUrl = `https://sportstats365.com${formUrl}`;
      console.log(`Fetching form from HTMX endpoint: ${fullFormUrl}`);
      
      formHtml = await new Promise((resolve, reject) => {
        cloudscraper.get({
          uri: fullFormUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'HX-Request': 'true',
          },
        }, (error: any, response: any, body: string) => {
          if (error) {
            console.warn('Failed to fetch form HTML:', error.message);
            resolve('');
          } else {
            resolve(body);
          }
        });
      });
    }
    
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
    
    // Extract competition from URL (more reliable than HTML parsing)
    // URL format: https://sportstats365.com/football/primera-division-co/2025/compare/...
    let competition = '';
    let competitionLogo = '';
    
    const urlMatch = matchUrl.match(/\/football\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      // Convert slug to readable name
      competition = urlMatch[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // Also try to get competition logo from HTML
    const competitionLink = $('a[href*="/football/"]').filter(function() {
      return $(this).find('img[src*="logo"]').length > 0;
    }).first();
    
    if (competitionLink.length > 0) {
      const linkText = competitionLink.text().trim();
      if (linkText) {
        competition = linkText; // Use HTML text if available (more accurate)
      }
      competitionLogo = competitionLink.find('img').attr('src') || '';
    }
    
    // Extract score - try .display-4 first, fallback to first score pattern in body
    let scoreText = $('.display-4').text().trim();
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    
    if (!scoreText && foundScores && foundScores.length > 0) {
      scoreText = foundScores[0];
    }
    
    const scoreMatch = scoreText.match(/(\d+)\s*[:]\s*(\d+)/);
    homeScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
    awayScore = scoreMatch ? parseInt(scoreMatch[2]) : null;
    
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
    console.log('Status badge text:', statusBadge.text().trim());
    
    let status: 'FT' | 'LIVE' | 'SCHEDULED' | 'POSTPONED' = 'SCHEDULED';
    const badgeText = statusBadge.text().trim();
    
    if (badgeText === 'FT' || badgeText === 'LIVE') {
      status = badgeText;
    } else if (!badgeText && hasFT && homeScore !== null && awayScore !== null) {
      // If badge is empty but we found "FT" in the body and have a score, assume FT
      status = 'FT';
      console.log('Using FT status from body text');
    } else if (!badgeText && hasLive) {
      status = 'LIVE';
      console.log('Using LIVE status from body text');
    }
    
    console.log('Final status:', status);
    
    // Extract form (W/L/D sequences) - will be extracted from form HTML later
    let homeFormSequence: ('W' | 'L' | 'D')[] = [];
    let awayFormSequence: ('W' | 'L' | 'D')[] = [];
    
    // Extract form scores
    let homeFormHome = 0, homeFormAway = 0, homeFormOverall = 0;
    let awayFormHome = 0, awayFormAway = 0, awayFormOverall = 0;
    
    // Parse form data from the form HTML endpoint
    if (formHtml) {
      const $form = cheerio.load(formHtml);
      
      // Extract last 5 form sequences from badges or links
      // Look for elements containing W, L, D (usually in badges or links)
      const extractLast5FromHtml = (htmlContent: cheerio.CheerioAPI): { home: ('W' | 'L' | 'D')[]; away: ('W' | 'L' | 'D')[] } => {
        const home: ('W' | 'L' | 'D')[] = [];
        const away: ('W' | 'L' | 'D')[] = [];
        
        // Look for all elements with text W, L, or D
        const wldElements = htmlContent('a, span, div').filter(function() {
          const text = htmlContent(this).text().trim();
          return text === 'W' || text === 'L' || text === 'D';
        });
        
        console.log('Found', wldElements.length, 'W/L/D elements in form HTML');
        
        // The first half are typically for home team, second half for away team
        const halfPoint = Math.floor(wldElements.length / 2);
        wldElements.each((i, el) => {
          const text = htmlContent(el).text().trim() as 'W' | 'L' | 'D';
          if (i < halfPoint) {
            home.push(text);
          } else {
            away.push(text);
          }
        });
        
        return {
          home: home.slice(-5),
          away: away.slice(-5)
        };
      };
      
      const last5 = extractLast5FromHtml($form);
      homeFormSequence = last5.home;
      awayFormSequence = last5.away;
      console.log('Extracted last 5 form:', { home: homeFormSequence, away: awayFormSequence });
      
      // Parse form data from list-group-item elements
      const formRows = $form('.list-group-item');
      
      formRows.each((i, row) => {
        // Look for .col-4 or .col-6 elements which typically hold the values
        const cols = $form(row).find('.col-4, .col-6, .col-3');
        
        if (cols.length >= 3) {
          // Typically: [home value] [label] [away value]
          const homeText = $form(cols[0]).text().trim();
          const labelText = $form(cols[1]).text().trim();
          const awayText = $form(cols[2]).text().trim();
          
          // Extract numeric values
          const homeVal = parseInt(homeText.match(/\d+/)?.[0] || '0') || 0;
          const awayVal = parseInt(awayText.match(/\d+/)?.[0] || '0') || 0;
          
          if (labelText.includes('Form Home')) {
            homeFormHome = homeVal;
            awayFormHome = awayVal;
          } else if (labelText.includes('Form Away')) {
            homeFormAway = homeVal;
            awayFormAway = awayVal;
          } else if (labelText.includes('Form Overall')) {
            homeFormOverall = homeVal;
            awayFormOverall = awayVal;
          }
        }
      });
    }
    
    // Extract statistics from comparison text
    const comparisonText = $('.card-body').text();
    
    const extractStat = (pattern: RegExp, defaultValue: number = 0): number => {
      const match = comparisonText.match(pattern);
      return match ? parseFloat(match[1]) : defaultValue;
    };
    
    // Helper function to parse stat from a div.col-4 element
    const parseStatFromCol = (colElement: any): { percentage: number; count: number; total: number } | undefined => {
      // Find the percentage span (has text-info, text-danger, or text-success class) - not the badge span
      const percentSpan = $(colElement).find('span[class*="text-"]').first();
      const percentText = percentSpan.text();
      const fractionText = $(colElement).find('small').first().text();
      
      const percentMatch = percentText.match(/(\d+\.?\d*)\s*%/);
      const fractionMatch = fractionText.match(/(\d+)\s*\/\s*(\d+)/);
      
      if (percentMatch) {
        const percentage = parseFloat(percentMatch[1]);
        const count = fractionMatch ? parseInt(fractionMatch[1]) : 0;
        const total = fractionMatch ? parseInt(fractionMatch[2]) : 0;
        return { percentage, count, total };
      }
      return undefined;
    };
    
    // Helper to find a stat section by header text
    const findStatSection = (headerText: string) => {
      return $('.card-header, .compare-header').filter(function() {
        return $(this).text().includes(headerText);
      }).closest('.card, section');
    };
    
    // Helper to parse a list-group-item with 3 columns (home stat, label, away stat)
    const parseStatRow = (row: any): { home: any; label: string; away: any } => {
      const cols = $(row).find('.col-4, .col-6');
      if (cols.length >= 3) {
        return {
          home: parseStatFromCol(cols[0]),
          label: $(cols[1]).text().trim(),
          away: parseStatFromCol(cols[2])
        };
      } else if (cols.length === 2) {
        // Sometimes only 2 columns for correct score etc
        return {
          home: parseStatFromCol(cols[0]),
          label: '',
          away: parseStatFromCol(cols[1])
        };
      }
      return { home: undefined, label: '', away: undefined };
    };
    
    // Extract all table rows for parsing statistics
    const allRows = $('tr, .row, div[class*="stat"]').toArray();
    
    // Parse Team Statistics (Wins, Draws, Losses)
    let homeWinPercent = 0, homeDrawPercent = 0, homeLossPercent = 0;
    let awayWinPercent = 0, awayDrawPercent = 0, awayLossPercent = 0;
    
    const teamStatsSection = findStatSection('Team Statistics');
    teamStatsSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('Wins')) {
        homeWinPercent = stat.home?.percentage || 0;
        awayWinPercent = stat.away?.percentage || 0;
      } else if (stat.label.includes('Draws')) {
        homeDrawPercent = stat.home?.percentage || 0;
        awayDrawPercent = stat.away?.percentage || 0;
      } else if (stat.label.includes('Losses')) {
        homeLossPercent = stat.home?.percentage || 0;
        awayLossPercent = stat.away?.percentage || 0;
      }
    });
    
    const homeGoalsScored = extractStat(/Racing Club scored.*?on average \((\d+\.?\d*)\)/);
    const awayGoalsScored = extractStat(/Flamengo.*?\((\d+\.?\d*)\)/);
    
    const homeGoalsConceded = extractStat(/Racing Club conceded.*?\(\s*(\d+\.?\d*)\s*\)/);
    const awayGoalsConceded = extractStat(/Flamengo conceded.*?\(\s*(\d+\.?\d*)\s*\)/);
    
    const homeCleanSheet = extractStat(/Racing Club kept a clean sheet in (\d+)/);
    const awayCleanSheet = extractStat(/Flamengo kept a clean sheet in (\d+)/);
    
    // Parse Double Chance statistics
    let homeDoubleChance1X, homeDoubleChanceX2, homeDoubleChance12;
    let awayDoubleChance1X, awayDoubleChanceX2, awayDoubleChance12;
    
    const doubleChanceSection = findStatSection('Double Chance');
    doubleChanceSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('1X')) {
        homeDoubleChance1X = stat.home;
        awayDoubleChance1X = stat.away;
      } else if (stat.label.includes('X2')) {
        homeDoubleChanceX2 = stat.home;
        awayDoubleChanceX2 = stat.away;
      } else if (stat.label.includes('12')) {
        homeDoubleChance12 = stat.home;
        awayDoubleChance12 = stat.away;
      }
    });
    
    // Parse To Nil statistics
    let homeWinToNil, homeLoseToNil, awayWinToNil, awayLoseToNil;
    
    const toNilSection = findStatSection('To Nil');
    toNilSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('Win to Nil')) {
        homeWinToNil = stat.home;
        awayWinToNil = stat.away;
      } else if (stat.label.includes('Lose to Nil')) {
        homeLoseToNil = stat.home;
        awayLoseToNil = stat.away;
      }
    });
    
    // Parse Winning Margin statistics
    let homeWinByOne, homeWinByTwoPlus, awayWinByOne, awayWinByTwoPlus;
    
    const winningMarginSection = findStatSection('Winning Margin');
    winningMarginSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('By 1 goal')) {
        homeWinByOne = stat.home;
        awayWinByOne = stat.away;
      } else if (stat.label.includes('By 2+ goals') || stat.label.includes('By 2 or more goals')) {
        homeWinByTwoPlus = stat.home;
        awayWinByTwoPlus = stat.away;
      }
    });
    
    // Parse BTTS statistics
    let homeBTTS, homeBTTSAndOver25, homeBTTSAndWin, homeBTTSAndLoss;
    let awayBTTS, awayBTTSAndOver25, awayBTTSAndWin, awayBTTSAndLoss;
    
    const bttsSection = findStatSection('BTTS');
    bttsSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label === 'BTTS' || stat.label.match(/^BTTS$/)) {
        homeBTTS = { overall: stat.home };
        awayBTTS = { overall: stat.away };
      } else if (stat.label.includes('BTTS & Over')) {
        homeBTTSAndOver25 = { overall: stat.home };
        awayBTTSAndOver25 = { overall: stat.away };
      } else if (stat.label.includes('BTTS & Win')) {
        homeBTTSAndWin = { overall: stat.home };
        awayBTTSAndWin = { overall: stat.away };
      } else if (stat.label.includes('BTTS & Loss')) {
        homeBTTSAndLoss = { overall: stat.home };
        awayBTTSAndLoss = { overall: stat.away };
      }
    });
    
    // Parse Goals Scored statistics
    let homeScoredPercent, homeAgainstPercent, awayScoredPercent, awayAgainstPercent;
    
    const goalsScoredSection = findStatSection('Goals Scored');
    goalsScoredSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('Scored Percent')) {
        homeScoredPercent = { overall: stat.home };
        awayScoredPercent = { overall: stat.away };
      } else if (stat.label.includes('Scored Against')) {
        homeAgainstPercent = { overall: stat.home };
        awayAgainstPercent = { overall: stat.away };
      }
    });
    
    // Parse Goals in Halves statistics
    let homeFirstHalfGoals, homeSecondHalfGoals, awayFirstHalfGoals, awaySecondHalfGoals;
    
    const goalsInHalvesSection = findStatSection('Number of goals in halves');
    goalsInHalvesSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('First Half')) {
        homeFirstHalfGoals = stat.home;
        awayFirstHalfGoals = stat.away;
      } else if (stat.label.includes('Second Half')) {
        homeSecondHalfGoals = stat.home;
        awaySecondHalfGoals = stat.away;
      }
    });
    
    // Parse Halftime Stats
    let homeHalftimeWon, homeHalftimeTied, homeHalftimeLost;
    let awayHalftimeWon, awayHalftimeTied, awayHalftimeLost;
    
    const halftimeSection = findStatSection('Halftime');
    halftimeSection.find('.list-group-item').each((i, row) => {
      const stat = parseStatRow(row);
      if (stat.label.includes('Won')) {
        homeHalftimeWon = stat.home;
        awayHalftimeWon = stat.away;
      } else if (stat.label.includes('Tied')) {
        homeHalftimeTied = stat.home;
        awayHalftimeTied = stat.away;
      } else if (stat.label.includes('Lost')) {
        homeHalftimeLost = stat.home;
        awayHalftimeLost = stat.away;
      }
    });
    
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
        doubleChance1X: homeDoubleChance1X,
        doubleChanceX2: homeDoubleChanceX2,
        doubleChance12: homeDoubleChance12,
        
        // To Nil
        winToNil: homeWinToNil,
        loseToNil: homeLoseToNil,
        
        // Winning Margin
        winByOneGoal: homeWinByOne,
        winByTwoPlusGoals: homeWinByTwoPlus,
        
        // BTTS
        btts: homeBTTS,
        bttsAndOver25: homeBTTSAndOver25,
        bttsAndWin: homeBTTSAndWin,
        bttsAndLoss: homeBTTSAndLoss,
        
        // Goals Scored
        scoredPercent: homeScoredPercent,
        scoredAgainstPercent: homeAgainstPercent,
        
        // Goals in Halves
        goalsInFirstHalf: homeFirstHalfGoals,
        goalsInSecondHalf: homeSecondHalfGoals,
        
        // Halftime Stats
        halftimeStats: {
          wonFirstHalf: homeHalftimeWon,
          tiedFirstHalf: homeHalftimeTied,
          lostFirstHalf: homeHalftimeLost,
        },
      },
      awayTeamStats: {
        winPercentage: awayWinPercent,
        drawPercentage: awayDrawPercent,
        lossPercentage: awayLossPercent,
        goalsScored: awayGoalsScored,
        goalsConceded: awayGoalsConceded,
        cleanSheetPercentage: awayCleanSheet,
        
        // Double Chance
        doubleChance1X: awayDoubleChance1X,
        doubleChanceX2: awayDoubleChanceX2,
        doubleChance12: awayDoubleChance12,
        
        // To Nil
        winToNil: awayWinToNil,
        loseToNil: awayLoseToNil,
        
        // Winning Margin
        winByOneGoal: awayWinByOne,
        winByTwoPlusGoals: awayWinByTwoPlus,
        
        // BTTS
        btts: awayBTTS,
        bttsAndOver25: awayBTTSAndOver25,
        bttsAndWin: awayBTTSAndWin,
        bttsAndLoss: awayBTTSAndLoss,
        
        // Goals Scored
        scoredPercent: awayScoredPercent,
        scoredAgainstPercent: awayAgainstPercent,
        
        // Goals in Halves
        goalsInFirstHalf: awayFirstHalfGoals,
        goalsInSecondHalf: awaySecondHalfGoals,
        
        // Halftime Stats
        halftimeStats: {
          wonFirstHalf: awayHalftimeWon,
          tiedFirstHalf: awayHalftimeTied,
          lostFirstHalf: awayHalftimeLost,
        },
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

// League statistics type
export interface LeagueStats {
  homeWins: number;
  draws: number;
  awayWins: number;
  under25: number;
  over25: number;
  avgGoals: number;
}

// Cache for league statistics to avoid repeated scraping
const leagueStatsCache: Map<string, LeagueStats> = new Map();

// Function to extract league slug from competition name
function getLeagueSlug(competitionName: string): string {
  // Convert competition name to URL slug
  // Examples:
  // "Copa Libertadores" -> "copa-libertadores"
  // "Primera División" -> "primera-division"
  // "Premier League" -> "premier-league"
  
  return competitionName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9-]/g, '');
}

// Function to scrape league statistics
export async function scrapeLeagueStats(competitionName: string): Promise<LeagueStats> {
  // Handle empty or invalid competition names
  if (!competitionName || competitionName.trim() === '') {
    console.warn('Empty competition name provided, using default stats');
    return {
      homeWins: 45,
      draws: 27,
      awayWins: 28,
      under25: 53,
      over25: 47,
      avgGoals: 2.61
    };
  }
  
  const leagueSlug = getLeagueSlug(competitionName);
  
  // Check cache first
  if (leagueStatsCache.has(leagueSlug)) {
    console.log(`Using cached stats for ${competitionName}`);
    return leagueStatsCache.get(leagueSlug)!;
  }
  
  try {
    // Don't use year in URL - statistics are available without it
    const statsUrl = `https://sportstats365.com/football/${leagueSlug}`;
    
    console.log(`Scraping league stats for "${competitionName}" from: ${statsUrl}`);
    
    const html: string = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: statsUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'HX-Request': 'true',
          'HX-Current-URL': statsUrl,
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
    
    let homeWins = 0, draws = 0, awayWins = 0, under25 = 0, over25 = 0, avgGoals = 0;
    
    // Parse statistics from page content
    // Look for text containing the statistics in format: "H Home Wins 44.91 % D Draws 29.53 %..."
    $('*').each((i, elem) => {
      const text = $(elem).text().trim();
      
      // Look for elements that contain the statistics section
      if (text.includes('Home Wins') && text.includes('Draws') && text.includes('Away Wins')) {
        // Extract Home Wins
        const homeWinsMatch = text.match(/Home Wins\s+(\d+\.?\d+)\s*%/i);
        if (homeWinsMatch && homeWins === 0) {
          homeWins = parseFloat(homeWinsMatch[1]);
        }
        
        // Extract Draws
        const drawsMatch = text.match(/Draws\s+(\d+\.?\d+)\s*%/i);
        if (drawsMatch && draws === 0) {
          draws = parseFloat(drawsMatch[1]);
        }
        
        // Extract Away Wins
        const awayWinsMatch = text.match(/Away Wins\s+(\d+\.?\d+)\s*%/i);
        if (awayWinsMatch && awayWins === 0) {
          awayWins = parseFloat(awayWinsMatch[1]);
        }
        
        // Extract Under 2.5
        const under25Match = text.match(/Under 2\.5\s+(\d+\.?\d+)\s*%/i);
        if (under25Match && under25 === 0) {
          under25 = parseFloat(under25Match[1]);
        }
        
        // Extract Over 2.5
        const over25Match = text.match(/Over 2\.5\s+(\d+\.?\d+)\s*%/i);
        if (over25Match && over25 === 0) {
          over25 = parseFloat(over25Match[1]);
        }
        
        // Extract Avg Goals
        const avgGoalsMatch = text.match(/Avg Goals\s+(\d+\.?\d+)/i);
        if (avgGoalsMatch && avgGoals === 0) {
          avgGoals = parseFloat(avgGoalsMatch[1]);
        }
      }
    });
    
    // If no stats found, use defaults
    if (under25 === 0 && over25 === 0 && avgGoals === 0) {
      console.warn(`No league stats found for ${competitionName} at ${statsUrl}, using defaults`);
      const defaultStats: LeagueStats = {
        homeWins: 45,
        draws: 27,
        awayWins: 28,
        under25: 53,
        over25: 47,
        avgGoals: 2.61
      };
      leagueStatsCache.set(leagueSlug, defaultStats);
      return defaultStats;
    }
    
    const stats: LeagueStats = {
      homeWins,
      draws,
      awayWins,
      under25,
      over25,
      avgGoals
    };
    
    // Cache the results
    leagueStatsCache.set(leagueSlug, stats);
    
    console.log(`Scraped league stats for ${competitionName}:`, stats);
    
    return stats;
  } catch (error) {
    console.error(`Failed to scrape league stats for ${competitionName}:`, error);
    
    // Return default values if scraping fails
    return {
      homeWins: 45,
      draws: 27,
      awayWins: 28,
      under25: 53,
      over25: 47,
      avgGoals: 2.61
    };
  }
}

/**
 * Normalize text by converting accented characters to their base form
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c');
}

/**
 * Generate possible URL slug variations for a league name
 */
function generateSlugVariations(competitionName: string): string[] {
  const cleanedName = competitionName.replace(/\s+\d{4}\/\d{4}$/g, '').trim();
  const variations: string[] = [];
  
  // Helper to create slug from text
  const createSlug = (text: string) => {
    return normalizeText(text)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  // Variation 1: Full name as-is
  variations.push(createSlug(cleanedName));
  
  // Variation 2: Always try without first word (usually country name)
  // Examples: "Poland Ekstraklasa" → "ekstraklasa", "England Championship" → "championship"
  const words = cleanedName.split(/\s+/);
  if (words.length > 1) {
    const withoutFirstWord = words.slice(1).join(' ');
    variations.push(createSlug(withoutFirstWord));
  }
  
  // Variation 3: Try without last word (common suffixes like League, Liga, etc.)
  if (words.length > 1) {
    const withoutLastWord = words.slice(0, -1).join(' ');
    variations.push(createSlug(withoutLastWord));
  }
  
  // Variation 4: Remove common suffixes more aggressively
  const withoutSuffix = cleanedName
    .replace(/\s+(league|liga|division|championship|premiership|cup|serie|superliga|bundesliga)$/i, '')
    .trim();
  if (withoutSuffix !== cleanedName && withoutSuffix.length > 0) {
    variations.push(createSlug(withoutSuffix));
  }
  
  // Variation 5: For Turkish leagues, try with -tr suffix
  if (cleanedName.toLowerCase().includes('turkey') || cleanedName.toLowerCase().includes('turkish')) {
    const turkishVariation = createSlug(cleanedName.replace(/^turkey\s+/i, '').replace(/^turkish\s+/i, ''));
    variations.push(turkishVariation + '-tr');
    variations.push('super-league-tr'); // Common Turkish league slug
  }
  
  // Variation 6: For multi-word leagues, try just the main word
  // Example: "La Liga" → "la-liga" and "liga"
  if (words.length === 2) {
    variations.push(createSlug(words[0]));
    variations.push(createSlug(words[1]));
  }
  
  // Variation 7: For numbered leagues (e.g., "2. Liga SNL"), try different combinations
  if (cleanedName.match(/^\d+\./)) {
    // Remove the period after the number: "2. Liga SNL" → "2-liga-snl"
    const withoutPeriod = cleanedName.replace(/^(\d+)\./, '$1');
    variations.push(createSlug(withoutPeriod));
    
    // Try just the number and last word: "2. Liga SNL" → "2-snl"
    if (words.length > 2) {
      const firstWord = words[0].replace('.', '');
      const lastWord = words[words.length - 1];
      variations.push(createSlug(`${firstWord} ${lastWord}`));
    }
  }
  
  // Variation 8: For leagues with "Bank" or middle words, try different combinations
  // Example: "OTP Bank Liga NB1" → try "nb-i", "nb1", "otp-bank-liga", "liga-nb1"
  if (words.length >= 3) {
    // Try last word only: "OTP Bank Liga NB1" → "nb1"
    variations.push(createSlug(words[words.length - 1]));
    
    // Try last word with "i" instead of "1": "NB1" → "nb-i"
    const lastWord = words[words.length - 1];
    if (lastWord.match(/\d$/)) {
      const withI = lastWord.replace(/1$/, 'i');
      variations.push(createSlug(withI));
    }
    
    // Try without middle words: "OTP Bank Liga NB1" → "otp-liga-nb1"
    if (words.length >= 4) {
      const withoutMiddle = `${words[0]} ${words[words.length - 2]} ${words[words.length - 1]}`;
      variations.push(createSlug(withoutMiddle));
    }
  }
  
  // Remove duplicates and empty strings
  return Array.from(new Set(variations)).filter(v => v.length > 0);
}

// Cache for discovered league slugs to avoid repeated URL checking
const discoveredLeagueSlugs = new Map<string, string>();

/**
 * Extract league slug from competition name with robust URL discovery
 * Tries multiple URL patterns and returns the one that works
 */
export function extractLeagueSlug(competitionName: string): string {
  const cleanedName = competitionName.replace(/\s+\d{4}\/\d{4}$/g, '').trim();
  
  // Check cache first
  if (discoveredLeagueSlugs.has(cleanedName)) {
    return discoveredLeagueSlugs.get(cleanedName)!;
  }
  
  // Manual mappings for leagues that don't follow the simple pattern
  const leagueSlugMap: Record<string, string> = {
    'Spain La Liga': 'la-liga',
    'La Liga': 'la-liga',
    'England Premier League': 'premier-league',
    'Premier League': 'premier-league',
    'England Championship': 'championship',
    'Championship': 'championship',
    'Italy Serie A': 'serie-a',
    'Serie A': 'serie-a',
    'Germany Bundesliga': 'bundesliga',
    'Bundesliga': 'bundesliga',
    'France Ligue 1': 'ligue-1',
    'Ligue 1': 'ligue-1',
    'France Ligue 2': 'ligue-2',
    'Ligue 2': 'ligue-2',
    'Portugal Liga Portugal': 'liga-portugal',
    'Liga Portugal': 'liga-portugal',
    'Netherlands Eredivisie': 'eredivisie',
    'Eredivisie': 'eredivisie',
    'Belgium Pro League': '1e-klasse',
    'Belgium Jupiler League': '1e-klasse',
    'Jupiler League': '1e-klasse',
    'Jupiler Pro League': '1e-klasse',
    'Brazil Serie A': 'brasileiro-serie-a',
    'Serie A Brazil': 'brasileiro-serie-a',
    'Argentina Primera Division': 'liga-profesional',
    'Primera Division': 'liga-profesional',
    'UEFA Champions League': 'champions-league',
    'Champions League': 'champions-league',
    'UEFA Europa League': 'europa-league',
    'Europa League': 'europa-league',
    'CONMEBOL Copa Libertadores': 'copa-libertadores',
    'Copa Libertadores': 'copa-libertadores',
    'CONMEBOL Copa Sudamericana': 'copa-sudamericana',
    'Copa Sudamericana': 'copa-sudamericana',
    'CONMEBOL Copa': 'copa-libertadores',
    'Scotland Premiership': 'scottish-premiership',
    'Scottish Premiership': 'scottish-premiership',
    'Turkey Super Lig': 'super-league-tr',
    'Turkey Süper Lig': 'super-league-tr',
    'Super Lig': 'super-league-tr',
    'Süper Lig': 'super-league-tr',
    'Russia Premier League': 'premier-liga',
    'Russian Premier League': 'premier-liga',
    'Mexico Liga MX': 'liga-mx',
    'Liga MX': 'liga-mx',
    'MLS': 'mls',
    'Major League Soccer': 'mls',
    'Poland Ekstraklasa': 'ekstraklasa',
    'Slovenia 2. Liga SNL': '2-snl',
    '2. Liga SNL': '2-snl',
    'Hungary OTP Bank Liga NB1': 'nb-i',
    'OTP Bank Liga NB1': 'nb-i',
  };
  
  // Check if we have a manual mapping
  if (leagueSlugMap[cleanedName]) {
    const slug = leagueSlugMap[cleanedName];
    discoveredLeagueSlugs.set(cleanedName, slug);
    return slug;
  }
  
  // Generate variations and return the first one (will be validated in scrapeLeagueMatches)
  const variations = generateSlugVariations(cleanedName);
  const primarySlug = variations[0];
  
  console.log(`Generated slug variations for "${cleanedName}":`, variations);
  
  return primarySlug;
}

/**
 * Get available years for a specific league
 */
export async function getLeagueYears(competitionName: string): Promise<number[]> {
  try {
    const leagueSlug = extractLeagueSlug(competitionName);
    const url = `https://sportstats365.com/football/${leagueSlug}`;
    
    console.log(`Fetching available years from: ${url}`);
    
    const html: string = await new Promise((resolve, reject) => {
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
    
    const $ = cheerio.load(html);
    const years: number[] = [];
    
    // Find all year links in the dropdown
    $('a[href*="/' + leagueSlug + '/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const yearMatch = href.match(/\/(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          if (year >= 2010 && year <= 2030 && !years.includes(year)) {
            years.push(year);
          }
        }
      }
    });
    
    // Sort years in descending order (newest first)
    years.sort((a, b) => b - a);
    
    console.log(`Found ${years.length} years for ${competitionName}:`, years);
    return years;
  } catch (error) {
    console.error(`Failed to get years for ${competitionName}:`, error);
    return [];
  }
}

/**
 * Try to fetch a URL and return the HTML if successful
 */
async function tryFetchLeaguePage(url: string): Promise<{ success: boolean; html?: string; error?: any }> {
  try {
    const html: string = await new Promise((resolve, reject) => {
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
        } else if (response && response.statusCode && response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    
    // Check if the page has match data (validate it's a real league page)
    const $ = cheerio.load(html);
    const hasMatches = $('.list-group-item').length > 0 || $('table').length > 0;
    
    if (!hasMatches) {
      return { success: false, error: 'No match data found on page' };
    }
    
    return { success: true, html };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Scrape all matches for a specific league and year
 * Navigates through all weeks in the FIXTURES tab to collect complete match data
 * Tries multiple URL variations to find the correct league page
 */
export async function scrapeLeagueMatches(
  competitionName: string,
  year: number,
  onProgress?: (message: string, matchCount: number) => void
): Promise<Match[]> {
  try {
    const cleanedName = competitionName.replace(/\s+\d{4}\/\d{4}$/g, '').trim();
    
    // Get all possible slug variations
    const slugVariations = generateSlugVariations(cleanedName);
    
    // Also check if we have a manual mapping or cached slug
    const primarySlug = extractLeagueSlug(competitionName);
    
    // Ensure primary slug is first in the list
    const slugsToTry = [primarySlug, ...slugVariations.filter(s => s !== primarySlug)];
    
    console.log(`Trying ${slugsToTry.length} URL variations for "${competitionName}":`, slugsToTry);
    
    // Determine if this league uses single year or season format
    const singleYearLeagues = [
      'copa-libertadores',
      'copa-sudamericana',
      'champions-league',
      'europa-league',
      'mls'
    ];
    
    let successfulSlug: string | null = null;
    let html: string | null = null;
    
    // Try each slug variation
    for (const slug of slugsToTry) {
      const useSingleYear = singleYearLeagues.includes(slug);
      const seasonFormat = useSingleYear ? `${year}` : `${year}-${year + 1}`;
      const baseUrl = `https://sportstats365.com/football/${slug}/${seasonFormat}`;
      
      console.log(`Trying URL: ${baseUrl}`);
      onProgress?.(`Trying ${competitionName} at ${slug}...`, 0);
      
      const result = await tryFetchLeaguePage(baseUrl);
      
      if (result.success && result.html) {
        console.log(`✓ Success! Found league at: ${baseUrl}`);
        successfulSlug = slug;
        html = result.html;
        
        // Cache this successful slug for future use
        discoveredLeagueSlugs.set(cleanedName, slug);
        break;
      } else {
        console.log(`✗ Failed: ${baseUrl} - ${result.error}`);
      }
    }
    
    if (!successfulSlug || !html) {
      throw new Error(`Could not find valid URL for ${competitionName}. Tried: ${slugsToTry.join(', ')}`);
    }
    
    const useSingleYear = singleYearLeagues.includes(successfulSlug);
    const seasonFormat = useSingleYear ? `${year}` : `${year}-${year + 1}`;
    const baseUrl = `https://sportstats365.com/football/${successfulSlug}/${seasonFormat}`;
    
    console.log(`Starting league scrape for ${competitionName} ${seasonFormat}`);
    console.log(`Using URL: ${baseUrl}`);
    onProgress?.(`Fetching matches for ${competitionName} ${seasonFormat}...`, 0);
    
    const $basePage = cheerio.load(html);
    const allMatches: Match[] = [];
    let matchId = 0;
    
    // Helper function to parse matches from HTML
    const parseMatches = ($doc: cheerio.CheerioAPI): Match[] => {
      const matches: Match[] = [];
      
      // Find all match items in the list
      $doc('.list-group-item').each((_, element) => {
        const $item = $doc(element);
        
        // Skip if this is a header/separator (text-muted with border-0)
        if ($item.hasClass('text-muted') && $item.hasClass('border-0')) {
          return;
        }
        
        // This should be a match item - look for match link
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
          
          const homeTeamSpan = $doc(teamSpans[0]);
          const awayTeamSpan = $doc(teamSpans[1]);
          
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
                const homeScoreText = $doc(mainScores[0]).text().trim();
                const awayScoreText = $doc(mainScores[1]).text().trim();
                
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
          
          // Extract odds
          let odds;
          const oddsBadges = $item.find('.badge-light');
          if (oddsBadges.length >= 3) {
            const homeOdds = parseFloat($doc(oddsBadges[0]).text().trim());
            const drawOdds = parseFloat($doc(oddsBadges[1]).text().trim());
            const awayOdds = parseFloat($doc(oddsBadges[2]).text().trim());
            
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
            competition: competitionName,
            competitionLogo: undefined,
            odds,
          });
        } catch (err) {
          console.error('Error parsing match:', err);
        }
      });
      
      return matches;
    };
    
    // Find the matches URL from the base page (check both buttons and anchors)
    let matchesUrl = '';
    $basePage('button[hx-get*="/matches"], a[hx-get*="/matches"]').each((_, element) => {
      const hxGet = $basePage(element).attr('hx-get');
      if (hxGet && hxGet.includes('/matches') && !matchesUrl) {
        matchesUrl = hxGet;
      }
    });
    
    if (!matchesUrl) {
      console.log(`No matches URL found, trying to parse from base page...`);
      const initialMatches = parseMatches($basePage);
      allMatches.push(...initialMatches);
      console.log(`Found ${initialMatches.length} matches on base page`);
      onProgress?.(`Found ${allMatches.length} matches...`, allMatches.length);
      return allMatches;
    }
    
    const fullMatchesUrl = matchesUrl.startsWith('http') ? matchesUrl : `https://sportstats365.com${matchesUrl}`;
    console.log(`Found matches URL: ${fullMatchesUrl}`);
    onProgress?.(`Loading fixtures from matches URL...`, 0);
    
    // Fetch the initial matches page to determine round range
    const matchesHtml: string = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: fullMatchesUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'HX-Request': 'true',
          'HX-Current-URL': baseUrl,
        },
      }, (error: any, response: any, body: string) => {
        if (error) {
          console.warn(`Failed to fetch matches URL:`, error.message);
          resolve('');
        } else {
          resolve(body);
        }
      });
    });
    
    if (!matchesHtml) {
      console.log(`Failed to fetch matches, using base page fallback...`);
      const initialMatches = parseMatches($basePage);
      allMatches.push(...initialMatches);
      return allMatches;
    }
    
    const $initial = cheerio.load(matchesHtml);
    
    // Find the current round and determine the range
    let currentRound = 1;
    let maxRound = 38; // Default for most leagues
    
    // Extract current round from header
    const headerText = $initial('.card-header').first().text();
    const weekMatch = headerText.match(/Week (\d+)/i);
    if (weekMatch) {
      currentRound = parseInt(weekMatch[1]);
      console.log(`Current round from header: ${currentRound}`);
    }
    
    // Find navigation buttons to determine round range
    $initial('button[name="round"]').each((_, element) => {
      const value = $initial(element).attr('value');
      if (value) {
        const roundNum = parseInt(value);
        if (!isNaN(roundNum)) {
          maxRound = Math.max(maxRound, roundNum);
        }
      }
    });
    
    console.log(`Determined round range: 1 to ${maxRound}`);
    
    // Now iterate through all rounds from 1 to maxRound
    for (let round = 1; round <= maxRound; round++) {
      try {
        // Properly append round parameter (use & if URL already has query params)
        const separator = fullMatchesUrl.includes('?') ? '&' : '?';
        const roundUrl = `${fullMatchesUrl}${separator}round=${round}`;
        console.log(`Fetching round ${round}/${maxRound}: ${roundUrl}`);
        onProgress?.(`Fetching round ${round}/${maxRound}... Found ${allMatches.length} matches so far`, allMatches.length);
        
        const roundHtml: string = await new Promise((resolve, reject) => {
          cloudscraper.get({
            uri: roundUrl,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'HX-Request': 'true',
              'HX-Current-URL': baseUrl,
              'Referer': baseUrl,
            },
          }, (error: any, response: any, body: string) => {
            if (error) {
              console.warn(`Failed to fetch round ${round}:`, error.message);
              resolve('');
            } else {
              resolve(body);
            }
          });
        });
        
        if (roundHtml) {
          const $round = cheerio.load(roundHtml);
          const roundMatches = parseMatches($round);
          
          // Avoid duplicates by checking if we've seen these teams
          for (const match of roundMatches) {
            const isDuplicate = allMatches.some(
              m => m.homeTeam === match.homeTeam && 
                   m.awayTeam === match.awayTeam &&
                   m.homeScore === match.homeScore &&
                   m.awayScore === match.awayScore
            );
            
            if (!isDuplicate) {
              allMatches.push(match);
            }
          }
          
          console.log(`Round ${round}: Found ${roundMatches.length} matches (${allMatches.length} total)`);
        }
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error(`Error fetching round ${round}:`, error);
      }
    }
    
    console.log(`Successfully scraped ${allMatches.length} total matches for ${competitionName} ${seasonFormat}`);
    onProgress?.(`Completed! Found ${allMatches.length} matches for ${competitionName} ${seasonFormat}`, allMatches.length);
    
    return allMatches;
  } catch (error) {
    console.error(`Failed to scrape league matches for ${competitionName}:`, error);
    throw error;
  }
}

