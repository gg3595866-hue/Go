import { useState } from "react";
import DateNavigator from "@/components/DateNavigator";
import ViewToggle from "@/components/ViewToggle";
import CompetitionGroup from "@/components/CompetitionGroup";
import TimeGroup from "@/components/TimeGroup";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { type Match } from "@shared/schema";

// TODO: Remove mock data - this will be replaced with real API calls
const mockMatches: Match[] = [
  {
    id: "1",
    homeTeam: "Racing Club",
    awayTeam: "Flamengo",
    homeScore: 0,
    awayScore: 0,
    homeHalfScore: 0,
    awayHalfScore: 0,
    status: "FT",
    time: "0:30",
    competition: "Copa Libertadores 2025",
    odds: { home: 3.23, draw: 3.10, away: 2.28 },
  },
  {
    id: "2",
    homeTeam: "Millonarios",
    awayTeam: "Once Caldas",
    homeScore: 0,
    awayScore: 0,
    homeHalfScore: 0,
    awayHalfScore: 0,
    status: "FT",
    time: "1:15",
    competition: "Colombia Primera A 2025",
    odds: { home: 1.82, draw: 3.37, away: 4.20 },
  },
  {
    id: "3",
    homeTeam: "Los Angeles FC",
    awayTeam: "Austin FC",
    homeScore: 2,
    awayScore: 1,
    homeHalfScore: 1,
    awayHalfScore: 0,
    status: "FT",
    time: "2:45",
    competition: "United States MLS 2025",
    odds: { home: 1.65, draw: 3.50, away: 4.80 },
  },
  {
    id: "4",
    homeTeam: "Cagliari",
    awayTeam: "Sassuolo",
    homeScore: 1,
    awayScore: 2,
    homeHalfScore: 0,
    awayHalfScore: 0,
    status: "FT",
    time: "12:00",
    competition: "Italy Serie A 2025/2026",
    odds: { home: 2.58, draw: 3.10, away: 2.90 },
  },
  {
    id: "5",
    homeTeam: "Pisa SC",
    awayTeam: "SS Lazio",
    homeScore: null,
    awayScore: null,
    homeHalfScore: null,
    awayHalfScore: null,
    status: "SCHEDULED",
    time: "15:45",
    competition: "Italy Serie A 2025/2026",
    odds: { home: 3.77, draw: 3.10, away: 2.13 },
  },
  {
    id: "6",
    homeTeam: "Grasshoppers Zürich",
    awayTeam: "Young Boys Bern",
    homeScore: null,
    awayScore: null,
    homeHalfScore: null,
    awayHalfScore: null,
    status: "SCHEDULED",
    time: "15:30",
    competition: "Switzerland Super League 2025/2026",
    odds: { home: 2.93, draw: 3.53, away: 2.23 },
  },
  {
    id: "7",
    homeTeam: "FC Lugano",
    awayTeam: "FC Luzern",
    homeScore: null,
    awayScore: null,
    homeHalfScore: null,
    awayHalfScore: null,
    status: "SCHEDULED",
    time: "15:30",
    competition: "Switzerland Super League 2025/2026",
    odds: { home: 1.78, draw: 3.80, away: 4.07 },
  },
  {
    id: "8",
    homeTeam: "Palmeiras",
    awayTeam: "LDU de Quito",
    homeScore: null,
    awayScore: null,
    homeHalfScore: null,
    awayHalfScore: null,
    status: "SCHEDULED",
    time: "20:30",
    competition: "Copa Libertadores 2025",
    odds: { home: 1.17, draw: 7.00, away: 14.67 },
  },
];

export default function FixturesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'competition' | 'time'>('competition');
  const [isLoading] = useState(false); // TODO: Remove mock - will be controlled by API loading state

  // TODO: Remove mock data grouping - this will be replaced with API data
  const groupByCompetition = (matches: Match[]) => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => {
      const existing = groups.get(match.competition) || [];
      groups.set(match.competition, [...existing, match]);
    });
    return Array.from(groups.entries()).map(([competition, matches]) => ({
      competition,
      matches,
    }));
  };

  const groupByTime = (matches: Match[]) => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => {
      const hour = parseInt(match.time.split(':')[0]);
      const range = `${hour}:00 - ${hour}:59`;
      const existing = groups.get(range) || [];
      groups.set(range, [...existing, match]);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([timeRange, matches]) => ({
        timeRange,
        matches,
      }));
  };

  const competitionGroups = groupByCompetition(mockMatches);
  const timeGroups = groupByTime(mockMatches);

  return (
    <div className="min-h-screen bg-background">
      <DateNavigator
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenCalendar={() => console.log('Open calendar - TODO: Implement calendar picker')}
      />

      <ViewToggle view={view} onViewChange={setView} />

      {isLoading ? (
        <LoadingState />
      ) : mockMatches.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="pb-8">
          {view === 'competition' ? (
            <>
              {competitionGroups.map(({ competition, matches }) => (
                <CompetitionGroup
                  key={competition}
                  competition={competition}
                  matches={matches}
                />
              ))}
            </>
          ) : (
            <>
              {timeGroups.map(({ timeRange, matches }) => (
                <TimeGroup
                  key={timeRange}
                  timeRange={timeRange}
                  matches={matches}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
