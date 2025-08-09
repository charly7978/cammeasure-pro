import { useEffect, useState, useRef } from 'react';
import { StatusBar } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

// Declaración de tipos para el objeto global Capacitor
declare global {
  interface Window {
    Capacitor: any;
  }
}

interface ImmersiveModeProps {
  children: React.ReactNode;
}

export const ImmersiveMode: React.FC<ImmersiveModeProps> = ({ children }) => {
  const [isImmersive, setIsImmersive] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const setupImmersiveMode = async () => {
      try {
        // Verificar si estamos en un entorno Capacitor
        if (typeof window !== 'undefined' && window.Capacitor) {
          // Ocultar la barra de estado
          await StatusBar.hide();
          
          // Configurar el modo inmersivo con manejo de estado de la app
          await App.addListener('appStateChange', (state) => {
            if (state.isActive) {
              // Cuando la app vuelve a primer plano, asegurar modo inmersivo
              enableImmersiveMode();
            }
          });

          // También escuchar eventos de visibilidad de la página
          document.addEventListener('visibilitychange', handleVisibilityChange);
          
          // Activar modo inmersivo inicial
          enableImmersiveMode();
        } else {
          // Si no estamos en Capacitor, desactivar el modo inmersivo
          setIsSupported(false);
          console.log('Immersive mode not supported in this environment');
        }
      } catch (error) {
        console.error('Error setting up immersive mode:', error);
        setIsSupported(false);
      }
    };

    const enableImmersiveMode = async () => {
      try {
        await StatusBar.hide();
        setIsImmersive(true);
        
        // Limpiar cualquier timeout existente
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Establecer un timeout para asegurar que el modo inmersivo se mantenga
        timeoutRef.current = setTimeout(() => {
          StatusBar.hide();
        }, 100);
      } catch (error) {
        console.error('Error enabling immersive mode:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        enableImmersiveMode();
      }
    };

    setupImmersiveMode();

    return () => {
      // Limpiar listeners y timeouts al desmontar
      App.removeAllListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const toggleImmersiveMode = async () => {
    try {
      if (isImmersive) {
        await StatusBar.show();
        setIsImmersive(false);
      } else {
        await StatusBar.hide();
        setIsImmersive(true);
      }
    } catch (error) {
      console.error('Error toggling immersive mode:', error);
    }
  };

  // Si no es soportado, simplemente renderizar los hijos sin el modo inmersivo
  if (!isSupported) {
    return <>{children}</>;
  }

  return (
    <div className={`immersive-container ${isImmersive ? 'immersive-active' : ''}`}>
      {children}
      {/* Botón para alternar modo inmersivo (solo visible en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={toggleImmersiveMode}
          className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-50 hover:opacity-100 transition-opacity"
        >
          {isImmersive ? 'Exit Immersive' : 'Enter Immersive'}
        </button>
      )}
    </div>
  );
};

export default ImmersiveMode;
