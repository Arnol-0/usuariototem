// Tipos base del sistema de tótem

export type TicketStatus = 'waiting' | 'in_progress' | 'paused' | 'done';
export type PauseReason  = 'bathroom' | 'lunch';
export type SkipReason   = 'no_show' | 'other';  // motivo al dar Siguiente

export interface Ticket {
  id: string;
  number: string;       // Ej: "A-142"
  name: string;
  service: string;
  status: TicketStatus;
  pauseReason?: PauseReason | null; // razón de la pausa
  duration: number;     // segundos transcurridos
  waitingTime: number;  // segundos en cola
  waitPosition?: number;
  // Metadatos del RTDB (opcionales — solo para tickets del tótem físico)
  _rtdbId?:    string;
  _letra?:     string;
  _rut?:       string;
  _emitidoEn?: number;
}

export interface QueueEntry {
  ticket: Ticket;
  waitingSeconds: number;
  isOverdue: boolean;
  position?: number;
  // Metadatos del RTDB propagados al nivel del entry (para claimNextTicket)
  _rtdbId?:    string;
  _letra?:     string;
  _claiming?:  string;
}

export interface Station {
  id: string;
  name: string;         // "Main Office - Station 05"
  area: string;         // "IP Area"
  isActive: boolean;
}

export type TicketAction = 'next' | 'recall' | 'finish' | 'pause' | 'pause_bathroom' | 'pause_lunch' | 'resume' | 'transfer';

export interface ActionPayload {
  action:      TicketAction;
  ticketId?:   string;
  comment?:    string;
  pauseReason?: PauseReason;
  skipReason?:  SkipReason;   // motivo al dar Siguiente (no_show, other)
}

export interface TotemState {
  station: Station;
  currentTicket: Ticket | null;
  queue: QueueEntry[];
  totalInQueue: number;
  isConnected: boolean;
}
