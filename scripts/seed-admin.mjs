// Ejecutar UNA sola vez: node scripts/seed-admin.mjs
// Escribe el usuario admin en Firestore via REST API (evita problemas de SSL con gRPC)

import https from 'https';
import { readFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ID = 'servicio-totem';
const API_KEY    = 'AIzaSyDhyS2VRfJ0Bq8xWeee9Pec1ZufZdCc_CE';

// Documento a escribir (colección: operators / id: admin-1)
const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/operators/admin-1`;
const url     = `https://firestore.googleapis.com/v1/${docPath}?key=${API_KEY}`;

const body = JSON.stringify({
  fields: {
    fullName:       { stringValue: 'Administrador' },
    email:          { stringValue: 'admin@totemst.cl' },
    password:       { stringValue: 'admin1234' },
    role:           { stringValue: 'admin' },
    avatarInitials: { stringValue: 'AD' },
    avatarColor:    { stringValue: '#4f8ef7' },
  },
});

// Usa PATCH (crea o sobreescribe el doc)
const options = {
  method: 'PATCH',
  headers: {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
  // Desactiva verificación de certificados para redes con proxy corporativo
  rejectUnauthorized: false,
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Admin creado exitosamente en Firestore');
      console.log('   Email:      admin@totemst.cl');
      console.log('   Contraseña: admin1234');
    } else {
      console.error('❌ Error HTTP', res.statusCode, data);
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('❌ Error de red:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
