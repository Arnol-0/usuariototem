import {
  collection, doc, getDoc, getDocs, setDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

export interface TicketComment {
  ticketId:      string;
  ticketNumber:  string;
  comment:       string;
  operatorId:    string;
  operatorName:  string;
  createdAt:     number; // epoch ms
  updatedAt:     number; // epoch ms
}

const COL = 'comments';

export async function upsertComment(input: {
  ticketId:     string;
  ticketNumber: string;
  comment:      string;
  operatorId?:  string;
  operatorName?: string;
}): Promise<TicketComment> {
  const now      = Date.now();
  const ref      = doc(db, COL, input.ticketId);
  const existing = await getDoc(ref);

  const next: TicketComment = {
    ticketId:     input.ticketId,
    ticketNumber: input.ticketNumber,
    comment:      input.comment,
    operatorId:   input.operatorId   ?? existing.data()?.operatorId   ?? '',
    operatorName: input.operatorName ?? existing.data()?.operatorName ?? '',
    createdAt:    existing.exists() ? (existing.data() as TicketComment).createdAt : now,
    updatedAt:    now,
  };

  await setDoc(ref, next);
  return next;
}

export async function getComment(ticketId: string): Promise<TicketComment | null> {
  const snap = await getDoc(doc(db, COL, ticketId));
  if (!snap.exists()) return null;
  return snap.data() as TicketComment;
}

export async function listComments(): Promise<TicketComment[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('updatedAt', 'desc')));
  return snap.docs.map(d => d.data() as TicketComment);
}

