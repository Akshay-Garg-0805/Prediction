"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import type { Match } from "@/lib/types";

function Countdown({ scheduledTime }: { scheduledTime: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledTime).getTime() - Date.now();
      if (diff <= 0) { setTime("Starting now!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [scheduledTime]);

  return <span className="font-mono text-yellow-400">{time}</span>;
}

function StatusBadge({ match }: { match: Match }) {
  if (match.status === "completed") return <span className="badge-completed">Completed</span>;
  if (match.status === "live") return <span className="badge-live">● Live</span>;
  if (match.predictionWindowOpen) return <span className="badge-open">✓ Predictions Open</span>;
  return <span className="badge-upcoming">Upcoming</span>;
}

export default function HomePage() {
  const { user, signIn, loading } = useAuth();
  const [matches, setMatches] = useState<(Match & { id: string })[]>([]);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("scheduledTime", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) })));
    });
    return unsub;
  }, []);

  const upcoming = matches.filter((m) => m.status !== "completed").slice(0, 5);
  const completed = matches.filter((m) => m.status === "completed").slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden px-6 pt-16 pb-20 text-center"
        style={{ background: "linear-gradient(135deg, #003B8E22 0%, #0A0E1A 40%, #1a0a0022 100%)" }}>
        {/* Decorative orbs */}
        <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: "#FFD700" }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-5"
          style={{ background: "#003B8E" }} />

        <div className="relative z-10">
          <div className="text-6xl mb-4">🏏</div>
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="gradient-text">IPL Predict</span>
          </h1>
          <p className="text-gray-400 text-xl mb-8 max-w-xl mx-auto">
            Predict scores, winners & top performers. Beat your friends to the top of the leaderboard!
          </p>

          {!loading && !user && (
            <button onClick={signIn} className="btn-primary text-base py-3 px-8 text-lg">
              🔐 Sign in with Google to Play
            </button>
          )}
          {user && (
            <Link href="/leaderboard">
              <button className="btn-primary text-base py-3 px-8">
                📊 View Leaderboard
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Points Guide */}
      <div className="px-6 py-10 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-gray-300 mb-5">🏆 How Points Work</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🏆", label: "Correct Winner", pts: "+2 pts" },
            { icon: "🏏", label: "Top Batsman", pts: "+1 pt" },
            { icon: "🎯", label: "Best Bowler", pts: "+1 pt" },
            { icon: "🎯", label: "Exact 1st Innings Score", pts: "+2 pts / +1 closest" },
          ].map((p) => (
            <div key={p.label} className="glass-card p-4 text-center animate-fade-in">
              <div className="text-3xl mb-2">{p.icon}</div>
              <div className="text-sm text-gray-400 mb-1">{p.label}</div>
              <div className="font-bold text-yellow-400">{p.pts}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Matches */}
      <div className="px-6 pb-8 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-gray-300 mb-5">📅 Upcoming Matches</h2>
        {upcoming.length === 0 ? (
          <div className="glass-card p-10 text-center text-gray-500">No upcoming matches scheduled yet.</div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((match) => (
              <div key={match.id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-yellow-400/20 transition-all animate-slide-up">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <StatusBadge match={match} />
                  </div>
                  <h3 className="text-lg font-bold mt-1">
                    {match.team1Short} <span className="text-gray-500">vs</span> {match.team2Short}
                  </h3>
                  <p className="text-sm text-gray-500">{match.team1} vs {match.team2}</p>
                  <p className="text-xs text-gray-600 mt-1">{match.venue}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm text-gray-400">
                    {new Date(match.scheduledTime).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      weekday: "short", day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                  {match.predictionWindowOpen ? (
                    <div className="text-xs text-gray-500">
                      Closes in: <Countdown scheduledTime={match.scheduledTime} />
                    </div>
                  ) : null}
                  {user && match.predictionWindowOpen ? (
                    <Link href={`/predict/${match.id}`}>
                      <button className="btn-primary text-sm py-2 px-4">Predict Now →</button>
                    </Link>
                  ) : user && match.status !== "completed" ? (
                    <span className="text-xs text-gray-600">Opens 1hr before match</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Results */}
      {completed.length > 0 && (
        <div className="px-6 pb-16 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-300 mb-5">✅ Recent Results</h2>
          <div className="space-y-3">
            {completed.map((match) => (
              <div key={match.id} className="glass-card p-4 flex items-center justify-between opacity-70">
                <div>
                  <span className="font-semibold">{match.team1Short} vs {match.team2Short}</span>
                  <div className="text-xs text-gray-500">
                    Winner: <span className="text-green-400">{match.winningTeam}</span>
                    {match.firstInningsScore ? ` · 1st innings: ${match.firstInningsScore}` : ""}
                  </div>
                </div>
                <span className="badge-completed">Done</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
