"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Image from "next/image";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const COLORS = ["text-yellow-400", "text-gray-300", "text-orange-400"];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "leaderboard", "current"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRankings(data.rankings || []);
        setUpdatedAt(data.updatedAt || "");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const myUid = user?.uid;

  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      <div className="text-center mb-8 animate-slide-up">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-4xl font-black mb-2">
          <span className="gradient-text">Leaderboard</span>
        </h1>
        <p className="text-gray-500 text-sm">
          IPL 2025 · Season standings
          {updatedAt && <span className="block text-xs mt-1">Updated {new Date(updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-16 animate-pulse" />
          ))}
        </div>
      ) : rankings.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">⏳</div>
          <p>No scores yet. First match results will appear here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((entry, index) => {
            const isMe = entry.uid === myUid;
            const medal = MEDALS[index] || "";
            const rankColor = COLORS[index] || "text-gray-400";

            return (
              <div
                key={entry.uid}
                className={`glass-card p-4 flex items-center gap-4 leaderboard-row animate-fade-in ${
                  isMe ? "border border-yellow-400/40 bg-yellow-400/5" : ""
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Rank */}
                <div className={`text-2xl font-black w-10 text-center ${rankColor}`}>
                  {medal || <span className="text-gray-500 text-lg">#{index + 1}</span>}
                </div>

                {/* Avatar */}
                {entry.photoURL ? (
                  <Image
                    src={entry.photoURL}
                    alt={entry.displayName}
                    width={40}
                    height={40}
                    className="rounded-full ring-2 ring-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {entry.displayName[0]}
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {entry.displayName}
                    {isMe && <span className="ml-2 text-xs text-yellow-400">(you)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{entry.email}</div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className={`text-2xl font-black ${index < 3 ? rankColor : "text-white"}`}>
                    {entry.totalPoints}
                  </div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
