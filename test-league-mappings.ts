/**
 * Quick test to demonstrate the comprehensive league mapping solution
 */

import { getLeagueSlug, COMPREHENSIVE_LEAGUE_MAPPINGS } from './server/league-mappings-comprehensive';

console.log('='.repeat(80));
console.log('TESTING COMPREHENSIVE LEAGUE MAPPINGS');
console.log('='.repeat(80));

// Test cases from the user's list
const testCases = [
  // Europe
  'Albania Super League 2025/2026',
  'Austria Admiral Bundesliga 2025/2026',
  'Belgium Jupiler League 2025/2026',
  'Croatia HNL 2025/2026',
  'Czechia Fortuna Liga 2025/2026',
  'Denmark Superliga 2025/2026',
  'England Premier League 2025/2026',
  'England Championship 2025/2026',
  'Germany Bundesliga 2025/2026',
  'Germany 2. Bundesliga 2025/2026',
  'Greece Super League 2025/2026',
  'Hungary OTP Bank Liga NB1 2025/2026',
  'Italy Serie A 2025/2026',
  'Netherlands Eredivisie 2025/2026',
  'Poland Ekstraklasa 2025/2026',
  'Portugal Liga Portugal 2025/2026',
  'Scotland Scottish Premiership 2025/2026',
  'Spain La Liga 2025/2026',
  'Turkey Süper Lig 2025/2026',
  
  // International
  'UEFA Champions League 2025/2026',
  'UEFA Europa League 2025/2026',
  'UEFA Europa Conference League 2025/2026',
  
  // Americas
  'United States MLS 2025',
  'Argentina Liga Profesional 2025',
  'Brazil Série A 2025',
  'Mexico Liga BBVA MX 2025/2026',
  
  // CONMEBOL
  'CONMEBOL Copa Libertadores 2025',
  'CONMEBOL Copa Sudamericana 2025',
  
  // Asia
  'Japan J League 2025',
  'Singapore S-League 2025/2026',
  'Australia A-League 2025/2026',
];

console.log(`\nTesting ${testCases.length} league mappings...\n`);

let successCount = 0;
let failCount = 0;

testCases.forEach((leagueName, index) => {
  const slug = getLeagueSlug(leagueName);
  
  if (slug) {
    successCount++;
    const url = `https://sportstats365.com/football/${slug}`;
    console.log(`✅ [${index + 1}/${testCases.length}] ${leagueName}`);
    console.log(`   → ${slug}`);
    console.log(`   → ${url}\n`);
  } else {
    failCount++;
    console.log(`❌ [${index + 1}/${testCases.length}] ${leagueName}`);
    console.log(`   → NO MAPPING FOUND\n`);
  }
});

console.log('='.repeat(80));
console.log('TEST RESULTS');
console.log('='.repeat(80));
console.log(`Total tests: ${testCases.length}`);
console.log(`✅ Successful: ${successCount} (${Math.round(successCount / testCases.length * 100)}%)`);
console.log(`❌ Failed: ${failCount} (${Math.round(failCount / testCases.length * 100)}%)`);
console.log('='.repeat(80));

console.log(`\nTotal unique mappings in database: ${Object.keys(COMPREHENSIVE_LEAGUE_MAPPINGS).length}`);
console.log('='.repeat(80));
