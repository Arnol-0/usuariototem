import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { subscribe, sendAction } from '../services/totemService';
import type { TotemState, ActionPayload } from '../types/totem';

interface TotemCtx {
  state: TotemState;
  dispatch: (payload: ActionPayload) => Promise<void>;
}

const TotemContext = createContext<TotemCtx | null>(null);

const initialState: TotemState = {
  station: { id: '', name: '', area: '', isActive: false },
  currentTicket: null,
  queue: [],
  totalInQueue: 0,
  isConnected: false,
};

export function TotemProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useReducer((_: TotemState, s: TotemState) => s, initialState);

  useEffect(() => {
    const unsub = subscribe(setState);
    return unsub;
  }, []);

  const dispatch = async (payload: ActionPayload) => {
    await sendAction(payload);
  };

  return (
    <TotemContext.Provider value={{ state, dispatch }}>
      {children}
    </TotemContext.Provider>
  );
}

export function useTotem(): TotemCtx {
  const ctx = useContext(TotemContext);
  if (!ctx) throw new Error('useTotem must be used inside <TotemProvider>');
  return ctx;
}
