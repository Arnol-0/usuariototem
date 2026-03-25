import React, { useEffect, useState } from 'react';
import { TotemProvider, useTotem } from './context/TotemContext';
import Header from './components/Header';
import CurrentTicket from './components/CurrentTicket';
import ActionButtons from './components/ActionButtons';
import WaitingQueue from './components/WaitingQueue';
import Login from './components/Login';
import AdminPanel from './admin/AdminPanel';
import { useOverlayWindow } from './hooks/useOverlayWindow';
import { sendAction, setOperatorName } from './services/totemService';
import type { PauseReason } from './types/totem';
import { LogOut } from 'lucide-react';
import './App.css';

function AppContent({ onLogout, username }: { onLogout: () => void; username: string }) {
  const { state } = useTotem();
  const [showLogout, setShowLogout] = useState(false);
  const [resuming, setResuming] = useState(false);

  const ticket = state.currentTicket;
  const isPaused = !resuming && ticket?.status === 'paused';
  const pauseReason: PauseReason = (ticket?.pauseReason ?? 'lunch') as PauseReason;

  const { openOverlay, enableAutoOverlay } = useOverlayWindow(state, (payload) => {
    if ((payload as any).action === 'logout') {
      onLogout();
      return;
    }
    sendAction(payload as Parameters<typeof sendAction>[0]);
  });

  useEffect(() => {
    const disable = enableAutoOverlay();
    return disable;
  }, [enableAutoOverlay]);

  return (
    <div className="app-shell">
      <Header onOpenOverlay={openOverlay} onLogout={() => setShowLogout(true)} username={username} />

      <main className="app-main">
        <section className="panel-left">
          <CurrentTicket isPaused={isPaused} pauseReason={pauseReason} />
          <ActionButtons
            isPaused={isPaused}
            pauseReason={pauseReason}
            onResume={() => setResuming(true)}
            onResumed={() => setResuming(false)}
          />
        </section>
        <aside className="panel-right">
          <WaitingQueue />
        </aside>
      </main>

      {showLogout && (
        <div className="fab-modal-backdrop" onClick={() => setShowLogout(false)}>
          <div className="fab-modal" onClick={e => e.stopPropagation()}>
            <div className="fab-modal-icon">
              <LogOut size={26} strokeWidth={1.8} color="#c0392b" />
            </div>
            <div className="fab-modal-title">¿Cerrar sesión?</div>
            <div className="fab-modal-sub">Se cerrará esta ventana de atención</div>
            <button className="fab-modal-confirm" onClick={onLogout}>
              Sí, cerrar sesión
            </button>
            <button className="fab-modal-cancel" onClick={() => setShowLogout(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole]         = useState<'operator' | 'admin'>('operator');

  const handleLogin = async (user: string, userRole: 'operator' | 'admin') => {
    setUsername(user);
    setRole(userRole);
    if (userRole === 'operator') {
      // Espera a que se resuelva el puesto antes de mostrar la app
      await setOperatorName(user).catch(console.error);
    }
    setExiting(true);
    setTimeout(() => { setLoggedIn(true); setExiting(false); }, 450);
  };

  const handleLogout = () => {
    setExiting(true);
    setTimeout(() => { setLoggedIn(false); setExiting(false); }, 400);
  };

  if (!loggedIn) {
    return (
      <div className={exiting ? 'login-exit-wrap exiting' : 'login-exit-wrap'}>
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  if (role === 'admin') {
    return <AdminPanel onLogout={handleLogout} />;
  }

  return (
    <div className={exiting ? 'app-shell-wrap exiting' : 'app-shell-wrap'}>
      <TotemProvider>
        <AppContent onLogout={handleLogout} username={username} />
      </TotemProvider>
    </div>
  );
}
