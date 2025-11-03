/**
 * Quick test for Argentina Liga Profesional mapping
 */

import { getLeagueSlug } from './server/league-mappings-comprehensive';
import { extractLeagueSlug } from './server/scraper';

const testName = 'Argentina Liga Profesional 2025';

console.log('='.repeat(60));
console.log('TESTING ARGENTINA LIGA PROFESIONAL MAPPING');
console.log('='.repeat(60));
console.log(`\nInput: "${testName}"`);

// Test the getLeagueSlug function
const slug1 = getLeagueSlug(testName);
console.log(`\ngetLeagueSlug() result: "${slug1}"`);

// Test the extractLeagueSlug function (what the scraper actually uses)
const slug2 = extractLeagueSlug(testName);
console.log(`extractLeagueSlug() result: "${slug2}"`);

// Expected URL
const expectedUrl = 'https://sportstats365.com/football/liga-profesional';
const actualUrl = `https://sportstats365.com/football/${slug2}`;

console.log(`\nExpected URL: ${expectedUrl}`);
console.log(`Actual URL:   ${actualUrl}`);

if (slug2 === 'liga-profesional') {
  console.log('\n✅ SUCCESS: Mapping is correct!');
} else {
  console.log(`\n❌ FAILED: Expected "liga-profesional" but got "${slug2}"`);
}

console.log('='.repeat(60));
