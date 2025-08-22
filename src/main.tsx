import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('🚀 Iniciando aplicación Vanguard Measure AI...');

const rootElement = document.getElementById("root");
console.log('Root element:', rootElement);

if (!rootElement) {
  document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: No se encontró el elemento root</div>';
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('✅ App montada correctamente');
  } catch (error) {
    console.error('❌ Error montando la app:', error);
    document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;">
      <h2>Error al montar la aplicación:</h2>
      <pre>${error}</pre>
    </div>`;
  }
}
