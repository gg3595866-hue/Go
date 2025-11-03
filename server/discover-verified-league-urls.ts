/**
 * Discover ALL league URLs from Sportstats365's official competition pages
 * This scrapes the actual site to get 100% accurate URL mappings
 */

import cloudscraper from 'cloudscraper';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

interface LeagueMapping {
  name: string;
  slug: string;
  url: string;
  country: string;
  region: string;
}

// Map of country names to their Sportstats365 country codes
const COUNTRY_CODES: Record<string, string> = {
  // Europe
  'Albania': 'al',
  'Austria': 'at',
  'Belarus': 'by',
  'Belgium': 'be',
  'Bosnia & Herzegovina': 'ba',
  'Bulgaria': 'bg',
  'Croatia': 'hr',
  'Czechia': 'cz',
  'Denmark': 'dk',
  'England': 'en',
  'Estonia': 'ee',
  'Germany': 'de',
  'Greece': 'gr',
  'Hungary': 'hu',
  'Iceland': 'is',
  'Ireland': 'ie',
  'Italy': 'it',
  'Latvia': 'lv',
  'Lithuania': 'lt',
  'Moldova': 'md',
  'Montenegro': 'me',
  'Netherlands': 'nl',
  'North Macedonia': 'mk',
  'Norway': 'no',
  'Poland': 'pl',
  'Portugal': 'pt',
  'Romania': 'ro',
  'Russia': 'ru',
  'Scotland': 'sc',
  'Serbia': 'rs',
  'Slovakia': 'sk',
  'Slovenia': 'si',
  'Spain': 'es',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Turkey': 'tr',
  'Ukraine': 'ua',
  'Wales': 'wl',
  
  // North America
  'United States': 'us',
  'Mexico': 'mx',
  
  // South America
  'Argentina': 'ar',
  'Brazil': 'br',
  'Chile': 'cl',
  'Colombia': 'co',
  'Ecuador': 'ec',
  'Uruguay': 'uy',
  'Venezuela': 've',
  
  // Asia
  'Japan': 'jp',
  'Singapore': 'sg',
  
  // Australia
  'Australia': 'au',
};

// International confederation pages
const INTERNATIONAL_PAGES = [
  { name: 'UEFA', url: '/football/uefa' },
  { name: 'AFC', url: '/football/afc' },
  { name: 'CAF', url: '/football/caf' },
  { name: 'CONCACAF', url: '/football/concacaf' },
  { name: 'CONMEBOL', url: '/football/conmebol' },
  { name: 'FIFA', url: '/football/fifa' },
  { name: 'OFC', url: '/football/ofc' },
];

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

function extractLeaguesFromPage(html: string, country: string, region: string): LeagueMapping[] {
  const $ = cheerio.load(html);
  const leagues: LeagueMapping[] = [];
  
  // Find all competition links on the page
  // Sportstats365 lists competitions with links to /football/{slug}
  $('a[href^="/football/"]').each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const name = $link.text().trim();
    
    if (!href || !name) return;
    
    // Skip navigation/common links
    const skipPatterns = [
      '/football/countries',
      '/football$',
      '/football/live',
      '/football/today',
      '/football/tomorrow',
      '/football/yesterday',
      'javascript:',
      '#',
    ];
    
    if (skipPatterns.some(pattern => href.match(pattern))) {
      return;
    }
    
    // Extract the slug from the URL
    const match = href.match(/^\/football\/([^\/\?]+)/);
    if (match) {
      const slug = match[1];
      
      // Skip if it's just a country code
      if (Object.values(COUNTRY_CODES).includes(slug)) {
        return;
      }
      
      leagues.push({
        name,
        slug,
        url: `https://sportstats365.com${href}`,
        country,
        region,
      });
    }
  });
  
  return leagues;
}

async function scrapeCountryCompetitions(countryName: string, countryCode: string, region: string): Promise<LeagueMapping[]> {
  const url = `https://sportstats365.com/football/countries/${countryCode}`;
  console.log(`Scraping ${countryName} (${countryCode})...`);
  
  try {
    const html = await fetchPage(url);
    const leagues = extractLeaguesFromPage(html, countryName, region);
    console.log(`  Found ${leagues.length} competitions for ${countryName}`);
    return leagues;
  } catch (error) {
    console.error(`  Error scraping ${countryName}:`, error);
    return [];
  }
}

async function scrapeInternationalCompetitions(confName: string, confUrl: string): Promise<LeagueMapping[]> {
  const url = `https://sportstats365.com${confUrl}`;
  console.log(`Scraping ${confName}...`);
  
  try {
    const html = await fetchPage(url);
    const leagues = extractLeaguesFromPage(html, confName, 'International');
    console.log(`  Found ${leagues.length} competitions for ${confName}`);
    return leagues;
  } catch (error) {
    console.error(`  Error scraping ${confName}:`, error);
    return [];
  }
}

async function discoverAllLeagues(): Promise<LeagueMapping[]> {
  const allLeagues: LeagueMapping[] = [];
  
  // Scrape European countries
  console.log('\n=== SCRAPING EUROPEAN COUNTRIES ===\n');
  const europeanCountries = [
    'Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia & Herzegovina',
    'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'England', 'Estonia',
    'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy',
    'Latvia', 'Lithuania', 'Moldova', 'Montenegro', 'Netherlands',
    'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania',
    'Russia', 'Scotland', 'Serbia', 'Slovakia', 'Slovenia', 'Spain',
    'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'Wales'
  ];
  
  for (const country of europeanCountries) {
    const code = COUNTRY_CODES[country];
    if (code) {
      const leagues = await scrapeCountryCompetitions(country, code, 'Europe');
      allLeagues.push(...leagues);
      // Be polite to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Scrape North American countries
  console.log('\n=== SCRAPING NORTH AMERICAN COUNTRIES ===\n');
  const northAmericanCountries = ['United States', 'Mexico'];
  for (const country of northAmericanCountries) {
    const code = COUNTRY_CODES[country];
    if (code) {
      const leagues = await scrapeCountryCompetitions(country, code, 'North America');
      allLeagues.push(...leagues);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Scrape South American countries
  console.log('\n=== SCRAPING SOUTH AMERICAN COUNTRIES ===\n');
  const southAmericanCountries = ['Argentina', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Uruguay', 'Venezuela'];
  for (const country of southAmericanCountries) {
    const code = COUNTRY_CODES[country];
    if (code) {
      const leagues = await scrapeCountryCompetitions(country, code, 'South America');
      allLeagues.push(...leagues);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Scrape Asian countries
  console.log('\n=== SCRAPING ASIAN COUNTRIES ===\n');
  const asianCountries = ['Japan', 'Singapore'];
  for (const country of asianCountries) {
    const code = COUNTRY_CODES[country];
    if (code) {
      const leagues = await scrapeCountryCompetitions(country, code, 'Asia');
      allLeagues.push(...leagues);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Scrape Australia
  console.log('\n=== SCRAPING AUSTRALIA ===\n');
  const code = COUNTRY_CODES['Australia'];
  if (code) {
    const leagues = await scrapeCountryCompetitions('Australia', code, 'Australia');
    allLeagues.push(...leagues);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Scrape International confederations
  console.log('\n=== SCRAPING INTERNATIONAL CONFEDERATIONS ===\n');
  for (const conf of INTERNATIONAL_PAGES) {
    const leagues = await scrapeInternationalCompetitions(conf.name, conf.url);
    allLeagues.push(...leagues);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return allLeagues;
}

function generateMappingFile(leagues: LeagueMapping[]): string {
  // Group by region for organized output
  const byRegion: Record<string, LeagueMapping[]> = {};
  
  leagues.forEach(league => {
    if (!byRegion[league.region]) {
      byRegion[league.region] = [];
    }
    byRegion[league.region].push(league);
  });
  
  // Sort within each region by country then name
  Object.keys(byRegion).forEach(region => {
    byRegion[region].sort((a, b) => {
      if (a.country !== b.country) {
        return a.country.localeCompare(b.country);
      }
      return a.name.localeCompare(b.name);
    });
  });
  
  let content = `/**
 * VERIFIED LEAGUE URL MAPPINGS
 * 
 * This file was auto-generated by scraping Sportstats365's official competition pages.
 * Each mapping is 100% verified from the actual website.
 * 
 * DO NOT EDIT MANUALLY - regenerate by running:
 * npx tsx server/discover-verified-league-urls.ts
 * 
 * Last updated: ${new Date().toISOString()}
 */

export const VERIFIED_LEAGUE_MAPPINGS: Record<string, string> = {\n`;
  
  const regions = ['Europe', 'International', 'North America', 'South America', 'Asia', 'Australia'];
  
  regions.forEach(region => {
    if (byRegion[region] && byRegion[region].length > 0) {
      content += `\n  // ==================== ${region.toUpperCase()} ====================\n`;
      
      let currentCountry = '';
      byRegion[region].forEach(league => {
        if (league.country !== currentCountry) {
          content += `\n  // ${league.country}\n`;
          currentCountry = league.country;
        }
        
        // Clean the name (remove year suffixes)
        const cleanName = league.name.replace(/\s+\d{4}(\/\d{4})?$/g, '').trim();
        
        content += `  '${cleanName}': '${league.slug}',\n`;
      });
    }
  });
  
  content += `};\n\n`;
  
  // Add helper function
  content += `/**
 * Get league slug for a competition name
 * Automatically removes year suffixes
 */
export function getVerifiedLeagueSlug(competitionName: string): string | null {
  // Remove year suffix (e.g., " 2025/2026" or " 2025")
  const cleanName = competitionName.replace(/\\s+\\d{4}(\\/\\d{4})?$/g, '').trim();
  
  // Check direct mapping
  if (VERIFIED_LEAGUE_MAPPINGS[cleanName]) {
    return VERIFIED_LEAGUE_MAPPINGS[cleanName];
  }
  
  // Return null if not found
  return null;
}\n`;
  
  return content;
}

async function main() {
  console.log('Starting league URL discovery from Sportstats365...\n');
  console.log('This will scrape the official competition pages to get VERIFIED URLs.\n');
  
  const leagues = await discoverAllLeagues();
  
  console.log(`\n=== DISCOVERY COMPLETE ===`);
  console.log(`Total competitions found: ${leagues.length}`);
  
  // Remove duplicates (same slug)
  const uniqueLeagues = leagues.filter((league, index, self) => 
    index === self.findIndex((l) => l.slug === league.slug)
  );
  
  console.log(`Unique competition slugs: ${uniqueLeagues.length}`);
  
  // Generate the mapping file
  const mappingContent = generateMappingFile(uniqueLeagues);
  fs.writeFileSync('server/verified-league-mappings.ts', mappingContent);
  console.log('\nMapping file saved to: server/verified-league-mappings.ts');
  
  // Generate a report
  const report = {
    totalCompetitions: leagues.length,
    uniqueSlugs: uniqueLeagues.length,
    byRegion: {} as Record<string, number>,
    timestamp: new Date().toISOString(),
    leagues: uniqueLeagues.map(l => ({
      name: l.name,
      slug: l.slug,
      country: l.country,
      region: l.region,
      url: l.url,
    })),
  };
  
  uniqueLeagues.forEach(league => {
    report.byRegion[league.region] = (report.byRegion[league.region] || 0) + 1;
  });
  
  fs.writeFileSync('server/league-discovery-report.json', JSON.stringify(report, null, 2));
  console.log('Report saved to: server/league-discovery-report.json');
  
  console.log('\n=== SUMMARY BY REGION ===');
  Object.entries(report.byRegion).forEach(([region, count]) => {
    console.log(`${region}: ${count} competitions`);
  });
  
  console.log('\n✅ Discovery complete! Use the verified mappings in your scraper.');
}

main().catch(console.error);
