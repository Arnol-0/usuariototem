/** Convierte segundos → "MM:SS" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Convierte segundos → "HH:MM min" */
export function formatWaiting(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(rem).padStart(2, '0')} min`;
  return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} min`;
}
