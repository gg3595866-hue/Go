# Football Match Features Analysis

## Executive Summary

This document analyzes the 63 features you want to calculate for football match predictions and compares them against what our scraper currently extracts from Sportstats365.com.

**Test Match:** Qarabag FK vs Chelsea (Champions League)  
**URL:** https://sportstats365.com/football/champions-league/2025-2026/compare/garabag-azersun-agdam/chelsea/1018893  
**Analysis Date:** November 5, 2025

---

## Current Scraper Capabilities

### ✅ What We Currently Extract (24 fields)

From the main match page and HTMX endpoints, we extract:

1. **Basic Match Data:**
   - Home team, Away team
   - Full-time scores (home, away)
   - Half-time scores (home, away)
   - Match status, Time
   - Competition name & logo
   - Betting odds (1X2)

2. **Team Form (Last 5 matches):**
   - Last 5 results sequence (W/L/D)
   - Home form score
   - Away form score
   - Overall form score

3. **Team Statistics (from stats endpoint):**
   - Win percentage
   - Draw percentage
   - Loss percentage
   - Goals scored average
   - Goals conceded average
   - Clean sheet percentage
   - BTTS (Both Teams To Score) overall %
   - Win To Nil %
   - Win by 1 goal %
   - Win by 2+ goals %
   - Goals in 1st half %
   - Goals in 2nd half %
   - Half-time won/tied/lost %
   - Scored % (overall, home, away)
   - Scored against % (overall, home, away)

4. **League-Level Stats (from league pages):**
   - Home wins %
   - Draws %
   - Away wins %
   - Under 2.5 goals %
   - Over 2.5 goals %
   - Average goals per match

---

## Feature Requirements Analysis

### 📊 All 63 Required Features

#### **Category 1: Form Dynamics (10 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 1 | Win Rate | ✅ | ✅ | Already scraped as `winPercentage` |
| 2 | Draw Rate | ✅ | ✅ | Already scraped as `drawPercentage` |
| 3 | Loss Rate | ✅ | ✅ | Already scraped as `lossPercentage` |
| 4 | Points per Game | ✅ | ⚠️ | **Calculate:** (3×Wins + Draws) / Total (from standings) |
| 5 | Last 5 Form Index | ✅ | ✅ | Already scraped as `homeForm/awayForm` |
| 6 | Momentum Score | ⚠️ | ❌ | **Calculate:** Compare last 5 vs previous 5 |
| 7 | Home Win Rate | ⚠️ | ❌ | **Need:** Extract from "Home" tab in stats |
| 8 | Away Win Rate | ⚠️ | ❌ | **Need:** Extract from "Away" tab in stats |
| 9 | Win after trailing | ⚠️ | ❌ | **Need:** Scrape individual match results |
| 10 | HT to FT Conversion | ⚠️ | ❌ | **Need:** Compare HT and FT results from matches |

**Status:** 5/10 directly available, 5/10 need additional scraping or calculation

---

#### **Category 2: Goal Dynamics (12 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 11 | Avg Goals Scored | ✅ | ✅ | Already scraped as `goalsScored` |
| 12 | Avg Goals Conceded | ✅ | ✅ | Already scraped as `goalsConceded` |
| 13 | Goals per Half Ratio | ✅ | ⚠️ | **Calculate:** `goalsInFirstHalf` / `goalsInSecondHalf` |
| 14 | Clean Sheet % | ✅ | ✅ | Already scraped as `cleanSheetPercentage` |
| 15 | Failed to Score % | ⚠️ | ❌ | **Calculate:** 100% - `scoredPercent.overall` |
| 16 | % Over 0.5 | ⚠️ | ❌ | **Need:** Scrape from Over/Under section |
| 17 | % Over 1.5 | ⚠️ | ❌ | **Need:** Scrape from Over/Under section |
| 18 | % Over 2.5 | ⚠️ | ❌ | **Need:** Scrape from Over/Under section |
| 19 | % Over 3.5 | ⚠️ | ❌ | **Need:** Scrape from Over/Under section |
| 20 | % BTTS | ✅ | ✅ | Already scraped as `btts.overall` |
| 21 | % BTTS & Over 2.5 | ✅ | ✅ | Already scraped as `bttsAndOver25` |
| 22 | % BTTS & Win | ✅ | ✅ | Already scraped as `bttsAndWin` |

**Status:** 7/12 available, 5/12 need Over/Under stats scraping

---

#### **Category 3: Performance Efficiency (10 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 23 | Expected Win Ratio | ✅ | ⚠️ | **Calculate:** (1/avgOdds) × winRate |
| 24 | Odds Efficiency | ⚠️ | ❌ | **Need:** Historical odds vs results |
| 25 | Win-to-Odds Index | ✅ | ⚠️ | **Calculate:** actualWinRate / (1/avgOdds) |
| 26 | Performance Deviation | ⚠️ | ❌ | **Need:** Match-level data for variance calc |
| 27 | Points vs Odds | ⚠️ | ❌ | **Need:** Historical odds per match |
| 28 | Scoring Efficiency | ❌ | ❌ | **Not available** (need xG data) |
| 29 | Conversion Rate | ❌ | ❌ | **Not available** (need shots on target) |
| 30 | Defensive Stability | ✅ | ⚠️ | **Calculate:** cleanSheets + (matches with <2 conceded) |
| 31 | Margin Consistency | ⚠️ | ❌ | **Need:** Match-level goal margins |
| 32 | Performance under pressure | ⚠️ | ❌ | **Need:** Results when odds > 2.50 |

**Status:** 3/10 can be calculated, 4/10 need additional data, 3/10 not available (xG, shots)

---

#### **Category 4: Psychological/Context (8 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 33 | Win after Draw streak | ⚠️ | ❌ | **Need:** Sequence analysis from matches |
| 34 | Loss after Win streak | ⚠️ | ❌ | **Need:** Sequence analysis from matches |
| 35 | Home Crowd Factor | ⚠️ | ❌ | **Calculate:** homeWinRate - awayWinRate |
| 36 | Response to Conceding Early | ⚠️ | ❌ | **Need:** Match-level HT losing → FT result |
| 37 | Dominance Index | ❌ | ❌ | **Not available** (need possession & shots) |
| 38 | Control Ratio | ❌ | ❌ | **Not available** (need shots on target) |
| 39 | Discipline Factor | ❌ | ❌ | **Not available** (need cards data) |
| 40 | Late Goals % | ⚠️ | ❌ | **Need:** Goal timing data |

**Status:** 1/8 can be calculated, 3/8 need match sequences, 4/8 not available

---

#### **Category 5: Market-Specific (12 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 41 | Probability(1X2) | ✅ | ✅ | Already calculated from odds |
| 42 | Expected Value 1X2 | ✅ | ⚠️ | **Calculate:** (trueProb - impliedProb) × odds |
| 43 | Probability(BTTS) | ✅ | ✅ | Already scraped as `btts` |
| 44 | Probability(Over2.5) | ⚠️ | ❌ | **Need:** Over 2.5 stats |
| 45 | HT Win Probability | ✅ | ⚠️ | **Calculate:** from `halftimeStats.wonFirstHalf` |
| 46 | FT Win Probability | ✅ | ✅ | Already scraped as `winPercentage` |
| 47 | HT Draw Probability | ✅ | ⚠️ | **Calculate:** from `halftimeStats.tiedFirstHalf` |
| 48 | FT Draw Probability | ✅ | ✅ | Already scraped as `drawPercentage` |
| 49 | HT-FT Win Consistency | ⚠️ | ❌ | **Need:** Match-level HT/FT patterns |
| 50 | Win Margin Ratio | ✅ | ⚠️ | **Calculate:** winBy2+ / totalWins |
| 51 | 1H Scoring Rate | ✅ | ✅ | Already scraped as `goalsInFirstHalf` |
| 52 | 2H Scoring Rate | ✅ | ✅ | Already scraped as `goalsInSecondHalf` |

**Status:** 10/12 available or calculable, 2/12 need additional data

---

#### **Category 6: Comparative (6 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 53 | Relative Attack Strength | ✅ | ⚠️ | **Calculate:** teamGoalsAvg / oppConcededAvg |
| 54 | Relative Defense Strength | ✅ | ⚠️ | **Calculate:** teamConceded / oppScoredAvg |
| 55 | Momentum Difference | ✅ | ⚠️ | **Calculate:** teamForm - oppForm |
| 56 | Recent Goal Difference | ✅ | ⚠️ | **Calculate:** last5GD(team) - last5GD(opp) |
| 57 | Market Expected Goals | ✅ | ⚠️ | **Calculate:** from odds distribution |
| 58 | League Position Normalized | ✅ | ⚠️ | **Calculate:** 1 - (rank / teamsCount) from standings |

**Status:** 6/6 can be calculated from available data

---

#### **Category 7: Advanced Situational (5 features)**

| # | Feature | Available | Current Scraper | Calculation Method |
|---|---------|-----------|-----------------|-------------------|
| 59 | Performance in Similar Odds | ⚠️ | ❌ | **Need:** Historical match-odds pairs |
| 60 | Win% vs Similar Teams | ⚠️ | ❌ | **Need:** Match results + opponent rankings |
| 61 | Defensive bounce-back | ⚠️ | ❌ | **Need:** Match sequence analysis |
| 62 | Emotional swing | ⚠️ | ❌ | **Need:** Match-to-match goal diff |
| 63 | Consistency Index | ⚠️ | ❌ | **Need:** Last 5 results variance |

**Status:** 0/5 directly available, 5/5 need match-level historical data

---

## Summary by Status

### ✅ Fully Available (Currently Scraped): 24 features
- Win/Draw/Loss rates
- Goals scored/conceded averages
- Clean sheets
- BTTS metrics
- 1st/2nd half scoring
- Half-time stats
- Form indicators
- Odds probabilities

### ⚠️ Calculable from Existing Data: 15 features
- Points per game
- Goal ratios
- Relative strengths
- Market metrics
- League position normalized
- Comparative stats

### 🔧 Need Additional Scraping: 18 features
- Home/Away-specific win rates
- Over/Under 0.5, 1.5, 3.5 goals
- Win after trailing
- Momentum trends
- HT-FT conversion patterns

### ❌ Not Available (Missing from Website): 6 features
- xG (Expected Goals)
- Shots on target
- Possession data
- Cards/discipline
- Control ratio
- Dominance index

---

## Data Sources on Sportstats365

### Available Endpoints:

1. **Main Match Page:**
   - Odds (1X2)
   - Scores
   - Standings table

2. **Stats Endpoint** (`/stats/{team1}/{team2}/{matchId}`):
   - Win/Draw/Loss %
   - Goals stats
   - BTTS stats
   - Half-time performance
   - **TODO:** Check if Over/Under stats are here

3. **Form Endpoint** (`/stats/.../form`):
   - Last 5 results (W/L/D)
   - Form scores

4. **Matches Endpoint** (`/stats/.../matches`):
   - Recent match results
   - **TODO:** Scrape for sequence analysis

5. **H2H Endpoint** (`/stats/.../h2h`):
   - Head-to-head history

### Missing from Website:
- xG (Expected Goals)
- Shots/Shots on Target
- Possession %
- Cards (Yellow/Red)
- Corner kicks
- Individual player stats

---

## Recommended Actions

### Phase 1: Extract Over/Under Stats ✅ PRIORITY
**Impact:** 5 features  
**Effort:** Low  

Scrape Over/Under section from stats endpoint:
- % Over 0.5
- % Over 1.5
- % Over 2.5 (may already be available)
- % Over 3.5

### Phase 2: Add Home/Away Split Stats ✅ PRIORITY
**Impact:** 2 features  
**Effort:** Low  

Website has "Home", "Away", "Overall" tabs - scrape each:
- Home win rate
- Away win rate

### Phase 3: Calculate Derived Features ⚠️ MEDIUM
**Impact:** 15 features  
**Effort:** Low (pure calculation)

Add calculation functions for:
- Points per game
- Goal ratios
- Relative strengths
- Market efficiency
- League position normalized

### Phase 4: Scrape Match-Level Data ⚠️ COMPLEX
**Impact:** 18 features  
**Effort:** High  

Scrape individual matches from `/matches` endpoint to enable:
- Sequence analysis (win after draw, etc.)
- HT-FT conversion patterns
- Momentum trends
- Consistency metrics
- Performance under pressure

### Phase 5: Accept Data Limitations ❌
**Impact:** 6 features  
**Effort:** N/A  

These features require data not available on Sportstats365:
- xG, shots, possession, cards

**Alternative:** Use other sources like FootyStats API or accept reduced feature set.

---

## Feature Implementation Priority

### **High Priority (Can implement immediately):**
1. Over/Under stats (0.5, 1.5, 3.5 goals)
2. Home/Away win rates
3. All calculable features (15 features)

**Total achievable in Phase 1-3:** 39 features (~62% of total)

### **Medium Priority (Requires match scraping):**
4. Match sequence analysis
5. HT-FT conversion
6. Momentum calculations

**Total achievable with match data:** 57 features (~90% of total)

### **Not Achievable (Missing data):**
- xG-based features
- Shot-based features
- Possession-based features
- Cards-based features

**Final realistic target:** ~57 out of 63 features (90%)

---

## Updated Scraper Requirements

To achieve the 57 achievable features, update `scraper.ts` to:

1. ✅ **Parse Over/Under section** in stats endpoint
2. ✅ **Parse Home/Away tabs** in stats endpoint  
3. ✅ **Fetch matches endpoint** and parse match history
4. ✅ **Calculate derived features** in `feature-extraction.ts`
5. ✅ **Update schema.ts** to store all 57 features
6. ⚠️ **Consider match-level storage** for sequence analysis

---

## Next Steps

1. **Test the current scraper** on the Chelsea vs Qarabag match
2. **Inspect the HTML files** saved by the analysis script
3. **Identify exact selectors** for Over/Under and Home/Away stats
4. **Update scraper** to extract missing data
5. **Update schema** to include all features
6. **Test feature calculations** with real data

Would you like me to proceed with updating the scraper to extract these additional features?
