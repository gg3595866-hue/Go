/**
 * Analyze the structure of Sportstats365's competitions page
 * to understand how to extract league information
 */

import httpClient from './http-client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpClient.get({
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

async function analyzeCompetitionsPage() {
  const url = 'https://sportstats365.com/football/competitions/leagues';
  console.log(`Fetching: ${url}\n`);
  
  try {
    const html = await fetchPage(url);
    
    // Save the HTML for inspection
    fs.writeFileSync('server/competitions-page.html', html);
    console.log('✅ Saved HTML to: server/competitions-page.html\n');
    
    const $ = cheerio.load(html);
    
    console.log('=== ANALYZING PAGE STRUCTURE ===\n');
    
    // Try different selectors to find leagues
    console.log('1. All links on the page:');
    let linkCount = 0;
    $('a[href]').each((i, el) => {
      if (i < 30) { // Show first 30
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (text && href) {
          console.log(`   [${i}] "${text}" -> ${href}`);
          linkCount++;
        }
      }
    });
    console.log(`   ... (${$('a[href]').length} total links)\n`);
    
    console.log('2. Links with /football/ in href:');
    $('a[href*="/football/"]').each((i, el) => {
      if (i < 30) {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        console.log(`   [${i}] "${text}" -> ${href}`);
      }
    });
    console.log(`   ... (${$('a[href*="/football/"]').length} total)\n`);
    
    console.log('3. List items:');
    $('.list-group-item').each((i, el) => {
      if (i < 20) {
        const text = $(el).text().trim().substring(0, 100);
        console.log(`   [${i}] ${text}`);
      }
    });
    console.log(`   ... (${$('.list-group-item').length} total)\n`);
    
    console.log('4. Card elements:');
    $('.card').each((i, el) => {
      if (i < 10) {
        const title = $(el).find('.card-title, .card-header').text().trim();
        const body = $(el).find('.card-body').text().trim().substring(0, 100);
        console.log(`   [${i}] Title: "${title}"`);
        console.log(`       Body: "${body}"\n`);
      }
    });
    console.log(`   ... (${$('.card').length} total)\n`);
    
    console.log('5. Table elements:');
    $('table').each((i, el) => {
      if (i < 5) {
        console.log(`   [${i}] Table ${i + 1}:`);
        $(el).find('tr').each((j, row) => {
          if (j < 5) {
            const rowText = $(row).text().trim();
            console.log(`       Row ${j}: ${rowText.substring(0, 100)}`);
          }
        });
        console.log();
      }
    });
    console.log(`   ... (${$('table').length} total)\n`);
    
    console.log('6. Divs with specific classes:');
    $('div[class*="competition"], div[class*="league"], div[class*="tournament"]').each((i, el) => {
      if (i < 20) {
        const className = $(el).attr('class');
        const text = $(el).text().trim().substring(0, 100);
        console.log(`   [${i}] Class: "${className}"`);
        console.log(`       Text: "${text}"\n`);
      }
    });
    
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log('Check server/competitions-page.html for full HTML');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeCompetitionsPage().catch(console.error);
