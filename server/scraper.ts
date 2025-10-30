import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import { type Match } from '@shared/schema';

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
