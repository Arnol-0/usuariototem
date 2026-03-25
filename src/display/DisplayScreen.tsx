import React, { useEffect, useReducer, useRef, useState } from 'react';
import type { TotemState, Ticket } from '@/types/totem';
import './DisplayScreen.css';

const EMPTY: TotemState = {
  station: { id: '', name: 'TotemDesk', area: '', isActive: false },
  currentTicket: null,
  queue: [],
  totalInQueue: 0,
  isConnected: false,
};

// Separa letra(s) y número de un código como "A-142" → ["A", "142"]
function splitTicketNumber(num: string): [string, string] {
  const match = num.match(/^([A-Za-z]+)[- ]?(\d+)$/);
  if (match) return [match[1], match[2]];
  return [num, ''];
}

// ── Chime tipo banco/hospital: "DING — DONG" ─────────────────────────────────
function playChime(): Promise<void> {
  return new Promise(resolve => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

      function dong(startTime: number, freq: number) {
        const master = ctx.createGain();
        master.connect(ctx.destination);

        // Cuerpo principal — decay más corto para no arrastrar
        const osc1 = ctx.createOscillator();
        const g1   = ctx.createGain();
        osc1.type  = 'sine';
        osc1.frequency.value = freq;
        g1.gain.setValueAtTime(0, startTime);
        g1.gain.linearRampToValueAtTime(0.55, startTime + 0.01);
        g1.gain.exponentialRampToValueAtTime(0.001, startTime + 1.6);
        osc1.connect(g1); g1.connect(master);
        osc1.start(startTime); osc1.stop(startTime + 1.8);

        // Armónico metálico
        const osc2 = ctx.createOscillator();
        const g2   = ctx.createGain();
        osc2.type  = 'sine';
        osc2.frequency.value = freq * 2.756;
        g2.gain.setValueAtTime(0, startTime);
        g2.gain.linearRampToValueAtTime(0.22, startTime + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
        osc2.connect(g2); g2.connect(master);
        osc2.start(startTime); osc2.stop(startTime + 0.7);

        // Sub-armónico suave
        const osc3 = ctx.createOscillator();
        const g3   = ctx.createGain();
        osc3.type  = 'sine';
        osc3.frequency.value = freq * 0.5;
        g3.gain.setValueAtTime(0, startTime);
        g3.gain.linearRampToValueAtTime(0.12, startTime + 0.015);
        g3.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
        osc3.connect(g3); g3.connect(master);
        osc3.start(startTime); osc3.stop(startTime + 1.1);
      }

      // ding-dong-ding: agudo → grave → agudo
      dong(ctx.currentTime + 0.05, 370);   // DING — Fa#4
      dong(ctx.currentTime + 0.70, 293);   // DONG — Re4
      dong(ctx.currentTime + 1.35, 370);   // DING — Fa#4

      // Resolver tras los 3 golpes
      setTimeout(() => { ctx.close(); resolve(); }, 2800);
    } catch {
      resolve();
    }
  });
}

// ── Sistema TTS — ElevenLabs (voz neural) → Web Speech API (fallback) ────────
//
//  Voz principal: ElevenLabs "Sarah" — mujer, español latino, clara y natural
//  Fallback:      Microsoft Sabina / Helena del navegador (sin internet)
//
// ElevenLabs gratuito: 10.000 chars/mes — https://elevenlabs.io
// Para cambiar voz o key abre el panel ⚙ en la pantalla de display.
// ─────────────────────────────────────────────────────────────────────────────

// "Sarah" — voz femenina ElevenLabs, español neutro latino, muy clara
const ELEVENLABS_VOICE_ID_DEFAULT = 'EXAVITQu4vr4xnSDxMaL';
const ELEVENLABS_KEY_DEFAULT      = 'sk_5e9c5906dac6fd3d036d416cb114cc0e17dbca0c01f77827';

async function speakNeural(text: string): Promise<void> {
  const elKey   = localStorage.getItem('elevenlabs_key')   || ELEVENLABS_KEY_DEFAULT;
  const elVoice = localStorage.getItem('elevenlabs_voice') || ELEVENLABS_VOICE_ID_DEFAULT;

  if (elKey) {
    const ok = await speakElevenLabs(text, elKey, elVoice);
    if (ok) return;
  }
  // Fallback: Web Speech API con voz femenina en español
  speakBrowser(text);
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function speakElevenLabs(text: string, key: string, voiceId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability:        0.60,
          similarity_boost: 0.80,
          style:            0.00,
          use_speaker_boost: true,
          speed:            0.88,
        },
      }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    window.speechSynthesis?.cancel();
    return new Promise<boolean>(resolve => {
      const audio = new Audio(url);
      audio.volume = 1;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(true); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      audio.play().catch(() => { URL.revokeObjectURL(url); resolve(false); });
    });
  } catch {
    return false;
  }
}

// ── Web Speech API — voz femenina en español (fallback sin internet) ──────────
function speakBrowser(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  // Esperar voces si aún no cargaron
  const doSpeak = () => {
    const voices  = window.speechSynthesis.getVoices();
    const esVoices = voices.filter(v => v.lang.startsWith('es') && !v.lang.startsWith('pt'));

    // Prioridad: Sabina (MX) → Paulina (MX) → Helena (ES) → Microsoft femenina ES → cualquier ES
    const female =
      esVoices.find(v => v.name.includes('Sabina'))  ??
      esVoices.find(v => v.name.includes('Paulina')) ??
      esVoices.find(v => v.name.includes('Helena'))  ??
      esVoices.find(v => v.name.toLowerCase().includes('microsoft') && /sabina|paulina|helena|laura|mónica|monica/i.test(v.name)) ??
      esVoices.find(v => !v.localService) ??
      esVoices[0];

    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'es-MX';
    utt.rate     = 0.82;
    utt.pitch    = 1.05;
    utt.volume   = 1;
    if (female) utt.voice = female;
    window.speechSynthesis.speak(utt);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
  }
}

function buildSpeechText(ticket: Ticket, stationName: string): string {
  const [letter, number] = splitTicketNumber(ticket.number);
  return `Turno ${letter} ${number}, ${stationName}.`;
}

export default function DisplayScreen() {
  const [state, setState] = useReducer((_: TotemState, s: TotemState) => s, EMPTY);
  const [connected, setConnected] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentCalls, setRecentCalls] = useState<Array<{ id: string; letter: string; number: string; name: string; service: string }>>([]);

  // Campos del modal de config
  const [elKey,   setElKey]   = useState(() => localStorage.getItem('elevenlabs_key')   || '');
  const [elVoice, setElVoice] = useState(() => localStorage.getItem('elevenlabs_voice') || ELEVENLABS_VOICE_ID_DEFAULT);

  const prevTicketId = useRef<string | null>(null);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', () => {});
  }, []);

  useEffect(() => {
    const bc = new BroadcastChannel('totem_state');
    bc.onmessage = (e: MessageEvent<TotemState>) => {
      setState(e.data);
      setConnected(true);
    };

    const req = new BroadcastChannel('totem_request');
    req.postMessage('get_state');
    req.close();

    // Escuchar recall/announce desde el operador
    const announce = new BroadcastChannel('totem_announce');
    announce.onmessage = (e: MessageEvent<{ number: string; station: string; recall?: boolean }>) => {
      const { number, station, recall } = e.data;
      if (!recall) return; // los llamados normales los gestiona el cambio de estado
      // Recall: chime + hablar sin cambiar estado visual
      const stationShort = station.split(' — ').pop() || station;
      playChime().then(() => {
        const [letter, num] = splitTicketNumber(number);
        const text = `Turno ${letter} ${num}, ${stationShort}.`;
        speakNeural(text);
      });
    };

    return () => { bc.close(); announce.close(); };
  }, []);

  // Cuando cambia el turno activo → animar + chime + hablar + guardar en historial
  useEffect(() => {
    const ticket = state.currentTicket;
    if (!ticket || ticket.status !== 'in_progress') return;
    if (ticket.id === prevTicketId.current) return;

    prevTicketId.current = ticket.id;
    setAnimKey(k => k + 1);

    // Guardar en historial (máximo 5, el más reciente queda al inicio)
    const [l, n] = splitTicketNumber(ticket.number);
    setRecentCalls(prev => [
      { id: ticket.id, letter: l, number: n, name: ticket.name, service: ticket.service },
      ...prev.filter(r => r.id !== ticket.id).slice(0, 4),
    ]);

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      await playChime();
      if (cancelled) return;
      speakNeural(buildSpeechText(ticket, state.station.name.split(' — ').pop() || state.station.name));
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state.currentTicket?.id, state.currentTicket?.status]);

  const ticket = state.currentTicket;
  const isActive = ticket && ticket.status === 'in_progress';
  const isPaused = ticket && ticket.status === 'paused';
  const [letter, number] = ticket ? splitTicketNumber(ticket.number) : ['', ''];

  return (
    <div className="ds-root">
      {/* Header */}
      <div className="ds-header">
        <div className="ds-header-left">
          <img src="/logost.png" alt="logo" className="ds-logo" />
          <div className="ds-header-title">
            <span className="ds-station">{state.station.name || 'TotemDesk'}</span>
            <span className="ds-area">{state.station.area || 'Sistema de atención'}</span>
          </div>
        </div>
        <div className="ds-header-right">
          <span className={`ds-conn-dot ${connected ? 'on' : 'off'}`} />
          <span className="ds-conn-label">{connected ? 'En línea' : 'Conectando…'}</span>
          <span className="ds-clock" id="ds-clock" />
        </div>
      </div>

      {/* Cuerpo principal */}
      <div className="ds-body">

        {/* ── Panel izquierdo: turno actual + historial ── */}
        <div className="ds-left-col">

          {/* Turno activo */}
          <div className="ds-main-panel">
            <div className="ds-now-label">ATENDIENDO AHORA</div>

            {isActive ? (
              <div className="ds-ticket-display" key={animKey}>
                <div className="ds-ticket-full">{letter}-{number}</div>
              </div>
            ) : isPaused ? (
              <div className="ds-paused-display">
                <div className="ds-paused-icon">⏸</div>
                <div className="ds-paused-text">En pausa</div>
              </div>
            ) : (
              <div className="ds-empty-display">
                <div className="ds-empty-icon">
                  <svg viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
                    <path d="M22 32h20M32 22l10 10-10 10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="ds-empty-text">Esperando turno…</div>
              </div>
            )}

            {ticket && (
              <div className="ds-name-row">
                <span className="ds-client-name">{ticket.name}</span>
                <span className="ds-service-badge">{ticket.service}</span>
              </div>
            )}
          </div>

          {/* ── Historial de llamados recientes ── */}
          {recentCalls.length > 0 && (
            <div className="ds-recent-panel">
              <div className="ds-recent-title">LLAMADOS RECIENTES</div>
              <div className="ds-recent-list">
                {recentCalls.map((call, i) => (
                  <div className={`ds-recent-row ${i === 0 ? 'current' : ''}`} key={call.id}>
                    <div className="ds-recent-badge">
                      <span className="ds-recent-letter">{call.letter}</span>
                      <span className="ds-recent-number">{call.number}</span>
                    </div>
                    <div className="ds-recent-info">
                      <span className="ds-recent-name">{call.name}</span>
                      <span className="ds-recent-service">{call.service}</span>
                    </div>
                    {i === 0 && <span className="ds-recent-now-dot" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Cola lateral: próximos ── */}
        <div className="ds-queue-panel">
          <div className="ds-queue-title">
            PRÓXIMOS
            <span className="ds-queue-count">{state.totalInQueue}</span>
          </div>
          <div className="ds-queue-list">
            {state.queue.slice(0, 8).map((entry, i) => {
              const [ql, qn] = splitTicketNumber(entry.ticket.number);
              return (
                <div className="ds-queue-row" key={entry.ticket.id} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="ds-queue-badge">
                    <span className="ds-queue-letter">{ql}</span>
                    <span className="ds-queue-num">{qn}</span>
                  </div>
                  <span className="ds-queue-name">{entry.ticket.name}</span>
                  {entry.isOverdue && <span className="ds-queue-overdue">⚠</span>}
                </div>
              );
            })}
            {state.queue.length === 0 && (
              <div className="ds-queue-empty">Sin turnos en espera</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ds-footer">
        <span>Por favor espere a ser llamado · Gracias por su paciencia</span>
        <button
          className="ds-config-btn"
          title="Configurar voz Neural"
          onClick={() => { setShowConfig(v => !v); setSaved(false); }}
        >⚙</button>
      </div>

      {/* Modal config TTS */}
      {showConfig && (
        <div className="ds-config-overlay" onClick={() => setShowConfig(false)}>
          <div className="ds-config-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-config-title">🎙 Configuración de Voz</div>

            {/* ─── ElevenLabs ─── */}
            <div className="ds-config-section">
              <div className="ds-config-section-title">
                ⭐ ElevenLabs <span className="ds-config-badge free">GRATIS</span>
              </div>
              <p className="ds-config-desc">
                La mejor voz neural en español. <strong>10.000 caracteres gratis/mes</strong>, sin tarjeta de crédito.<br />
                Regístrate en <strong>elevenlabs.io</strong> → Profile → API Key.
              </p>
              <label className="ds-config-label">API Key</label>
              <input
                className="ds-config-input"
                type="password"
                placeholder="sk_..."
                value={elKey}
                onChange={e => { setElKey(e.target.value); setSaved(false); }}
                autoFocus
              />
              <label className="ds-config-label" style={{ marginTop: 10 }}>
                Voice ID <span style={{ opacity: 0.5, fontWeight: 400 }}>(opcional — deja vacío para usar la voz por defecto)</span>
              </label>
              <input
                className="ds-config-input"
                type="text"
                placeholder={ELEVENLABS_VOICE_ID_DEFAULT}
                value={elVoice === ELEVENLABS_VOICE_ID_DEFAULT ? '' : elVoice}
                onChange={e => { setElVoice(e.target.value || ELEVENLABS_VOICE_ID_DEFAULT); setSaved(false); }}
              />
              <div className="ds-config-hint" style={{ marginTop: 6 }}>
                <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noreferrer">
                  → Buscar voces en español en ElevenLabs Voice Library
                </a>
              </div>
            </div>

            <div className="ds-config-actions">
              <button
                className="ds-config-save"
                onClick={() => {
                  if (elKey.trim())   localStorage.setItem('elevenlabs_key', elKey.trim());
                  else                localStorage.removeItem('elevenlabs_key');
                  localStorage.setItem('elevenlabs_voice', elVoice || ELEVENLABS_VOICE_ID_DEFAULT);
                  setSaved(true);
                }}
              >
                {saved ? '✓ Guardado' : 'Guardar'}
              </button>
              <button className="ds-config-close" onClick={() => setShowConfig(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <Clock />
    </div>
  );
}

// Reloj en tiempo real
function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="ds-clock-val">{time}</span>;
}
