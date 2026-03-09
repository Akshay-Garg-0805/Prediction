import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "IPL Predictions <noreply@resend.dev>";

export async function sendPredictionOpenEmail(
  emails: string[],
  matchInfo: { team1: string; team2: string; closesAt: string }
) {
  if (!emails.length) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: emails,
    subject: `🏏 Predictions Open: ${matchInfo.team1} vs ${matchInfo.team2}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #0A0E1A; color: #fff; padding: 32px; border-radius: 12px; max-width: 500px;">
        <h1 style="color: #FFD700; margin-bottom: 8px;">🏏 Prediction Window Open!</h1>
        <p style="font-size: 18px; color: #e5e7eb;">
          <strong>${matchInfo.team1}</strong> vs <strong>${matchInfo.team2}</strong>
        </p>
        <p style="color: #9ca3af;">
          Toss is happening soon. Prediction window is open — submit your picks before the first ball is bowled!
        </p>
        <p style="color: #f87171; font-weight: bold;">⏰ Window closes at: ${matchInfo.closesAt}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/predict" 
           style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#000;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:16px;">
          Make My Predictions →
        </a>
      </div>
    `,
  });
}

export async function sendTossEmail(
  emails: string[],
  matchInfo: { team1: string; team2: string; tossWinner: string; decision: string; closesAt: string }
) {
  if (!emails.length) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: emails,
    subject: `🪙 Toss Done: ${matchInfo.tossWinner} elected to ${matchInfo.decision}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #0A0E1A; color: #fff; padding: 32px; border-radius: 12px; max-width: 500px;">
        <h1 style="color: #FFD700;">🪙 Toss Result!</h1>
        <p style="font-size: 18px; color: #e5e7eb;">
          <strong>${matchInfo.tossWinner}</strong> won the toss and elected to <strong>${matchInfo.decision}</strong>
        </p>
        <p style="color: #9ca3af;">
          Playing squads are now available! Head over and lock in your best bowler and top batsman picks.
        </p>
        <p style="color: #f87171; font-weight: bold;">⏰ Predictions close at first ball: ${matchInfo.closesAt}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/predict"
           style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#000;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:16px;">
          Update My Predictions →
        </a>
      </div>
    `,
  });
}

export async function sendPredictionClosedEmail(emails: string[], matchInfo: { team1: string; team2: string }) {
  if (!emails.length) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: emails,
    subject: `🏏 First ball bowled — Predictions closed!`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #0A0E1A; color: #fff; padding: 32px; border-radius: 12px; max-width: 500px;">
        <h1 style="color: #FF6B35;">⚽ Match Started!</h1>
        <p style="color: #e5e7eb;">${matchInfo.team1} vs ${matchInfo.team2} is underway. Predictions are now locked!</p>
        <p style="color: #9ca3af;">Results and points will be updated after the match ends. Good luck! 🤞</p>
      </div>
    `,
  });
}

export async function sendResultsEmail(
  emails: string[],
  matchInfo: { team1: string; team2: string; winner: string },
  pointsSummary: string
) {
  if (!emails.length) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: emails,
    subject: `🏆 Match Over! ${matchInfo.winner} won — Check your points`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background: #0A0E1A; color: #fff; padding: 32px; border-radius: 12px; max-width: 500px;">
        <h1 style="color: #FFD700;">🏆 Match Over!</h1>
        <p style="font-size: 18px; color: #e5e7eb;">
          ${matchInfo.team1} vs ${matchInfo.team2}
        </p>
        <p style="color: #4ade80; font-size: 20px; font-weight: bold;">Winner: ${matchInfo.winner}</p>
        <pre style="background:#111827;padding:16px;border-radius:8px;color:#e5e7eb;white-space:pre-wrap;">${pointsSummary}</pre>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}/leaderboard"
           style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FF6B35);color:#000;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:16px;">
          View Leaderboard →
        </a>
      </div>
    `,
  });
}
