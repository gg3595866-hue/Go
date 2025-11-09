import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function saveStatsHTML() {
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
    
    fs.writeFileSync('stats-html-output.html', statsHtml);
    console.log('Stats HTML saved to stats-html-output.html');
    console.log('Length:', statsHtml.length);
  }
}

saveStatsHTML().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
