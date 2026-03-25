import React, { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import './Login.css';

interface LoginProps {
  onLogin: (username: string, role: 'operator' | 'admin') => void;
}

const DISPLAY_PIN = '2801';

function openDisplay() {
  const w = screen.availWidth;
  const h = screen.availHeight;
  window.open(
    '/display.html',
    'totem-display',
    `width=${w},height=${h},left=0,top=0,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`,
  );
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal PIN pantalla de llamados
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  function handlePinKey(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setPinError(false);
    if (next.length === 4) {
      if (next === DISPLAY_PIN) {
        setShowPin(false);
        setPin('');
        openDisplay();
      } else {
        setPinError(true);
        setTimeout(() => setPin(''), 600);
      }
    }
  }

  function handlePinBackspace() {
    setPin(p => p.slice(0, -1));
    setPinError(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Busca en Firestore por email (username) y contraseña
      const q = query(
        collection(db, 'operators'),
        where('email', '==', username.trim()),
        where('password', '==', password),
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data() as { role: 'operator' | 'supervisor' | 'admin'; email: string };
        const role: 'operator' | 'admin' = data.role === 'admin' ? 'admin' : 'operator';
        setLoading(false);
        onLogin(data.email, role);
      } else {
        setLoading(false);
        setError('Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError('Error de conexión. Intenta de nuevo.');
    }
  };

  return (
    <div className="login-root">
      {/* Fondo animado con burbujas */}
      <div className="login-bg">
        <span className="login-bubble b1" />
        <span className="login-bubble b2" />
        <span className="login-bubble b3" />
        <span className="login-bubble b4" />
      </div>

      <div className="login-card">
        {/* Logo / marca */}
        <div className="login-logo">
          <img src="/logost.png" alt="TotemDesk" />
        </div>

        <div className="login-brand">Sistema usuario</div>
        <div className="login-sub">Panel de atención al cliente</div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="username">Usuario</label>
            <input
              id="username"
              className={`login-input ${error ? 'err' : ''}`}
              type="text"
              placeholder="usuario@totemst.cl"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={e => { setUsername(e.target.value); setError(''); }}
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className={`login-input ${error ? 'err' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={e => { setPassword(e.target.value); setError(''); }}
            />
          </div>

          {error && (
            <div className="login-error">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <>
                <span>Iniciar sesión</span>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">Sistema de gestión de filas · v2.0</div>
      </div>

      {/* Botón pantalla de llamados — esquina inferior izquierda, discreto */}
      <button className="login-display-btn" onClick={() => { setShowPin(true); setPin(''); setPinError(false); }} type="button" title="Abrir pantalla de llamados">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
          <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Modal PIN */}
      {showPin && (
        <div className="pin-backdrop" onClick={() => setShowPin(false)}>
          <div className="pin-modal" onClick={e => e.stopPropagation()}>
            <div className="pin-title">Pantalla de llamados</div>
            <div className="pin-sub">Ingresa el PIN de 4 dígitos</div>

            {/* Indicadores de dígitos */}
            <div className={`pin-dots ${pinError ? 'pin-dots--error' : ''}`}>
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''} ${pinError ? 'error' : ''}`} />
              ))}
            </div>
            {pinError && <div className="pin-error-msg">PIN incorrecto</div>}

            {/* Teclado numérico */}
            <div className="pin-keyboard">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                <button
                  key={i}
                  className={`pin-key ${k === '' ? 'pin-key--empty' : ''} ${k === '⌫' ? 'pin-key--back' : ''}`}
                  onClick={() => k === '⌫' ? handlePinBackspace() : k !== '' ? handlePinKey(k) : undefined}
                  disabled={k === ''}
                  type="button"
                >
                  {k}
                </button>
              ))}
            </div>

            <button className="pin-cancel" onClick={() => setShowPin(false)} type="button">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
