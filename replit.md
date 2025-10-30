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
- Drizzle ORM configured for PostgreSQL (via drizzle.config.ts)
- Neon serverless PostgreSQL driver (@neondatabase/serverless)
- Current implementation includes user schema but not actively used
- In-memory storage fallback available (MemStorage class)

**Note:** The database configuration exists but is not currently utilized for fixture data - all match information is scraped in real-time. The database setup appears to be prepared for future features like user accounts or favorites.

**Build & Development Tools**
- Vite for fast development and optimized production builds
- esbuild for server-side bundling
- TypeScript compiler for type checking
- Replit-specific plugins for development experience

**Date/Time Handling**
- date-fns for date formatting and manipulation
- No timezone conversion (matches displayed in source timezone)