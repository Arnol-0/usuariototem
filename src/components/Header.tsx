import React, { useState, useRef, useEffect } from 'react';
import { useTotem } from '../context/TotemContext';
import { Settings, MonitorUp, LogOut } from 'lucide-react';
import './Header.css';

interface HeaderProps {
  onOpenOverlay: () => void;
  onLogout: () => void;
  username: string;
}

export default function Header({ onOpenOverlay, onLogout, username }: HeaderProps) {
  const { state } = useTotem();
  const { isConnected, station } = state;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // station.name = "Nombre Operador — Nombre Puesto" (set by setOperatorName)
  // station.area  = "A, B, C" (ticket labels for this station)
  const displayName = station.name || username;
  const displayArea = station.area ? `Letras: ${station.area}` : 'Sin puesto asignado';

  return (
    <header className="app-header">
      <div className="header-left">
        <span className={`station-dot${station.isActive ? '' : ' offline'}`} />
        <span className="station-name">{displayName}</span>
        <span className="station-area">{displayArea}</span>
      </div>
      <div className="header-right">
        <span className={`status-badge ${isConnected ? 'active' : 'offline'}`}>
          <span className="status-dot" />
          {isConnected ? 'En línea' : 'Offline'}
        </span>

        <div className="hdr-menu-wrap" ref={menuRef}>
          <button
            className={`hdr-settings-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            title="Configuración"
          >
            <Settings size={17} strokeWidth={2} />
          </button>

          {menuOpen && (
            <div className="hdr-dropdown">
              <button className="hdr-dd-item" onClick={() => { onOpenOverlay(); setMenuOpen(false); }}>
                <MonitorUp size={15} strokeWidth={2} />
                <span>Panel escritorio</span>
              </button>
              <div className="hdr-dd-divider" />
              <button className="hdr-dd-item danger" onClick={() => { onLogout(); setMenuOpen(false); }}>
                <LogOut size={15} strokeWidth={2} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
