/**
 * Script to scrape ALL available leagues from sportstats365.com
 * This will get the actual league pages and their URLs
 */

import * as cheerio from 'cheerio';
import cloudscraper from 'cloudscraper';
import * as fs from 'fs';
import * as path from 'path';

interface LeagueInfo {
  name: string;
  url: string;
  slug: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    console.log(`Fetching: ${url}`);
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
        } else if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    return html;
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function getAllLeaguesFromMainPage(): Promise<LeagueInfo[]> {
  const leagues: LeagueInfo[] = [];
  const baseUrl = 'https://sportstats365.com';
  
  // Fetch the main football page
  const html = await fetchPage(`${baseUrl}/football`);
  if (!html) {
    console.error('Failed to fetch main page');
    return [];
  }
  
  const $ = cheerio.load(html);
  
  // Find all league links - they typically have the pattern /football/league-name or /football/league-name/year
  const seenSlugs = new Set<string>();
  
  $('a[href*="/football/"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    
    // Match patterns like /football/premier-league or /football/premier-league/2025
    const match = href.match(/\/football\/([a-z0-9-]+)/);
    if (match) {
      const slug = match[1];
      
      // Skip if we've already seen this slug
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);
      
      const leagueName = $(element).text().trim();
      if (leagueName && !leagueName.match(/^\d{4}$/)) { // Skip year-only links
        leagues.push({
          name: leagueName,
          url: `${baseUrl}/football/${slug}`,
          slug: slug,
        });
      }
    }
  });
  
  console.log(`Found ${leagues.length} unique leagues`);
  return leagues;
}

async function main() {
  console.log('='.repeat(80));
  console.log('SCRAPING ALL LEAGUES FROM SPORTSTATS365.COM');
  console.log('='.repeat(80));
  
  const leagues = await getAllLeaguesFromMainPage();
  
  // Save results
  const outputFile = path.join(__dirname, '..', 'discovered-leagues.json');
  fs.writeFileSync(outputFile, JSON.stringify(leagues, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Scraping complete!`);
  console.log(`   Total leagues discovered: ${leagues.length}`);
  console.log(`   Output: ${outputFile}`);
  console.log('='.repeat(80));
  
  // Generate TypeScript mapping
  const tsMapping = leagues.reduce((acc, league) => {
    acc[league.name] = league.slug;
    return acc;
  }, {} as Record<string, string>);
  
  const tsCode = `// Auto-discovered league slugs from sportstats365.com\nexport const DISCOVERED_LEAGUE_SLUGS: Record<string, string> = ${JSON.stringify(tsMapping, null, 2)};\n`;
  
  const tsOutputFile = path.join(__dirname, 'discovered-leagues.ts');
  fs.writeFileSync(tsOutputFile, tsCode);
  
  console.log(`   TypeScript mapping: ${tsOutputFile}`);
  console.log('='.repeat(80));
  
  // Print some examples
  console.log('\nSample leagues discovered:');
  leagues.slice(0, 10).forEach(l => {
    console.log(`  ${l.name} -> ${l.slug}`);
  });
}

main().catch(console.error);
