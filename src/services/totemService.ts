import {
  collection, doc, onSnapshot, setDoc, updateDoc, getDocs,
  deleteDoc, addDoc, query, orderBy, where, serverTimestamp,
  runTransaction, limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { get } from 'firebase/database';
import { db } from './firebase';
import type { Ticket, QueueEntry, Station, TotemState, ActionPayload } from '../types/totem';
import {
  startRtdbBridge, rtdbMarkCalled, rtdbMarkFinished, getRtdbTicketRef, getBridgeConfig,
  type RtdbTicket,
} from './rtdbBridge';

// ─── Colecciones / docs en Firestore ─────────────────────────────────────────
//   state/{stationId}  → ticket actual + info de estación (uno por puesto)
//   queue/             → documentos de cola (uno por turno)

const QUEUE_COL = collection(db, 'queue');

/** Devuelve el doc de estado propio del puesto actual. */
function stateDoc() { return doc(db, 'state', _station.id); }

// ─── Estado local (espejo del Firestore) ──────────────────────────────────────

let _station: Station = { id: 'station-01', name: 'Puesto 01', area: '', isActive: false };
let _current: Ticket | null = null;
let _queue: QueueEntry[] = [];
let _totalInQueue = 0;
let listeners: Array<(s: TotemState) => void> = [];

// Canal persistente para broadcast al overlay
let bcStatePersistent: BroadcastChannel | null = null;
try { bcStatePersistent = new BroadcastChannel('totem_state'); } catch { /* sin BroadcastChannel */ }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getState(): TotemState {
  return {
    station: _station,
    currentTicket: _current,
    queue: _queue,
    totalInQueue: _totalInQueue,
    isConnected: true,
  };
}

function notify() {
  const s = getState();
  listeners.forEach(fn => fn(s));
  bcStatePersistent?.postMessage(s);
}

// ─── Sincronización en tiempo real desde Firestore ───────────────────────────

let _unsub: Unsubscribe[] = [];

function stopListeners() {
  _unsub.forEach(u => u());
  _unsub = [];
}

function startListeners() {
  stopListeners();
  // 1) Escucha el documento de estado PROPIO del puesto (state/{stationId})
  const unsubState = onSnapshot(stateDoc(), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as {
        currentTicket: Ticket | null;
        station: Station;
      };
      _current = data.currentTicket ?? null;
      _station = data.station ?? _station;
    } else {
      _current = null;
    }
    notify();
  });

  // 2) Escucha la cola ordenada por posición
  const unsubQueue = onSnapshot(
    query(QUEUE_COL, orderBy('position', 'asc')),
    snap => {
      _queue = snap.docs.map(d => d.data() as QueueEntry);
      _totalInQueue = _queue.length;
      notify();
    },
  );

  _unsub = [unsubState, unsubQueue];
}

startListeners();

// Timer local — cada segundo:
//  • Incrementa duración del turno activo
//  • Incrementa waitingSeconds de cada entry en cola
//  • Actualiza isOverdue cuando supera 15 min (900 s)
setInterval(() => {
  let changed = false;

  if (_current && _current.status === 'in_progress') {
    _current = { ..._current, duration: _current.duration + 1 };
    changed = true;
    if (_current.duration % 5 === 0) {
      updateDoc(stateDoc(), { 'currentTicket.duration': _current.duration }).catch(() => { });
    }
  }

  if (_queue.length > 0) {
    _queue = _queue.map(e => ({
      ...e,
      waitingSeconds: e.waitingSeconds + 1,
      isOverdue: e.waitingSeconds + 1 > 900,
    }));
    changed = true;
  }

  if (changed) notify();
}, 1000);

// ─── API pública ──────────────────────────────────────────────────────────────

export function subscribe(fn: (s: TotemState) => void): () => void {
  listeners.push(fn);
  fn(getState());
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getSnapshot(): TotemState {
  return getState();
}

/** Busca el puesto asignado al operador en Firestore y actualiza el estado */
export async function setOperatorName(operatorId: string): Promise<void> {
  // Busca en 'operators' el doc cuyo email coincide con operatorId
  const opSnap = await getDocs(query(
    collection(db, 'operators'),
    where('email', '==', operatorId),
  ));

  let resolvedOperatorId = operatorId; // fallback: usar el email como id
  let displayName = operatorId;

  if (!opSnap.empty) {
    const opDoc = opSnap.docs[0];
    resolvedOperatorId = opDoc.id;
    displayName = opDoc.data().fullName ?? operatorId;
  }

  // Busca el puesto que tiene asignado este operador
  const stSnap = await getDocs(query(
    collection(db, 'stations'),
    where('operatorId', '==', resolvedOperatorId),
  ));

  if (!stSnap.empty) {
    const st = stSnap.docs[0].data();
    const stationId = stSnap.docs[0].id;
    const labels: string[] = st.labels ?? [];
    _station = {
      id: stationId,
      name: `${displayName} — ${st.name}`,
      area: labels.join(', '),
      isActive: true,
    };
    // Reinicia listeners apuntando al doc propio de este puesto
    startListeners();
    // Inicia el puente RTDB → Firestore para las letras de este puesto
    startRtdbBridge(labels, resolvedOperatorId, stationId);
  } else {
    // Sin puesto asignado — muestra igual el nombre del operador
    _station = { ..._station, name: `${displayName} — Sin puesto`, isActive: false };
  }

  await setDoc(stateDoc(), { station: _station, currentTicket: _current }, { merge: true });
  notify();
}

// ─── Acciones sobre tickets ────────────────────────────────────────────────────

/**
 * Intenta reclamar atómicamente el primer ticket de la cola.
 * Devuelve { entry, docId } si tuvo éxito, o null si la cola está vacía
 * o si otro puesto ganó la carrera.
 *
 * Estrategia de 2 fases:
 *  1. getDocs fuera de la tx para obtener la ref del primer doc
 *  2. tx.get dentro de la tx para leer consistente + marcar _claiming
 */
async function claimNextTicket(): Promise<{ entry: QueueEntry; docId: string } | null> {
  const preSnap = await getDocs(
    query(QUEUE_COL, orderBy('position', 'asc'), limit(1)),
  );
  if (preSnap.empty) return null;

  const firstRef = preSnap.docs[0].ref;
  let result: { entry: QueueEntry; docId: string } | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const freshSnap = await tx.get(firstRef);
      if (!freshSnap.exists()) return;

      const data = freshSnap.data() as QueueEntry;
      if (data._claiming) return;   // otro puesto lo reclamó primero

      tx.update(firstRef, { _claiming: _station.id });
      result = { entry: data, docId: firstRef.id };
    });
  } catch {
    result = null;
  }

  return result;
}

export async function sendAction(payload: ActionPayload): Promise<void> {
  switch (payload.action) {

    case 'next':
    case 'resume': {
      // ── Si hay turno activo, guarda historial antes de descartarlo ─────────
      if (_current && payload.action === 'next') {
        const t = _current as Ticket & { _codServicio?: string; _rtdbIdx?: number };
        // Guarda en Firestore `tickets` como "skipped"
        addDoc(collection(db, 'tickets'), {
          letter: _current.number?.charAt(0) ?? '',
          number: _current.number,
          service: _current.service,
          rut: _current.name,
          issuedAt: null,
          calledAt: new Date(),
          finishedAt: new Date(),
          status: 'skipped',
          skipReason: payload.skipReason ?? 'other',
          comment: payload.comment ?? '',
          stationId: _station.id,
          operatorId: getBridgeConfig().operatorId,
          waitSec: _current.waitingTime,
        }).catch(console.error);
        // Notifica al RTDB que este turno fue descartado
        if (t._codServicio && t._rtdbIdx !== undefined) {
          rtdbMarkFinished(t._codServicio, t._rtdbIdx, 'atendido', _current as any, Date.now())
            .catch(console.error);
        }
      }

      // ── Reclama el siguiente ticket ────────────────────────────────────────
      const claimed = await claimNextTicket();

      if (!claimed) {
        // Cola vacía — solo "Sin turno activo" cuando hay pausa; aquí el op espera
        await setDoc(
          doc(db, 'state', _station.id),
          { currentTicket: null, station: _station },
          { merge: true },
        );
        break;
      }

      const { entry, docId } = claimed;
      const next: Ticket = {
        ...entry.ticket,
        status: 'in_progress',
        duration: 0,
        pauseReason: null,
      };

      await deleteDoc(doc(db, 'queue', docId));
      await setDoc(
        doc(db, 'state', _station.id),
        { currentTicket: next, station: _station },
        { merge: true },
      );

      // Notifica al RTDB
      const tNext = next as Ticket & { _codServicio?: string; _rtdbIdx?: number };
      if (tNext._codServicio && tNext._rtdbIdx !== undefined) {
        const { operatorId } = getBridgeConfig();
        rtdbMarkCalled(tNext._codServicio, tNext._rtdbIdx, _station.id, operatorId)
          .catch(console.error);
      }

      // Anuncia el nuevo turno para TTS en overlay/display
      try {
        new BroadcastChannel('totem_announce').postMessage({
          number: next.number,
          station: _station.name,
        });
      } catch { /* sin BroadcastChannel */ }
      break;
    }

    case 'recall':
      if (_current) {
        await updateDoc(stateDoc(), {
          'currentTicket.status': 'in_progress',
          'currentTicket.duration': 0,
          'currentTicket.pauseReason': null,
        });
        // Anuncia de nuevo para TTS
        try {
          new BroadcastChannel('totem_announce').postMessage({
            number: _current.number,
            station: _station.name,
            recall: true,
          });
        } catch { /* sin BroadcastChannel */ }
      }
      break;

    case 'pause':
      if (_current) {
        await updateDoc(stateDoc(), {
          'currentTicket.status': 'paused',
          'currentTicket.pauseReason': payload.pauseReason ?? null,
        });
      }
      break;

    case 'finish':
    case 'transfer': {
      if (_current) {
        const t = _current as Ticket & {
          _codServicio?: string;
          _rtdbIdx?: number;
        };
        if (t._codServicio && t._rtdbIdx !== undefined) {
          const rtdbSnap = await get(getRtdbTicketRef(t._codServicio, t._rtdbIdx));
          const rtdbData = rtdbSnap.val() as RtdbTicket | null;
          if (rtdbData) {
            rtdbMarkFinished(
              t._codServicio,
              t._rtdbIdx,
              payload.action === 'transfer' ? 'transferido' : 'atendido',
              rtdbData,
              rtdbData.llamadoEn ?? Date.now(),
            ).catch(console.error);
          }
        }
      }

      // ── Después de finalizar, llama automáticamente al siguiente ───────────
      const claimedAfterFinish = await claimNextTicket();

      if (!claimedAfterFinish) {
        await setDoc(stateDoc(), { currentTicket: null, station: _station }, { merge: true });
        break;
      }

      const { entry: nextEntry, docId: nextDocId } = claimedAfterFinish;
      const nextTicket: Ticket = {
        ...nextEntry.ticket,
        status: 'in_progress',
        duration: 0,
        pauseReason: null,
      };

      await deleteDoc(doc(db, 'queue', nextDocId));
      await setDoc(
        doc(db, 'state', _station.id),
        { currentTicket: nextTicket, station: _station },
        { merge: true },
      );

      const tNext2 = nextTicket as Ticket & { _codServicio?: string; _rtdbIdx?: number };
      if (tNext2._codServicio && tNext2._rtdbIdx !== undefined) {
        const { operatorId } = getBridgeConfig();
        rtdbMarkCalled(tNext2._codServicio, tNext2._rtdbIdx, _station.id, operatorId)
          .catch(console.error);
      }

      try {
        new BroadcastChannel('totem_announce').postMessage({
          number: nextTicket.number,
          station: _station.name,
        });
      } catch { /* sin BroadcastChannel */ }
      break;
    }
  }
}

// ─── Agregar turno a la cola (llamado desde el Tótem físico / módulo de turnos) ──

export async function enqueue(entry: QueueEntry): Promise<void> {
  const position = _queue.length;
  await addDoc(QUEUE_COL, { ...entry, position, _ts: serverTimestamp() });
}

// ─── Escuchar acciones del overlay externo ────────────────────────────────────

try {
  const bcAction = new BroadcastChannel('totem_action');
  bcAction.onmessage = (e: MessageEvent<ActionPayload>) => {
    sendAction(e.data).catch(console.error);
  };
} catch { /* sin BroadcastChannel */ }

