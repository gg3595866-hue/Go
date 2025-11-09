import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';

async function checkMainPage() {
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
  
  console.log('=== SEARCHING FOR HOME/AWAY WIN RATE DATA ON MAIN PAGE ===\n');
  
  // Look for any statistics tables or sections
  console.log('--- Statistics sections ---');
  $('.card-header, h3, h4, h5').each((i, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase().includes('statistic') || 
        text.toLowerCase().includes('home') || 
        text.toLowerCase().includes('away') ||
        text.toLowerCase().includes('win')) {
      console.log(`${i}. ${text}`);
    }
  });
  
  console.log('\n--- Looking for win percentages on main page ---');
  $('*').filter(function() {
    const text = $(this).text();
    return text.includes('%') && (text.toLowerCase().includes('win') || text.toLowerCase().includes('home') || text.toLowerCase().includes('away'));
  }).slice(0, 10).each((i, el) => {
    console.log(`${i}. ${$(el).text().trim().substring(0, 100)}`);
  });
}

checkMainPage().then(() => {
  console.log('\n=== COMPLETE ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
