import React, { useEffect, useReducer, useState } from 'react';
import type { TotemState, ActionPayload, QueueEntry, PauseReason } from '@/types/totem';
import { formatTime, formatWaiting } from '@/utils/time';
import { getComment, upsertComment } from '@/services/commentStore';
import { Utensils, Toilet, LogOut } from 'lucide-react';
import './OverlayApp.css';

// ── Estado inicial vacío ───────────────────────────────────────────────────
const EMPTY: TotemState = {
  station: { id: '', name: 'Tótem', area: '', isActive: false },
  currentTicket: null,
  queue: [],
  totalInQueue: 0,
  isConnected: false,
};

// ── Comunicación con la ventana principal ──────────────────────────────────
// Escucha estado vía BroadcastChannel 'totem_state'
// Envía acciones vía BroadcastChannel 'totem_action'

function sendAction(payload: ActionPayload) {
  const bc = new BroadcastChannel('totem_action');
  bc.postMessage(payload);
  bc.close();
}

export default function OverlayApp() {
  const [state, setState] = useReducer(
    (_: TotemState, s: TotemState) => s,
    EMPTY,
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [noCommentWarn, setNoCommentWarn] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [resuming, setResuming] = useState(false);

  // Suscribirse al canal de estado
  useEffect(() => {
    const bc = new BroadcastChannel('totem_state');
    bc.onmessage = (e: MessageEvent<TotemState>) => {
      setState(e.data);
      setConnected(true);
      setResuming(false); // nuevo estado recibido → limpiar flag
    };
    // Pedir estado actual al abrir
    const req = new BroadcastChannel('totem_request');
    req.postMessage('get_state');
    req.close();

    return () => bc.close();
  }, []);

  // Cargar comentario guardado al cambiar el ticket actual
  useEffect(() => {
    const t = state.currentTicket;
    if (!t) {
      setCommentDraft('');
      return;
    }
    getComment(t.id).then(saved => setCommentDraft(saved?.comment ?? ''));
  }, [state.currentTicket?.id]);

  // Persistir el comentario mientras escribe (debounce simple)
  useEffect(() => {
    const t = state.currentTicket;
    if (!t) return;
    const handle = window.setTimeout(() => {
      // Guardar aunque esté vacío (permite borrar)
      upsertComment({ ticketId: t.id, ticketNumber: t.number, comment: commentDraft });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [commentDraft, state.currentTicket?.id]);

  const act = async (action: 'next' | 'recall' | 'pause') => {
    const t = state.currentTicket;

    // Bloquear SIGUIENTE si no hay comentario escrito
    if (action === 'next' && commentDraft.trim() === '') {
      setNoCommentWarn(true);
      setTimeout(() => setNoCommentWarn(false), 3500);
      return;
    }

    // PAUSAR (cuando NO está pausado) → mostrar modal de motivo
    if (action === 'pause' && t?.status !== 'paused') {
      setShowPauseModal(true);
      return;
    }

    // REANUDAR (cuando SÍ está pausado) → envía 'resume' para liberar el turno
    const resolvedAction = (action === 'pause' && t?.status === 'paused') ? 'resume' : action;

    // Ocultar vista pausada inmediatamente sin esperar el BroadcastChannel
    if (resolvedAction === 'resume') setResuming(true);

    // Reanudar o ejecutar normalmente
    setNoCommentWarn(false);
    setLoading(action);
    if (t) upsertComment({ ticketId: t.id, ticketNumber: t.number, comment: commentDraft });
    sendAction({ action: resolvedAction, ticketId: t?.id, comment: commentDraft });
    setTimeout(() => setLoading(null), 400);
  };

  const actPause = (reason: PauseReason) => {
    const t = state.currentTicket;
    setShowPauseModal(false);
    setLoading('pause');
    if (t) upsertComment({ ticketId: t.id, ticketNumber: t.number, comment: commentDraft });
    sendAction({ action: 'pause', ticketId: t?.id, comment: commentDraft, pauseReason: reason });
    setTimeout(() => setLoading(null), 400);
  };

  const ticket = state.currentTicket;
  const isPaused = !resuming && ticket?.status === 'paused';
  // Si pauseReason es null (dato legado sin motivo), tratar como 'lunch' por defecto
  const pauseReason: PauseReason = (ticket?.pauseReason ?? 'lunch') as PauseReason;

  const pausePillLabel = isPaused
    ? (pauseReason === 'bathroom' ? 'EN EL BAÑO' : 'EN COLACIÓN')
    : 'EN ATENCIÓN';

  return (
    <div className="oa-root">
      {/* Header oscuro */}
      <div className="oa-topbar">
        <span className="oa-topbar-title">{state.station.name || 'JOTO - PUESTO'}</span>
        <div className="oa-topbar-right">
          <span className={`oa-conn ${connected ? 'on' : 'off'}`} title={connected ? 'Conectado' : 'Desconectado'} />
          <button className="oa-logout-btn" title="Cerrar sesión" onClick={() => setShowLogoutConfirm(true)}>
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="oa-body">
        {/* Turno actual */}
        <div className={`oa-current ${isPaused ? 'paused' : ''}`}>
          {ticket ? (
            <>
              <div className="oa-live-row">
                <span className={`oa-live-pill ${isPaused ? 'paused' : ''}`}>{pausePillLabel}</span>
              </div>

              {isPaused ? (
                <div className="oa-paused-state">
                  <div className={`oa-paused-icon ${pauseReason === 'bathroom' ? 'oa-paused-icon--bathroom' : 'oa-paused-icon--lunch'}`}>
                    {pauseReason === 'bathroom'
                      ? <Toilet size={38} strokeWidth={1.5} color="#2a5298" />
                      : <Utensils size={34} strokeWidth={1.5} color="#92580a" />}
                  </div>
                  <div className="oa-paused-label">Sin turno activo</div>
                  <div className="oa-paused-sub">
                    {pauseReason === 'bathroom' ? 'Operador en el baño' : 'Operador en colación'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="oa-current-number">{ticket.number}</div>
                  <div className="oa-current-name">{ticket.name}</div>

                  <div className="oa-metrics">
                    <div className="oa-metric">
                      <div className="oa-metric-label">SERVICIO</div>
                      <div className="oa-metric-value">{ticket.service}</div>
                    </div>
                    <div className="oa-metric">
                      <div className="oa-metric-label">DURACIÓN</div>
                      <div className="oa-metric-value duration">{formatTime(ticket.duration)}</div>
                    </div>
                    <div className="oa-metric">
                      <div className="oa-metric-label">ESPERA</div>
                      <div className="oa-metric-value">{formatWaiting(ticket.waitingTime)}</div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="oa-empty-state">
              {connected ? 'Sin turno activo' : 'Conectando…'}
            </div>
          )}
        </div>

        {/* Acciones: SIGUIENTE · RECALL · PAUSAR */}
        <div className="oa-actions-grid">
          <button className="oa-card-btn next" onClick={() => act('next')} disabled={!!loading || !ticket}>
            <div className="oa-card-icon">
              {loading === 'next' ? <span className="oa-spin" /> : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </div>
            <div className="oa-card-label">SIGUIENTE</div>
          </button>

          <button className="oa-card-btn recall" onClick={() => act('recall')} disabled={!!loading || !ticket}>
            <div className="oa-card-icon">
              {loading === 'recall' ? <span className="oa-spin recall-spin" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                </svg>
              )}
            </div>
            <div className="oa-card-label">RECALL</div>
          </button>

          <button className="oa-card-btn pause oa-card-btn--wide" onClick={() => act('pause')} disabled={!!loading || !ticket}>
            <div className="oa-card-icon">
              {loading === 'pause' ? <span className="oa-spin pause-spin" /> : isPaused ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
              )}
            </div>
            <div className="oa-card-label">{isPaused ? 'REANUDAR' : 'PAUSAR'}</div>
          </button>
        </div>

        {/* Aviso: no hay comentario */}
        {noCommentWarn && (
          <div className="oa-warn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            No escribiste el comentario del turno <strong>{ticket?.number}</strong>
          </div>
        )}

        {/* Próximos */}
        <div className="oa-next">
          <div className="oa-next-title">PRÓXIMOS ({state.totalInQueue})</div>
          <div className="oa-next-list">
            {state.queue.slice(0, 3).map((e: QueueEntry) => (
              <div key={e.ticket.id} className="oa-next-row">
                <div className="oa-next-left">
                  <div className="oa-next-num">{e.ticket.number}</div>
                  <div className="oa-next-name">{e.ticket.name}</div>
                </div>
                <div className={`oa-next-wait ${e.isOverdue ? 'overdue' : ''}`}>{formatWaiting(e.waitingSeconds)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Comentario siempre visible y asociado al ticket actual */}
        <div className="oa-comment">
          <div className="oa-comment-header">
            <svg className="oa-comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div className="oa-comment-label">Comentario de turno</div>
          </div>
          <textarea
            className="oa-comment-input"
            rows={2}
            value={commentDraft}
            placeholder={ticket ? `Comentario para ${ticket.number}…` : 'Selecciona un turno…'}
            onChange={(e) => setCommentDraft(e.target.value)}
            disabled={!ticket}
          />
          {ticket && (
            <div className="oa-comment-hint">
              Se guarda para <strong>{ticket.number}</strong>.
            </div>
          )}
        </div>
      </div>

      {/* Modal de motivo de pausa — obligatorio, sin opción de cancelar */}
      {showPauseModal && (
        <div className="oa-pause-backdrop">
          <div className="oa-pause-modal">
            <div className="oa-pause-modal-title">¿Motivo de la pausa?</div>
            <div className="oa-pause-modal-sub">Turno <strong>{ticket?.number}</strong></div>

            <button className="oa-pause-opt bathroom" onClick={() => actPause('bathroom')}>
              <span className="oa-pause-opt-icon">
                <Toilet size={24} strokeWidth={1.7} color="#2a5298" />
              </span>
              <div className="oa-pause-opt-text">
                <div className="oa-pause-opt-label">Ir al baño</div>
                <div className="oa-pause-opt-hint">Pausa corta</div>
              </div>
            </button>

            <button className="oa-pause-opt lunch" onClick={() => actPause('lunch')}>
              <span className="oa-pause-opt-icon">
                <Utensils size={22} strokeWidth={1.7} color="#92580a" />
              </span>
              <div className="oa-pause-opt-text">
                <div className="oa-pause-opt-label">Colación</div>
                <div className="oa-pause-opt-hint">Pausa de almuerzo</div>
              </div>
            </button>

            <button className="oa-pause-cancel" onClick={() => setShowPauseModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal cierre de sesión */}
      {showLogoutConfirm && (
        <div className="oa-pause-backdrop">
          <div className="oa-pause-modal">
            <div className="oa-logout-icon-wrap">
              <LogOut size={28} strokeWidth={1.8} color="#c0392b" />
            </div>
            <div className="oa-pause-modal-title">¿Cerrar sesión?</div>
            <div className="oa-pause-modal-sub">Se cerrará este panel de atención</div>
            <button className="oa-logout-confirm-btn" onClick={() => {
              sendAction({ action: 'logout' } as any);
              window.close();
            }}>
              Sí, cerrar sesión
            </button>
            <button className="oa-pause-cancel" onClick={() => setShowLogoutConfirm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
