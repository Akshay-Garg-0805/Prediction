import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function verifyCronSecret(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  const searchSecret = req.nextUrl.searchParams.get("secret");
  return secret === process.env.CRON_SECRET || searchSecret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Delete all matches (which cascade deletes predictions inside them in this script)
    const matchesSnap = await adminDb.collection("matches").get();
    const batchSize = 100;
    
    for (const matchDoc of matchesSnap.docs) {
      // Delete predictions subcollection
      const predsSnap = await adminDb.collection(`predictions/${matchDoc.id}/entries`).get();
      const predBatch = adminDb.batch();
      predsSnap.docs.forEach((doc) => predBatch.delete(doc.ref));
      await predBatch.commit();
      
      // Delete match doc
      await matchDoc.ref.delete();
    }

    // 2. Clear user points
    const usersSnap = await adminDb.collection("users").get();
    const userBatch = adminDb.batch();
    usersSnap.docs.forEach((doc) => {
      userBatch.update(doc.ref, { totalPoints: 0 });
    });
    await userBatch.commit();

    // 3. Clear leaderboard
    await adminDb.doc("leaderboard/current").set({ rankings: [], updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, message: "Database completely cleared!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
