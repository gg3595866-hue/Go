import TimeGroup from "../TimeGroup";
import { type Match } from "@shared/schema";

export default function TimeGroupExample() {
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
      time: "0:45",
      competition: "Colombia Primera A 2025",
      odds: { home: 1.82, draw: 3.37, away: 4.20 },
    },
  ];

  return (
    <TimeGroup
      timeRange="0:00 - 0:59"
      matches={mockMatches}
    />
  );
}
