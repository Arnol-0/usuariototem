import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { subscribe, sendAction, getSnapshot } from '../services/totemService';

describe('totemService mock', () => {
  it('initial state has a current ticket A-142', () => {
    const state = getSnapshot();
    expect(state.currentTicket).not.toBeNull();
    expect(state.currentTicket?.number).toBe('A-142');
  });

  it('isConnected is true', () => {
    expect(getSnapshot().isConnected).toBe(true);
  });

  it('queue has 4 entries initially', () => {
    expect(getSnapshot().queue.length).toBe(4);
  });

  it('next action advances the queue', async () => {
    const before = getSnapshot();
    const firstInQueue = before.queue[0].ticket.number;
    await sendAction({ action: 'next' });
    const after = getSnapshot();
    expect(after.currentTicket?.number).toBe(firstInQueue);
  });

  it('recall keeps the ticket and resets duration', async () => {
    await sendAction({ action: 'recall' });
    const state = getSnapshot();
    expect(state.currentTicket?.duration).toBe(0);
    expect(state.currentTicket?.status).toBe('in_progress');
  });

  it('pause sets status to paused', async () => {
    await sendAction({ action: 'pause' });
    expect(getSnapshot().currentTicket?.status).toBe('paused');
  });

  it('subscribe delivers state changes', async () => {
    const received: string[] = [];
    const unsub = subscribe(s => {
      if (s.currentTicket) received.push(s.currentTicket.status);
    });
    await sendAction({ action: 'recall' });
    unsub();
    expect(received.length).toBeGreaterThan(0);
  });
});
