import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Match } from "@/lib/types";

/**
 * GET /api/admin/seed-test-match
 * Creates a test match with prediction window open for immediate testing.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Schedule 30 mins from now so countdown shows
  const matchTime = new Date(now.getTime() + 30 * 60 * 1000);

  const testMatch: Omit<Match, "id"> = {
    matchId: `test_${Date.now()}`,
    team1: "Mumbai Indians",
    team2: "Chennai Super Kings",
    team1Short: "MI",
    team2Short: "CSK",
    venue: "Wankhede Stadium, Mumbai",
    scheduledTime: matchTime.toISOString(),
    tossResult: null,
    status: "upcoming",
    predictionWindowOpen: true,
    firstInningsScore: null,
    topBatsman: null,
    bestBowler: null,
    winningTeam: null,
    squads: {
      team1: [
        "Rohit Sharma", "Ishan Kishan", "Suryakumar Yadav", "Tilak Varma",
        "Hardik Pandya", "Tim David", "Naman Dhir", "Romario Shepherd",
        "Piyush Chawla", "Jasprit Bumrah", "Trent Boult",
        "Dewald Brevis", "Shreyas Gopal", "Mohammad Nabi", "Nuwan Thushara",
      ],
      team2: [
        "Ruturaj Gaikwad", "Devon Conway", "Ajinkya Rahane", "Daryl Mitchell",
        "Shivam Dube", "MS Dhoni", "Ravindra Jadeja", "Mitchell Santner",
        "Deepak Chahar", "Tushar Deshpande", "Matheesha Pathirana",
        "Rachin Ravindra", "Sameer Rizvi", "Shardul Thakur", "Mustafizur Rahman",
      ],
    },
    bowlingRatings: null,
    createdAt: new Date().toISOString(),
  };

  const ref = await adminDb.collection("matches").add(testMatch);
  return NextResponse.json({ success: true, matchId: ref.id, message: "Test MI vs CSK match created with prediction window open!" });
}

/**
 * DELETE /api/admin/seed-test-match?secret=xxx&matchId=yyy
 * Simulates match completion for testing points calculation.
 */
export async function DELETE(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  // Simulate a completed match with known results
  await adminDb.doc(`matches/${matchId}`).update({
    status: "completed",
    predictionWindowOpen: false,
    winningTeam: "Mumbai Indians",
    firstInningsScore: 187,
    topBatsman: "Suryakumar Yadav",
    bestBowler: "Jasprit Bumrah",
    bowlingRatings: { "Jasprit Bumrah": 72.5, "Trent Boult": 45, "Matheesha Pathirana": 30 },
  });

  return NextResponse.json({ success: true, message: "Match marked as completed. MI won, SKY top bat, Bumrah best bowl, 187 first innings." });
}
