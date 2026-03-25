import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DisplayScreen from './DisplayScreen';

createRoot(document.getElementById('display-root')!).render(
  <StrictMode>
    <DisplayScreen />
  </StrictMode>,
);
