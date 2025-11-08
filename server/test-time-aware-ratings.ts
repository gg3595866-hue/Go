import { buildTimeAwareRatings, validateTimeAwareRatings, getRatingsForMatch } from './time-aware-ratings';
import type { MatchStats } from '@shared/schema';

/**
 * Test the time-aware rating system with sample data
 */
export async function testTimeAwareRatings() {
  console.log('\n🧪 Testing Time-Aware Rating System\n');
  console.log('='.repeat(80));
  
  // Create sample matches spanning multiple dates
  const sampleMatches = [
    {
      id: 1,
      homeTeamId: 100,
      awayTeamId: 101,
      matchDate: new Date('2024-01-01'),
      ftHomeScore: 2,
      ftAwayScore: 1,
      htHomeScore: 1,
      htAwayScore: 0,
      ftResult: '1',
      leagueId: 1,
      countryId: 1,
    },
    {
      id: 2,
      homeTeamId: 100,
      awayTeamId: 102,
      matchDate: new Date('2024-01-08'),
      ftHomeScore: 1,
      ftAwayScore: 1,
      htHomeScore: 0,
      htAwayScore: 1,
      ftResult: 'X',
      leagueId: 1,
      countryId: 1,
    },
    {
      id: 3,
      homeTeamId: 101,
      awayTeamId: 102,
      matchDate: new Date('2024-01-15'),
      ftHomeScore: 0,
      ftAwayScore: 3,
      htHomeScore: 0,
      htAwayScore: 1,
      ftResult: '2',
      leagueId: 1,
      countryId: 1,
    },
    {
      id: 4,
      homeTeamId: 100,
      awayTeamId: 101,
      matchDate: new Date('2024-01-22'),
      ftHomeScore: 2,
      ftAwayScore: 0,
      htHomeScore: 1,
      htAwayScore: 0,
      ftResult: '1',
      leagueId: 1,
      countryId: 1,
    },
  ] as unknown as MatchStats[];
  
  console.log(`📊 Testing with ${sampleMatches.length} sample matches\n`);
  
  // Build time-aware ratings
  const { historicalSnapshots, finalRatings } = buildTimeAwareRatings(sampleMatches);
  
  console.log(`✅ Built ${finalRatings.size} team ratings`);
  console.log(`✅ Created ${historicalSnapshots.size} historical snapshots\n`);
  
  // Validate temporal consistency
  const validation = validateTimeAwareRatings(sampleMatches, historicalSnapshots);
  
  if (validation.isValid) {
    console.log('✅ Temporal consistency validated - no data leakage detected\n');
  } else {
    console.log('❌ Temporal consistency issues detected:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
  }
  
  console.log('📈 Statistics:');
  console.log(`  - Avg matches at first appearance: ${validation.stats.avgMatchesAtFirstAppearance.toFixed(1)}`);
  console.log(`  - Avg matches at last appearance: ${validation.stats.avgMatchesAtLastAppearance.toFixed(1)}`);
  console.log(`  - Avg ELO growth: ${validation.stats.avgEloGrowth > 0 ? '+' : ''}${validation.stats.avgEloGrowth.toFixed(1)}\n`);
  
  // Test specific match rating retrieval
  console.log('🔍 Testing historical rating retrieval:\n');
  
  for (const match of sampleMatches) {
    const { homeRating, awayRating } = getRatingsForMatch(match.id, historicalSnapshots);
    
    if (homeRating && awayRating) {
      console.log(`  Match ${match.id} (${match.matchDate?.toISOString().split('T')[0]}):`);
      console.log(`    Team ${match.homeTeamId} had ${homeRating.totalMatches} matches, ELO=${homeRating.eloRating.toFixed(0)}`);
      console.log(`    Team ${match.awayTeamId} had ${awayRating.totalMatches} matches, ELO=${awayRating.eloRating.toFixed(0)}`);
      console.log(`    Result: ${match.ftResult} (${match.ftHomeScore}-${match.ftAwayScore})`);
      console.log('');
    }
  }
  
  // Verify rating evolution
  console.log('📊 Final team ratings:\n');
  for (const [teamId, rating] of Array.from(finalRatings.entries())) {
    console.log(`  Team ${teamId}:`);
    console.log(`    Total matches: ${rating.totalMatches}`);
    console.log(`    ELO: ${rating.eloRating.toFixed(0)}`);
    console.log(`    Record: ${rating.wins}W-${rating.draws}D-${rating.losses}L`);
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('✅ Time-aware rating test complete!\n');
  
  return {
    historicalSnapshots,
    finalRatings,
    validation,
  };
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTimeAwareRatings()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}
