# Football Fixtures App

## Overview

A real-time football fixtures tracking application that displays live scores, match schedules, and betting odds from leagues worldwide. The app scrapes data from sportstats365.com and presents it in a clean, dark-themed interface optimized for quick scanning and data comprehension.

**Core Functionality:**
- Browse football fixtures by date with intuitive date navigation
- View matches grouped by competition or time range
- Display live scores, team logos, and betting odds
- Responsive design with dark mode optimization

**Tech Stack:**
- Frontend: React + TypeScript with Vite
- Backend: Express.js + Node.js
- Styling: Tailwind CSS + shadcn/ui components
- Data: Web scraping with Cheerio and Axios
- State Management: TanStack Query (React Query)
- Routing: Wouter (lightweight React router)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Component-Based React Application**
- Single-page application (SPA) using Vite as the build tool and development server
- Component library based on shadcn/ui (Radix UI primitives with Tailwind CSS styling)
- Custom design system inspired by modern sports platforms (ESPN, FotMob) with emphasis on data density and scanability

**State Management Strategy**
- TanStack Query for server state management and API data fetching
- Local component state for UI interactions (date selection, view toggles)
- No global state management library needed due to simple data flow

**Key UI Components**
- `DateNavigator`: Sticky header for date selection with prev/next navigation
- `ViewToggle`: Switch between competition-based and time-based grouping
- `MatchCard`: Individual match display with team info, scores, and odds
- `CompetitionGroup`/`TimeGroup`: Organizational containers for matches
- `LoadingState`/`EmptyState`: Feedback components for async operations
- `DatabasePage`: Displays all match statistics from the training database with pagination (92 columns including all 35 new ML features)
- `TesterPage`: Displays match statistics for prediction with team name search (93 columns including team names and all 35 new ML features)

**Design Principles**
- Dark mode by default for reduced eye strain
- Tabular numbers for score alignment
- Sticky positioning for navigation elements
- Utility-first CSS approach with Tailwind
- Mobile-first responsive design

### Backend Architecture

**Express.js REST API**
- Minimal API surface with single endpoint pattern: `/api/fixtures/:date`
- Web scraping implementation using Cheerio to parse HTML from sportstats365.com
- No database persistence - data fetched on-demand from external source

**Scraping Strategy**
- Axios for HTTP requests with browser-like headers to avoid blocking
- Cheerio for DOM parsing and data extraction
- Timeout handling (10s) for reliability
- Structured data transformation from HTML to typed Match objects

**Verified League URL Mapping System**
Solves the league-based bulk upload problem (previously 85% failure rate):
- **Scrapes real league URLs** from Sportstats365 fixtures instead of guessing
- **121+ verified league slugs** extracted from 30+ days of fixtures (`server/verified-league-mappings.ts`)
- **Robust normalization** in `getVerifiedLeagueSlug()`:
  - Removes country/confederation prefixes (England, Spain, UEFA, etc.)
  - Removes leading numbers ("1. HNL" → "HNL")
  - Normalizes accents and special characters
  - Case-insensitive matching
- **100% accuracy** on test leagues (50/50 leagues mapped correctly)
- **Self-maintaining**: Re-run `server/extract-league-urls-from-fixtures.ts` to update mappings
- **No manual aliases needed**: Normalization handles variations automatically

Key insight: Sportstats365 uses non-predictable slugs ("premiership" not "premier-league"), so we scrape them from the site's own fixture pages.

**Development vs Production**
- Vite middleware in development for HMR and fast refresh
- Static file serving in production from compiled dist directory
- Environment-based configuration via NODE_ENV

**Type Safety**
- Shared schema definitions between client and server (`shared/schema.ts`)
- Zod for runtime validation and type inference
- TypeScript strict mode enabled across codebase

### External Dependencies

**UI Component Library**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui configuration for pre-styled component variants
- Lucide React for iconography

**Styling System**
- Tailwind CSS for utility-first styling
- PostCSS for CSS processing
- Custom CSS variables for theme tokens (defined in index.css)
- Google Fonts (Inter) for typography

**Data Fetching**
- TanStack Query for caching, background updates, and request deduplication
- Axios for HTTP client with custom headers and timeout configuration
- Cheerio for HTML parsing and web scraping

**Database/ORM Setup**
- Drizzle ORM with SQLite (Better-SQLite3)
- Two separate databases: `database.db` (for training data) and `tester.db` (for prediction data)
- Shared entity mapping tables ensure consistent IDs across both databases
- Match statistics stored with 70+ features for neural network training, including:
  - **Original features** (35): Form metrics, win/draw/loss rates, goal statistics, betting odds, league stats
  - **New advanced features** (35): Home/away-specific metrics, points per game, over/under goal rates (0.5, 1.5, 3.5), failed-to-score rates, goals-per-half ratios, comparative metrics (attack/defense strength, momentum), market-specific features (expected win ratios, value indices), league position (raw and normalized), win margin ratios

**Team Rating System (Dynamic, Updated Every Game)**
The application uses a sophisticated Elo-based rating system that tracks 50+ metrics per team:
- **Core Ratings**: Elo rating, attack rating, defense rating
- **Momentum Metrics**: Win/draw/loss streaks, home/away streaks, unbeaten/losing streaks
- **Offensive/Defensive Capacity**: Goals scored/conceded, average goals, performance in high/low scoring games
- **Pressure Performance** (NEW):
  - `comebackRate`: Win/draw rate after losing at halftime
  - `performanceInCloseGames`: Win rate in 1-goal margin games
  - `mentalStrength`: Ability to hold leads and win when ahead at HT
  - `performanceWhenTrailing`: Points gained when losing at halftime
- **Mistake Propensity** (NEW):
  - `leadBlownRate`: Rate of dropping points after leading at halftime
  - `cleanSheetRate`: Rate of keeping clean sheets (not conceding)
  - `lateCollapseRate`: Rate of losing narrow HT leads (1-goal margins)
  - `defensiveErrors`: Count of goals conceded from winning positions
- **Market Expectations**: Performance vs odds, underdog win rate, BTTS correlations
- **Half-time Analysis**: HT win/draw/loss rates, HT-FT consistency, comeback rates
- All ratings update automatically after each match result

**Entity ID Mapping System (for Neural Network Embeddings)**
The application uses a centralized ID mapping system to ensure each team, league, and country gets a unique, consistent ID across both databases:
- **Teams Table**: Maps team names to unique team IDs
- **Leagues Table**: Maps competition names to unique league IDs  
- **Countries Table**: Maps extracted country names to unique country IDs
- All entity names are normalized (lowercase, trimmed, spaces collapsed) before lookup/insert
- The main database (`database.db`) stores all entity mappings
- Both database and tester storage use the same mapping tables, ensuring consistency
- This approach enables proper neural network embedding layers where:
  - Each team_id has its own learned vector representation
  - Each league_id has its own embedding vector
  - Each country_id has its own embedding vector
  - IDs remain stable across training and prediction datasets

**Previous Implementation:** Previously used hash-based ID generation which could cause collisions and inconsistencies. Now uses database-backed get-or-create operations with race condition handling.

**Build & Development Tools**
- Vite for fast development and optimized production builds
- esbuild for server-side bundling
- TypeScript compiler for type checking
- Replit-specific plugins for development experience

**Date/Time Handling**
- date-fns for date formatting and manipulation
- No timezone conversion (matches displayed in source timezone)