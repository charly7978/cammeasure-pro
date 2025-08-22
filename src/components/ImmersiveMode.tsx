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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // NUEVO: Detectar cambios de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      console.log(`📱 Estado fullscreen: ${isCurrentlyFullscreen ? 'ACTIVO' : 'INACTIVO'}`);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // NUEVO: Función para entrar en pantalla completa
  const enterFullscreen = async () => {
    try {
      const element = containerRef.current || document.documentElement;
      
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
      
      console.log('✅ Pantalla completa activada');
    } catch (error) {
      console.error('❌ Error entrando en pantalla completa:', error);
    }
  };

  // NUEVO: Función para salir de pantalla completa
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      
      console.log('✅ Pantalla completa desactivada');
    } catch (error) {
      console.error('❌ Error saliendo de pantalla completa:', error);
    }
  };

  useEffect(() => {
    const setupImmersiveMode = async () => {
      try {
        // MEJORADO: Configuración inmersiva más robusta
        console.log('🚀 Configurando modo inmersivo avanzado...');
        
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
          // Para navegadores web, usar API de pantalla completa
          console.log('🌐 Configurando modo inmersivo para navegador web');
          
          // Auto-activar pantalla completa al hacer clic en la pantalla
          const handleUserInteraction = () => {
            if (!isFullscreen) {
              enterFullscreen();
            }
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('touchstart', handleUserInteraction);
          };
          
          document.addEventListener('click', handleUserInteraction, { once: true });
          document.addEventListener('touchstart', handleUserInteraction, { once: true });
          
          setIsSupported(true);
        }
        
        // NUEVO: Configurar viewport para dispositivos móviles
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
          );
        } else {
          const newViewport = document.createElement('meta');
          newViewport.name = 'viewport';
          newViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
          document.head.appendChild(newViewport);
        }
        
        // NUEVO: Prevenir zoom con gestos
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
        document.addEventListener('gestureend', (e) => e.preventDefault());
        
      } catch (error) {
        console.error('Error setting up immersive mode:', error);
        setIsSupported(false);
      }
    };

    const enableImmersiveMode = async () => {
      try {
        if (window.Capacitor) {
          await StatusBar.hide();
        }
        setIsImmersive(true);
        
        // Limpiar cualquier timeout existente
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Establecer un timeout para asegurar que el modo inmersivo se mantenga
        timeoutRef.current = setTimeout(() => {
          if (window.Capacitor) {
            StatusBar.hide();
          }
        }, 100);
        
        console.log('✅ Modo inmersivo activado');
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
      if (window.Capacitor) {
        App.removeAllListeners();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
      document.removeEventListener('gesturechange', (e) => e.preventDefault());
      document.removeEventListener('gestureend', (e) => e.preventDefault());
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isFullscreen]);

  const toggleImmersiveMode = async () => {
    try {
      if (isImmersive) {
        if (window.Capacitor) {
          await StatusBar.show();
        } else {
          await exitFullscreen();
        }
        setIsImmersive(false);
      } else {
        if (window.Capacitor) {
          await StatusBar.hide();
        } else {
          await enterFullscreen();
        }
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
    <div 
      ref={containerRef}
      className={`immersive-container ${isImmersive ? 'immersive-active' : ''} ${isFullscreen ? 'fullscreen-active' : ''}`}
    >
      {children}
      {/* Botón para alternar modo inmersivo (solo visible en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={toggleImmersiveMode}
          className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-50 hover:opacity-100 transition-opacity"
        >
          {isImmersive ? 'Salir Inmersivo' : 'Modo Inmersivo'}
        </button>
      )}
    </div>
  );
};

export default ImmersiveMode;
