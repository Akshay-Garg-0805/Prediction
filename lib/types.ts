// Shared TypeScript types used across the app

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  isAdmin: boolean;
  totalPoints: number;
  joinedAt: string;
}

export interface Squad {
  team1: string[];
  team2: string[];
}

export interface TossResult {
  winner: string;
  decision: "bat" | "field";
}

export interface BowlingRating {
  [playerName: string]: number;
}

export type MatchStatus = "upcoming" | "toss_done" | "live" | "completed";

export interface Match {
  id: string;
  matchId: string; // cricbuzz match ID
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  venue: string;
  scheduledTime: string; // ISO string
  tossResult: TossResult | null;
  status: MatchStatus;
  predictionWindowOpen: boolean;
  firstInningsScore: number | null;
  topBatsman: string | null;
  bestBowler: string | null;
  winningTeam: string | null;
  squads: Squad | null;
  bowlingRatings: BowlingRating | null;
  createdAt: string;
}

export interface Prediction {
  uid: string;
  matchId: string;
  predictedWinner: string;
  predictedBatsman: string;
  predictedBowler: string;
  predictedScore: number;
  submittedAt: string;
  points: number | null;
  pointsBreakdown: {
    winningTeam: number;
    topBatsman: number;
    bestBowler: number;
    firstInningsScore: number;
  } | null;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  totalPoints: number;
  matchPoints: { [matchId: string]: number };
}
