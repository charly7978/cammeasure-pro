import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// CONFIGURACIÓN PARA MODO INMERSIVO MEJORADO
const setupImmersiveEnvironment = () => {
  // Configurar viewport para experiencia inmersiva
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
  }

  // Prevenir comportamientos no deseados en modo inmersivo
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  
  // Optimizar para dispositivos táctiles
  document.body.style.touchAction = 'manipulation';
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.webkitTouchCallout = 'none';
  
  // Configurar para pantalla completa automática en interacción
  let hasInteracted = false;
  const handleFirstInteraction = () => {
    if (!hasInteracted) {
      hasInteracted = true;
      // Intentar entrar en pantalla completa si es posible
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          console.log('Pantalla completa no disponible o denegada');
        });
      }
    }
  };

  document.addEventListener('touchstart', handleFirstInteraction, { once: true });
  document.addEventListener('click', handleFirstInteraction, { once: true });
  
  console.log('🚀 Entorno inmersivo configurado');
};

// Configurar entorno inmersivo antes de renderizar la app
setupImmersiveEnvironment();

import { RealCalibrationProvider } from './lib/calibrationContext';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RealCalibrationProvider>
      <App />
    </RealCalibrationProvider>
  </StrictMode>
);
