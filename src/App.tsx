import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from './loading-file.json';
import { TotemProvider, useTotem } from './context/TotemContext';
import Header from './components/Header';
import CurrentTicket from './components/CurrentTicket';
import ActionButtons from './components/ActionButtons';
import WaitingQueue from './components/WaitingQueue';
import Login from './components/Login';
import AdminPanel from './admin/AdminPanel';
import { useOverlayWindow } from './hooks/useOverlayWindow';
import { sendAction, setOperatorName, getSnapshot } from './services/totemService';
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

  const [showLottie, setShowLottie] = useState(false);
  const [lottieExiting, setLottieExiting] = useState(false);

  const handleLogin = async (user: string, userRole: 'operator' | 'admin') => {
    // Evita mostrar el id/correo bruto en el overlay de carga temporalmente
    setUsername('');
    setRole(userRole);
    
    // Activa de inmediato la hermosa pantalla de carga con Lottie
    setShowLottie(true);

    if (userRole === 'operator') {
      // Al tener la animación Lottie que cubre la pantalla, podemos 'await' la BD sin problema
      await setOperatorName(user).catch(console.error);
      
      // Una vez resuelto, obtenemos el nombre real del usuario extraído de Firestore desde el contexto local
      const snap = getSnapshot();
      if (snap.station && snap.station.name) {
        // Formato devuelto: "Arnol — Puesto X" o "Arnol — Sin puesto" -> Extraemos "Arnol"
        const realName = snap.station.name.split(' — ')[0];
        setUsername(realName);
      } else {
        setUsername(user);
      }
    } else {
      setUsername('Administrador');
    }
    
    // Le damos un respiro mínimo de 2 segundos para que el Lottie se luzca y transmita sensación premium
    await new Promise(r => setTimeout(r, 2000));

    // Cambia el estado de sesión y activa la salida suavizada del Overlay
    setLoggedIn(true);
    setLottieExiting(true);
    
    setTimeout(() => {
      setShowLottie(false);
      setLottieExiting(false);
    }, 500); 
  };

  const handleLogout = () => {
    setExiting(true);
    setTimeout(() => { setLoggedIn(false); setExiting(false); }, 400);
  };

  return (
    <>
      {!loggedIn ? (
        <div className="login-exit-wrap">
          <Login onLogin={handleLogin} />
        </div>
      ) : role === 'admin' ? (
        <AdminPanel onLogout={handleLogout} />
      ) : (
        <div className={exiting ? 'app-shell-wrap exiting' : 'app-shell-wrap'}>
          <TotemProvider>
            <AppContent onLogout={handleLogout} username={username} />
          </TotemProvider>
        </div>
      )}

      {showLottie && (
        <div className={`lottie-overlay ${lottieExiting ? 'exiting' : ''}`}>
          <div className="lottie-container">
            <Lottie
              animationData={loadingAnimation}
              loop={true}
              autoplay={true}
            />
          </div>
          <h2 className="lottie-welcome">
            {username ? `¡Bienvenido de nuevo, ${username}!` : 'Iniciando sesión...'}
          </h2>
          <p className="lottie-sub">Preparando tu entorno de trabajo...</p>
        </div>
      )}
    </>
  );
}
