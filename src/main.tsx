import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { RealCalibrationProvider } from './lib/calibrationContext';

createRoot(document.getElementById("root")!).render(
  <RealCalibrationProvider>
    <App />
  </RealCalibrationProvider>
);
