import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { calculateAndSavePoints } from "@/lib/points";
import type { Match } from "@/lib/types";

async function verifyAdmin(req: NextRequest): Promise<string | null> {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    try {
        const decoded = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.doc(`users/${decoded.uid}`).get();
        if (!userDoc.data()?.isAdmin) return null;
        return decoded.uid;
    } catch {
        return null;
    }
}

// GET /api/admin/matches — list all matches
export async function GET(req: NextRequest) {
    const uid = await verifyAdmin(req);
    if (!uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const snap = await adminDb.collection("matches").orderBy("scheduledTime", "desc").get();
    const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ matches });
}

// POST /api/admin/matches — create/edit match manually
export async function POST(req: NextRequest) {
    const uid = await verifyAdmin(req);
    if (!uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id, ...data } = body;

    if (id) {
        await adminDb.doc(`matches/${id}`).update(data);
        return NextResponse.json({ success: true, updated: id });
    } else {
        const newMatch: Omit<Match, "id"> = {
            matchId: data.matchId || `manual_${Date.now()}`,
            team1: data.team1,
            team2: data.team2,
            team1Short: data.team1Short,
            team2Short: data.team2Short,
            venue: data.venue || "",
            scheduledTime: data.scheduledTime,
            tossResult: null,
            status: "upcoming",
            predictionWindowOpen: data.predictionWindowOpen ?? false,
            firstInningsScore: null,
            topBatsman: null,
            bestBowler: null,
            winningTeam: null,
            squads: data.squads || null,
            bowlingRatings: null,
            createdAt: new Date().toISOString(),
        };
        const ref = await adminDb.collection("matches").add(newMatch);
        return NextResponse.json({ success: true, id: ref.id });
    }
}

// DELETE /api/admin/matches — calculate results for a match
export async function DELETE(req: NextRequest) {
    const uid = await verifyAdmin(req);
    if (!uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { matchId, action } = body;

    if (action === "calculate-results") {
        try {
            await calculateAndSavePoints(matchId);
            return NextResponse.json({ success: true, message: "Points calculated" });
        } catch (err) {
            return NextResponse.json({ error: String(err) }, { status: 500 });
        }
    }

    if (action === "open-window") {
        await adminDb.doc(`matches/${matchId}`).update({ predictionWindowOpen: true });
        return NextResponse.json({ success: true });
    }

    if (action === "close-window") {
        await adminDb.doc(`matches/${matchId}`).update({ predictionWindowOpen: false });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
