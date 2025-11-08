import type { MatchStats, TeamRating, InsertTeamRating } from '@shared/schema';
import { updateTeamRatingFromMatch, createDefaultTeamRating } from './rating-system';

export interface HistoricalRatingSnapshot {
  matchId: number;
  matchDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeRatingBeforeMatch: TeamRating;
  awayRatingBeforeMatch: TeamRating;
}

/**
 * Create a full TeamRating object with all required fields for a new team
 */
function createFullTeamRating(teamId: number): TeamRating {
  const defaultRating = createDefaultTeamRating(teamId);
  return {
    id: 0, // Will be assigned by database
    teamId,
    ...defaultRating,
    updatedAt: new Date(),
    createdAt: new Date(),
  } as TeamRating;
}

/**
 * Build team ratings progressively by processing matches in chronological order.
 * For each match, captures the team ratings BEFORE the match was played.
 * This ensures no temporal data leakage - ratings reflect only historical information.
 */
export function buildTimeAwareRatings(
  matches: MatchStats[]
): {
  historicalSnapshots: Map<number, HistoricalRatingSnapshot>;
  finalRatings: Map<number, TeamRating>;
} {
  console.log('\n⏰ Building time-aware team ratings chronologically...');
  
  // Sort matches by date (oldest first)
  const sortedMatches = [...matches]
    .filter(m => m.matchDate != null)
    .sort((a, b) => {
      const dateA = new Date(a.matchDate!).getTime();
      const dateB = new Date(b.matchDate!).getTime();
      return dateA - dateB;
    });
  
  if (sortedMatches.length === 0) {
    console.log('  ⚠️  No matches with dates found');
    return {
      historicalSnapshots: new Map(),
      finalRatings: new Map(),
    };
  }
  
  const earliestDate = new Date(sortedMatches[0].matchDate!);
  const latestDate = new Date(sortedMatches[sortedMatches.length - 1].matchDate!);
  
  console.log(`  📅 Processing ${sortedMatches.length} matches from ${earliestDate.toISOString().split('T')[0]} to ${latestDate.toISOString().split('T')[0]}`);
  
  // Initialize ratings map - starts empty, teams get default ratings when first encountered
  const currentRatings = new Map<number, TeamRating>();
  
  // Store historical snapshots: rating state BEFORE each match
  const historicalSnapshots = new Map<number, HistoricalRatingSnapshot>();
  
  let processedCount = 0;
  const progressInterval = Math.max(1, Math.floor(sortedMatches.length / 10));
  
  // Process matches chronologically
  for (const match of sortedMatches) {
    // Skip matches without complete results
    if (match.ftHomeScore === null || match.ftAwayScore === null || !match.ftResult) {
      continue;
    }
    
    // Get or create ratings for both teams
    let homeRating = currentRatings.get(match.homeTeamId);
    if (!homeRating) {
      homeRating = createFullTeamRating(match.homeTeamId);
      currentRatings.set(match.homeTeamId, homeRating);
    }
    
    let awayRating = currentRatings.get(match.awayTeamId);
    if (!awayRating) {
      awayRating = createFullTeamRating(match.awayTeamId);
      currentRatings.set(match.awayTeamId, awayRating);
    }
    
    // CRITICAL: Store a snapshot of ratings BEFORE this match
    // This snapshot represents what we knew about the teams before they played
    historicalSnapshots.set(match.id, {
      matchId: match.id,
      matchDate: new Date(match.matchDate!),
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeRatingBeforeMatch: { ...homeRating },
      awayRatingBeforeMatch: { ...awayRating },
    });
    
    // Now update ratings based on this match's actual result
    const homeUpdate = updateTeamRatingFromMatch(homeRating, awayRating, match, true);
    const awayUpdate = updateTeamRatingFromMatch(awayRating, homeRating, match, false);
    
    // Apply updates to current ratings (for next match)
    currentRatings.set(match.homeTeamId, {
      ...homeRating,
      ...homeUpdate,
      updatedAt: new Date(),
    } as TeamRating);
    currentRatings.set(match.awayTeamId, {
      ...awayRating,
      ...awayUpdate,
      updatedAt: new Date(),
    } as TeamRating);
    
    processedCount++;
    if (processedCount % progressInterval === 0) {
      const progress = Math.round((processedCount / sortedMatches.length) * 100);
      console.log(`  ⚙️  Progress: ${progress}% (${processedCount}/${sortedMatches.length} matches)`);
    }
  }
  
  console.log(`  ✅ Built ${currentRatings.size} team ratings from ${processedCount} matches`);
  console.log(`  📸 Created ${historicalSnapshots.size} historical rating snapshots`);
  
  // Show example of rating evolution for a random team
  if (currentRatings.size > 0) {
    const exampleTeamId = Array.from(currentRatings.keys())[0];
    const finalRating = currentRatings.get(exampleTeamId)!;
    console.log(`  📊 Example team ${exampleTeamId}: ${finalRating.totalMatches} matches, ELO=${finalRating.eloRating.toFixed(0)}, Attack=${finalRating.attackRating.toFixed(0)}, Defense=${finalRating.defenseRating.toFixed(0)}`);
  }
  
  return {
    historicalSnapshots,
    finalRatings: currentRatings,
  };
}

/**
 * Get team ratings for a specific match, using only historical data available before that match.
 * Returns the rating snapshot from BEFORE the match was played.
 */
export function getRatingsForMatch(
  matchId: number,
  historicalSnapshots: Map<number, HistoricalRatingSnapshot>
): {
  homeRating: TeamRating | undefined;
  awayRating: TeamRating | undefined;
} {
  const snapshot = historicalSnapshots.get(matchId);
  
  if (!snapshot) {
    return {
      homeRating: undefined,
      awayRating: undefined,
    };
  }
  
  return {
    homeRating: snapshot.homeRatingBeforeMatch,
    awayRating: snapshot.awayRatingBeforeMatch,
  };
}

/**
 * Validate that ratings are time-aware by checking that a team's rating increases
 * with more matches played (in general trend).
 */
export function validateTimeAwareRatings(
  matches: MatchStats[],
  historicalSnapshots: Map<number, HistoricalRatingSnapshot>
): {
  isValid: boolean;
  issues: string[];
  stats: {
    avgMatchesAtFirstAppearance: number;
    avgMatchesAtLastAppearance: number;
    avgEloGrowth: number;
  };
} {
  const issues: string[] = [];
  
  // Group matches by team to track rating evolution
  const teamMatchHistory = new Map<number, Array<{
    date: Date;
    matchId: number;
    totalMatches: number;
    eloRating: number;
  }>>();
  
  // Sort matches chronologically
  const sortedMatches = [...matches]
    .filter(m => m.matchDate != null)
    .sort((a, b) => new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime());
  
  for (const match of sortedMatches) {
    const snapshot = historicalSnapshots.get(match.id);
    if (!snapshot) continue;
    
    // Track home team
    if (!teamMatchHistory.has(match.homeTeamId)) {
      teamMatchHistory.set(match.homeTeamId, []);
    }
    teamMatchHistory.get(match.homeTeamId)!.push({
      date: new Date(match.matchDate!),
      matchId: match.id,
      totalMatches: snapshot.homeRatingBeforeMatch.totalMatches,
      eloRating: snapshot.homeRatingBeforeMatch.eloRating,
    });
    
    // Track away team
    if (!teamMatchHistory.has(match.awayTeamId)) {
      teamMatchHistory.set(match.awayTeamId, []);
    }
    teamMatchHistory.get(match.awayTeamId)!.push({
      date: new Date(match.matchDate!),
      matchId: match.id,
      totalMatches: snapshot.awayRatingBeforeMatch.totalMatches,
      eloRating: snapshot.awayRatingBeforeMatch.eloRating,
    });
  }
  
  // Validate temporal consistency
  let totalMatchesGrowth = 0;
  let totalEloChange = 0;
  let teamCount = 0;
  
  for (const [teamId, history] of teamMatchHistory.entries()) {
    if (history.length < 2) continue;
    
    const first = history[0];
    const last = history[history.length - 1];
    
    // Check 1: Total matches should increase over time
    if (last.totalMatches < first.totalMatches) {
      issues.push(`Team ${teamId}: matches decreased from ${first.totalMatches} to ${last.totalMatches}`);
    }
    
    // Check 2: Verify chronological processing
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      
      // Date should always increase
      if (curr.date < prev.date) {
        issues.push(`Team ${teamId}: date went backwards at match ${curr.matchId}`);
      }
      
      // Total matches should increase or stay same
      if (curr.totalMatches < prev.totalMatches) {
        issues.push(`Team ${teamId}: total matches decreased from ${prev.totalMatches} to ${curr.totalMatches}`);
      }
    }
    
    totalMatchesGrowth += (last.totalMatches - first.totalMatches);
    totalEloChange += (last.eloRating - first.eloRating);
    teamCount++;
  }
  
  const stats = {
    avgMatchesAtFirstAppearance: teamCount > 0 ? 
      Array.from(teamMatchHistory.values()).reduce((sum, h) => sum + h[0].totalMatches, 0) / teamCount : 0,
    avgMatchesAtLastAppearance: teamCount > 0 ?
      Array.from(teamMatchHistory.values()).reduce((sum, h) => sum + h[h.length - 1].totalMatches, 0) / teamCount : 0,
    avgEloGrowth: teamCount > 0 ? totalEloChange / teamCount : 0,
  };
  
  return {
    isValid: issues.length === 0,
    issues,
    stats,
  };
}
