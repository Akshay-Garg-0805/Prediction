import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { Prediction } from "@/lib/types";

// POST /api/predictions — submit or update prediction
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json();
    const { matchId, predictedWinner, predictedBatsman, predictedBowler, predictedScore } = body;

    // Validate inputs
    if (!matchId || !predictedWinner || !predictedBatsman || !predictedBowler || predictedScore === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!Number.isInteger(Number(predictedScore)) || predictedScore < 50 || predictedScore > 350) {
      return NextResponse.json({ error: "Score must be an integer between 50 and 350" }, { status: 400 });
    }

    // Check match exists and window is open
    const matchSnap = await adminDb.collection("matches").doc(matchId).get();
    if (!matchSnap.exists) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (!matchSnap.data()?.predictionWindowOpen) {
      return NextResponse.json({ error: "Prediction window is closed" }, { status: 403 });
    }

    const predictionData: Omit<Prediction, "uid"> = {
      matchId,
      predictedWinner,
      predictedBatsman,
      predictedBowler,
      predictedScore: Number(predictedScore),
      submittedAt: new Date().toISOString(),
      points: null,
      pointsBreakdown: null,
    };

    await adminDb.doc(`predictions/${matchId}/entries/${uid}`).set(predictionData, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/predictions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/predictions?matchId=xxx — get my prediction for a match
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const matchId = req.nextUrl.searchParams.get("matchId");
    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

    const predSnap = await adminDb.doc(`predictions/${matchId}/entries/${uid}`).get();
    if (!predSnap.exists) return NextResponse.json({ prediction: null });

    return NextResponse.json({ prediction: { uid, ...predSnap.data() } });
  } catch (err) {
    console.error("GET /api/predictions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
