import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

async function testHTMLExtraction() {
  const matchUrl = 'https://sportstats365.com/football/serie-a-br/2025/compare/sao-paulo/bragantino/1019632';
  
  console.log(`Fetching: ${matchUrl}\n`);
  
  // Fetch main page
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
  
  // Find all HTMX endpoints
  console.log('=== HTMX ENDPOINTS ===');
  $('[hx-get]').each((i, el) => {
    const hxGet = $(el).attr('hx-get');
    const text = $(el).text().trim().substring(0, 50);
    console.log(`${text}: ${hxGet}`);
  });
  
  // Find the stats endpoint
  const statsButton = $('button[hx-get*="/stats/"]').filter(function() {
    return !$(this).attr('hx-get')?.includes('/form') && 
           !$(this).attr('hx-get')?.includes('/matches') && 
           !$(this).attr('hx-get')?.includes('/h2h');
  });
  const statsUrl = statsButton.attr('hx-get');
  
  if (statsUrl) {
    const fullStatsUrl = `https://sportstats365.com${statsUrl}`;
    console.log(`\n=== FETCHING STATS: ${fullStatsUrl} ===\n`);
    
    const statsHtml: string = await new Promise((resolve, reject) => {
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
    
    const $stats = cheerio.load(statsHtml);
    
    // Find all sections/headers
    console.log('=== SECTION HEADERS IN STATS ===');
    $stats('.card-header, .compare-header, h3, h4, h5').each((i, el) => {
      const text = $stats(el).text().trim();
      if (text) {
        console.log(`- ${text}`);
      }
    });
    
    // Look for Over/Under section
    console.log('\n=== LOOKING FOR OVER/UNDER DATA ===');
    const overUnderText = statsHtml.toLowerCase();
    if (overUnderText.includes('over') || overUnderText.includes('under')) {
      console.log('Found "over" or "under" in stats HTML');
      
      // Find all rows that might contain over/under data
      $stats('.list-group-item').each((i, row) => {
        const rowText = $stats(row).text();
        if (rowText.toLowerCase().includes('over') || rowText.toLowerCase().includes('under')) {
          console.log(`Row ${i}: ${rowText.substring(0, 100)}`);
        }
      });
    } else {
      console.log('No "over" or "under" found in stats HTML');
    }
    
    // Look for all percentages in the stats
    console.log('\n=== ALL PERCENTAGE VALUES FOUND ===');
    let percentCount = 0;
    $stats('span[class*="text-"]').each((i, el) => {
      const text = $stats(el).text().trim();
      if (text.includes('%')) {
        percentCount++;
        if (percentCount <= 20) { // Show first 20
          const parent = $stats(el).closest('.list-group-item');
          const context = parent.length > 0 ? parent.text().trim().substring(0, 80) : 'No context';
          console.log(`${percentCount}. ${text} - Context: ${context}`);
        }
      }
    });
    console.log(`Total percentage values found: ${percentCount}`);
  }
  
  // Check form endpoint
  const formButton = $('button[hx-get*="/form"]').first();
  const formUrl = formButton.attr('hx-get');
  
  if (formUrl) {
    const fullFormUrl = `https://sportstats365.com${formUrl}`;
    console.log(`\n=== FETCHING FORM: ${fullFormUrl} ===\n`);
    
    const formHtml: string = await new Promise((resolve, reject) => {
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
    
    console.log('Form HTML length:', formHtml.length);
    
    // Look for odds in form
    const $form = cheerio.load(formHtml);
    console.log('\n=== LOOKING FOR ODDS IN FORM ===');
    const formText = $form.text();
    const oddsMatch = formText.match(/Odds[\s\S]{0,200}?(\d+\.?\d*)\s*(\d+)\s*%\s*(\d+\.?\d*)\s*(\d+)\s*%\s*(\d+\.?\d*)\s*(\d+)\s*%/);
    if (oddsMatch) {
      console.log('Found odds pattern:', {
        odds1: oddsMatch[1],
        prob1: oddsMatch[2],
        oddsX: oddsMatch[3],
        probX: oddsMatch[4],
        odds2: oddsMatch[5],
        prob2: oddsMatch[6]
      });
    } else {
      console.log('No odds pattern found in form HTML');
      console.log('Form text preview:', formText.substring(0, 500));
    }
  }
}

testHTMLExtraction().then(() => {
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
