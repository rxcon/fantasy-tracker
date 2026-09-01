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

export type RosterPlayer = {
  playerId: string;
  name: string;
  position: string;
  proTeam: string;
  points: number;
  isStarter: boolean;
  slot: string;
};

export type OpponentInfo = {
  teamName: string;
  totalPoints: number;
  players: RosterPlayer[];
} | null;

export type RosterResponse =
  | {
      status: "ok";
      week: number;
      myPoints: number;
      players: RosterPlayer[];
      opponent: OpponentInfo;
    }
  | { status: "error"; errorMessage: string };
