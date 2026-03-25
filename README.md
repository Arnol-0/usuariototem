# Tótem de Turnos — Desktop App

App de escritorio React + Vite + TypeScript para gestionar turnos de un tótem de atención al cliente.

## Capturas de pantalla

| Panel principal | Overlay flotante |
|---|---|
| Turno actual LIVE · cola de espera · botones de acción | Aparece al minimizar o cambiar de ventana |

---

## Características

- **Turno en progreso** con número, nombre, servicio, duración (contador en vivo) y tiempo de espera.
- **Cola de espera** con posición, nombre y tiempo de cola (resalta turnos con demora).
- **Acciones**: Next Turn · Recall · Finish · Transfer Ticket · On Break/Reanudar.
- **Comentarios** de turno directamente desde la UI o el overlay.
- **Overlay flotante** que aparece automáticamente cuando la ventana pierde foco o se minimiza:
  - Arrastrable con el mouse.
  - Muestra número de turno, estado LIVE/PAUSED.
  - Botones: Siguiente · Recall · Pausar/Reanudar · Finalizar.
  - Campo de comentario.
- **Mock local** del tótem listo para desarrollo sin servidor externo.

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18+ |
| npm | 9+ |

---

## Instalación y desarrollo

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor de desarrollo
npm run dev
# → http://localhost:5173
```

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (`dist/`) |
| `npm run preview` | Vista previa del build |
| `npm run test` | Tests unitarios (Vitest) |

---

## Conectar con un tótem real

Edita `src/services/totemService.ts`. Las funciones `subscribe` y `sendAction` contienen comentarios marcados con `// En producción:`.

### Opción A — REST + polling

```ts
// En totemService.ts
const BASE_URL = import.meta.env.VITE_TOTEM_URL ?? 'http://localhost:8080';

export async function sendAction(payload: ActionPayload) {
  await fetch(`${BASE_URL}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

### Opción B — WebSocket en tiempo real

```ts
const ws = new WebSocket(import.meta.env.VITE_TOTEM_WS ?? 'ws://localhost:8080/ws');
ws.onmessage = (e) => notify(JSON.parse(e.data));
```

### Variables de entorno

Crea un archivo `.env.local` en la raíz:

```env
VITE_TOTEM_URL=http://192.168.1.100:8080
VITE_TOTEM_WS=ws://192.168.1.100:8080/ws
```

---

## Empaquetar como app de escritorio (Tauri)

```bash
# Instalar Rust (https://rustup.rs) y luego:
npm install -D @tauri-apps/cli @tauri-apps/api

# Inicializar Tauri
npx tauri init

# Dev desktop
npx tauri dev

# Build .exe Windows
npx tauri build
```

---

## Estructura del proyecto

```
src/
├── components/
│   ├── Header.tsx / .css          ← barra superior con estación y estado
│   ├── CurrentTicket.tsx / .css   ← tarjeta turno en progreso
│   ├── ActionButtons.tsx / .css   ← Next / Recall / Finish / Transfer / Break / Comment
│   ├── WaitingQueue.tsx / .css    ← lista de espera lateral
│   └── FloatingOverlay.tsx / .css ← mini-panel flotante al perder foco
├── context/
│   └── TotemContext.tsx           ← Provider + useTotem hook
├── services/
│   └── totemService.ts            ← mock + API real (REST/WebSocket)
├── types/
│   └── totem.ts                   ← interfaces TypeScript
├── utils/
│   └── time.ts                    ← formatTime / formatWaiting
└── tests/
    └── totemService.test.ts       ← 7 tests unitarios (Vitest)
```
