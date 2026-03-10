"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import type { Match, Prediction } from "@/lib/types";

function Countdown({ scheduledTime }: { scheduledTime: string }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledTime).getTime() - Date.now();
      if (diff <= 0) { setTime("Match starting!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [scheduledTime]);
  return <span className="font-mono text-orange-400 text-lg font-bold">{time}</span>;
}

export default function PredictPage() {
  const { matchId } = useParams() as { matchId: string };
  const { user, getIdToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [existingPrediction, setExistingPrediction] = useState<Prediction | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  // Form state
  const [winner, setWinner] = useState("");
  const [batsman, setBatsman] = useState("");
  const [bowler, setBowler] = useState("");
  const [score, setScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load match
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "matches", matchId), (snap) => {
      if (snap.exists()) {
        setMatch(snap.data() as Match);
      }
      setLoadingMatch(false);
    });
    return unsub;
  }, [matchId]);

  // Load existing prediction
  useEffect(() => {
    if (!user || !matchId) return;
    const fetchPred = async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/predictions?matchId=${matchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.prediction) {
        const pred = data.prediction as Prediction;
        setExistingPrediction(pred);
        setWinner(pred.predictedWinner);
        setBatsman(pred.predictedBatsman);
        setBowler(pred.predictedBowler);
        setScore(String(pred.predictedScore));
      }
    };
    fetchPred();
  }, [user, matchId, getIdToken]);

  const allPlayers = match?.squads ? [...match.squads.team1, ...match.squads.team2] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!winner || !batsman || !bowler || !score) {
      setError("Please fill in all fields.");
      return;
    }
    const scoreNum = parseInt(score);
    if (isNaN(scoreNum) || scoreNum < 50 || scoreNum > 350) {
      setError("Score must be a whole number between 50 and 350.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, predictedWinner: winner, predictedBatsman: batsman, predictedBowler: bowler, predictedScore: scoreNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingMatch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse text-lg">Loading match...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-5xl">🔐</div>
        <h2 className="text-2xl font-bold">Sign in to predict</h2>
        <p className="text-gray-400">You need to be signed in to make predictions.</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Match not found.</p>
      </div>
    );
  }

  const closed = !match.predictionWindowOpen;
  const isCompleted = match.status === "completed";

  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <div className="text-4xl mb-3">🏏</div>
        <h1 className="text-3xl font-black mb-2">
          <span className="gradient-text">{match.team1Short}</span>
          <span className="text-gray-500 mx-3">vs</span>
          <span className="gradient-text">{match.team2Short}</span>
        </h1>
        <p className="text-gray-500 text-sm">{match.team1} vs {match.team2}</p>
        <p className="text-gray-600 text-xs mt-1">{match.venue}</p>

        <div className="mt-4">
          {isCompleted ? (
            <div className="badge-completed mx-auto inline-block">Match Completed</div>
          ) : closed ? (
            <div className="badge-live mx-auto inline-block">Predictions Closed — Match Live</div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="badge-open inline-block">Predictions Open</div>
              <div className="text-sm text-gray-500 mt-1">
                Time remaining: <Countdown scheduledTime={match.scheduledTime} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toss result */}
      {match.tossResult && (
        <div className="glass-card p-4 mb-6 text-center border border-yellow-400/20 animate-fade-in">
          <p className="text-yellow-400 font-semibold">
            🪙 {match.tossResult.winner} won the toss and elected to{" "}
            <span className="text-white">{match.tossResult.decision}</span>
          </p>
        </div>
      )}

      {/* Match results if completed */}
      {isCompleted && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h3 className="font-bold text-lg mb-3">📋 Match Results</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Winner:</span> <span className="text-green-400 font-bold">{match.winningTeam}</span></div>
            <div><span className="text-gray-400">1st Innings:</span> <span className="text-white font-bold">{match.firstInningsScore}</span></div>
            <div><span className="text-gray-400">Top Batsman:</span> <span className="text-yellow-400 font-bold">{match.topBatsman}</span></div>
            <div><span className="text-gray-400">Best Bowler:</span> <span className="text-blue-400 font-bold">{match.bestBowler}</span></div>
          </div>
          {/* User's prediction details */}
          {existingPrediction && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <h3 className="font-bold text-sm text-gray-400 mb-3 text-center uppercase tracking-wide">Your Prediction</h3>
              <div className="grid grid-cols-2 gap-3 text-sm mb-5 bg-white/5 rounded-xl p-4">
                <div><span className="text-gray-500">Winner:</span> <span className="text-white">{existingPrediction.predictedWinner}</span></div>
                <div><span className="text-gray-500">1st Innings:</span> <span className="text-white">{existingPrediction.predictedScore}</span></div>
                <div><span className="text-gray-500">Top Batsman:</span> <span className="text-white">{existingPrediction.predictedBatsman}</span></div>
                <div><span className="text-gray-500">Best Bowler:</span> <span className="text-white">{existingPrediction.predictedBowler}</span></div>
              </div>

              {existingPrediction.points !== null && (
                <div className="text-center">
                  <div className="text-3xl font-black gradient-text">{existingPrediction.points} pts</div>
                  <div className="text-gray-400 text-sm mt-1">Your score this match</div>
                  {existingPrediction.pointsBreakdown && (
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                      <div>Winner: +{existingPrediction.pointsBreakdown.winningTeam}</div>
                      <div>Batsman: +{existingPrediction.pointsBreakdown.topBatsman}</div>
                      <div>Bowler: +{existingPrediction.pointsBreakdown.bestBowler}</div>
                      <div>Score: +{existingPrediction.pointsBreakdown.firstInningsScore}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prediction Form */}
      {!isCompleted && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">

          {/* Winning Team */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-base mb-4">🏆 Who will win?</h3>
            <div className="grid grid-cols-2 gap-4">
              {[match.team1, match.team2].map((team) => (
                <button
                  type="button"
                  key={team}
                  onClick={() => !closed && setWinner(team)}
                  className={`team-card ${winner === team ? "selected" : ""} ${closed ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={closed}
                >
                  <div className="text-3xl mb-2">
                    {team === match.team1 ? "🔵" : "🟡"}
                  </div>
                  <div className="font-bold text-sm">{team}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Top Batsman */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-base mb-1">🏏 Top Batsman (highest runs in match)</h3>
            <p className="text-xs text-gray-500 mb-4">
              {allPlayers.length === 0 ? "Player list available after toss" : `${allPlayers.length} players available`}
            </p>
            <select
              value={batsman}
              onChange={(e) => setBatsman(e.target.value)}
              className="ipl-input"
              disabled={closed || allPlayers.length === 0}
            >
              <option value="">
                {allPlayers.length === 0 ? "⏳ Awaiting toss for player list..." : "Select top batsman..."}
              </option>
              {match.squads && (
                <>
                  <optgroup label={`── ${match.team1} ──`}>
                    {match.squads.team1.map((p) => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                  <optgroup label={`── ${match.team2} ──`}>
                    {match.squads.team2.map((p) => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* Best Bowler */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-base mb-1">🎯 Best Bowler</h3>
            <p className="text-xs text-gray-500 mb-4">Rated by: (Wickets × 25) − (Economy × 5). Highest wins.</p>
            <select
              value={bowler}
              onChange={(e) => setBowler(e.target.value)}
              className="ipl-input"
              disabled={closed || allPlayers.length === 0}
            >
              <option value="">
                {allPlayers.length === 0 ? "⏳ Awaiting toss for player list..." : "Select best bowler..."}
              </option>
              {match.squads && (
                <>
                  <optgroup label={`── ${match.team1} ──`}>
                    {match.squads.team1.map((p) => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                  <optgroup label={`── ${match.team2} ──`}>
                    {match.squads.team2.map((p) => <option key={p} value={p}>{p}</option>)}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* First Innings Score */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-base mb-1">📊 First Innings Score Prediction</h3>
            <p className="text-xs text-gray-500 mb-4">Exact match = 2 pts · Closest = 1 pt (50–350)</p>
            <input
              type="number"
              min={50}
              max={350}
              step={1}
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Enter your predicted score (e.g. 182)"
              className="ipl-input"
              disabled={closed}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-400/10 px-4 py-3 rounded-lg border border-red-400/20">
              {error}
            </div>
          )}

          {/* Submit */}
          {submitSuccess ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-green-400 font-bold text-lg">Prediction saved!</div>
              <p className="text-gray-500 text-sm mt-1">You can update it until the first ball is bowled.</p>
            </div>
          ) : (
            <button
              type="submit"
              className="btn-primary w-full py-4 text-base"
              disabled={closed || submitting}
            >
              {closed ? "🔒 Predictions Closed" : submitting ? "Saving..." : existingPrediction ? "Update Prediction" : "Submit Prediction 🏏"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
