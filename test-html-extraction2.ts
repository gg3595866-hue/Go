import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

async function testDetailedExtraction() {
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
    
    console.log('=== NUMBER OF GOALS SECTION ===');
    const goalsSection = $stats('.card-header, .compare-header').filter(function() {
      return $stats(this).text().includes('Number of Goals');
    }).closest('.card, section');
    
    console.log('Found section:', goalsSection.length > 0);
    
    goalsSection.find('.list-group-item').each((i, row) => {
      const cols = $stats(row).find('.col-4, .col-6, .col-3, .col');
      
      if (cols.length >= 3) {
        const homeText = $stats(cols[0]).text().trim();
        const labelText = $stats(cols[1]).text().trim();
        const awayText = $stats(cols[2]).text().trim();
        
        console.log(`\nRow ${i}:`);
        console.log(`  Home: ${homeText}`);
        console.log(`  Label: ${labelText}`);
        console.log(`  Away: ${awayText}`);
      } else if (cols.length === 2) {
        console.log(`\nRow ${i} (2 cols):`);
        console.log(`  Col 0: ${$stats(cols[0]).text().trim()}`);
        console.log(`  Col 1: ${$stats(cols[1]).text().trim()}`);
      } else {
        console.log(`\nRow ${i}: ${cols.length} cols - ${$stats(row).text().trim().substring(0, 80)}`);
      }
    });
    
    // Also check for win rates by venue
    console.log('\n\n=== CHECKING FOR HOME/AWAY SPECIFIC WIN RATES ===');
    const allText = statsHtml.toLowerCase();
    console.log('Contains "home statistics":', allText.includes('home statistics'));
    console.log('Contains "away statistics":', allText.includes('away statistics'));
    
    // Check all tabs or buttons
    $stats('button, a').each((i, el) => {
      const text = $stats(el).text().trim();
      if (text === 'Home' || text === 'Away' || text === 'Overall') {
        console.log(`Found tab/button: "${text}" with hx-get="${$stats(el).attr('hx-get')}"`);
      }
    });
  }
}

testDetailedExtraction().then(() => {
  console.log('\n=== COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
