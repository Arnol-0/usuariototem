import React from 'react';
import { useTotem } from '../context/TotemContext';
import { formatTime, formatWaiting } from '../utils/time';
import type { PauseReason } from '../types/totem';
import { Toilet, Utensils } from 'lucide-react';
import './CurrentTicket.css';

interface CurrentTicketProps {
  isPaused: boolean;
  pauseReason: PauseReason;
}

export default function CurrentTicket({ isPaused, pauseReason }: CurrentTicketProps) {
  const { state } = useTotem();
  const ticket = state.currentTicket;

  if (!ticket) {
    return (
      <div className="ct-card ct-empty">
        <div className="ct-empty-icon">📋</div>
        <div className="ct-empty-label">Sin turno activo</div>
        <div className="ct-empty-sub">Esperando siguiente llamada</div>
      </div>
    );
  }

  return (
    <div className={`ct-card ${isPaused ? 'paused' : ''}`}>
      <div className="ct-top-row">
        <span className="ct-label">TURNO EN ATENCIÓN</span>
        <span className={`ct-pill ${isPaused ? 'paused' : ''}`}>
          {isPaused
            ? (pauseReason === 'bathroom' ? 'EN EL BAÑO' : 'EN COLACIÓN')
            : '● EN ATENCIÓN'}
        </span>
      </div>

      {isPaused ? (
        <div className="ct-paused-state">
          <div className={`ct-paused-icon ${pauseReason === 'bathroom' ? 'bathroom' : 'lunch'}`}>
            {pauseReason === 'bathroom'
              ? <Toilet size={36} strokeWidth={1.5} color="#2a5298" />
              : <Utensils size={32} strokeWidth={1.5} color="#92580a" />}
          </div>
          <div className="ct-paused-label">Sin turno activo</div>
          <div className="ct-paused-sub">
            {pauseReason === 'bathroom' ? 'Operador en el baño' : 'Operador en colación'}
          </div>
        </div>
      ) : (
        <>
          <div className="ct-number">{ticket.number}</div>
          <div className="ct-name">{ticket.name}</div>
          <div className="ct-meta">
            <div className="ct-meta-item">
              <span className="ct-meta-label">SERVICIO</span>
              <span className="ct-meta-value">{ticket.service}</span>
            </div>
            <div className="ct-meta-item">
              <span className="ct-meta-label">DURACIÓN</span>
              <span className="ct-meta-value accent">{formatTime(ticket.duration)}</span>
            </div>
            <div className="ct-meta-item">
              <span className="ct-meta-label">ESPERA</span>
              <span className="ct-meta-value">{formatWaiting(ticket.waitingTime)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
