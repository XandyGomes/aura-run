'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AuraAICard() {
  const [suggestion, setSuggestion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchSuggestion = async () => {
      try {
        const res = await fetch('/api/ai/suggestion');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setSuggestion(data.suggestion || data.error);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestion();
  }, []);

  if (loading) {
    return (
      <div style={{ background: "linear-gradient(135deg, rgba(0,200,232,0.08) 0%, rgba(0,114,255,0.06) 100%)", border: "1px solid rgba(0,200,232,0.2)", borderRadius: "24px", padding: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <div style={{ width: 36, height: 36, borderRadius: "11px", background: "linear-gradient(135deg,#00C8E8,#0072FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🤖</div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "white" }}>Analisando...</div>
            <div style={{ fontSize: "11px", color: "#00E5FF", fontWeight: "600" }}>Aura AI Coach</div>
          </div>
        </div>
        <div className="skeleton" style={{ height: '60px', width: '100%', marginBottom: '16px' }} />
        <div style={{ display: "flex", gap: "10px" }}>
          <div className="skeleton" style={{ flex: 1, height: '44px', borderRadius: '14px' }} />
          <div className="skeleton" style={{ width: '100px', height: '44px', borderRadius: '14px' }} />
        </div>
      </div>
    );
  }

  if (error || !suggestion) return null;

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(0,200,232,0.08) 0%, rgba(0,114,255,0.06) 100%)", border: "1px solid rgba(0,200,232,0.2)", borderRadius: "24px", padding: "20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "radial-gradient(circle, rgba(0,200,232,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: "11px", background: "linear-gradient(135deg,#00C8E8,#0072FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", boxShadow: "0 4px 12px rgba(0,114,255,0.3)" }}>🤖</div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "white" }}>Treino de Hoje</div>
          <div style={{ fontSize: "11px", color: "#00E5FF", fontWeight: "600" }}>Aura AI Coach</div>
        </div>
      </div>
      <div style={{ maxHeight: "100px", overflowY: "auto", marginBottom: "16px", paddingRight: "4px" }} className="custom-scrollbar">
        <p style={{ fontSize: "13px", lineHeight: "1.6", color: "rgba(255,255,255,0.7)", margin: 0 }}>{suggestion}</p>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <Link href="/workout" className="btn-primary" style={{ flex: 1, padding: "12px", fontSize: "14px", textAlign: "center", borderRadius: "14px", textDecoration: 'none' }}>
          ▶ Iniciar Treino
        </Link>
        <Link href={`/coach?tip=${encodeURIComponent(suggestion)}`} style={{ padding: "12px 16px", background: "rgba(0,200,232,0.1)", border: "1px solid rgba(0,200,232,0.25)", borderRadius: "14px", color: "#00E5FF", fontSize: "13px", fontWeight: "700", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
          Ver tudo →
        </Link>
      </div>
    </div>
  );
}
