# Football Fixtures App - Design Guidelines

## Design Approach

**Selected Approach:** Custom Design System inspired by modern sports data platforms (ESPN, FotMob, The Athletic)

This utility-focused application prioritizes **data clarity, scanning efficiency, and real-time information access**. The dark theme enhances focus on match data while reducing eye strain during extended browsing sessions.

## Core Design Principles

1. **Information Hierarchy**: Match data must be instantly scannable
2. **Dark Mode Optimization**: Leverage contrast without overwhelming users
3. **Data Density**: Maximize information while maintaining breathing room
4. **Visual Consistency**: Uniform treatment across all match cards and competition groups

---

## Typography System

### Font Family
- **Primary**: Inter or Roboto via Google Fonts CDN
- **Numeric Data**: Tabular numbers enabled for score alignment

### Hierarchy
- **Page Title**: text-2xl font-bold (Date display)
- **Competition Headers**: text-base font-semibold uppercase tracking-wide
- **Team Names**: text-sm font-medium
- **Match Times**: text-xs font-normal
- **Scores**: text-xl font-bold tabular-nums
- **Half-time Scores**: text-xs font-normal opacity-70
- **Odds**: text-sm font-medium tabular-nums

---

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 3, 4, 6, 8, 12** for consistent rhythm
- Component padding: p-4 to p-6
- Card gaps: gap-3 to gap-4
- Section margins: my-6 to my-8
- Element spacing: space-y-2 to space-y-4

### Container Structure
```
- Full-width app container
- Max-width content: max-w-7xl mx-auto
- Side padding: px-4 (mobile) to px-6 (desktop)
- Date picker: Sticky top position
```

---

## Component Library

### 1. Date Picker Header (Sticky)
**Layout:**
- Full-width sticky bar at top
- Three-column layout: [Prev Arrow | Date Display | Next Arrow]
- Date display centered with large, bold typography
- Arrow buttons on edges with touch-friendly sizing (min-touch-target: 44px)

**Elements:**
- Previous/Next arrow icons (Heroicons: ChevronLeftIcon, ChevronRightIcon)
- Date text: "Day, MM/DD/YYYY" format (e.g., "Thu, 10/30/2025")
- Calendar icon button for date picker modal
- Subtle elevation/shadow to separate from content below

### 2. View Toggle
**Position:** Below date picker
**Options:** "Group by competition" | "Group by time"
- Segmented control style
- Active state clearly distinguished
- Full-width on mobile, centered on desktop

### 3. Competition Group Headers
**Structure:**
- Competition name + flag/logo (left aligned)
- Subtle divider line below
- Slightly elevated from background
- Padding: py-3 px-4
- Sticky behavior when scrolling through long lists

**Content:**
- Competition flag icon (20x20px)
- Competition name in uppercase
- Match count badge (optional)

### 4. Match Cards
**Card Layout:**
```
[Status/Time] [Home Team Logo + Name] [Score] [Away Team Logo + Name] [Odds x3]
```

**Specifications:**
- Full-width cards with subtle borders
- Padding: p-4
- Gap between elements: gap-3
- Rounded corners: rounded-lg
- Hover state: subtle elevation increase

**Match Time/Status Section:**
- Fixed width column (60px)
- Time format: "HH:MM" (24-hour)
- Status badges: "FT" (Full Time), "Live" (pulsing indicator), "Postponed"
- Status colors via opacity variations

**Team Section (Each):**
- Team logo: w-8 h-8 (32px) with object-contain
- Team name truncation on mobile: truncate max-w-[120px]
- Flex layout: logo + name with gap-2

**Score Section:**
- Main score: Large bold numbers
- Half-time score below in smaller, muted text
- Format: "X-Y (a-b)"
- Center-aligned between teams
- Minimum width to prevent layout shift

**Odds Section:**
- Three columns for 1-X-2 odds
- Equal width cells: grid-cols-3
- Subtle borders between columns
- Monospace-like tabular numbers
- Each cell: text-center p-2

### 5. Empty States
**No Matches Available:**
- Centered message with icon (Heroicons: CalendarIcon)
- Text: "No fixtures scheduled for this date"
- Suggestion: "Try selecting another date"
- Minimum height: min-h-[400px] to prevent jarring layout

### 6. Loading States
**Skeleton Screens:**
- Animated pulse effect on card placeholders
- Maintain exact layout of actual cards
- Show 5-8 skeleton cards during load
- Competition headers also get skeleton treatment

### 7. Time Grouping View
**When "Group by time" selected:**
- Hour-based grouping: "0:00 - 0:59", "1:00 - 1:59", etc.
- Collapsible sections with match counts
- Same match card format within groups

---

## Match Status Indicators

### Visual Treatment
- **Live Matches**: Pulsing red/green dot indicator
- **Full Time (FT)**: Static badge, muted appearance
- **Upcoming**: Time display only, standard treatment
- **Postponed/Cancelled**: Strike-through with warning badge

---

## Responsive Behavior

### Mobile (< 768px)
- Single column layout
- Team names truncate to prevent wrapping
- Odds section stacks or uses horizontal scroll
- Match cards: full-width with reduced padding (p-3)
- Date picker arrows larger for touch targets

### Tablet (768px - 1024px)
- Same single column but wider cards
- More generous spacing
- Team names show more characters

### Desktop (> 1024px)
- Maintain single column for consistency
- Max-width container for comfortable reading
- Larger team logos (40px)
- More padding in cards (p-5)

---

## Icon System

**Library:** Heroicons (via CDN)

**Required Icons:**
- ChevronLeft, ChevronRight (date navigation)
- Calendar (date picker trigger)
- Clock (match time indicator)
- Trophy (competition indicator)
- Globe (international matches)
- XCircle (cancelled matches)

---

## Accessibility Requirements

- **Contrast Ratios**: Maintain WCAG AA standards (4.5:1 for text)
- **Focus States**: Clear keyboard navigation indicators
- **ARIA Labels**: Proper labels for date picker and match cards
- **Screen Reader**: Announce live score updates
- **Touch Targets**: Minimum 44x44px for all interactive elements

---

## Animation Guidelines

**Use Sparingly:**
- Date picker slide transitions (subtle 200ms ease)
- Match card hover elevation (150ms ease-out)
- Live match pulsing indicator (2s infinite)
- Skeleton loading pulse (1.5s ease-in-out infinite)

**NO animations for:**
- Score updates (instant)
- Competition group expand/collapse (instant or max 150ms)
- View toggle switches (instant state change)

---

## Images

### Team Logos
- Display all team badges from the scraped data
- Size: 32px x 32px (mobile), 40px x 40px (desktop)
- Object-fit: contain to preserve aspect ratio
- Fallback: Team initials in circular badge if logo fails to load
- Lazy loading for performance

### Competition Flags/Logos
- Size: 20px x 20px
- Positioned left of competition name
- Fallback: Generic trophy icon

### No Hero Image
This is a data-focused application without a hero section. The date picker serves as the primary navigation/header element.

---

## Special Features

### Date Picker Modal
- Calendar grid view (7 columns for days)
- Month/year navigation
- Quick jump to today
- Highlight selected date
- No date restrictions (infinite past/future)
- Close on selection or outside click

### Match Details Link
- Each match card is clickable
- Subtle hover indication
- Links to detailed comparison page (as per scraped URLs)

---

## Performance Considerations

- Lazy load team logos below fold
- Virtual scrolling for days with 100+ matches
- Debounce date navigation rapid clicks (300ms)
- Cache scraped data by date (localStorage or IndexedDB)
- Progressive loading: Show cached data immediately, update in background

---

This design system prioritizes **data clarity, scanning efficiency, and professional polish** suitable for a sports data application while maintaining modern web standards and dark mode aesthetics.