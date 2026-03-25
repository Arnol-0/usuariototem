import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './services/firebase'; // Inicializa Firebase al arrancar
import { seedAdminIfEmpty } from './services/adminService';

// Garantiza que siempre exista al menos el usuario admin en Firestore
seedAdminIfEmpty().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
