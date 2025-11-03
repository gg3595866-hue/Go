/**
 * Script to validate all league URL mappings
 * Tests each mapping to ensure URLs are accessible
 */

import cloudscraper from 'cloudscraper';
import { COMPREHENSIVE_LEAGUE_MAPPINGS } from './league-mappings-comprehensive';
import * as fs from 'fs';

interface ValidationResult {
  leagueName: string;
  slug: string;
  url: string;
  status: 'success' | 'failed' | 'error';
  statusCode?: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLeagueUrl(slug: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const url = `https://sportstats365.com/football/${slug}`;
  
  try {
    const result: any = await new Promise((resolve, reject) => {
      cloudscraper.get({
        uri: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }, (error: any, response: any, body: string) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: response.statusCode === 200, statusCode: response.statusCode });
        }
      });
    });
    
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function validateAllMappings(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const uniqueSlugs = new Set<string>();
  
  // Get unique slugs to test (avoid duplicates)
  for (const [leagueName, slug] of Object.entries(COMPREHENSIVE_LEAGUE_MAPPINGS)) {
    uniqueSlugs.add(slug);
  }
  
  console.log(`\n🔍 Testing ${uniqueSlugs.size} unique league URLs...\n`);
  
  let tested = 0;
  for (const slug of uniqueSlugs) {
    tested++;
    const url = `https://sportstats365.com/football/${slug}`;
    
    // Find a league name for this slug
    const leagueName = Object.entries(COMPREHENSIVE_LEAGUE_MAPPINGS)
      .find(([_, s]) => s === slug)?.[0] || slug;
    
    console.log(`[${tested}/${uniqueSlugs.size}] Testing: ${slug}`);
    
    const testResult = await testLeagueUrl(slug);
    
    results.push({
      leagueName,
      slug,
      url,
      status: testResult.success ? 'success' : 'failed',
      statusCode: testResult.statusCode,
      error: testResult.error,
    });
    
    if (testResult.success) {
      console.log(`  ✓ Success (HTTP ${testResult.statusCode})`);
    } else {
      console.log(`  ✗ Failed: ${testResult.error || `HTTP ${testResult.statusCode}`}`);
    }
    
    // Rate limiting - wait between requests
    await sleep(1000);
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('LEAGUE URL MAPPING VALIDATION');
  console.log('='.repeat(80));
  console.log(`Total mappings: ${Object.keys(COMPREHENSIVE_LEAGUE_MAPPINGS).length}`);
  
  const results = await validateAllMappings();
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tested: ${results.length}`);
  console.log(`Successful: ${successful} (${Math.round(successful / results.length * 100)}%)`);
  console.log(`Failed: ${failed} (${Math.round(failed / results.length * 100)}%)`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED URLS:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`  - ${r.slug}: ${r.error || `HTTP ${r.statusCode}`}`);
      });
  }
  
  // Save results to file
  const reportPath = 'validation-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(80));
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}
