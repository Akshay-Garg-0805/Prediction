import { adminDb } from "./firebase-admin";
import type { Prediction, Match, LeaderboardEntry, UserProfile } from "./types";
import {
  sendResultsEmail,
} from "./email";

/**
 * Calculate and save points for all predictions of a match.
 * Called after match completes.
 */
export async function calculateAndSavePoints(matchId: string): Promise<void> {
  const matchRef = adminDb.doc(`matches/${matchId}`);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) throw new Error(`Match ${matchId} not found`);

  const match = matchSnap.data() as Match;

  if (!match.winningTeam || match.firstInningsScore === null || !match.topBatsman || !match.bestBowler) {
    console.warn("Match result data incomplete, skipping points calculation");
    return;
  }

  // Fetch all predictions for this match
  const predictionsSnap = await adminDb.collection(`predictions/${matchId}/entries`).get();
  if (predictionsSnap.empty) return;

  const predictions = predictionsSnap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<Prediction, "uid">),
  }));

  // --- Score closest logic ---
  const exactScoreWinners: string[] = [];
  let closestDiff = Infinity;
  const closestUsers: string[] = [];

  predictions.forEach((p) => {
    const diff = Math.abs(p.predictedScore - match.firstInningsScore!);
    if (diff === 0) {
      exactScoreWinners.push(p.uid);
    } else if (diff < closestDiff) {
      closestDiff = diff;
      closestUsers.length = 0;
      closestUsers.push(p.uid);
    } else if (diff === closestDiff) {
      closestUsers.push(p.uid);
    }
  });

  // --- Points batch write ---
  const batch = adminDb.batch();
  const userPointUpdates: Record<string, number> = {};

  for (const prediction of predictions) {
    const breakdown = {
      winningTeam: 0,
      topBatsman: 0,
      bestBowler: 0,
      firstInningsScore: 0,
    };

    // Winning team: 2 pts
    if (prediction.predictedWinner === match.winningTeam) {
      breakdown.winningTeam = 2;
    }

    // Top batsman: 1 pt
    if (prediction.predictedBatsman === match.topBatsman) {
      breakdown.topBatsman = 1;
    }

    // Best bowler: 1 pt
    if (prediction.predictedBowler === match.bestBowler) {
      breakdown.bestBowler = 1;
    }

    // First innings score
    if (exactScoreWinners.includes(prediction.uid)) {
      breakdown.firstInningsScore = 2;
    } else if (exactScoreWinners.length === 0 && closestUsers.includes(prediction.uid)) {
      breakdown.firstInningsScore = 1;
    }

    const totalPoints =
      breakdown.winningTeam + breakdown.topBatsman + breakdown.bestBowler + breakdown.firstInningsScore;

    const predRef = adminDb.doc(`predictions/${matchId}/entries/${prediction.uid}`);
    batch.update(predRef, { points: totalPoints, pointsBreakdown: breakdown });
    userPointUpdates[prediction.uid] = totalPoints;
  }

  await batch.commit();

  // --- Update each user's total points ---
  for (const [uid, pts] of Object.entries(userPointUpdates)) {
    await adminDb.doc(`users/${uid}`).update({
      totalPoints: (await adminDb.doc(`users/${uid}`).get()).data()?.totalPoints + pts || pts,
    });
  }

  // --- Update leaderboard ---
  await rebuildLeaderboard();

  // --- Send results email ---
  const usersSnap = await adminDb.collection("users").get();
  const emails = usersSnap.docs.map((d) => (d.data() as UserProfile).email).filter(Boolean);

  const summaryLines = predictions
    .map((p) => {
      const pts = userPointUpdates[p.uid] || 0;
      const user = usersSnap.docs.find((d) => d.id === p.uid)?.data() as UserProfile;
      return `${user?.displayName || p.uid}: +${pts} points`;
    })
    .join("\n");

  await sendResultsEmail(
    emails,
    { team1: match.team1, team2: match.team2, winner: match.winningTeam! },
    summaryLines
  );
}

/**
 * Rebuild the leaderboard from all users' total points
 */
export async function rebuildLeaderboard(): Promise<void> {
  const usersSnap = await adminDb.collection("users").orderBy("totalPoints", "desc").get();

  const rankings: LeaderboardEntry[] = usersSnap.docs.map((d) => {
    const user = d.data() as UserProfile;
    return {
      uid: d.id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
      totalPoints: user.totalPoints || 0,
      matchPoints: {},
    };
  });

  await adminDb.doc("leaderboard/current").set({ rankings, updatedAt: new Date().toISOString() });
}

/**
 * Get all user emails for notifications
 */
export async function getAllUserEmails(): Promise<string[]> {
  const snap = await adminDb.collection("users").get();
  return snap.docs.map((d) => (d.data() as UserProfile).email).filter(Boolean);
}
