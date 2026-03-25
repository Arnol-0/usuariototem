import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, setDoc, getDoc, where, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserRole = 'operator' | 'supervisor' | 'admin';

export interface Operator {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  avatarInitials: string;
  avatarColor: string;
}

export interface WorkStation {
  id: string;
  labels: string[];     // ["A", "B", "C"] — letras de turno que atiende este puesto
  name: string;         // "Counter 1 - Main Hall"
  operatorId: string | null;
  isActive: boolean;
}

export interface DailyStat {
  label: string;   // "Lun", "Mar", ...
  ip: number;
  cft: number;
  consultas: number;
  espera: number;
}

export interface AdminStats {
  dailyIP: number;
  dailyIPChange: number;   // %
  dailyCFT: number;
  dailyCFTChange: number;  // %
  avgWaitMinutes: number;
  avgWaitSeconds: number;
  performanceLabel: string;
  weekly: DailyStat[];
  // totales para el pastel
  totalIP: number;
  totalCFT: number;
  totalConsultas: number;
  totalEspera: number;
}

/** Una fila en la tabla de estadísticas por letra */
export interface TicketStatRow {
  letter: string;      // "A", "B", "C" ...
  service: string;     // "Técnico en Enfermería", "Área de Salud" ...
  total: number;       // tickets emitidos
  attended: number;    // tickets atendidos (status finished/completed)
  pending: number;     // en cola o en progreso
  unattended: number;  // tickets que no se presentaron o fueron saltados (status skipped)
  avgWaitSec: number;  // tiempo promedio de espera en segundos
}

export interface TicketRecord {
  id: string;
  letter: string;       // letra del turno ("A", "B", ...)
  number: string;       // número completo ("A-1", "B-12" ...)
  service: string;      // nombre del servicio
  rut: string;
  issuedAt: number;     // timestamp ms cuando fue emitido
  calledAt: number | null;
  finishedAt: number | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'transferred' | 'skipped';
  stationId: string | null;
  operatorId: string | null;
  waitSec: number | null;  // segundos de espera real
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORS = ['#4f8ef7', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const ADMIN_SEED: Omit<Operator, 'id'> = {
  fullName: 'Administrador',
  email: 'admin@totemst.cl',
  password: 'admin1234',
  role: 'admin',
  avatarInitials: 'AD',
  avatarColor: '#4f8ef7',
};

// ─── Seed admin si la colección está vacía ────────────────────────────────────

export async function seedAdminIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, 'operators'));
  if (snap.empty) {
    await setDoc(doc(db, 'operators', 'admin-1'), ADMIN_SEED);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitials(fullName: string): string {
  return fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── OPERADORES ───────────────────────────────────────────────────────────────

export async function getOperators(): Promise<Operator[]> {
  const snap = await getDocs(query(collection(db, 'operators'), orderBy('fullName')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Operator));
}

export function subscribeOperators(cb: (ops: Operator[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'operators'), orderBy('fullName')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Operator))),
  );
}

export async function createOperator(
  data: Omit<Operator, 'id' | 'avatarInitials' | 'avatarColor'>,
  existingCount: number,
): Promise<Operator> {
  const avatarInitials = buildInitials(data.fullName);
  const avatarColor    = COLORS[existingCount % COLORS.length];
  const payload = { ...data, avatarInitials, avatarColor };
  const ref = await addDoc(collection(db, 'operators'), payload);
  return { id: ref.id, ...payload };
}

export async function deleteOperator(id: string): Promise<void> {
  await deleteDoc(doc(db, 'operators', id));
}

// ─── PUESTOS ──────────────────────────────────────────────────────────────────

export async function getStations(): Promise<WorkStation[]> {
  const snap = await getDocs(query(collection(db, 'stations'), orderBy('label')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStation));
}

export function subscribeStations(cb: (sts: WorkStation[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'stations'), orderBy('name')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStation))),
  );
}

export async function createStation(
  data: { labels: string[]; name: string },
): Promise<WorkStation> {
  const payload: Omit<WorkStation, 'id'> = {
    labels: data.labels.map(l => l.toUpperCase().slice(0, 4)),
    name: data.name,
    operatorId: null,
    isActive: false,
  };
  const ref = await addDoc(collection(db, 'stations'), payload);
  return { id: ref.id, ...payload };
}

export async function updateStation(
  id: string,
  data: Partial<Pick<WorkStation, 'labels' | 'name'>>,
): Promise<void> {
  const update: Partial<WorkStation> = { ...data };
  if (data.labels) update.labels = data.labels.map(l => l.toUpperCase().slice(0, 4));
  await updateDoc(doc(db, 'stations', id), update);
}

export async function deleteStation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stations', id));
}

export async function assignOperator(
  stationId: string,
  operatorId: string | null,
): Promise<void> {
  await updateDoc(doc(db, 'stations', stationId), {
    operatorId,
    isActive: operatorId !== null,
  });
}

// ─── ESTADÍSTICAS desde Firestore ────────────────────────────────────────────

/**
 * Lee todos los tickets de Firestore (colección `tickets`) en un rango de fechas
 * y los agrupa por letra/servicio para mostrar en la sección de estadísticas.
 *
 * Si la colección `tickets` aún no existe o está vacía, devuelve un arreglo
 * vacío sin lanzar error — la UI mostrará "Sin datos aún".
 */
export async function getTicketStats(
  from: Date,
  to: Date,
): Promise<TicketRecord[]> {
  const fromTs = Timestamp.fromDate(from);
  const toTs   = Timestamp.fromDate(to);

  try {
    const snap = await getDocs(
      query(
        collection(db, 'tickets'),
        where('issuedAt', '>=', fromTs),
        where('issuedAt', '<=', toTs),
        orderBy('issuedAt', 'asc'),
      ),
    );
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id:         d.id,
        letter:     data.letter   ?? '',
        number:     data.number   ?? '',
        service:    data.service  ?? '',
        rut:        data.rut      ?? '',
        issuedAt:   data.issuedAt?.toMillis?.() ?? data.issuedAt ?? 0,
        calledAt:   data.calledAt?.toMillis?.() ?? data.calledAt ?? null,
        finishedAt: data.finishedAt?.toMillis?.() ?? data.finishedAt ?? null,
        status:     data.status   ?? 'waiting',
        stationId:  data.stationId  ?? null,
        operatorId: data.operatorId ?? null,
        waitSec:    data.waitSec  ?? null,
      } as TicketRecord;
    });
  } catch {
    // La colección puede no existir todavía — no es un error fatal
    return [];
  }
}

/**
 * Agrupa un array de TicketRecord por letra y calcula totales y promedios.
 */
export function groupStatsByLetter(tickets: TicketRecord[]): TicketStatRow[] {
  const map = new Map<string, { service: string; total: number; attended: number; pending: number; unattended: number; waitSecs: number[] }>();

  for (const t of tickets) {
    const key = t.letter.toUpperCase();
    if (!map.has(key)) {
      map.set(key, { service: t.service, total: 0, attended: 0, pending: 0, unattended: 0, waitSecs: [] });
    }
    const row = map.get(key)!;
    row.total++;
    if (t.status === 'finished' || t.status === 'transferred') {
      row.attended++;
    } else if (t.status === 'skipped') {
      row.unattended++;
    } else {
      row.pending++;
    }
    if (t.waitSec != null && t.waitSec >= 0) {
      row.waitSecs.push(t.waitSec);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, row]) => ({
      letter,
      service:    row.service,
      total:      row.total,
      attended:   row.attended,
      pending:    row.pending,
      unattended: row.unattended,
      avgWaitSec: row.waitSecs.length
        ? Math.round(row.waitSecs.reduce((s, v) => s + v, 0) / row.waitSecs.length)
        : 0,
    }));
}

// ─── COMENTARIOS ──────────────────────────────────────────────────────────────

export async function getAllComments() {
  const { listComments } = await import('./commentStore');
  const stored = await listComments();

  // Buscar también los tickets descartados ("no_show" u "other")
  const snap = await getDocs(query(collection(db, 'tickets'), where('status', '==', 'skipped')));
  
  const skipped = snap.docs.map(d => {
    const t = d.data();
    return {
      ticketId: d.id,
      ticketNumber: t.number || '',
      comment: t.comment || (t.skipReason === 'no_show' ? 'No se presentó' : 'Otro motivo (Saltado)'),
      operatorId: t.operatorId || '',
      operatorName: t.operatorId || 'Sin nombre',
      createdAt: t.calledAt?.toMillis?.() || t.calledAt || Date.now(),
      updatedAt: t.finishedAt?.toMillis?.() || t.finishedAt || Date.now(),
      status: 'NO RESUELTO',
    };
  });

  const merged = [
    ...stored.map(s => ({
      ...s,
      operatorName: s.operatorName || 'Sin nombre',
      operatorId:   s.operatorId   || '',
      status: 'RESUELTO',
    })),
    ...skipped
  ];

  // Desduplicar por número de ticket, dando prioridad al estado no resuelto si hay colisión
  const dedup = new Map();
  for (const item of merged) {
    if (item.status === 'NO RESUELTO') {
      dedup.set(item.ticketNumber, item);
    } else {
      if (!dedup.has(item.ticketNumber)) {
        dedup.set(item.ticketNumber, item);
      }
    }
  }

  return Array.from(dedup.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

