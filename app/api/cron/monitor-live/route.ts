import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchLiveMatchInfo, fetchScorecard } from "@/lib/cricket";
import { sendPredictionClosedEmail } from "@/lib/email";
import { calculateAndSavePoints } from "@/lib/points";
import type { Match } from "@/lib/types";

function verifyCronSecret(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * Cron: Runs every 2 minutes.
 * - Detects first ball (closes prediction window)
 * - Detects match end, triggers result calculation
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get matches that are active (window open or live)
    const matchesSnap = await adminDb
      .collection("matches")
      .where("status", "in", ["upcoming", "toss_done", "live"])
      .get();

    if (matchesSnap.empty) {
      return NextResponse.json({ success: true, message: "No active matches" });
    }

    const usersSnap = await adminDb.collection("users").get();
    const emails = usersSnap.docs.map((d) => d.data().email).filter(Boolean) as string[];

    for (const doc of matchesSnap.docs) {
      const match = doc.data() as Match;
      const liveInfo = await fetchLiveMatchInfo(match.matchId);
      if (!liveInfo) continue;

      // First ball detected → close prediction window
      if (liveInfo.firstBallBowled && match.predictionWindowOpen) {
        await doc.ref.update({
          predictionWindowOpen: false,
          status: "live",
        });

        await sendPredictionClosedEmail(emails, { team1: match.team1, team2: match.team2 });
        console.log(`First ball detected, predictions closed for match ${match.matchId}`);
      }

      // Match completed → fetch scorecard, calculate points
      if (liveInfo.isCompleted && match.status !== "completed") {
        const scorecard = await fetchScorecard(match.matchId);
        if (!scorecard) {
          console.warn(`Scorecard not available yet for match ${match.matchId}`);
          continue;
        }

        await doc.ref.update({
          status: "completed",
          predictionWindowOpen: false,
          firstInningsScore: scorecard.firstInningsScore,
          topBatsman: scorecard.topBatsman,
          bestBowler: scorecard.bestBowler,
          winningTeam: scorecard.winningTeam,
          bowlingRatings: scorecard.bowlingRatings,
        });

        // Trigger points calculation
        await calculateAndSavePoints(doc.id);
        console.log(`Match ${match.matchId} completed, points calculated`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("monitor-live cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
