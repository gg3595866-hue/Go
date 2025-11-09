import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

async function testGoalsStructure() {
  const matchUrl = 'https://sportstats365.com/football/serie-a-br/2025/compare/sao-paulo/bragantino/1019632';
  
  const html: string = await new Promise((resolve, reject) => {
    cloudscraper.get({
      uri: matchUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (error: any, response: any, body: string) => {
      if (error) reject(error);
      else resolve(body);
    });
  });
  
  const $ = cheerio.load(html);
  
  // Extract team names
  const teamHeaders = $('.text-center h2');
  const homeTeam = $(teamHeaders[0]).text().trim();
  const awayTeam = $(teamHeaders[1]).text().trim();
  
  console.log('Home Team:', homeTeam);
  console.log('Away Team:', awayTeam);
  
  const statsButton = $('button[hx-get*="/stats/"]').filter(function() {
    return !$(this).attr('hx-get')?.includes('/form') && 
           !$(this).attr('hx-get')?.includes('/matches') && 
           !$(this).attr('hx-get')?.includes('/h2h');
  });
  const statsUrl = statsButton.attr('hx-get');
  
  if (statsUrl) {
    const fullStatsUrl = `https://sportstats365.com${statsUrl}`;
    
    const statsHtml: string = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: fullStatsUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'HX-Request': 'true',
        },
      }, (error: any, response: any, body: string) => {
        if (error) {
          resolve('');
        } else {
          resolve(body);
        }
      });
    });
    
    const $stats = cheerio.load(statsHtml);
    
    // Look for "Number of Goals / Match" or similar section
    console.log('\n=== SEARCHING FOR GOALS SCORED DATA ===');
    
    // Find section with goals per match
    const goalsPerMatchSection = $stats('.card-header, .compare-header, h3, h4, h5').filter(function() {
      const text = $stats(this).text().trim();
      return text.includes('Number of Goals') && text.includes('Match');
    }).closest('.card, section');
    
    console.log('Found Goals/Match section:', goalsPerMatchSection.length > 0);
    
    if (goalsPerMatchSection.length > 0) {
      console.log('\n=== GOALS PER MATCH SECTION ROWS ===');
      goalsPerMatchSection.find('.list-group-item').each((i, row) => {
        const cols = $stats(row).find('.col-4, .col-6, .col-3, .col');
        
        if (cols.length >= 2) {
          const col1 = $stats(cols[0]).text().trim();
          const col2 = cols.length >= 3 ? $stats(cols[1]).text().trim() : '';
          const col3 = cols.length >= 3 ? $stats(cols[2]).text().trim() : $stats(cols[1]).text().trim();
          
          console.log(`\nRow ${i}:`);
          console.log(`  Col 0: ${col1.substring(0, 60)}`);
          if (col2) console.log(`  Col 1: ${col2.substring(0, 60)}`);
          console.log(`  Col ${cols.length >= 3 ? '2' : '1'}: ${col3.substring(0, 60)}`);
        }
      });
    }
    
    // Also check the Goals Scored section
    console.log('\n\n=== GOALS SCORED SECTION ===');
    const goalsScoredSection = $stats('.card-header, .compare-header').filter(function() {
      return $stats(this).text().includes('Goals Scored');
    }).closest('.card, section');
    
    console.log('Found Goals Scored section:', goalsScoredSection.length > 0);
    
    if (goalsScoredSection.length > 0) {
      goalsScoredSection.find('.list-group-item').each((i, row) => {
        const text = $stats(row).text().trim();
        console.log(`Row ${i}: ${text.substring(0, 100)}`);
      });
    }
    
    // Search for the text containing goals scored/conceded
    console.log('\n\n=== SEARCHING FOR GOALS TEXT PATTERNS ===');
    const fullText = statsHtml;
    
    // Look for patterns like "Sao Paulo scored ... on average"
    const scoredPattern1 = new RegExp(`${homeTeam}\\s+scored.*?on average.*?\\d+\\.?\\d*`, 'i');
    const scoredPattern2 = new RegExp(`${awayTeam}\\s+scored.*?on average.*?\\d+\\.?\\d*`, 'i');
    
    const homeMatch = fullText.match(scoredPattern1);
    const awayMatch = fullText.match(scoredPattern2);
    
    console.log('Home team scored pattern:', homeMatch ? homeMatch[0].substring(0, 100) : 'NOT FOUND');
    console.log('Away team scored pattern:', awayMatch ? awayMatch[0].substring(0, 100) : 'NOT FOUND');
    
    // Try to find any numbers associated with goals scored
    const avgGoalsPattern = /(\d+\.?\d*)\s*goals\s*on\s*average/gi;
    let match;
    console.log('\n=== ALL "goals on average" PATTERNS ===');
    let count = 0;
    while ((match = avgGoalsPattern.exec(fullText)) !== null && count < 10) {
      const context = fullText.substring(Math.max(0, match.index - 50), Math.min(fullText.length, match.index + 100));
      console.log(`${count + 1}. ${match[1]} goals - Context: ${context.substring(0, 80)}`);
      count++;
    }
  }
}

testGoalsStructure().then(() => {
  console.log('\n=== COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
