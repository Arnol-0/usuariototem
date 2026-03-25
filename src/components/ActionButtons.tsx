import React, { useState, useEffect } from 'react';
import { useTotem } from '../context/TotemContext';
import {
  SkipForward, PhoneCall, PauseCircle, PlayCircle,
  CheckCircle, Toilet, Utensils, UserX, HelpCircle,
} from 'lucide-react';
import { getComment, upsertComment } from '../services/commentStore';
import type { PauseReason, SkipReason } from '../types/totem';
import './ActionButtons.css';

interface ActionButtonsProps {
  isPaused:   boolean;
  pauseReason: PauseReason;
  onResume:   () => void;
  onResumed:  () => void;
}

export default function ActionButtons({ isPaused, onResume, onResumed }: ActionButtonsProps) {
  const { state, dispatch } = useTotem();
  const [loading, setLoading]               = useState<string | null>(null);
  const [comment, setComment]               = useState('');

  // Modales
  const [showPauseModal,  setShowPauseModal]  = useState(false);
  const [showNextModal,   setShowNextModal]   = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Modal Siguiente — expansión "Otro motivo"
  const [nextOtherExpanded, setNextOtherExpanded] = useState(false);
  const [nextOtherComment,  setNextOtherComment]  = useState('');

  // Validación comentario en modal Finalizar
  const [finishComment,       setFinishComment]       = useState('');
  const [finishCommentWarn,   setFinishCommentWarn]   = useState(false);

  const ticket = state.currentTicket;

  // Nombre del operador extraído del estado (formato "Nombre — Puesto")
  const operatorName = state.station.name.split(' — ')[0].trim();

  // Carga comentario guardado al cambiar ticket
  useEffect(() => {
    if (!ticket) { setComment(''); return; }
    getComment(ticket.id).then(s => setComment(s?.comment ?? ''));
  }, [ticket?.id]);

  // Autosave comentario con debounce
  useEffect(() => {
    if (!ticket) return;
    const h = window.setTimeout(() =>
      upsertComment({ ticketId: ticket.id, ticketNumber: ticket.number, comment }), 300);
    return () => window.clearTimeout(h);
  }, [comment, ticket?.id]);

  // ── Pausa ────────────────────────────────────────────────────────────────────
  const actPause = async (reason: PauseReason) => {
    setShowPauseModal(false);
    setLoading('pause');
    if (ticket && comment.trim())
      upsertComment({ ticketId: ticket.id, ticketNumber: ticket.number, comment: comment.trim(), operatorName });
    await dispatch({ action: 'pause', ticketId: ticket?.id, comment, pauseReason: reason });
    setLoading(null);
  };

  // ── Siguiente (con motivo) ───────────────────────────────────────────────────
  const actNext = async (reason: SkipReason) => {
    const finalComment = reason === 'other' ? nextOtherComment.trim() : '';
    setShowNextModal(false);
    setNextOtherExpanded(false);
    setNextOtherComment('');
    setLoading('next');
    await dispatch({ action: 'next', ticketId: ticket?.id, comment: finalComment, skipReason: reason });
    setLoading(null);
    setComment('');
  };

  // ── Finalizar (comentario obligatorio) ──────────────────────────────────────
  const actFinish = async () => {
    if (!finishComment.trim()) {
      setFinishCommentWarn(true);
      return;
    }
    setShowFinishModal(false);
    setLoading('finish');
    if (ticket)
      upsertComment({ ticketId: ticket.id, ticketNumber: ticket.number, comment: finishComment.trim(), operatorName });
    await dispatch({ action: 'finish', ticketId: ticket?.id, comment: finishComment });
    setLoading(null);
    setFinishComment('');
    setComment('');
  };

  // ── Recall ───────────────────────────────────────────────────────────────────
  const actRecall = async () => {
    setLoading('recall');
    await dispatch({ action: 'recall', ticketId: ticket?.id });
    setLoading(null);
  };

  /* ── Vista pausado ── */
  if (isPaused) {
    return (
      <div className="ab-wrapper">
        <button className="ab-btn ab-resume-wide"
          onClick={async () => { onResume(); setLoading('pause'); await dispatch({ action: 'resume' }); setLoading(null); onResumed(); }}
          disabled={!!loading}>
          {loading === 'pause' ? <span className="ab-spinner" /> : <PlayCircle size={22} strokeWidth={2} />}
          <span>Reanudar</span>
        </button>
      </div>
    );
  }

  return (
    <div className="ab-wrapper">

      {/* Grid principal — 3 columnas */}
      <div className="ab-grid">

        {/* Siguiente / Iniciar turno */}
        <button className="ab-btn ab-next"
          onClick={() => {
            if (!ticket) {
              actNext('other');
            } else {
              setShowNextModal(true);
            }
          }}
          disabled={!!loading}>
          {loading === 'next' ? <span className="ab-spinner" /> : <SkipForward size={22} strokeWidth={2} />}
          <span>{ticket ? 'Siguiente' : 'Iniciar turno'}</span>
        </button>

        {/* Recall */}
        <button className="ab-btn ab-recall"
          onClick={actRecall}
          disabled={!!loading || !ticket}>
          {loading === 'recall' ? <span className="ab-spinner" /> : <PhoneCall size={20} strokeWidth={2} />}
          <span>Recall</span>
        </button>

        {/* Pausar */}
        <button className="ab-btn ab-pause"
          onClick={() => setShowPauseModal(true)}
          disabled={!!loading}>
          {loading === 'pause' ? <span className="ab-spinner ab-spinner--dark" /> : <PauseCircle size={20} strokeWidth={2} />}
          <span>Pausar</span>
        </button>

        {/* Finalizar — span 3 columnas, abre modal con comentario obligatorio */}
        <button className="ab-btn ab-finish ab-finish-wide"
          onClick={() => { setFinishComment(comment); setFinishCommentWarn(false); setShowFinishModal(true); }}
          disabled={!!loading || !ticket}>
          {loading === 'finish' ? <span className="ab-spinner ab-spinner--light" /> : <CheckCircle size={20} strokeWidth={2} />}
          <span>Finalizar turno</span>
        </button>

      </div>

      {/* Comentario interno (se pre-carga en el modal Finalizar) */}
      <div className="ab-comment-card">
        <div className="ab-comment-header">
          <svg className="ab-comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="ab-comment-label">Comentario de turno</span>
        </div>
        <textarea
          className="ab-comment-input"
          placeholder={ticket ? `Notas para ${ticket.number}…` : 'Sin turno activo…'}
          value={comment}
          rows={2}
          disabled={!ticket}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      {/* ── Modal: Siguiente — motivo ── */}
      {showNextModal && (
        <div className="ab-modal-backdrop" onClick={() => { setShowNextModal(false); setNextOtherExpanded(false); setNextOtherComment(''); }}>
          <div className="ab-modal" onClick={e => e.stopPropagation()}>
            <div className="ab-modal-title">¿Por qué das siguiente?</div>
            {ticket
              ? <div className="ab-modal-sub">Turno <strong>{ticket.number}</strong></div>
              : <div className="ab-modal-sub">Llamar al próximo de la cola</div>}

            <button className="ab-modal-opt no-show" onClick={() => actNext('no_show')}>
              <span className="ab-modal-opt-icon"><UserX size={24} strokeWidth={1.7} color="#c0392b" /></span>
              <div className="ab-modal-opt-text">
                <div className="ab-modal-opt-label">No se presentó</div>
                <div className="ab-modal-opt-hint">La persona no llegó al puesto</div>
              </div>
            </button>

            {/* "Otro motivo" — se expande al hacer click */}
            <button
              className={`ab-modal-opt other ${nextOtherExpanded ? 'expanded' : ''}`}
              onClick={() => setNextOtherExpanded(v => !v)}
            >
              <span className="ab-modal-opt-icon"><HelpCircle size={24} strokeWidth={1.7} color="#6c757d" /></span>
              <div className="ab-modal-opt-text">
                <div className="ab-modal-opt-label">Otro motivo</div>
                <div className="ab-modal-opt-hint">{nextOtherExpanded ? 'Escribe el motivo abajo' : 'Toca para escribir el motivo'}</div>
              </div>
            </button>

            {/* Expansión animada */}
            <div className={`ab-next-other-expand ${nextOtherExpanded ? 'open' : ''}`}>
              <textarea
                className="ab-modal-textarea"
                placeholder="Describe brevemente el motivo…"
                rows={2}
                value={nextOtherComment}
                autoFocus={nextOtherExpanded}
                onChange={e => setNextOtherComment(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              <button
                className="ab-modal-confirm"
                onClick={e => { e.stopPropagation(); actNext('other'); }}
              >
                <SkipForward size={16} strokeWidth={2} /> Confirmar y siguiente
              </button>
            </div>

            <button className="ab-modal-cancel" onClick={() => { setShowNextModal(false); setNextOtherExpanded(false); setNextOtherComment(''); }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Finalizar — comentario obligatorio ── */}
      {showFinishModal && (
        <div className="ab-modal-backdrop" onClick={() => setShowFinishModal(false)}>
          <div className="ab-modal" onClick={e => e.stopPropagation()}>
            <div className="ab-modal-title">Finalizar turno</div>
            <div className="ab-modal-sub">Turno <strong>{ticket?.number}</strong> – {ticket?.name}</div>

            <div className={`ab-modal-field ${finishCommentWarn ? 'warn' : ''}`}>
              <label className="ab-modal-field-label">
                Comentario de cierre <span className="ab-modal-required">*obligatorio</span>
              </label>
              <textarea
                className={`ab-modal-textarea ${finishCommentWarn ? 'warn' : ''}`}
                placeholder="Describe brevemente la atención…"
                rows={3}
                value={finishComment}
                autoFocus
                onChange={e => { setFinishComment(e.target.value); setFinishCommentWarn(false); }}
              />
              {finishCommentWarn && (
                <div className="ab-modal-field-warn">Debes escribir un comentario antes de finalizar</div>
              )}
            </div>

            <button className="ab-modal-confirm" onClick={actFinish}>
              <CheckCircle size={18} strokeWidth={2} /> Confirmar y finalizar
            </button>
            <button className="ab-modal-cancel" onClick={() => setShowFinishModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Pausar — motivo ── */}
      {showPauseModal && (
        <div className="ab-modal-backdrop" onClick={() => setShowPauseModal(false)}>
          <div className="ab-modal" onClick={e => e.stopPropagation()}>
            <div className="ab-modal-title">¿Motivo de la pausa?</div>
            <div className="ab-modal-sub">Turno <strong>{ticket?.number}</strong></div>

            <button className="ab-modal-opt bathroom" onClick={() => actPause('bathroom')}>
              <span className="ab-modal-opt-icon"><Toilet size={24} strokeWidth={1.7} color="#2a5298" /></span>
              <div className="ab-modal-opt-text">
                <div className="ab-modal-opt-label">Ir al baño</div>
                <div className="ab-modal-opt-hint">Pausa corta</div>
              </div>
            </button>

            <button className="ab-modal-opt lunch" onClick={() => actPause('lunch')}>
              <span className="ab-modal-opt-icon"><Utensils size={22} strokeWidth={1.7} color="#92580a" /></span>
              <div className="ab-modal-opt-text">
                <div className="ab-modal-opt-label">Colación</div>
                <div className="ab-modal-opt-hint">Pausa de almuerzo</div>
              </div>
            </button>

            <button className="ab-modal-cancel" onClick={() => setShowPauseModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
}
