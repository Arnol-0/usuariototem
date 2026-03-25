import React from 'react';
import { useTotem } from '../context/TotemContext';
import { formatWaiting } from '../utils/time';
import type { QueueEntry } from '../types/totem';
import { Clock } from 'lucide-react';
import './WaitingQueue.css';

function QueueRow({ entry }: { entry: QueueEntry }) {
  const { ticket, waitingSeconds, isOverdue } = entry;
  return (
    <div className="wq-row">
      <div className="wq-row-left">
        <span className="wq-num">{ticket.number}</span>
        <span className="wq-name">{ticket.name}</span>
      </div>
      <span className={`wq-wait ${isOverdue ? 'overdue' : ''}`}>
        <Clock size={11} strokeWidth={2.5} />
        {formatWaiting(waitingSeconds)}
      </span>
    </div>
  );
}

export default function WaitingQueue() {
  const { state } = useTotem();
  const { queue, totalInQueue } = state;
  const extra = totalInQueue - queue.length;

  return (
    <div className="waiting-queue">
      <div className="wq-header">
        <span className="wq-dot" />
        <span className="wq-title">Cola de espera</span>
        <span className="wq-count">{totalInQueue}</span>
      </div>

      <div className="wq-list">
        {queue.map(entry => (
          <QueueRow key={entry.ticket.id} entry={entry} />
        ))}
      </div>

      {extra > 0 && (
        <p className="wq-extra">+ {extra} más en cola</p>
      )}

      <button className="wq-view-all">Ver todos los turnos</button>
    </div>
  );
}
