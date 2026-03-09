import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchLiveMatchInfo, fetchSquads } from "@/lib/cricket";
import { sendTossEmail } from "@/lib/email";
import type { Match } from "@/lib/types";

function verifyCronSecret(req: NextRequest) {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "");
    return secret === process.env.CRON_SECRET;
}

/**
 * Cron: Runs every 2 minutes.
 * - Checks active matches for toss result
 * - Once toss detected: saves toss + fetches squads, sends email
 */
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get matches that are open for predictions but haven't had toss detected yet
        const matchesSnap = await adminDb
            .collection("matches")
            .where("predictionWindowOpen", "==", true)
            .where("tossResult", "==", null)
            .get();

        if (matchesSnap.empty) {
            return NextResponse.json({ success: true, message: "No pending toss matches" });
        }

        const usersSnap = await adminDb.collection("users").get();
        const emails = usersSnap.docs.map((d) => d.data().email).filter(Boolean) as string[];

        for (const doc of matchesSnap.docs) {
            const match = doc.data() as Match;
            const liveInfo = await fetchLiveMatchInfo(match.matchId);

            if (!liveInfo?.tossResult) continue;

            // Toss detected! Fetch squads
            const squads = await fetchSquads(match.matchId);

            const updateData: Partial<Match> = {
                tossResult: liveInfo.tossResult,
                status: "toss_done",
            };
            if (squads) updateData.squads = squads;

            await doc.ref.update(updateData);

            // Send toss notification email
            const matchTime = new Date(match.scheduledTime);
            await sendTossEmail(emails, {
                team1: match.team1,
                team2: match.team2,
                tossWinner: liveInfo.tossResult.winner,
                decision: liveInfo.tossResult.decision,
                closesAt: matchTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            });

            console.log(`Toss detected for match ${match.matchId}: ${liveInfo.tossResult.winner} won`);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("monitor-toss cron error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
