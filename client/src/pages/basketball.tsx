import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import DateNavigator from "@/components/DateNavigator";
import ViewToggle from "@/components/ViewToggle";
import CompetitionGroup from "@/components/CompetitionGroup";
import TimeGroup from "@/components/TimeGroup";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { type Match, type FixturesResponse } from "@shared/schema";

export default function BasketballPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'competition' | 'time'>('competition');

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  
  const { data, isLoading, error } = useQuery<FixturesResponse>({
    queryKey: ['/api/basketball/fixtures', dateString],
    queryFn: async () => {
      const response = await fetch(`/api/basketball/fixtures/${dateString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch basketball fixtures');
      }
      return response.json();
    },
  });

  const matches = data?.matches || [];

  const groupByCompetition = (matches: Match[]) => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => {
      const existing = groups.get(match.competition) || [];
      groups.set(match.competition, [...existing, match]);
    });
    return Array.from(groups.entries()).map(([competition, matches]) => ({
      competition,
      competitionLogo: matches[0]?.competitionLogo,
      matches,
    }));
  };

  const groupByTime = (matches: Match[]) => {
    const groups = new Map<string, Match[]>();
    matches.forEach((match) => {
      const time = match.time;
      if (time === 'FT' || !time.includes(':')) {
        const range = 'Finished';
        const existing = groups.get(range) || [];
        groups.set(range, [...existing, match]);
      } else {
        const hour = parseInt(time.split(':')[0]);
        const range = `${hour}:00 - ${hour}:59`;
        const existing = groups.get(range) || [];
        groups.set(range, [...existing, match]);
      }
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === 'Finished') return -1;
        if (b === 'Finished') return 1;
        return parseInt(a) - parseInt(b);
      })
      .map(([timeRange, matches]) => ({
        timeRange,
        matches,
      }));
  };

  const competitionGroups = groupByCompetition(matches);
  const timeGroups = groupByTime(matches);

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
      ) : error ? (
        <EmptyState 
          message="Failed to load basketball fixtures"
          suggestion="Please try again or select a different date"
        />
      ) : matches.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="pb-8">
          {view === 'competition' ? (
            <>
              {competitionGroups.map(({ competition, competitionLogo, matches }) => (
                <CompetitionGroup
                  key={competition}
                  competition={competition}
                  competitionLogo={competitionLogo}
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
