import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

async function testDOMStructure() {
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
    
    // Look for Number of Goals / Match section with detailed structure
    console.log('=== NUMBER OF GOALS / MATCH SECTION - FULL HTML ===');
    const goalsMatchSection = $stats('.card-header, .compare-header').filter(function() {
      const text = $stats(this).text().trim();
      return text.includes('Number of Goals') && text.includes('Match');
    }).closest('.card, section');
    
    if (goalsMatchSection.length > 0) {
      // Get the HTML of first few rows
      const rows = goalsMatchSection.find('.list-group-item');
      rows.slice(0, 3).each((i, row) => {
        console.log(`\n--- Row ${i} HTML ---`);
        console.log($stats(row).html()?.substring(0, 500));
      });
    }
    
    // Look for tabs/toggles in Team Statistics section
    console.log('\n\n=== TEAM STATISTICS TABS/TOGGLES ===');
    const teamStatsSection = $stats('.card-header, .compare-header').filter(function() {
      return $stats(this).text().includes('Team Statistics');
    }).closest('.card, section');
    
    if (teamStatsSection.length > 0) {
      // Look for tab buttons or toggle elements
      console.log('\n--- Tab Buttons ---');
      teamStatsSection.find('button, a, [role="tab"]').each((i, el) => {
        const text = $stats(el).text().trim();
        const classes = $stats(el).attr('class');
        const dataTarget = $stats(el).attr('data-target') || $stats(el).attr('data-bs-target');
        const ariaControls = $stats(el).attr('aria-controls');
        
        console.log(`${i}. "${text}" - classes: ${classes} - target: ${dataTarget || ariaControls || 'none'}`);
      });
      
      // Look for tab content panels
      console.log('\n--- Tab Content Panels ---');
      teamStatsSection.find('[role="tabpanel"], .tab-pane, [id*="home"], [id*="away"], [id*="overall"]').each((i, el) => {
        const id = $stats(el).attr('id');
        const classes = $stats(el).attr('class');
        const firstRow = $stats(el).find('.list-group-item').first().text().trim().substring(0, 60);
        
        console.log(`${i}. ID: ${id} - Classes: ${classes} - First row: ${firstRow}`);
      });
    }
    
    // Look for data in small tags or specific columns
    console.log('\n\n=== SEARCHING FOR GOALS/MATCH DATA IN SMALL TAGS ===');
    goalsMatchSection.find('small').each((i, el) => {
      const text = $stats(el).text().trim();
      if (text && i < 10) {
        console.log(`${i}. ${text}`);
      }
    });
  }
}

testDOMStructure().then(() => {
  console.log('\n=== COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
