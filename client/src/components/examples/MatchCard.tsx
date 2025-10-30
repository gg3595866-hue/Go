import MatchCard from "../MatchCard";
import { type Match } from "@shared/schema";

export default function MatchCardExample() {
  const mockMatch: Match = {
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
    odds: {
      home: 3.23,
      draw: 3.10,
      away: 2.28,
    },
  };

  return (
    <div className="space-y-3 p-4">
      <MatchCard match={mockMatch} />
      <MatchCard match={{ ...mockMatch, id: "2", status: "LIVE", homeScore: 2, awayScore: 1, homeHalfScore: 1, awayHalfScore: 0 }} />
      <MatchCard match={{ ...mockMatch, id: "3", status: "SCHEDULED", homeScore: null, awayScore: null, homeHalfScore: null, awayHalfScore: null, time: "15:45" }} />
    </div>
  );
}
