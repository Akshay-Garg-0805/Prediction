"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/types";

export default function AdminPage() {
  const { userProfile, getIdToken, loading } = useAuth();
  const router = useRouter();

  const [matches, setMatches] = useState<(Match & { id: string })[]>([]);
  const [fetching, setFetching] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Form for new match
  const [newMatch, setNewMatch] = useState({
    team1: "", team2: "", team1Short: "", team2Short: "",
    venue: "", scheduledTime: "", predictionWindowOpen: false,
  });

  useEffect(() => {
    if (!loading && !userProfile?.isAdmin) {
      router.replace("/");
    }
  }, [loading, userProfile, router]);

  const fetchMatches = async () => {
    setFetching(true);
    const token = await getIdToken();
    const res = await fetch("/api/admin/matches", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMatches(data.matches || []);
    setFetching(false);
  };

  useEffect(() => {
    if (userProfile?.isAdmin) fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const performAction = async (matchId: string, action: string) => {
    const token = await getIdToken();
    setActionMsg("Working...");
    const res = await fetch("/api/admin/matches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, action }),
    });
    const data = await res.json();
    setActionMsg(data.message || data.error || "Done");
    setTimeout(() => setActionMsg(""), 3000);
    fetchMatches();
  };

  const createMatch = async () => {
    const token = await getIdToken();
    await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newMatch),
    });
    setNewMatch({ team1: "", team2: "", team1Short: "", team2Short: "", venue: "", scheduledTime: "", predictionWindowOpen: false });
    fetchMatches();
  };

  if (loading || !userProfile?.isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading admin...</div>;
  }

  return (
    <div className="min-h-screen px-4 py-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Manage matches and trigger result calculations</p>
      </div>

      {actionMsg && (
        <div className="mb-4 text-center py-3 px-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400">
          {actionMsg}
        </div>
      )}

      {/* Create Match */}
      <div className="glass-card p-6 mb-8">
        <h2 className="font-bold text-lg mb-4">➕ Add Match Manually</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key: "team1", label: "Team 1 Full Name" },
            { key: "team2", label: "Team 2 Full Name" },
            { key: "team1Short", label: "Team 1 Short (e.g. MI)" },
            { key: "team2Short", label: "Team 2 Short (e.g. CSK)" },
            { key: "venue", label: "Venue" },
          ].map(({ key, label }) => (
            <input
              key={key}
              className="ipl-input"
              placeholder={label}
              value={(newMatch as Record<string, string | boolean>)[key] as string}
              onChange={(e) => setNewMatch((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          ))}
          <input
            className="ipl-input"
            type="datetime-local"
            value={newMatch.scheduledTime}
            onChange={(e) => setNewMatch((prev) => ({ ...prev, scheduledTime: new Date(e.target.value).toISOString() }))}
          />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="predOpen"
            checked={newMatch.predictionWindowOpen}
            onChange={(e) => setNewMatch((prev) => ({ ...prev, predictionWindowOpen: e.target.checked }))}
            className="w-4 h-4"
          />
          <label htmlFor="predOpen" className="text-sm text-gray-400">Open prediction window immediately</label>
        </div>
        <button onClick={createMatch} className="btn-primary">Create Match</button>
      </div>

      {/* Matches list */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">📋 All Matches</h2>
          <button onClick={fetchMatches} className="text-sm text-gray-400 hover:text-white">↻ Refresh</button>
        </div>

        {fetching ? (
          <div className="text-gray-500 text-sm text-center py-8">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">No matches yet.</div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <div key={m.id} className="border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold">{m.team1Short} vs {m.team2Short}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.team1} vs {m.team2}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {new Date(m.scheduledTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400">Status: {m.status}</span>
                      <span className={`px-2 py-0.5 rounded-full ${m.predictionWindowOpen ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        Window: {m.predictionWindowOpen ? "Open" : "Closed"}
                      </span>
                      {m.tossResult && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                          Toss: {m.tossResult.winner}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {m.predictionWindowOpen ? (
                      <button onClick={() => performAction(m.id, "close-window")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
                        Close Window
                      </button>
                    ) : (
                      <button onClick={() => performAction(m.id, "open-window")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20">
                        Open Window
                      </button>
                    )}
                    {m.status === "completed" && (
                      <button onClick={() => performAction(m.id, "calculate-results")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20">
                        Recalc Points
                      </button>
                    )}
                  </div>
                </div>

                {/* Results if completed */}
                {m.status === "completed" && (
                  <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-gray-500">Winner:</span> <span className="text-green-400">{m.winningTeam}</span></div>
                    <div><span className="text-gray-500">1st inns:</span> <span className="text-white">{m.firstInningsScore}</span></div>
                    <div><span className="text-gray-500">Top bat:</span> <span className="text-yellow-400">{m.topBatsman}</span></div>
                    <div><span className="text-gray-500">Best bowl:</span> <span className="text-blue-400">{m.bestBowler}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
