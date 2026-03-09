import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchUpcomingIPLMatches } from "@/lib/cricket";
import { sendPredictionOpenEmail, sendTossEmail } from "@/lib/email";
import type { Match } from "@/lib/types";

function verifyCronSecret(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * Cron: Runs every 5 minutes.
 * - Fetches upcoming IPL matches from Cricbuzz
 * - Opens prediction window 1 hour before match
 * - Sends email notification when window opens
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const upcomingMatches = await fetchUpcomingIPLMatches();
    const now = new Date();
    const ONE_HOUR = 60 * 60 * 1000;

    // Fetch all user emails
    const usersSnap = await adminDb.collection("users").get();
    const emails = usersSnap.docs.map((d) => d.data().email).filter(Boolean) as string[];

    for (const m of upcomingMatches) {
      const scheduled = new Date(m.scheduledTime);
      const timeUntilMatch = scheduled.getTime() - now.getTime();

      // Check if match should open prediction window (within 1hr before match, not past)
      if (timeUntilMatch > 0 && timeUntilMatch <= ONE_HOUR) {
        // Check if match exists in Firestore
        const existingSnap = await adminDb
          .collection("matches")
          .where("matchId", "==", m.matchId)
          .limit(1)
          .get();

        if (existingSnap.empty) {
          // Create new match document
          const matchData: Omit<Match, "id"> = {
            matchId: m.matchId,
            team1: m.team1,
            team2: m.team2,
            team1Short: m.team1Short,
            team2Short: m.team2Short,
            venue: m.venue,
            scheduledTime: m.scheduledTime,
            tossResult: null,
            status: "upcoming",
            predictionWindowOpen: true,
            firstInningsScore: null,
            topBatsman: null,
            bestBowler: null,
            winningTeam: null,
            squads: null,
            bowlingRatings: null,
            createdAt: new Date().toISOString(),
          };

          await adminDb.collection("matches").add(matchData);

          // Send email notification
          await sendPredictionOpenEmail(emails, {
            team1: m.team1,
            team2: m.team2,
            closesAt: scheduled.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          });

          console.log(`Prediction window opened for ${m.team1} vs ${m.team2}`);
        } else {
          // Match exists, ensure window is open
          const matchDoc = existingSnap.docs[0];
          const matchData = matchDoc.data() as Match;
          if (!matchData.predictionWindowOpen && matchData.status === "upcoming") {
            await matchDoc.ref.update({ predictionWindowOpen: true });
            await sendPredictionOpenEmail(emails, {
              team1: m.team1,
              team2: m.team2,
              closesAt: scheduled.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, checked: upcomingMatches.length });
  } catch (err) {
    console.error("monitor-matches cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
