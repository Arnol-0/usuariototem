import React, { useState, useEffect, useRef } from 'react';
import { useTotem } from '../context/TotemContext';
import './FloatingOverlay.css';

/**
 * FloatingOverlay – aparece cuando el usuario minimiza o cambia de ventana.
 * Usa la Page Visibility API + window blur para detectar pérdida de foco.
 * El panel es arrastrable para que el usuario lo recoloque.
 */
export default function FloatingOverlay() {
  const { state, dispatch } = useTotem();
  const [visible, setVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // Detectar pérdida de foco / minimización
  useEffect(() => {
    const onVisChange = () => setVisible(document.hidden);
    const onBlur = () => setVisible(true);
    const onFocus = () => setVisible(false);

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const act = async (action: 'next' | 'recall' | 'pause' | 'finish') => {
    setLoading(action);
    await dispatch({ action, ticketId: state.currentTicket?.id, comment });
    setLoading(null);
  };

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!visible) return null;

  const ticket = state.currentTicket;
  const isPaused = ticket?.status === 'paused';

  return (
    <div
      className="fo-root"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Handle de arrastre */}
      <div className="fo-drag-handle" onMouseDown={onMouseDown}>
        <span className="fo-station">{state.station.name}</span>
        <button
          className="fo-close"
          onClick={() => setVisible(false)}
          title="Cerrar overlay"
        >✕</button>
      </div>

      {/* Turno actual */}
      <div className="fo-ticket">
        {ticket ? (
          <>
            <span className={`fo-live ${isPaused ? 'paused' : ''}`}>
              {isPaused ? 'PAUSED' : 'LIVE'}
            </span>
            <span className="fo-number">{ticket.number}</span>
            <span className="fo-name">{ticket.name}</span>
          </>
        ) : (
          <span className="fo-empty">Sin turno activo</span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="fo-actions">
        <button
          className="fo-btn primary"
          disabled={!!loading}
          onClick={() => act('next')}
          title="Siguiente"
        >
          {loading === 'next' ? '…' : '▶⏸ Siguiente'}
        </button>
        <button
          className="fo-btn secondary"
          disabled={!!loading}
          onClick={() => act('recall')}
          title="Llamar de nuevo"
        >
          {loading === 'recall' ? '…' : '📣 Recall'}
        </button>
        <button
          className={`fo-btn ${isPaused ? 'resume' : 'pause'}`}
          disabled={!!loading}
          onClick={() => act('pause')}
          title={isPaused ? 'Reanudar' : 'Pausar turno'}
        >
          {loading === 'pause' ? '…' : isPaused ? '▶ Reanudar' : '⏸ Pausar'}
        </button>
        <button
          className="fo-btn finish"
          disabled={!!loading}
          onClick={() => act('finish')}
          title="Finalizar"
        >
          {loading === 'finish' ? '…' : '✔ Finalizar'}
        </button>
      </div>

      {/* Comentario */}
      <div className="fo-comment-row">
        <button
          className="fo-comment-toggle"
          onClick={() => setShowComment(v => !v)}
        >
          💬 {showComment ? 'Cerrar comentario' : 'Añadir comentario'}
        </button>
      </div>
      {showComment && (
        <div className="fo-comment-box">
          <textarea
            className="fo-comment-input"
            rows={2}
            value={comment}
            placeholder="Escribe un comentario…"
            onChange={e => setComment(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
