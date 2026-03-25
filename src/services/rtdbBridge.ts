/**
 * rtdbBridge.ts
 *
 * Puente entre el Realtime Database del tótem y Firestore de este sistema.
 *
 * ── Estructura REAL del RTDB (tótem físico) ───────────────────────────────────
 *   cola/
 *     {codigoServicio}/       ← ej: "tens", "medico", "admin" ...
 *       contador: N
 *       tickets: [            ← ARRAY (índice 0 = null, datos desde índice 1)
 *         null,
 *         {
 *           codigoServicio    ← "tens"
 *           estado            ← "esperando" | "llamado" | "atendido" | "transferido"
 *           fecha             ← "2026-03-09"
 *           hora              ← "02:24 p.m."
 *           letra             ← "A"   ← letra del turno (lo que usamos para filtrar)
 *           numero            ← 1     ← número correlativo (int)
 *           rut               ← "11.111.111-1"
 *           servicio          ← "Técnico en Enfermería"
 *           ticketCompleto    ← "A-1" ← número de turno legible
 *           timestamp         ← 1773077058561  (ms)
 *         },
 *         ...
 *       ]
 *
 * ── Lo que hace este bridge ───────────────────────────────────────────────────
 *   1. Suscribe a cola/ completo (todos los códigos de servicio)
 *   2. Filtra tickets cuya letra esté en las letras del operador logueado
 *   3. Por cada ticket nuevo con estado "esperando" → inserta en Firestore queue
 *   4. Mantiene mapa "codigoServicio/idx" → firestoreDocId
 *   5. Exporta helpers para marcar llamado / finalizado en el RTDB
 *   6. Al finalizar → escribe en Firestore `tickets` (historial para stats)
 */

import {
  ref, onValue, update, off,
  type DatabaseReference,
} from 'firebase/database';
import {
  collection, addDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs, query, where,
} from 'firebase/firestore';
import { rtdb, db } from './firebase';

// ─── Tipo real del ticket en el RTDB ─────────────────────────────────────────

export interface RtdbTicket {
  codigoServicio: string;       // "tens"
  estado:         string;       // "esperando" | "llamado" | "atendido" | "transferido"
  fecha:          string;       // "2026-03-09"
  hora:           string;       // "02:24 p.m."
  letra:          string;       // "A"
  numero:         number;       // 1 (correlativo int)
  rut:            string;       // "11.111.111-1"
  servicio:       string;       // "Técnico en Enfermería"
  ticketCompleto: string;       // "A-1"
  timestamp:      number;       // ms epoch
  // Campos que escribe este sistema al llamar/finalizar:
  llamadoEn?:    number | null;
  finalizadoEn?: number | null;
  puestoId?:     string | null;
  operadorId?:   string | null;
  esperaSeg?:    number | null;
}

// ─── Estado interno del bridge ────────────────────────────────────────────────

// Mapa: "codigoServicio/idx" → docId en Firestore `queue`
const _queueMap = new Map<string, string>();

// Ref único a cola/ completo
let _colaRef: DatabaseReference | null = null;

// Letras que este operador atiende (["A", "B", ...])
let _myLetters: string[] = [];

// IDs del operador y puesto logueado
let _operatorId = '';
let _stationId  = '';

// ─── Inicializar bridge ───────────────────────────────────────────────────────

/**
 * Inicia el bridge.
 * @param letters    Letras que atiende este puesto: ["A", "B"]
 * @param operatorId ID del doc de operador en Firestore
 * @param stationId  ID del doc de puesto en Firestore
 */
export function startRtdbBridge(
  letters:    string[],
  operatorId: string,
  stationId:  string,
): void {
  stopRtdbBridge();

  _myLetters  = letters.map(l => l.toUpperCase());
  _operatorId = operatorId;
  _stationId  = stationId;

  if (_myLetters.length === 0) {
    console.warn('[rtdbBridge] Sin letras asignadas — no se suscribe al RTDB');
    return;
  }

  // Suscripción a toda la cola/ — filtramos por letra dentro del handler
  _colaRef = ref(rtdb, 'cola');

  onValue(_colaRef, async (snapshot) => {
    const cola = snapshot.val() as Record<string, {
      contador?: number;
      tickets?: (RtdbTicket | null)[];
    }> | null;

    if (!cola) return;

    // Recorre cada código de servicio (tens, medico, etc.)
    for (const [codServicio, servData] of Object.entries(cola)) {
      const tickets = servData?.tickets;
      if (!tickets) continue;

      // tickets es un array — recorremos con índice (index 0 = null en el tótem)
      tickets.forEach(async (ticket, idx) => {
        if (!ticket) return;                                   // slot null (índice 0)
        if (!_myLetters.includes(ticket.letra?.toUpperCase())) return; // no es nuestra letra

        const key = `${codServicio}/${idx}`;

        if (ticket.estado === 'esperando' && !_queueMap.has(key)) {
          await _addToFirestoreQueue(key, codServicio, idx, ticket);
        }

        // Si el tótem lo marcó como no-esperando desde otro sistema → sacamos de queue
        if (ticket.estado !== 'esperando' && _queueMap.has(key)) {
          const fsDocId = _queueMap.get(key)!;
          try { await deleteDoc(doc(db, 'queue', fsDocId)); } catch { /* ya borrado */ }
          _queueMap.delete(key);
        }
      });
    }
  });
}

/** Detiene todos los listeners y limpia el estado */
export function stopRtdbBridge(): void {
  if (_colaRef) { off(_colaRef); _colaRef = null; }
  _queueMap.clear();
}

// ─── Insertar ticket en Firestore queue ──────────────────────────────────────

async function _addToFirestoreQueue(
  key:         string,     // "tens/1"
  codServicio: string,     // "tens"
  idx:         number,     // 1
  ticket:      RtdbTicket,
): Promise<void> {
  // Evita duplicados: comprueba si ya existe en Firestore por _rtdbKey
  try {
    const existing = await getDocs(
      query(collection(db, 'queue'), where('_rtdbKey', '==', key)),
    );
    if (!existing.empty) {
      // Ya existe — registra el mapeo y sale
      _queueMap.set(key, existing.docs[0].id);
      return;
    }
  } catch { /* sin permisos de lectura todavía — continúa */ }

  const position     = _queueMap.size;
  const waitingTime  = Math.floor((Date.now() - ticket.timestamp) / 1000);

  const entry = {
    ticket: {
      id:           `rtdb-${codServicio}-${idx}`,
      number:       ticket.ticketCompleto,          // "A-1"
      name:         ticket.rut,                     // RUT como nombre visible
      service:      ticket.servicio,
      status:       'waiting' as const,
      duration:     0,
      waitingTime,
      waitPosition: position,
      pauseReason:  null,
      // Metadatos para poder escribir de vuelta al RTDB
      _rtdbKey:     key,                            // "tens/1"
      _codServicio: codServicio,                    // "tens"
      _rtdbIdx:     idx,                            // 1
      _letra:       ticket.letra.toUpperCase(),     // "A"
      _rut:         ticket.rut,
      _emitidoEn:   ticket.timestamp,
    },
    waitingSeconds: waitingTime,
    isOverdue:      false,
    position,
    _ts:            serverTimestamp(),
    // Duplicamos en el nivel superior para queries fáciles
    _rtdbKey:       key,
    _letra:         ticket.letra.toUpperCase(),
  };

  try {
    const docRef = await addDoc(collection(db, 'queue'), entry);
    _queueMap.set(key, docRef.id);
    console.log(`[rtdbBridge] ✅ Ticket ${ticket.ticketCompleto} (${key}) → Firestore queue/${docRef.id}`);
  } catch (err) {
    console.error('[rtdbBridge] ❌ Error insertando en queue:', err);
  }
}

// ─── Escribir de vuelta al RTDB ───────────────────────────────────────────────

/**
 * Marca el ticket como "llamado" en el RTDB.
 * @param codServicio  ej: "tens"
 * @param idx          índice en el array (1, 2, 3...)
 */
export async function rtdbMarkCalled(
  codServicio: string,
  idx:         number,
  puestoId:    string,
  operadorId:  string,
): Promise<void> {
  await update(ref(rtdb, `cola/${codServicio}/tickets/${idx}`), {
    estado:    'llamado',
    llamadoEn: Date.now(),
    puestoId,
    operadorId,
  });
}

/**
 * Marca el ticket como "atendido" o "transferido" y guarda historial en Firestore.
 * @param codServicio  ej: "tens"
 * @param idx          índice en el array
 * @param llamadoEn    timestamp ms cuando fue llamado
 */
export async function rtdbMarkFinished(
  codServicio:  string,
  idx:          number,
  status:       'atendido' | 'transferido',
  ticket:       RtdbTicket,
  llamadoEn:    number,
): Promise<void> {
  const ahora     = Date.now();
  const esperaSeg = llamadoEn
    ? Math.floor((llamadoEn - ticket.timestamp) / 1000)
    : null;

  await update(ref(rtdb, `cola/${codServicio}/tickets/${idx}`), {
    estado:       status,
    finalizadoEn: ahora,
    esperaSeg,
  });

  await setDoc(doc(db, 'tickets', `${ticket.letra}-${codServicio}-${idx}`), {
    letter:     ticket.letra.toUpperCase(),
    number:     ticket.ticketCompleto,
    service:    ticket.servicio,
    rut:        ticket.rut,
    issuedAt:   new Date(ticket.timestamp),
    calledAt:   llamadoEn ? new Date(llamadoEn) : null,
    finishedAt: new Date(ahora),
    status:     status === 'atendido' ? 'finished' : 'transferred',
    stationId:  _stationId,
    operatorId: _operatorId,
    waitSec:    esperaSeg,
  });
}

// ─── Helpers de lectura ───────────────────────────────────────────────────────

/** Devuelve la ref RTDB de un ticket por codServicio + idx */
export function getRtdbTicketRef(codServicio: string, idx: number): DatabaseReference {
  return ref(rtdb, `cola/${codServicio}/tickets/${idx}`);
}

/** Getters de configuración actual del bridge */
export function getBridgeConfig() {
  return { operatorId: _operatorId, stationId: _stationId, letters: _myLetters };
}
