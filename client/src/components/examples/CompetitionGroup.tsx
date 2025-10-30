import CompetitionGroup from "../CompetitionGroup";
import { type Match } from "@shared/schema";

export default function CompetitionGroupExample() {
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
      time: "0:00",
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
      time: "1:00",
      competition: "Copa Libertadores 2025",
      odds: { home: 1.82, draw: 3.37, away: 4.20 },
    },
  ];

  return (
    <CompetitionGroup
      competition="Copa Libertadores 2025"
      matches={mockMatches}
    />
  );
}
