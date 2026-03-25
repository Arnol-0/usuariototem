import { useEffect, useRef, useCallback } from 'react';
import type { TotemState } from '../types/totem';

const OVERLAY_URL = '/overlay.html';
const OVERLAY_FEATURES =
  'width=300,height=620,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no';

/**
 * Abre y mantiene sincronizada la ventana externa del overlay.
 * - Abre /overlay.html en una ventana separada del SO.
 * - Envía el estado completo del tótem por BroadcastChannel 'totem_state'
 *   cada vez que cambia.
 * - Escucha acciones del overlay en 'totem_action' y las reenvía al
 *   callback `onAction`.
 */
export function useOverlayWindow(
  state: TotemState,
  onAction: (payload: { action: string; ticketId?: string; comment?: string }) => void,
) {
  const winRef = useRef<Window | null>(null);
  const bcState = useRef<BroadcastChannel | null>(null);
  const bcAction = useRef<BroadcastChannel | null>(null);
  const bcRequest = useRef<BroadcastChannel | null>(null);
  const lastAutoToggleAt = useRef<number>(0);
  // Ref para tener siempre el estado más reciente accesible desde closures
  const stateRef = useRef<TotemState>(state);

  // Mantener stateRef actualizado con cada render
  stateRef.current = state;

  // Inicializar canales
  useEffect(() => {
    bcState.current   = new BroadcastChannel('totem_state');
    bcAction.current  = new BroadcastChannel('totem_action');
    bcRequest.current = new BroadcastChannel('totem_request');

    // Escuchar acciones provenientes del overlay
    bcAction.current.onmessage = (e) => onAction(e.data);

    // Responder a peticiones de estado inicial del overlay (usa stateRef para tener el estado actual)
    bcRequest.current.onmessage = () => {
      bcState.current?.postMessage(stateRef.current);
    };

    return () => {
      bcState.current?.close();
      bcAction.current?.close();
      bcRequest.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enviar estado actualizado cada vez que cambia
  useEffect(() => {
    bcState.current?.postMessage(state);
  }, [state]);

  // Abrir / traer al frente la ventana overlay
  const openOverlay = useCallback(() => {
    if (winRef.current && !winRef.current.closed) {
      winRef.current.focus();
      return;
    }
    winRef.current = window.open(OVERLAY_URL, 'totem-overlay', OVERLAY_FEATURES);
  }, []);

  const closeOverlay = useCallback(() => {
    try {
      winRef.current?.close();
    } finally {
      winRef.current = null;
    }
  }, []);

  /**
   * Activa auto open/close del overlay:
   * - abre al perder foco u ocultarse la pestaña
   * - cierra al volver el foco
   */
  const enableAutoOverlay = useCallback(() => {
    const canToggle = () => {
      const now = Date.now();
      if (now - lastAutoToggleAt.current < 400) return false;
      lastAutoToggleAt.current = now;
      return true;
    };

    const onBlur = () => {
      if (!canToggle()) return;
      openOverlay();
    };

    const onFocus = () => {
      if (!canToggle()) return;
      closeOverlay();
    };

    const onVisibility = () => {
      if (!canToggle()) return;
      if (document.hidden) openOverlay();
      else closeOverlay();
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [openOverlay, closeOverlay]);

  // Cerrar la ventana overlay si la app principal se cierra
  useEffect(() => {
    const onUnload = () => winRef.current?.close();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return { openOverlay, closeOverlay, enableAutoOverlay };
}
