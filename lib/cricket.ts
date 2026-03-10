/**
 * Cricket data fetcher using Cricbuzz unofficial API.
 * Falls back to scraping if needed.
 */

import * as cheerio from "cheerio";
import type { Match, Squad, TossResult, BowlingRating } from "./types";

// Generic JSON record type for untyped external API responses
type J = Record<string, unknown>;

const CRICBUZZ_BASE = "https://www.cricbuzz.com";

// Headers to mimic a real browser
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

export interface LiveMatchInfo {
  matchId: string;
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  scheduledTime: string;
  venue: string;
  status: string;
  tossResult: TossResult | null;
  isLive: boolean;
  isCompleted: boolean;
  firstBallBowled: boolean;
  winningTeam: string | null;
}

export interface Scorecard {
  firstInningsScore: number;
  topBatsman: string;
  bestBowler: string;
  bowlingRatings: BowlingRating;
  winningTeam: string;
}

/**
 * Fetch upcoming IPL matches from Cricbuzz
 */
export async function fetchUpcomingIPLMatches(): Promise<
  Array<{
    matchId: string;
    team1: string;
    team2: string;
    team1Short: string;
    team2Short: string;
    venue: string;
    scheduledTime: string;
  }>
> {
  try {
    // Set CRICBUZZ_SERIES_URL in Vercel env vars when IPL 2026 page goes live on Cricbuzz
    // e.g. https://www.cricbuzz.com/cricket-series/XXXXX/indian-premier-league-2026/matches
    const seriesUrl =
      process.env.CRICBUZZ_SERIES_URL ||
      "https://www.cricbuzz.com/cricket-series/9237/indian-premier-league-2025/matches";
    const res = await fetch(seriesUrl, {
      headers: HEADERS,
      next: { revalidate: 0 },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const matches: Array<{
      matchId: string;
      team1: string;
      team2: string;
      team1Short: string;
      team2Short: string;
      venue: string;
      scheduledTime: string;
    }> = [];

    // Parse match schedule from Cricbuzz
    $(".cb-series-matches .cb-col-100").each((_, el) => {
      const link = $(el).find("a.cb-lv-scrd-mtch-a").attr("href") || "";
      const matchIdMatch = link.match(/\/live-cricket-scores\/(\d+)\//);
      if (!matchIdMatch) return;

      const matchId = matchIdMatch[1];
      const teamNames = $(el)
        .find(".cb-hmscg-tm-nm")
        .map((_, e) => $(e).text().trim())
        .get();
      const timeStr = $(el).find(".schedule-date").attr("data-start-date-iso") || "";

      if (teamNames.length >= 2) {
        matches.push({
          matchId,
          team1: teamNames[0],
          team2: teamNames[1],
          team1Short: abbreviate(teamNames[0]),
          team2Short: abbreviate(teamNames[1]),
          venue: $(el).find(".text-gray").first().text().trim(),
          scheduledTime: timeStr,
        });
      }
    });

    return matches;
  } catch (err) {
    console.error("fetchUpcomingIPLMatches error:", err);
    return [];
  }
}

/**
 * Fetch live match status, toss result, and whether first ball has been bowled
 */
export async function fetchLiveMatchInfo(matchId: string): Promise<LiveMatchInfo | null> {
  try {
    // First try JSON API endpoint
    const apiRes = await fetch(`${CRICBUZZ_BASE}/api/cricket-match/${matchId}/full-commentary/0`, {
      headers: { ...HEADERS, Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      return parseLiveMatchInfoFromAPI(data);
    }

    // Fallback: scrape HTML
    const htmlRes = await fetch(`${CRICBUZZ_BASE}/live-cricket-scores/${matchId}`, {
      headers: HEADERS,
      next: { revalidate: 0 },
    });
    const html = await htmlRes.text();
    return parseLiveMatchInfoFromHTML(matchId, html);
  } catch (err) {
    console.error(`fetchLiveMatchInfo error for match ${matchId}:`, err);
    return null;
  }
}

function parseLiveMatchInfoFromAPI(data: J): LiveMatchInfo | null {
  try {
    const match = data?.matchHeader as J;
    if (!match) return null;

    const toss = match.tossResults as J;
    const tossResult: TossResult | null =
      toss?.tossWinnerName
        ? { winner: toss.tossWinnerName as string, decision: (toss.decision as string) === "bat" ? "bat" : "field" }
        : null;

    const status: string = (match.status as string) || "";
    const isCompleted = match.complete === true;
    const isLive = match.state === "In Progress";

    // Detect first ball: if balls > 0
    const miniscore = data?.miniscore as J | undefined;
    const batTeam = miniscore?.batTeam as J | undefined;
    const teamInnings = batTeam?.teamInnings as J | undefined;
    const firstBallBowled = !!((teamInnings?.balls as number) > 0 || (teamInnings?.runs as number) > 1);

    const resultObj = match.result as J | undefined;
    const winningTeam = isCompleted && resultObj?.winningTeam ? (resultObj.winningTeam as string) : null;

    const t1 = match.team1 as J;
    const t2 = match.team2 as J;

    return {
      matchId: String(match.matchId),
      team1: (t1?.name as string) || "",
      team2: (t2?.name as string) || "",
      team1Short: (t1?.shortName as string) || abbreviate((t1?.name as string) || ""),
      team2Short: (t2?.shortName as string) || abbreviate((t2?.name as string) || ""),
      scheduledTime: new Date((match.matchStartTimestamp as number) || Date.now()).toISOString(),
      venue: ((match.venue as J)?.name as string) || "",
      status,
      tossResult,
      isLive,
      isCompleted,
      firstBallBowled,
      winningTeam,
    };
  } catch {
    return null;
  }
}

function parseLiveMatchInfoFromHTML(matchId: string, html: string): LiveMatchInfo | null {
  try {
    const $ = cheerio.load(html);

    const statusText = $(".cb-lv-crct-msg").text().trim();
    const tossText = $("*")
      .filter((_, el) => $(el).text().toLowerCase().includes("won the toss"))
      .first()
      .text()
      .trim();

    let tossResult: TossResult | null = null;
    if (tossText) {
      const tossMatch = tossText.match(/^(.+?) won the toss and elected to (bat|field)/i);
      if (tossMatch) {
        tossResult = {
          winner: tossMatch[1].trim(),
          decision: tossMatch[2].toLowerCase() === "bat" ? "bat" : "field",
        };
      }
    }

    const isLive = statusText.toLowerCase().includes("live") || statusText.toLowerCase().includes("innings");
    const isCompleted = statusText.toLowerCase().includes("won") && !isLive;
    const firstBallBowled = isLive;

    return {
      matchId,
      team1: "",
      team2: "",
      team1Short: "",
      team2Short: "",
      scheduledTime: new Date().toISOString(),
      venue: "",
      status: statusText,
      tossResult,
      isLive,
      isCompleted,
      firstBallBowled,
      winningTeam: null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch playing 15 squads after toss from Cricbuzz
 */
export async function fetchSquads(matchId: string): Promise<Squad | null> {
  try {
    const res = await fetch(`${CRICBUZZ_BASE}/api/cricket-match/${matchId}/playing15`, {
      headers: { ...HEADERS, Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const data = await res.json();
      const team1Players = (data?.playing15?.[0]?.player || [])
        .map((p: Record<string, string>) => p.fullName || p.name || "Unknown");
      const team2Players = (data?.playing15?.[1]?.player || [])
        .map((p: Record<string, string>) => p.fullName || p.name || "Unknown");

      if (team1Players.length && team2Players.length) {
        return { team1: team1Players, team2: team2Players };
      }
    }

    // Fallback: scrape innings page
    return await scrapeSquadsFromPage(matchId);
  } catch (err) {
    console.error(`fetchSquads error for match ${matchId}:`, err);
    return null;
  }
}

async function scrapeSquadsFromPage(matchId: string): Promise<Squad | null> {
  try {
    const res = await fetch(`${CRICBUZZ_BASE}/cricket-match/${matchId}/squads`, {
      headers: HEADERS,
      next: { revalidate: 0 },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const teams: string[][] = [];
    $(".cb-col-67.cb-col").each((_, el) => {
      const players = $(el)
        .find(".cb-player-name-wo-flag")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      if (players.length) teams.push(players.slice(0, 15));
    });

    if (teams.length >= 2) {
      return { team1: teams[0], team2: teams[1] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch final scorecard to compute results
 */
export async function fetchScorecard(matchId: string): Promise<Scorecard | null> {
  try {
    const res = await fetch(`${CRICBUZZ_BASE}/api/cricket-match/${matchId}/full-commentary/0`, {
      headers: { ...HEADERS, Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;
    const data = await res.json();

    return parseScorecardFromAPI(data);
  } catch (err) {
    console.error(`fetchScorecard error for match ${matchId}:`, err);
    return null;
  }
}

function parseScorecardFromAPI(data: J): Scorecard | null {
  try {
    const scorecard = data?.scoreCard;
    if (!scorecard || !Array.isArray(scorecard)) return null;

    // First innings score
    const firstInnings = scorecard[0] as J;
    const scoreDetails = firstInnings?.scoreDetails as J | undefined;
    const firstInningsScore: number = (scoreDetails?.runs as number) || 0;

    // Top batsman (most runs across entire match)
    const allBatsmen: { name: string; runs: number }[] = [];
    (scorecard as J[]).forEach((innings) => {
      ((innings?.batsmenData as J[]) || []).forEach((b) => {
        allBatsmen.push({ name: (b.batName as string) || "Unknown", runs: (b.runs as number) || 0 });
      });
    });
    allBatsmen.sort((a, b) => b.runs - a.runs);
    const topBatsman = allBatsmen[0]?.name || "Unknown";

    // Best bowler with rating = wickets*25 - economy*5
    const bowlingRatings: BowlingRating = {};
    (scorecard as J[]).forEach((innings) => {
      ((innings?.bowlersData as J[]) || []).forEach((b) => {
        const wickets = (b.wickets as number) || 0;
        const economy = (b.eco as number) || 0;
        const rating = wickets * 25 - economy * 5;
        const name = (b.bowlName as string) || "Unknown";
        if (!bowlingRatings[name] || rating > bowlingRatings[name]) {
          bowlingRatings[name] = rating;
        }
      });
    });

    const bestBowler =
      Object.keys(bowlingRatings).length > 0
        ? Object.entries(bowlingRatings).sort((a, b) => b[1] - a[1])[0][0]
        : "Unknown";

    // Match winner
    const matchHeader = data?.matchHeader as J | undefined;
    const resultObj = matchHeader?.result as J | undefined;
    const winningTeam = (resultObj?.winningTeam as string) || "Unknown";

    return { firstInningsScore, topBatsman, bestBowler, bowlingRatings, winningTeam };
  } catch {
    return null;
  }
}

function abbreviate(name: string): string {
  // Common IPL team abbreviations
  const map: Record<string, string> = {
    "Mumbai Indians": "MI",
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Royal Challengers Bangalore": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Delhi Capitals": "DC",
    "Sunrisers Hyderabad": "SRH",
    "Rajasthan Royals": "RR",
    "Punjab Kings": "PBKS",
    "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
  };
  return map[name] || name.slice(0, 3).toUpperCase();
}

export { abbreviate };
