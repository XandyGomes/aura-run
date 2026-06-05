import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import KitReminder from "@/components/KitReminder";
import AuraAICard from "@/components/AuraAICard";
import { supabase } from "@/lib/supabase";

// ── Helpers ────────────────────────────────────────────────────────
const actColor: Record<string, string> = {
  Run: "#FF4D00", Walk: "#00E5FF", Ride: "#00E5A0",
  Swim: "#4A90E2", Hike: "#A78BFA", Workout: "#FFB020",
};
const actIcon: Record<string, string> = {
  Run: "🏃", Walk: "🚶", Ride: "🚴", Swim: "🏊", Hike: "🥾", Workout: "💪",
};

function fmtPace(dist: number, time: number): string {
  if (!dist || !time) return "--:--";
  const s = time / (dist / 1000);
  return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, "0")}`;
}
function fmtMovingTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
function greeting(): string {
  const h = new Date().getUTCHours() - 3; // BRT offset
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// ── Ring SVG ───────────────────────────────────────────────────────
function Ring({ pct, size = 80, stroke = 8, color = "#FF4D00" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(pct, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ── Data fetchers ──────────────────────────────────────────────────
async function getActivities(token: string) {
  try {
    const after = Math.floor((Date.now() - 30 * 86400000) / 1000);
    const r = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=30&after=${after}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function getAthlete(token: string) {
  try {
    const r = await fetch("https://www.strava.com/api/v3/athlete", { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function getLocalWorkouts(athleteId: number) {
  try {
    const { data, error } = await supabase
      .from('recorded_workouts')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('start_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar treinos do Supabase na Home:', err);
    return [];
  }
}

// ── Page ───────────────────────────────────────────────────────────
export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("strava_token")?.value;
  const athleteId = cookieStore.get("strava_athlete_id")?.value;

  // ── Not logged in ──
  if (!token) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "32px 24px", textAlign: "center", background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,77,0,0.12) 0%, transparent 60%), #080810" }}>
        <div style={{ marginBottom: "28px", animation: "fadeUp 0.6s ease both" }}>
          <Image src="/logo.png" alt="Aura Run" width={100} height={100} style={{ borderRadius: "28px", boxShadow: "0 12px 40px rgba(255,77,0,0.35)" }} />
        </div>
        <h1 style={{ fontSize: "42px", fontWeight: "900", letterSpacing: "-1px", marginBottom: "8px" }}>
          Aura <span style={{ color: "#FF4D00" }}>Run</span>
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)", maxWidth: "280px", marginBottom: "40px", lineHeight: "1.6" }}>
          Seu treinador de corrida com IA conectado ao Strava
        </p>
        <a href="/api/auth/strava/login" className="btn-primary" style={{ padding: "16px 36px", fontSize: "16px", borderRadius: "16px" }}>
          Conectar com Strava
        </a>
        <p style={{ marginTop: "40px", fontSize: "11px", color: "rgba(255,255,255,0.15)", letterSpacing: "3px", fontWeight: "700", textTransform: "uppercase" }}>BY XANDY GOMES</p>
      </div>
    );
  }

  // ── Data ──
  const [stravaActivities, athlete, localWorkouts] = await Promise.all([
    getActivities(token),
    getAthlete(token),
    athleteId ? getLocalWorkouts(Number(athleteId)) : []
  ]);

  // Map local workouts to Strava format
  const mappedLocal = (localWorkouts || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    type: "Run",
    sport_type: "Run",
    start_date: w.start_date,
    distance: w.distance * 1000, // Strava compat (meters)
    moving_time: w.moving_time,
    elapsed_time: Math.floor(w.elapsed_time / 1000), // seconds
    total_elevation_gain: 0,
    is_local: true,
  }));

  // Merge & Sort
  const activities = [...mappedLocal, ...stravaActivities].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  const userName = athlete?.firstname || "Atleta";
  const userPhoto = athlete?.profile_medium || "";

  const weekAgo = Date.now() - 7 * 86400000;
  const weekActs = activities.filter((a: any) => new Date(a.start_date).getTime() > weekAgo);
  const weekRuns = weekActs.filter((a: any) => a.type === "Run");
  const weekDist = weekActs.reduce((s: number, a: any) => s + a.distance, 0) / 1000;
  const weekTime = weekActs.reduce((s: number, a: any) => s + a.moving_time, 0);
  const GOAL_KM = 40; // weekly distance goal
  const goalPct = weekDist / GOAL_KM;

  const avgPaceRun = weekRuns.length > 0
    ? weekRuns.reduce((s: number, a: any) => s + a.moving_time / (a.distance / 1000), 0) / weekRuns.length
    : 0;

  // Day-of-week dots: Mon-Sun, did they run?
  const dayDots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const had = weekActs.some((a: any) => {
      const t = new Date(a.start_date).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    const labels = ["S", "T", "Q", "Q", "S", "S", "D"];
    return { label: labels[d.getDay() === 0 ? 6 : d.getDay() - 1], had };
  });

  const recentActs = activities.slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", paddingBottom: "100px" }}>

      {/* ── Hero ── */}
      <div style={{ padding: "52px 20px 28px", background: "linear-gradient(180deg, rgba(255,77,0,0.08) 0%, transparent 100%)", position: "relative", overflow: "hidden" }}>
        {/* Glow orb */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(255,77,0,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", width: 48, height: 48 }}>
              {userPhoto
                ? <Image src={userPhoto} alt={userName} width={48} height={48} style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,77,0,0.6)" }} />
                : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#FF4D00,#FF9240)" }} />
              }
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, background: "#00E5A0", border: "2px solid #080810", borderRadius: "50%" }} />
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: "500" }}>{greeting()},</p>
              <h2 style={{ fontSize: "18px", fontWeight: "800" }}>{userName} 👋</h2>
            </div>
          </div>
          <Link href="/profile" style={{ textDecoration: "none" }}>
            <div style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
            </div>
          </Link>
        </div>

        {/* Weekly hero stat */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Progress ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Ring pct={goalPct} size={88} stroke={7} color="#FF4D00" />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: "900", color: "#FF4D00", lineHeight: 1 }}>{weekDist.toFixed(1)}</span>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontWeight: "600", textTransform: "uppercase" }}>km</span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "4px", fontWeight: "500" }}>Esta semana</p>
            <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>
              <span style={{ color: "#FF4D00" }}>{weekDist.toFixed(1)}</span>
              <span style={{ color: "rgba(255,255,255,0.3)" }}> / {GOAL_KM} km</span>
            </div>
            {/* Day dots */}
            <div style={{ display: "flex", gap: "6px" }}>
              {dayDots.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "8px", background: d.had ? "linear-gradient(135deg,#FF4D00,#FF7340)" : "rgba(255,255,255,0.06)", border: d.had ? "none" : "1px solid rgba(255,255,255,0.08)", boxShadow: d.had ? "0 2px 8px rgba(255,77,0,0.35)" : "none" }} />
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Micro stats */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          {[
            { label: "Atividades", value: weekActs.length },
            { label: "Tempo", value: fmtMovingTime(weekTime) },
            { label: "Pace médio", value: avgPaceRun > 0 ? `${fmtPace(1000, avgPaceRun)}/km` : "--" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "white", marginBottom: "2px" }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px", margin: "0 auto", width: "100%" }}>

        {/* ── Kit Pickup Reminder ── */}
        <KitReminder />

        {/* ── Aura AI card ── */}
        <AuraAICard />

        {/* ── Quick actions ── */}
        <div>
          <p style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Ações Rápidas</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { href: "/workout", icon: "🏃", label: "Treinar Agora", sub: "GPS ao vivo", color: "#FF4D00", bg: "rgba(255,77,0,0.1)", border: "rgba(255,77,0,0.25)" },
              { href: "/plan", icon: "📋", label: "Planilha", sub: "Monte seu plano", color: "#00E5A0", bg: "rgba(0,229,160,0.08)", border: "rgba(0,229,160,0.2)" },
              { href: "/races", icon: "🗓️", label: "Corridas", sub: "Calendário de provas", color: "#00E5FF", bg: "rgba(0,229,255,0.08)", border: "rgba(0,229,255,0.2)" },
              { href: "/coach", icon: "🤖", label: "Aura AI", sub: "Pergunte algo", color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: "none" }} className="action-card">
                <div style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: "18px", padding: "16px" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>{a.icon}</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "white", marginBottom: "2px" }}>{a.label}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{a.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent activities ── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px" }}>Atividades Recentes</p>
            <Link href="/stats" style={{ fontSize: "12px", color: "#FF4D00", fontWeight: "700", textDecoration: "none" }}>Ver tudo →</Link>
          </div>

          {recentActs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏃</div>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>Nenhuma atividade nos últimos 30 dias</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentActs.map((act: any) => {
                const color = actColor[act.type] || "#888";
                const icon = actIcon[act.type] || "🏅";
                return (
                  <Link key={act.id} href={`/stats?id=${act.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "18px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", transition: "background 0.15s" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "12px", background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.name}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{fmtDate(act.start_date)} · {fmtMovingTime(act.moving_time)}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: "800", fontSize: "16px", color }}>{(act.distance / 1000).toFixed(2)}<span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: "500", marginLeft: "2px" }}>km</span></div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{fmtPace(act.distance, act.moving_time)}/km</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
