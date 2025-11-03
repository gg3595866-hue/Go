/**
 * Test the verified league mappings with real league names
 * from the user's list to ensure 100% accuracy
 */

import { getVerifiedLeagueSlug } from './verified-league-mappings';

// Test leagues from the user's comprehensive list
const testLeagues = [
  // Europe
  'Albania Super League 2025/2026',
  'Austria Admiral Bundesliga 2025/2026',
  'England Premier League 2025/2026',
  'England Championship 2025/2026',
  'England FA Cup 2025/2026',
  'England LDV Trophy 2025/2026',
  'Germany Bundesliga 2025/2026',
  'Spain La Liga 2025/2026',
  'Spain La Liga 2 2025/2026',
  'Spain Copa del Rey 2025/2026',
  'Spain Primera RFEF - Group I 2025/2026',
  'Spain Primera RFEF - Group II 2025/2026',
  'Italy Serie A 2025/2026',
  'France Ligue 1 2025/2026',
  'Portugal Liga Portugal 2025/2026',
  'Netherlands Eredivisie 2025/2026',
  'Belgium Jupiler League 2025/2026',
  'Turkey Süper Lig 2025/2026',
  'Scotland Scottish Premiership 2025/2026',
  'Denmark Superliga 2025/2026',
  'Sweden Allsvenskan 2025',
  'Norway Eliteserien 2025',
  'Poland Ekstraklasa 2025/2026',
  'Czechia Fortuna Liga 2025/2026',
  'Croatia HNL 2025/2026',
  'Greece Super League 2025/2026',
  'Hungary OTP Bank Liga NB1 2025/2026',
  'Romania Liga I 2025/2026',
  'Serbia Super Liga 2025/2026',
  'Bulgaria Parva Liga 2025/2026',
  
  // International
  'UEFA Champions League 2025/2026',
  'UEFA Europa League 2025/2026',
  'UEFA Europa Conference League 2025/2026',
  'Copa Libertadores 2025',
  'Copa Sudamericana 2025',
  'World Cup Qualifiers - Europe 2025/2026',
  'World Cup Qualifiers - South America 2023/2024',
  'World Cup Qualifiers - Africa 2023/2024',
  'World Cup Qualifiers - Asia 2023/2024',
  'World Cup Qualifiers - N+C America 2024/2025',
  
  // Americas
  'United States MLS 2025',
  'Argentina Liga Profesional 2025',
  'Brazil Série A 2025',
  'Mexico Liga BBVA MX 2025/2026',
  'Chile Primera División 2025',
  'Colombia Primera A 2025',
  'Uruguay Primera División 2025',
  
  // Asia & Australia
  'Japan J League 2025',
  'Singapore S-League 2025/2026',
  'Australia A-League 2025/2026',
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('TESTING VERIFIED LEAGUE MAPPINGS');
console.log('Testing with leagues from user\'s comprehensive list');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalTested = 0;
let totalFound = 0;
let totalNotFound = 0;

const foundLeagues: Array<{ name: string; slug: string; url: string }> = [];
const notFoundLeagues: string[] = [];

for (const leagueName of testLeagues) {
  totalTested++;
  const slug = getVerifiedLeagueSlug(leagueName);
  
  if (slug) {
    totalFound++;
    const url = `https://sportstats365.com/football/${slug}`;
    foundLeagues.push({ name: leagueName, slug, url });
    console.log(`✅ "${leagueName}"`);
    console.log(`   → slug: "${slug}"`);
    console.log(`   → URL: ${url}\n`);
  } else {
    totalNotFound++;
    notFoundLeagues.push(leagueName);
    console.log(`❌ NOT FOUND: "${leagueName}"\n`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST RESULTS SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total leagues tested: ${totalTested}`);
console.log(`Successfully mapped: ${totalFound} (${Math.round((totalFound / totalTested) * 100)}%)`);
console.log(`Not found: ${totalNotFound} (${Math.round((totalNotFound / totalTested) * 100)}%)`);

if (notFoundLeagues.length > 0) {
  console.log('\n❌ LEAGUES NOT FOUND IN VERIFIED MAPPINGS:');
  notFoundLeagues.forEach(league => {
    console.log(`   - ${league}`);
  });
  console.log('\nThese leagues need to be scraped from more fixture dates.');
  console.log('To update mappings: npx tsx server/extract-league-urls-from-fixtures.ts');
} else {
  console.log('\n🎉 ALL LEAGUES SUCCESSFULLY MAPPED!');
  console.log('The verified mappings provide 100% coverage for the tested leagues.');
}

console.log('\n═══════════════════════════════════════════════════════════════');
