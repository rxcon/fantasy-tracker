export type TeamResult =
  | {
      id: string;
      platform: "sleeper" | "espn";
      status: "ok";
      leagueId: string;
      leagueName: string;
      scoringFormat: string;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
    }
  | {
      id: string;
      platform: "sleeper" | "espn";
      status: "error";
      leagueId: string;
      errorMessage: string;
    };
