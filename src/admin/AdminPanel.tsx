import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  subscribeOperators, createOperator, deleteOperator,
  subscribeStations, assignOperator, createStation, updateStation, deleteStation,
  getAllComments, getTicketStats, groupStatsByLetter,
  type Operator, type WorkStation, type UserRole, type TicketStatRow, type TicketRecord,
} from '../services/adminService';
import './AdminPanel.css';

// ─── Iconos SVG inline ────────────────────────────────────────────────────────
const IconUsers     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconStation   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
const IconStats     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>;
const IconHistory   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h6l2 3h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>;
const IconLogout    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconFilter    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const IconExport    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconTrash     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;

type NavSection = 'users' | 'stations' | 'statistics' | 'comments';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(epoch: number) {
  return new Date(epoch).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(epoch: number) {
  return new Date(epoch).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────
interface AdminPanelProps { onLogout: () => void; }

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [section, setSection]     = useState<NavSection>('users');
  const [sideOpen, setSideOpen]   = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className={`adm-root ${sideOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

      {/* ── Sidebar ── */}
      <aside
        className="adm-sidebar"
        onMouseEnter={() => setSideOpen(true)}
        onMouseLeave={() => setSideOpen(false)}
      >
        {/* Logo / Brand */}
        <div className="adm-brand">
          <img src="/logost.png" alt="Logo" className="adm-brand-logo" />
          <span className="adm-brand-name">Panel de Admin</span>
        </div>

        {/* Nav */}
        <nav className="adm-nav">
          <NavItem icon={<IconUsers />}   label="Usuarios"              id="users"      active={section === 'users'}      open={sideOpen} onClick={() => setSection('users')} />
          <NavItem icon={<IconStation />} label="Puestos de trabajo"    id="stations"   active={section === 'stations'}   open={sideOpen} onClick={() => setSection('stations')} />
          <NavItem icon={<IconStats />}   label="Estadísticas"          id="statistics" active={section === 'statistics'} open={sideOpen} onClick={() => setSection('statistics')} />
          <NavItem icon={<IconHistory />} label="Historial comentarios" id="comments"   active={section === 'comments'}   open={sideOpen} onClick={() => setSection('comments')} />
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="adm-main">
        {/* Topbar */}
        <header className="adm-topbar">
          <div />
          <div className="adm-topbar-right">
            {/* Info admin + logout en topbar derecha */}
            <div className="adm-topbar-user">
              <div className="adm-avatar" style={{ background: '#4f8ef7' }}>AD</div>
              <div className="adm-admin-text">
                <span className="adm-admin-name">Administrador</span>
                <span className="adm-admin-email">admin@totemst.cl</span>
              </div>
              <button className="adm-logout-btn adm-logout-topbar" onClick={() => setShowLogout(true)} title="Cerrar sesión">
                <IconLogout />
              </button>
            </div>
          </div>
        </header>

        {/* Section content */}
        <div className="adm-content">
          {section === 'users'      && <SectionUsers />}
          {section === 'stations'   && <SectionStations />}
          {section === 'statistics' && <SectionStatistics />}
          {section === 'comments'   && <SectionComments />}
        </div>
      </main>

      {/* ── Modal confirmación logout ── */}
      {showLogout && (
        <div className="adm-modal-backdrop" onClick={() => setShowLogout(false)}>
          <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-icon">
              <IconLogout />
            </div>
            <div className="adm-modal-title">¿Cerrar sesión?</div>
            <div className="adm-modal-sub">Saldrás del Panel de Administración</div>
            <button className="adm-modal-confirm" onClick={onLogout}>Sí, cerrar sesión</button>
            <button className="adm-modal-cancel" onClick={() => setShowLogout(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, open, onClick }: {
  icon: React.ReactNode; label: string; id: NavSection;
  active: boolean; open: boolean; onClick: () => void;
}) {
  return (
    <button className={`adm-nav-item ${active ? 'active' : ''}`} onClick={onClick} title={!open ? label : undefined}>
      <span className="adm-nav-icon">{icon}</span>
      {open && <span className="adm-nav-label">{label}</span>}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: USUARIOS
// ═══════════════════════════════════════════════════════════════════════════════
function SectionUsers() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: '' as UserRole | '' });
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Suscripción en tiempo real
  useEffect(() => {
    const unsub = subscribeOperators(setOperators);
    return unsub;
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password || !form.role) {
      setError('Completa todos los campos'); return;
    }
    setCreating(true);
    try {
      await createOperator(
        { fullName: form.fullName, email: form.email, password: form.password, role: form.role as UserRole },
        operators.length,
      );
      setForm({ fullName: '', email: '', password: '', role: '' });
      setError('');
    } catch (err) {
      setError('Error al crear el usuario');
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteOperator(id);
  }

  return (
    <div className="adm-section">
      {/* Stats row */}
      <div className="adm-stats-row">
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div><div className="adm-stat-value">{operators.length}</div><div className="adm-stat-label">Total operadores</div></div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div><div className="adm-stat-value">{operators.filter(o => o.role !== 'admin').length}</div><div className="adm-stat-label">Activos hoy</div></div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div><div className="adm-stat-value">{operators.filter(o => o.role === 'supervisor').length}</div><div className="adm-stat-label">Supervisores</div></div>
        </div>
      </div>

      <div className="adm-two-col">
        {/* Formulario crear cuenta */}
        <div className="adm-card">
          <div className="adm-card-header">
            <div>
              <div className="adm-card-title">Gestión de Usuarios</div>
              <div className="adm-card-sub">Crea y asigna roles a operadores del sistema</div>
            </div>
          </div>
          <form className="adm-form" onSubmit={handleCreate}>
            <div className="adm-form-group">
              <label>NOMBRE COMPLETO</label>
              <input placeholder="John Doe" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="adm-form-group">
              <label>CORREO ELECTRÓNICO</label>
              <input type="email" placeholder="john@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="adm-form-group">
              <label>CONTRASEÑA</label>
              <div className="adm-input-eye">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button type="button" className="adm-eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <div className="adm-form-group">
              <label>ASIGNAR ROL</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                <option value="">Seleccionar rol</option>
                <option value="operator">Operador</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div className="adm-form-error">{error}</div>}
            <button className="adm-btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear Cuenta'}
            </button>
          </form>
        </div>

        {/* Tabla de usuarios */}
        <div className="adm-card">
          <div className="adm-card-header">
            <div>
              <div className="adm-card-title">Operadores registrados</div>
              <div className="adm-card-sub">{operators.length} cuentas activas</div>
            </div>
          </div>
          <div className="adm-users-list">
            {operators.map(op => (
              <div className="adm-user-row" key={op.id}>
                <div className="adm-avatar" style={{ background: op.avatarColor }}>{op.avatarInitials}</div>
                <div className="adm-user-info">
                  <span className="adm-user-name">{op.fullName}</span>
                  <span className="adm-user-id">{op.email}</span>
                </div>
                <span className={`adm-role-badge role-${op.role}`}>{op.role}</span>
                <button className="adm-icon-btn danger" onClick={() => handleDelete(op.id)} title="Eliminar">
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PUESTOS DE TRABAJO
// ═══════════════════════════════════════════════════════════════════════════════
function SectionStations() {
  const [stations, setStations]           = useState<WorkStation[]>([]);
  const [operators, setOperators]         = useState<Operator[]>([]);
  const [reassigning, setReassigning]     = useState<string | null>(null);
  const [selectedOp, setSelectedOp]       = useState('');
  // Edición inline
  const [editing, setEditing]             = useState<string | null>(null);
  const [editLabels, setEditLabels]       = useState<string[]>([]);
  const [editLabelInput, setEditLabelInput] = useState('');
  const [editName, setEditName]           = useState('');
  // Crear nuevo puesto
  const [showCreate, setShowCreate]       = useState(false);
  const [newLabels, setNewLabels]         = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [newName, setNewName]             = useState('');
  const [createError, setCreateError]     = useState('');

  // Suscripciones en tiempo real
  useEffect(() => {
    const unsubS = subscribeStations(setStations);
    const unsubO = subscribeOperators(setOperators);
    return () => { unsubS(); unsubO(); };
  }, []);

  const activeCount   = stations.filter(s => s.isActive).length;
  const unassignCount = stations.filter(s => !s.isActive).length;

  function getOperator(id: string | null) {
    if (!id) return null;
    return operators.find(o => o.id === id) ?? null;
  }

  async function handleAssign(stationId: string) {
    await assignOperator(stationId, selectedOp || null);
    setReassigning(null); setSelectedOp('');
  }

  function startEdit(st: WorkStation) {
    setEditing(st.id);
    setEditLabels(st.labels ?? []);
    setEditLabelInput('');
    setEditName(st.name);
    setReassigning(null);
  }

  async function confirmEdit(id: string) {
    if (editLabels.length === 0 || !editName.trim()) return;
    await updateStation(id, { labels: editLabels, name: editName.trim() });
    setEditing(null);
  }

  async function handleCreate() {
    if (newLabels.length === 0 || !newName.trim()) { setCreateError('Agrega al menos una letra y el nombre.'); return; }
    await createStation({ labels: newLabels, name: newName.trim() });
    setShowCreate(false);
    setNewLabels([]); setNewLabelInput(''); setNewName(''); setCreateError('');
  }

  async function handleDelete(id: string) {
    await deleteStation(id);
  }

  const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );

  return (
    <div className="adm-section">
      {/* KPI cards */}
      <div className="adm-stats-row">
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div><div className="adm-stat-value">{stations.length}</div><div className="adm-stat-label">Total puestos</div></div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div><div className="adm-stat-value">{activeCount}</div><div className="adm-stat-label">Activos</div></div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#f8fafc', color: '#94a3b8' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><line x1="9" y1="10" x2="15" y2="10"/></svg>
          </div>
          <div><div className="adm-stat-value">{unassignCount}</div><div className="adm-stat-label">Sin asignar</div></div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">
          <div>
            <div className="adm-card-title">Puestos de Trabajo</div>
            <div className="adm-card-sub">Gestión y asignación de operadores</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="adm-active-badge">● {activeCount} Activos</div>
            <button className="adm-btn-sm primary" onClick={() => { setShowCreate(v => !v); setCreateError(''); }}>
              {showCreate ? '✕ Cancelar' : '+ Nuevo puesto'}
            </button>
          </div>
        </div>

        {/* ── Formulario crear puesto ── */}
        {showCreate && (
          <div className="adm-station-create-form">
            {/* Fila 1: nombre */}
            <div className="adm-scf-fields">
              <div className="adm-scf-group" style={{ flex: 1 }}>
                <label>NOMBRE DEL PUESTO</label>
                <input
                  className="adm-scf-input"
                  placeholder="Ej: Counter 5 - Preferencial"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
            </div>
            {/* Fila 2: letras */}
            <div className="adm-scf-fields" style={{ marginTop: 10 }}>
              <div className="adm-scf-group" style={{ flex: 1 }}>
                <label>LETRAS DE TURNO</label>
                <div className="adm-labels-add-row">
                  <input
                    className="adm-scf-input adm-labels-single-input"
                    placeholder="Ej: A"
                    maxLength={4}
                    value={newLabelInput}
                    onChange={e => setNewLabelInput(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && newLabelInput.trim()) {
                        e.preventDefault();
                        const val = newLabelInput.trim().toUpperCase();
                        if (!newLabels.includes(val)) setNewLabels(prev => [...prev, val]);
                        setNewLabelInput('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="adm-btn-sm"
                    onClick={() => {
                      const val = newLabelInput.trim().toUpperCase();
                      if (val && !newLabels.includes(val)) setNewLabels(prev => [...prev, val]);
                      setNewLabelInput('');
                    }}
                  >+ Agregar</button>
                </div>
                {newLabels.length > 0 && (
                  <div className="adm-labels-chips-row">
                    {newLabels.map(l => (
                      <span key={l} className="adm-label-chip">
                        {l}
                        <button type="button" onClick={() => setNewLabels(prev => prev.filter(x => x !== l))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="adm-scf-hint">Escribe una letra y presiona Enter o "+ Agregar"</div>
              </div>
              <button className="adm-btn-sm primary adm-scf-btn" style={{ alignSelf: 'flex-end' }} onClick={handleCreate}>Crear</button>
            </div>
            {createError && <div className="adm-form-error" style={{ margin: '6px 0 0' }}>{createError}</div>}
          </div>
        )}

        {/* ── Lista de puestos ── */}
        <div className="adm-stations-list">
          {stations.map(st => {
            const op           = getOperator(st.operatorId);
            const isReassigning = reassigning === st.id;
            const isEditing     = editing === st.id;
            const firstLabel    = (st.labels ?? [])[0] ?? '?';
            const initials      = op ? op.avatarInitials : firstLabel;
            const avatarBg      = op ? op.avatarColor : '#e2e8f0';
            const avatarClr     = op ? '#fff' : '#94a3b8';

            return (
              <div className={`adm-station-row ${!st.isActive ? 'unassigned' : ''}`} key={st.id}>

                {/* Avatar */}
                <div className="adm-station-avatar" style={{ background: avatarBg, color: avatarClr }}>
                  {initials}
                </div>

                {/* Info / modo edición */}
                {isEditing ? (
                  <div className="adm-station-edit-row">
                    <input
                      className="adm-scf-input"
                      style={{ flex: 2, minWidth: 160 }}
                      value={editName}
                      placeholder="Nombre del puesto"
                      onChange={e => setEditName(e.target.value)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 3 }}>
                      <div className="adm-labels-add-row">
                        <input
                          className="adm-scf-input adm-labels-single-input"
                          placeholder="Letra"
                          maxLength={4}
                          value={editLabelInput}
                          onChange={e => setEditLabelInput(e.target.value.toUpperCase())}
                          onKeyDown={e => {
                            if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && editLabelInput.trim()) {
                              e.preventDefault();
                              const val = editLabelInput.trim().toUpperCase();
                              if (!editLabels.includes(val)) setEditLabels(prev => [...prev, val]);
                              setEditLabelInput('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="adm-btn-sm"
                          onClick={() => {
                            const val = editLabelInput.trim().toUpperCase();
                            if (val && !editLabels.includes(val)) setEditLabels(prev => [...prev, val]);
                            setEditLabelInput('');
                          }}
                        >+</button>
                      </div>
                      {editLabels.length > 0 && (
                        <div className="adm-labels-chips-row">
                          {editLabels.map(l => (
                            <span key={l} className="adm-label-chip">
                              {l}
                              <button type="button" onClick={() => setEditLabels(prev => prev.filter(x => x !== l))}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="adm-btn-sm primary" onClick={() => confirmEdit(st.id)}>Guardar</button>
                    <button className="adm-btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="adm-station-info">
                    <div className="adm-station-name-row">
                      <span className="adm-station-name">{st.name}</span>
                      <div className="adm-labels-badge-row">
                        {(st.labels ?? []).map(l => (
                          <span key={l} className="adm-station-area-tag">{l}</span>
                        ))}
                      </div>
                    </div>
                    <span className="adm-station-area">
                      {op
                        ? <><UserIcon />{op.fullName}</>
                        : <span className="adm-station-unassigned">Sin operador activo</span>
                      }
                    </span>
                  </div>
                )}

                {/* Acciones — ocultas si se está editando */}
                {!isEditing && (
                  <div className="adm-station-actions">
                    {isReassigning ? (
                      <div className="adm-reassign-row">
                        <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)} className="adm-reassign-select">
                          <option value="">Sin asignar</option>
                          {operators.map(o => <option key={o.id} value={o.id}>{o.fullName}</option>)}
                        </select>
                        <button className="adm-btn-sm primary" onClick={() => handleAssign(st.id)}>Confirmar</button>
                        <button className="adm-btn-sm" onClick={() => { setReassigning(null); setSelectedOp(''); }}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <button
                          className={`adm-assign-btn ${st.isActive ? 'reassign' : 'assign'}`}
                          onClick={() => { setReassigning(st.id); setSelectedOp(st.operatorId ?? ''); }}
                        >
                          {st.isActive ? 'Reasignar' : 'Asignar'}
                        </button>
                        <button className="adm-icon-btn" onClick={() => startEdit(st)} title="Editar puesto">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="adm-icon-btn danger" onClick={() => handleDelete(st.id)} title="Eliminar puesto">
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════════════

// Paleta de colores para las letras
const LETTER_COLORS = [
  '#2563eb', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
];

function fmtSec(sec: number): string {
  if (sec === 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function todayRange(): { from: Date; to: Date } {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to   = new Date(); to.setHours(23, 59, 59, 999);
  return { from, to };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Gráfico de donut SVG reutilizable
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = 110, cy = 110, r = 90, ri = 52;

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  let cumulative = 0;
  const paths = slices.map(slice => {
    const pct   = total > 0 ? slice.value / total : 0;
    const start = cumulative;
    cumulative += pct * 360;
    const end   = pct === 1 ? 359.99 : cumulative;
    if (pct === 0) return { ...slice, d: '', pct };
    const p1 = polarToXY(start, r);  const p2 = polarToXY(end, r);
    const i1 = polarToXY(start, ri); const i2 = polarToXY(end, ri);
    const large = end - start > 180 ? 1 : 0;
    const d = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} L ${i2.x} ${i2.y} A ${ri} ${ri} 0 ${large} 0 ${i1.x} ${i1.y} Z`;
    return { ...slice, d, pct };
  });

  return (
    <div className="adm-pie-wrap" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg viewBox="0 0 220 220" width={130} height={130} className="adm-pie-svg">
        {total === 0
          ? <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" />
          : paths.filter(p => p.d).map((p, i) => (
            <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={2} className="adm-pie-slice">
              <title>{p.label}: {p.value} ({(p.pct * 100).toFixed(1)}%)</title>
            </path>
          ))
        }
        <circle cx={cx} cy={cy} r={ri - 4} fill="#fff" />
        <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={22} fontWeight={800} fill="#111827">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="#94a3b8">tickets</text>
      </svg>
      <div className="adm-pie-legend">
        {paths.map((p, i) => (
          <div key={i} className="adm-pie-legend-item">
            <span className="adm-pie-dot" style={{ background: p.color }} />
            <div className="adm-pie-legend-text">
              <span className="adm-pie-legend-label">
                <strong>{p.label.split(' — ')[0]}</strong>
                {p.label.includes(' — ') && <> — {p.label.split(' — ')[1]}</>}
              </span>
              <span className="adm-pie-legend-val">{p.value.toLocaleString()}</span>
            </div>
            <span className="adm-pie-legend-pct">{total > 0 ? (p.pct * 100).toFixed(1) : '0.0'}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionStatistics() {
  const defRange = todayRange();
  const [fromDate, setFromDate] = useState(isoDate(defRange.from));
  const [toDate,   setToDate]   = useState(isoDate(defRange.to));
  const [tickets,  setTickets]  = useState<TicketRecord[]>([]);
  const [rows,     setRows]     = useState<TicketStatRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadStats(from: string, to: string) {
    setLoading(true);
    try {
      const f = new Date(from + 'T00:00:00');
      const t = new Date(to   + 'T23:59:59');
      const data = await getTicketStats(f, t);
      setTickets(data);
      setRows(groupStatsByLetter(data));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(fromDate, toDate); }, []);

  const totalTickets  = rows.reduce((s, r) => s + r.total,    0);
  const totalAttended = rows.reduce((s, r) => s + r.attended, 0);
  const totalPending  = rows.reduce((s, r) => s + r.pending,  0);
  const totalUnattended = rows.reduce((s, r) => s + r.unattended, 0);
  const avgWaitAll    = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.avgWaitSec * r.attended, 0) / Math.max(totalAttended, 1))
    : 0;

  const pieSlices = [
    { label: 'Atendidos', value: totalAttended, color: '#16a34a' },
    { label: 'No Atendidos', value: totalUnattended, color: '#dc2626' },
    { label: 'En Espera', value: totalPending, color: '#ca8a04' },
  ];

  // ── Exportar a Excel ─────────────────────────────────────────────────────
  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Resumen por letra ─────────────────────────────────────────
    const summaryData = [
      ['SISTEMA DE TURNOS — ESTADÍSTICAS DE ATENCIÓN'],
      [`Período: ${fromDate}  al  ${toDate}`],
      [`Generado el: ${new Date().toLocaleString('es-CL')}`],
      [],
      ['Letra', 'Servicio', 'Total emitidos', 'Atendidos', 'No Atendidos', 'En espera / cola', 'Tiempo prom. espera'],
      ...rows.map(r => [
        r.letter,
        r.service,
        r.total,
        r.attended,
        r.unattended,
        r.pending,
        fmtSec(r.avgWaitSec),
      ]),
      [],
      ['TOTALES', '', totalTickets, totalAttended, totalUnattended, totalPending, fmtSec(avgWaitAll)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    // Anchos de columna
    wsSummary['!cols'] = [
      { wch: 8 }, { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por Letra');

    // ── Hoja 2: Detalle de tickets ────────────────────────────────────────
    const detailHeader = [
      'N° Ticket', 'Letra', 'Servicio', 'RUT', 'Fecha Emisión', 'Hora Emisión',
      'Hora Llamado', 'Hora Fin', 'Estado', 'Espera (seg)',
    ];
    const detailRows = tickets.map(t => {
      const issued = new Date(t.issuedAt);
      return [
        t.number,
        t.letter,
        t.service,
        t.rut,
        issued.toLocaleDateString('es-CL'),
        issued.toLocaleTimeString('es-CL'),
        t.calledAt   ? new Date(t.calledAt).toLocaleTimeString('es-CL')   : '—',
        t.finishedAt ? new Date(t.finishedAt).toLocaleTimeString('es-CL') : '—',
        t.status === 'finished'    ? 'Atendido'
          : t.status === 'transferred' ? 'Transferido'
          : t.status === 'in_progress' ? 'En atención'
          : 'En espera',
        t.waitSec ?? '—',
      ];
    });
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    wsDetail['!cols'] = [
      { wch: 10 }, { wch: 7 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle de Tickets');

    // ── Descarga ──────────────────────────────────────────────────────────
    const filename = `estadisticas_${fromDate}_${toDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // ── Exportar a PDF ───────────────────────────────────────────────────────
  function handleExportPDF() {
    const doc = new jsPDF();
    
    // Encabezado
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text('SISTEMA DE TURNOS - ESTADÍSTICAS', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Período: ${fromDate} al ${toDate}`, 14, 28);
    doc.text(`Generado el: ${new Date().toLocaleString('es-CL')}`, 14, 34);

    // Resumen de KPIs
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.setFont('', 'bold');
    doc.text(`Total Tickets: ${totalTickets}`, 14, 46);
    doc.text(`Atendidos: ${totalAttended}`, 60, 46);
    doc.text(`No Atendidos: ${totalUnattended}`, 110, 46);
    doc.text(`En Espera: ${totalPending}`, 160, 46);

    // Tabla de Resumen por Letra
    const tableData = rows.map(r => [
      r.letter,
      r.service,
      r.total.toString(),
      r.attended.toString(),
      r.unattended.toString(),
      r.pending.toString(),
      fmtSec(r.avgWaitSec)
    ]);
    
    if (rows.length > 0) {
      tableData.push(['TOT', 'TOTALES', totalTickets.toString(), totalAttended.toString(), totalUnattended.toString(), totalPending.toString(), fmtSec(avgWaitAll)]);
    }

    autoTable(doc, {
      startY: 54,
      head: [['Letra', 'Servicio', 'Emitidos', 'Atendidos', 'No Atend.', 'Espera', 'T. Promedio']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39] },
      styles: { fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: 'bold' } // if using foot
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 54;

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont('', 'normal');
    doc.text('* El detalle completo de cada módulo está disponible exportando a formato Excel.', 14, finalY + 12);

    const filename = `resumen_estadisticas_${fromDate}_${toDate}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="adm-section">

      {/* ── Filtro de fechas ────────────────────────────────────────────── */}
      <div className="adm-stats-filter-bar">
        <div className="adm-filter-group">
          <label className="adm-filter-label">Desde</label>
          <input
            type="date"
            className="adm-date-input"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div className="adm-filter-group">
          <label className="adm-filter-label">Hasta</label>
          <input
            type="date"
            className="adm-date-input"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>
        <button
          className="adm-btn-primary"
          onClick={() => loadStats(fromDate, toDate)}
          disabled={loading}
        >
          {loading ? 'Cargando…' : 'Consultar'}
        </button>
        <div style={{ marginLeft: 'auto', position: 'relative' }} ref={exportRef}>
          <button
            className={`adm-custom-select-btn ${showExportMenu ? 'focus' : ''}`}
            style={{ width: 'auto', gap: '8px', padding: '8px 16px', fontWeight: 600, color: '#111827', background: '#fff' }}
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={tickets.length === 0}
            title={tickets.length === 0 ? 'Sin datos para exportar' : 'Exportar datos'}
          >
            <IconExport /> Exportar
          </button>

          <div className={`adm-export-menu ${showExportMenu ? 'open' : ''}`}>
            <button 
              className="adm-export-option" 
              onClick={() => { handleExportExcel(); setShowExportMenu(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} style={{ color: '#16a34a' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              Exportar a Excel
            </button>
            <button 
              className="adm-export-option" 
              onClick={() => { handleExportPDF(); setShowExportMenu(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} style={{ color: '#dc2626' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Exportar a PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="adm-stats-row quad">
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9" y1="14.5" x2="15" y2="14.5"/></svg>
          </div>
          <div className="adm-kpi-body">
            <div className="adm-kpi-label">Total de Tickets</div>
            <div className="adm-kpi-value">{totalTickets.toLocaleString()}</div>
            <div className="adm-kpi-sub">Emitidos en el período</div>
          </div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="adm-kpi-body">
            <div className="adm-kpi-label">Atendidos</div>
            <div className="adm-kpi-value">
              {totalAttended.toLocaleString()}
              {totalTickets > 0 && (
                <span className="adm-kpi-change up"> {((totalAttended / totalTickets) * 100).toFixed(0)}%</span>
              )}
            </div>
            <div className="adm-kpi-sub">Tickets finalizados</div>
          </div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon red" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="adm-kpi-body">
            <div className="adm-kpi-label">No Atendidos</div>
            <div className="adm-kpi-value">
              {totalUnattended.toLocaleString()}
              {totalTickets > 0 && (
                <span className="adm-kpi-change down" style={{ color: '#dc2626' }}> {((totalUnattended / totalTickets) * 100).toFixed(0)}%</span>
              )}
            </div>
            <div className="adm-kpi-sub">Tickets saltados/ausentes</div>
          </div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-icon light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="adm-kpi-body">
            <div className="adm-kpi-label">Prom. de Espera</div>
            <div className="adm-kpi-value">{fmtSec(avgWaitAll)}</div>
            <div className="adm-kpi-sub">{totalPending > 0 ? `${totalPending} en espera ahora` : 'Cola vacía'}</div>
          </div>
        </div>
      </div>

      {/* ── Tabla por letra + Gráfico ─────────────────────────────────── */}
      <div className="adm-stats-grid">
        {/* Tabla */}
        <div className="adm-card adm-stats-table-card">
          <div className="adm-card-header">
            <div>
              <div className="adm-card-title">Atenciones por Letra / Servicio</div>
              <div className="adm-card-sub">{rows.length} letras activas</div>
            </div>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table adm-stats-tbl">
              <thead>
                <tr>
                  <th>LETRA</th>
                  <th>SERVICIO</th>
                  <th className="text-right">EMITIDOS</th>
                  <th className="text-right">ATENDIDOS</th>
                  <th className="text-right">NO ATENDIDOS</th>
                  <th className="text-right">EN ESPERA</th>
                  <th className="text-right">PROM. ESPERA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={7} className="adm-td-empty">
                    Sin datos para el período seleccionado
                  </td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="adm-td-empty">Cargando datos…</td></tr>
                )}
                {rows.map((row, i) => {
                  const pct = row.total > 0 ? (row.attended / row.total) * 100 : 0;
                  const color = LETTER_COLORS[i % LETTER_COLORS.length];
                  return (
                    <tr key={row.letter}>
                      <td>
                        <span className="adm-letter-badge" style={{ background: color }}>
                          {row.letter}
                        </span>
                      </td>
                      <td className="adm-td-service">{row.service}</td>
                      <td className="text-right adm-td-num">{row.total}</td>
                      <td className="text-right adm-td-num">{row.attended}</td>
                      <td className="text-right adm-td-num" style={{ color: '#dc2626' }}>{row.unattended}</td>
                      <td className="text-right adm-td-num">{row.pending > 0
                        ? <span className="adm-pending-badge">{row.pending}</span>
                        : <span className="adm-zero">0</span>}
                      </td>
                      <td className="text-right adm-td-num">{fmtSec(row.avgWaitSec)}</td>
                      <td>
                        <div className="adm-progress-bar">
                          <div className="adm-progress-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico donut */}
        <div className="adm-card adm-stats-pie-card">
          <div className="adm-card-header">
            <div>
              <div className="adm-card-title">Estado Global de Tickets</div>
              <div className="adm-card-sub">{fromDate} — {toDate}</div>
            </div>
          </div>
          <DonutChart slices={pieSlices.length > 0 ? pieSlices : [{ label: 'Sin datos', value: 1, color: '#e2e8f0' }]} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: HISTORIAL COMENTARIOS
// ═══════════════════════════════════════════════════════════════════════════════

type CommentRow = {
  ticketId: string; ticketNumber: string; comment: string;
  createdAt: number; updatedAt: number;
  operatorName: string; operatorId: string; status: string;
};

// ─── Custom Select Component ───────────────────────────────────────────────────
function AdminSelect({ value, onChange, options, placeholder }: { value: string, onChange: (v: string) => void, options: {value: string, label: string}[], placeholder: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`adm-custom-select ${open ? 'active' : ''}`} ref={ref}>
      <button 
        type="button" 
        className={`adm-custom-select-btn ${open ? 'focus' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontWeight: selected ? 600 : 400, color: selected ? '#111827' : '#475569' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', color: '#94a3b8' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={`adm-custom-select-menu ${open ? 'open' : ''}`}>
        <div 
          className={`adm-custom-select-item ${!value ? 'selected' : ''}`}
          onClick={() => { onChange(''); setOpen(false); }}
        >
          {placeholder}
        </div>
        {options.map(o => (
          <div 
            key={o.value} 
            className={`adm-custom-select-item ${o.value === value ? 'selected' : ''}`}
            onClick={() => { onChange(o.value); setOpen(false); }}
          >
            {o.label}
            {o.value === value && (
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2563eb', marginLeft: 'auto' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionComments() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filterText, setFilterText] = useState('');
  const [filterLetter, setFilterLetter] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getAllComments().then(setComments);
    const unsub = subscribeOperators(setOperators);
    return unsub;
  }, []);

  const uniqueLetters = Array.from(new Set(comments.map(c => {
    const match = c.ticketNumber.match(/^[A-Za-z]+/);
    return match ? match[0].toUpperCase() : '';
  }).filter(Boolean))).sort();

  const filtered = comments.filter((c: CommentRow) => {
    if (filterText) {
      const q = filterText.toLowerCase();
      const matchText = c.ticketNumber.toLowerCase().includes(q) ||
                        (c.comment && c.comment.toLowerCase().includes(q)) ||
                        (c.operatorName && c.operatorName.toLowerCase().includes(q));
      if (!matchText) return false;
    }
    if (filterLetter && !c.ticketNumber.toUpperCase().startsWith(filterLetter)) return false;
    if (filterOperator && c.operatorId !== filterOperator) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  function handleExport() {
    const rows = [
      ['Fecha', 'Hora', 'Ticket ID', 'Operador', 'Comentario', 'Estado'],
      ...filtered.map((c: CommentRow) => [fmtDate(c.updatedAt), fmtTime(c.updatedAt), c.ticketNumber, c.operatorName, `"${c.comment}"`, c.status]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'comentarios.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function getOpAvatar(operatorId: string) {
    return operators.find((o: Operator) => o.id === operatorId) ?? null;
  }

  return (
    <div className="adm-section">
      <div className="adm-stats-row">
        {/* Total comentarios */}
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div><div className="adm-stat-value">{comments.length}</div><div className="adm-stat-label">Total comentarios</div></div>
        </div>
        {/* Resueltos */}
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div><div className="adm-stat-value">{comments.filter(c => c.status === 'RESUELTO').length}</div><div className="adm-stat-label">Resueltos</div></div>
        </div>
        {/* No resueltos */}
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div><div className="adm-stat-value">{comments.filter(c => c.status === 'NO RESUELTO').length}</div><div className="adm-stat-label">No resueltos</div></div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="adm-card-title">Historial de Comentarios de Turnos</div>
            <div className="adm-card-sub">{filtered.length} registros encontrados</div>
          </div>
          <div className="adm-table-actions">
            <input
              className="adm-filter-input"
              placeholder="Buscar..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
            
            <div style={{ position: 'relative' }}>
              <button className={`adm-action-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                <IconFilter /> Filtros {(filterLetter || filterOperator || filterStatus) && <span className="adm-filter-dot" />}
              </button>

              {/* ── Panel de Filtros Avanzados Flotante ── */}
              <div className={`adm-filters-panel ${showFilters ? 'open' : ''}`}>
                 <div className="adm-filters-grid">
                    <div className="adm-filter-group">
                      <label>Letra del Módulo</label>
                      <AdminSelect 
                        value={filterLetter} 
                        onChange={setFilterLetter} 
                        placeholder="Todas las letras" 
                        options={uniqueLetters.map(l => ({ value: l, label: `Letra ${l}` }))} 
                      />
                    </div>
                    <div className="adm-filter-group">
                      <label>Operador a cargo</label>
                      <AdminSelect 
                        value={filterOperator} 
                        onChange={setFilterOperator} 
                        placeholder="Todos los operadores" 
                        options={operators.map(o => ({ value: o.id, label: o.fullName }))} 
                      />
                    </div>
                    <div className="adm-filter-group">
                      <label>Estado del Ticket</label>
                      <AdminSelect 
                        value={filterStatus} 
                        onChange={setFilterStatus} 
                        placeholder="Cualquier estado" 
                        options={[
                          { value: 'RESUELTO', label: 'Resueltos' },
                          { value: 'NO RESUELTO', label: 'No resueltos' }
                        ]} 
                      />
                    </div>
                 </div>
                 
                 {(filterLetter || filterOperator || filterStatus || filterText) && (
                   <div className="adm-filters-footer">
                     <button className="adm-btn-sm" onClick={() => { setFilterText(''); setFilterLetter(''); setFilterOperator(''); setFilterStatus(''); }}>
                       Limpiar filtros
                     </button>
                   </div>
                 )}
              </div>
            </div>

            <button className="adm-action-btn" onClick={handleExport}>
              <IconExport /> Exportar
            </button>
          </div>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>TICKET ID</th>
                <th>OPERADOR</th>
                <th>COMENTARIO</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const op = getOpAvatar(c.operatorId);
                return (
                  <tr key={i}>
                    <td className="adm-td-time">
                      <div>{fmtTime(c.updatedAt)}</div>
                      <div className="adm-td-date">{fmtDate(c.updatedAt)}</div>
                    </td>
                    <td><span className="adm-ticket-id">{c.ticketNumber}</span></td>
                    <td>
                      <div className="adm-op-cell">
                        {op
                          ? <div className="adm-avatar sm" style={{ background: op.avatarColor }}>{op.avatarInitials}</div>
                          : <div className="adm-avatar sm" style={{ background: '#94a3b8' }}>{c.operatorName[0]}</div>
                        }
                        <span>{c.operatorName}</span>
                      </div>
                    </td>
                    <td className="adm-td-comment">"{c.comment}"</td>
                    <td><span className={`adm-status-badge status-${c.status.toLowerCase().replace(/ /g, '_')}`}>{c.status}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="adm-td-empty">No hay comentarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── StatCard helper ─────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div>
        <div className="adm-stat-value">{value}</div>
        <div className="adm-stat-label">{label}</div>
      </div>
    </div>
  );
}
