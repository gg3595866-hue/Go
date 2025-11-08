# Football Fixtures App

## Overview

A real-time football fixtures tracking application displaying live scores, match schedules, and betting odds from global leagues. It scrapes data from sportstats365.com and presents it in a dark-themed, responsive interface. The app incorporates a sophisticated machine learning system for predicting match outcomes based on dynamically updated team ratings and Poisson distribution modeling.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React SPA using Vite, Tailwind CSS, and shadcn/ui. It emphasizes a dark-themed, data-dense design for quick information scanning. Key components include `DateNavigator`, `MatchCard`, and views for grouping matches. State management uses TanStack Query for server state and local component state for UI interactions.

### Backend

The backend is an Express.js REST API that scrapes sportstats365.com using Cheerio and Axios. It features a robust, self-maintaining verified league URL mapping system to ensure accurate data extraction. The system does not persist fixture data but fetches it on-demand. Development uses Vite middleware, and production serves static files. Shared schemas and Zod ensure type safety between client and server.

### Machine Learning System

The application incorporates a machine learning system for match prediction, utilizing Drizzle ORM with SQLite for two databases: `database.db` for training and `tester.db` for prediction. Match statistics include 70+ features, comprising original and 35 new advanced features (e.g., home/away-specific metrics, points per game, over/under goal rates, mental strength indicators, mistake propensity).

A dynamic, Elo-based rating system tracks 50+ metrics per team, including core ratings, momentum, offensive/defensive capacity, and new metrics like `comebackRate`, `performanceInCloseGames`, `mentalStrength`, and `leadBlownRate`. These ratings update after every game.

The system integrates Poisson distribution for goal-based predictions, calculating probabilities for 1X2 outcomes, BTTS, Over/Under 2.5 goals, and expected full-time and half-time scores. It accurately models attack/defense balance, home advantage, and league context.

An enhanced training pipeline addresses temporal data leakage by using time-aware training. This processes matches chronologically, capturing team ratings before each match, and splitting data chronologically (oldest 70% for training, middle 15% for validation, most recent 15% for testing). It also includes stratified data splitting, 5-fold cross-validation, optimized regularization (Batch Normalization, Dropout, L2), and learning curve visualization.

An entity ID mapping system ensures consistent unique IDs for teams, leagues, and countries across both databases, facilitating neural network embedding layers.

## External Dependencies

**UI/Styling:**
- Radix UI primitives
- shadcn/ui
- Lucide React (iconography)
- Tailwind CSS
- PostCSS
- Google Fonts (Inter)
- date-fns

**Data Fetching/Scraping:**
- TanStack Query
- Axios
- Cheerio

**Database/ORM:**
- Drizzle ORM
- SQLite (Better-SQLite3)

**Build & Development Tools:**
- Vite
- esbuild
- TypeScript