/**
 * Script to discover ALL correct league URLs from sportstats365.com
 * This will create a comprehensive mapping for all leagues
 */

import * as cheerio from 'cheerio';
import httpClient from './http-client';
import * as fs from 'fs';
import * as path from 'path';

interface LeagueMapping {
  displayName: string;
  url: string;
  slug: string;
  country: string;
  category: string;
}

// Normalized list of all competitions from the website
const ALL_COMPETITIONS = [
  // Europe - Albania
  { name: 'Super League 2025/2026', country: 'Albania', category: 'Europe' },
  
  // Europe - Austria
  { name: 'Liga 2025/2026', country: 'Austria', category: 'Europe' },
  { name: 'Admiral Bundesliga 2025/2026', country: 'Austria', category: 'Europe' },
  { name: 'ÖFB Stiegl Cup 2025/2026', country: 'Austria', category: 'Europe' },
  
  // Europe - Belarus
  { name: 'Vysheyshaya Liga 2025', country: 'Belarus', category: 'Europe' },
  
  // Europe - Belgium
  { name: 'Belgian Cup 2025/2026', country: 'Belgium', category: 'Europe' },
  { name: 'Challenger Pro League 2025/2026', country: 'Belgium', category: 'Europe' },
  { name: 'Jupiler League 2025/2026', country: 'Belgium', category: 'Europe' },
  
  // Europe - Bosnia & Herzegovina
  { name: 'Premier Liga 2025/2026', country: 'Bosnia & Herzegovina', category: 'Europe' },
  
  // Europe - Bulgaria
  { name: 'Parva Liga 2025/2026', country: 'Bulgaria', category: 'Europe' },
  
  // Europe - Croatia
  { name: 'HNL 2025/2026', country: 'Croatia', category: 'Europe' },
  { name: 'HR Nogometni Cup 2025/2026', country: 'Croatia', category: 'Europe' },
  
  // Europe - Czechia
  { name: 'Czech Cup 2025/2026', country: 'Czechia', category: 'Europe' },
  { name: 'FNL 2025/2026', country: 'Czechia', category: 'Europe' },
  { name: 'Fortuna Liga 2025/2026', country: 'Czechia', category: 'Europe' },
  
  // Europe - Denmark
  { name: '1st Division 2025/2026', country: 'Denmark', category: 'Europe' },
  { name: 'Danish Landspokal 2025/2026', country: 'Denmark', category: 'Europe' },
  { name: 'Superliga 2025/2026', country: 'Denmark', category: 'Europe' },
  
  // Europe - England
  { name: 'Carling Cup 2025/2026', country: 'England', category: 'Europe' },
  { name: 'Championship 2025/2026', country: 'England', category: 'Europe' },
  { name: 'FA Community Shield 2025', country: 'England', category: 'Europe' },
  { name: 'FA Cup 2025/2026', country: 'England', category: 'Europe' },
  { name: 'FA Trophy 2025/2026', country: 'England', category: 'Europe' },
  { name: 'LDV Trophy 2025/2026', country: 'England', category: 'Europe' },
  { name: 'League One 2025/2026', country: 'England', category: 'Europe' },
  { name: 'League Two 2025/2026', country: 'England', category: 'Europe' },
  { name: 'National League 2025/2026', country: 'England', category: 'Europe' },
  { name: 'Premier League 2025/2026', country: 'England', category: 'Europe' },
  
  // Europe - Estonia
  { name: 'Meistriliiga 2025', country: 'Estonia', category: 'Europe' },
  
  // Europe - Germany
  { name: 'Bundesliga 2025/2026', country: 'Germany', category: 'Europe' },
  { name: 'Liga 2025/2026', country: 'Germany', category: 'Europe' },
  { name: 'Liga Nord 2007/2008', country: 'Germany', category: 'Europe' },
  { name: 'Liga Süd 2007/2008', country: 'Germany', category: 'Europe' },
  { name: '2. Bundesliga 2025/2026', country: 'Germany', category: 'Europe' },
  { name: 'DFB Cup 2025/2026', country: 'Germany', category: 'Europe' },
  
  // Europe - Greece
  { name: 'Greek Cup 2025/2026', country: 'Greece', category: 'Europe' },
  { name: 'Super League 2025/2026', country: 'Greece', category: 'Europe' },
  { name: 'Super League 2 2025/2026', country: 'Greece', category: 'Europe' },
  
  // Europe - Hungary
  { name: 'Hungarian Cup 2025/2026', country: 'Hungary', category: 'Europe' },
  { name: 'League Cup 2014/2015', country: 'Hungary', category: 'Europe' },
  { name: 'League Cup II. 2007/2008', country: 'Hungary', category: 'Europe' },
  { name: 'NB II 2025/2026', country: 'Hungary', category: 'Europe' },
  { name: 'NB II East 2012/2013', country: 'Hungary', category: 'Europe' },
  { name: 'NB II West 2012/2013', country: 'Hungary', category: 'Europe' },
  { name: 'OTP Bank Liga NB1 2025/2026', country: 'Hungary', category: 'Europe' },
  
  // Europe - Iceland
  { name: 'Besta Deild Karla 2025', country: 'Iceland', category: 'Europe' },
  
  // Europe - Ireland
  { name: 'FAI Cup 2025', country: 'Ireland', category: 'Europe' },
  { name: 'First Division 2025', country: 'Ireland', category: 'Europe' },
  { name: 'Premier Division 2025', country: 'Ireland', category: 'Europe' },
  
  // Europe - Italy
  { name: 'Coppa Italia 2025/2026', country: 'Italy', category: 'Europe' },
  { name: 'Serie A 2025/2026', country: 'Italy', category: 'Europe' },
  { name: 'Serie B 2025/2026', country: 'Italy', category: 'Europe' },
  
  // Europe - Latvia
  { name: 'Virsliga 2025', country: 'Latvia', category: 'Europe' },
  
  // Europe - Lithuania
  { name: 'A Lyga 2025', country: 'Lithuania', category: 'Europe' },
  
  // Europe - Moldavia
  { name: 'Super Liga 2025/2026', country: 'Moldavia', category: 'Europe' },
  
  // Europe - Montenegro
  { name: 'CFL League 2025/2026', country: 'Montenegro', category: 'Europe' },
  
  // Europe - Netherlands
  { name: 'Eerste Divisie 2025/2026', country: 'Netherlands', category: 'Europe' },
  { name: 'Eredivisie 2025/2026', country: 'Netherlands', category: 'Europe' },
  { name: 'KNVB Beker 2025/2026', country: 'Netherlands', category: 'Europe' },
  
  // Europe - North Macedonia
  { name: 'First League 2025/2026', country: 'North Macedonia', category: 'Europe' },
  
  // Europe - Norway
  { name: 'Eliteserien 2025', country: 'Norway', category: 'Europe' },
  { name: 'Norwegian NM Cup 2025/2026', country: 'Norway', category: 'Europe' },
  { name: 'OBOS-ligaen 2025', country: 'Norway', category: 'Europe' },
  
  // Europe - Poland
  { name: 'Ekstraklasa 2025/2026', country: 'Poland', category: 'Europe' },
  { name: 'I Liga 2025/2026', country: 'Poland', category: 'Europe' },
  { name: 'Polish Cup 2025/2026', country: 'Poland', category: 'Europe' },
  
  // Europe - Portugal
  { name: 'Liga Portugal 2025/2026', country: 'Portugal', category: 'Europe' },
  { name: 'Liga Portugal 2 2025/2026', country: 'Portugal', category: 'Europe' },
  { name: 'Taça de Portugal 2025/2026', country: 'Portugal', category: 'Europe' },
  
  // Europe - Romania
  { name: 'Liga I 2025/2026', country: 'Romania', category: 'Europe' },
  { name: 'Liga II 2025/2026', country: 'Romania', category: 'Europe' },
  { name: 'Liga II - Serie 1 2015/2016', country: 'Romania', category: 'Europe' },
  { name: 'Liga II - Serie 2 2015/2016', country: 'Romania', category: 'Europe' },
  { name: 'Romanian Cup 2025/2026', country: 'Romania', category: 'Europe' },
  
  // Europe - Russia
  { name: 'Premier League 2025/2026', country: 'Russia', category: 'Europe' },
  { name: 'Russian Cup 2025/2026', country: 'Russia', category: 'Europe' },
  
  // Europe - Scotland
  { name: 'Challenge Cup 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'League Cup 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'Scottish Championship 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'Scottish Cup 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'Scottish League One 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'Scottish League Two 2025/2026', country: 'Scotland', category: 'Europe' },
  { name: 'Scottish Premiership 2025/2026', country: 'Scotland', category: 'Europe' },
  
  // Europe - Serbia
  { name: 'Serbian Cup 2025/2026', country: 'Serbia', category: 'Europe' },
  { name: 'Super Liga 2025/2026', country: 'Serbia', category: 'Europe' },
  
  // Europe - Slovakia
  { name: 'Niké Liga 2025/2026', country: 'Slovakia', category: 'Europe' },
  { name: 'Slovakian Cup 2025/2026', country: 'Slovakia', category: 'Europe' },
  
  // Europe - Slovenia
  { name: 'Liga SNL 2025/2026', country: 'Slovenia', category: 'Europe' },
  { name: 'Prva Liga 2025/2026', country: 'Slovenia', category: 'Europe' },
  { name: 'Slovenian Cup 2025/2026', country: 'Slovenia', category: 'Europe' },
  
  // Europe - Spain
  { name: 'Copa del Rey 2025/2026', country: 'Spain', category: 'Europe' },
  { name: 'La Liga 2025/2026', country: 'Spain', category: 'Europe' },
  { name: 'La Liga 2 2025/2026', country: 'Spain', category: 'Europe' },
  { name: 'Primera RFEF - Group I 2025/2026', country: 'Spain', category: 'Europe' },
  { name: 'Primera RFEF - Group II 2025/2026', country: 'Spain', category: 'Europe' },
  { name: 'Segunda B - Group III 2020/2021', country: 'Spain', category: 'Europe' },
  { name: 'Segunda B - Group IV 2020/2021', country: 'Spain', category: 'Europe' },
  
  // Europe - Sweden
  { name: 'Allsvenskan 2025', country: 'Sweden', category: 'Europe' },
  { name: 'Superettan 2025', country: 'Sweden', category: 'Europe' },
  { name: 'Svenska Cupen 2025/2026', country: 'Sweden', category: 'Europe' },
  
  // Europe - Switzerland
  { name: 'Challenge League 2025/2026', country: 'Switzerland', category: 'Europe' },
  { name: 'Schweizer Pokal 2025/2026', country: 'Switzerland', category: 'Europe' },
  { name: 'Super League 2025/2026', country: 'Switzerland', category: 'Europe' },
  
  // Europe - Turkey
  { name: 'Süper Lig 2025/2026', country: 'Turkey', category: 'Europe' },
  { name: 'Türkiye Kupası 2025/2026', country: 'Turkey', category: 'Europe' },
  
  // Europe - Ukraine
  { name: 'Premier League 2025/2026', country: 'Ukraine', category: 'Europe' },
  { name: 'Ukranian Cup 2025/2026', country: 'Ukraine', category: 'Europe' },
  
  // Europe - Wales
  { name: 'FA Cup 2025/2026', country: 'Wales', category: 'Europe' },
  { name: 'Premier League 2025/2026', country: 'Wales', category: 'Europe' },
  
  // International - UEFA
  { name: 'Champions League 2025/2026', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'Champions League Qualification 2025/2026', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'EURO 2024', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'EURO - Promotion 2011', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'EURO Qualifiers 2023/2024', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'Europa Conference League 2025/2026', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'Europa League 2025/2026', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'UEFA Cup 2008/2009', country: 'UEFA', category: 'International - European Confederations' },
  { name: 'World Cup Qualifiers - Europe 2025/2026', country: 'UEFA', category: 'International - European Confederations' },
  
  // International - AFC
  { name: 'World Cup Qualifiers - Asia 2023/2024', country: 'AFC', category: 'International - Other Confederations' },
  
  // International - CAF
  { name: 'African Nation Cup 2024', country: 'CAF', category: 'International - Other Confederations' },
  { name: 'World Cup Qualifiers - Africa 2023/2024', country: 'CAF', category: 'International - Other Confederations' },
  
  // International - CONCACAF
  { name: 'World Cup Qualifiers - N+C America 2024/2025', country: 'CONCACAF', category: 'International - Other Confederations' },
  
  // International - CONMEBOL
  { name: 'Copa Libertadores 2025', country: 'CONMEBOL', category: 'International - Other Confederations' },
  { name: 'Copa Sudamericana 2025', country: 'CONMEBOL', category: 'International - Other Confederations' },
  { name: 'World Cup Qualifiers - South America 2023/2024', country: 'CONMEBOL', category: 'International - Other Confederations' },
  
  // International - FIFA
  { name: 'World Cup 2022', country: 'FIFA', category: 'International - Other Confederations' },
  
  // International - OFC
  { name: 'World Cup Qualifiers - Oceania 2024/2025', country: 'OFC', category: 'International - Other Confederations' },
  
  // International (General)
  { name: 'Confederations Cup 2017', country: 'International', category: 'International (General)' },
  { name: 'International Friendlies 2025', country: 'International', category: 'International (General)' },
  { name: 'Intertoto Cup 2008', country: 'International', category: 'International (General)' },
  
  // North America - United States
  { name: 'MLS 2025', country: 'United States', category: 'North America' },
  
  // South America - Argentina
  { name: 'Liga Profesional 2025', country: 'Argentina', category: 'South America' },
  
  // South America - Brazil
  { name: 'Série A 2025', country: 'Brazil', category: 'South America' },
  
  // South America - Chile
  { name: 'Primera División 2025', country: 'Chile', category: 'South America' },
  
  // South America - Colombia
  { name: 'Primera A 2025', country: 'Colombia', category: 'South America' },
  
  // South America - Ecuador
  { name: 'Liga Pro 2025', country: 'Ecuador', category: 'South America' },
  
  // South America - Mexico
  { name: 'Liga BBVA MX 2025/2026', country: 'Mexico', category: 'South America' },
  
  // South America - Uruguay
  { name: 'Primera División 2025', country: 'Uruguay', category: 'South America' },
  
  // South America - Venezuela
  { name: 'Primera División 2025', country: 'Venezuela', category: 'South America' },
  
  // Asia - Japan
  { name: 'J League 2025', country: 'Japan', category: 'Asia' },
  
  // Asia - Singapore
  { name: 'S-League 2025/2026', country: 'Singapore', category: 'Asia' },
  
  // Australia
  { name: 'A-League 2025/2026', country: 'Australia', category: 'Australia' },
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim();
}

function createSlug(text: string): string {
  const cleaned = text.replace(/\s+\d{4}(\/\d{4})?$/g, '').trim();
  return normalizeText(cleaned)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const html: string = await new Promise((resolve, reject) => {
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
        } else if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    return html;
  } catch (error) {
    return null;
  }
}

function extractPageLeagueName(html: string): string {
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() ||
                $('title').text().replace(/\s*\|\s*.*$/, '').trim();
  return title;
}

async function discoverLeagueUrl(
  competitionName: string,
  country: string
): Promise<{ slug: string; url: string } | null> {
  console.log(`\n🔍 Discovering URL for: ${country} - ${competitionName}`);
  
  // Generate possible slug variations
  const baseName = competitionName.replace(/\s+\d{4}(\/\d{4})?$/g, '').trim();
  const variations: string[] = [];
  
  // Add various slug patterns
  variations.push(createSlug(baseName));
  variations.push(createSlug(`${country} ${baseName}`));
  
  // Try country-specific patterns
  const countrySlug = createSlug(country);
  variations.push(createSlug(baseName) + `-${countrySlug.substring(0, 2)}`);
  variations.push(countrySlug + '-' + createSlug(baseName));
  
  // Try without common suffixes
  const withoutSuffixes = baseName
    .replace(/\s+(league|liga|division|cup|championship|premiership|super|primera|serie)$/i, '');
  if (withoutSuffixes !== baseName) {
    variations.push(createSlug(withoutSuffixes));
  }
  
  // Try numbered variations
  if (baseName.match(/^\d+/)) {
    const withDash = baseName.replace(/^(\d+)\.\s*/, '$1-');
    variations.push(createSlug(withDash));
  }
  
  // Remove duplicates
  const uniqueVariations = Array.from(new Set(variations));
  
  console.log(`  Testing ${uniqueVariations.length} variations...`);
  
  for (const slug of uniqueVariations) {
    const testUrl = `https://sportstats365.com/football/${slug}`;
    console.log(`  Trying: ${slug}`);
    
    const html = await fetchPage(testUrl);
    if (html) {
      const pageTitle = extractPageLeagueName(html);
      console.log(`  ✓ Found page: "${pageTitle}"`);
      console.log(`  ✓ URL: ${testUrl}`);
      return { slug, url: testUrl };
    }
    
    await sleep(500); // Rate limiting
  }
  
  console.log(`  ✗ No valid URL found`);
  return null;
}

async function discoverAllLeagues(): Promise<LeagueMapping[]> {
  const mappings: LeagueMapping[] = [];
  const total = ALL_COMPETITIONS.length;
  let current = 0;
  
  console.log(`\n🚀 Starting discovery for ${total} competitions...\n`);
  
  for (const comp of ALL_COMPETITIONS) {
    current++;
    console.log(`\n[${current}/${total}] Processing ${comp.country} - ${comp.name}`);
    
    const result = await discoverLeagueUrl(comp.name, comp.country);
    
    if (result) {
      mappings.push({
        displayName: comp.name,
        url: result.url,
        slug: result.slug,
        country: comp.country,
        category: comp.category,
      });
      console.log(`✅ Success`);
    } else {
      console.log(`❌ Failed to discover URL`);
    }
    
    // Save progress every 10 competitions
    if (current % 10 === 0) {
      const progressFile = path.join(__dirname, '..', 'league-url-mappings-progress.json');
      fs.writeFileSync(progressFile, JSON.stringify(mappings, null, 2));
      console.log(`\n💾 Progress saved (${mappings.length}/${current} successful)\n`);
    }
  }
  
  return mappings;
}

async function main() {
  console.log('='.repeat(80));
  console.log('LEAGUE URL DISCOVERY SCRIPT');
  console.log('='.repeat(80));
  
  const mappings = await discoverAllLeagues();
  
  // Save final results
  const outputFile = path.join(__dirname, '..', 'league-url-mappings.json');
  fs.writeFileSync(outputFile, JSON.stringify(mappings, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Discovery complete!`);
  console.log(`   Total competitions: ${ALL_COMPETITIONS.length}`);
  console.log(`   Successfully mapped: ${mappings.length}`);
  console.log(`   Failed: ${ALL_COMPETITIONS.length - mappings.length}`);
  console.log(`   Output: ${outputFile}`);
  console.log('='.repeat(80));
  
  // Generate TypeScript code for the mapping
  const tsMapping = mappings.reduce((acc, m) => {
    const cleanName = m.displayName.replace(/\s+\d{4}(\/\d{4})?$/g, '').trim();
    acc[cleanName] = m.slug;
    return acc;
  }, {} as Record<string, string>);
  
  const tsCode = `// Auto-generated league URL mappings\nexport const LEAGUE_SLUG_MAP: Record<string, string> = ${JSON.stringify(tsMapping, null, 2)};\n`;
  
  const tsOutputFile = path.join(__dirname, 'league-url-mappings.ts');
  fs.writeFileSync(tsOutputFile, tsCode);
  
  console.log(`   TypeScript mapping: ${tsOutputFile}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
