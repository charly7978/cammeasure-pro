import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { CalibrationProvider } from './lib/calibrationContext';

createRoot(document.getElementById("root")!).render(
  <CalibrationProvider>
    <App />
  </CalibrationProvider>
);
