import { useState, useCallback, RefObject } from 'react';
import { HTMLVideoElement } from 'react';

export const useCameraControls = (videoRef: RefObject<HTMLVideoElement>) => {
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const [showGrid, setShowGrid] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const handleCameraSwitch = useCallback(async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    setCurrentCamera(newDirection);
  }, [currentCamera]);

  const handleGridToggle = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  const handleFlashToggle = useCallback(() => {
    setFlashEnabled(prev => !prev);
  }, []);

  const handleFocusReset = useCallback(() => {
    setFocusPoint(null);
  }, []);

  const handleFocus = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setFocusPoint({ x, y });
      
      console.log('🎯 Punto de enfoque establecido:', { x, y });
    } catch (error) {
      console.error('❌ Error al establecer punto de enfoque:', error);
    }
  }, []);

  return {
    currentCamera,
    showGrid,
    flashEnabled,
    focusPoint,
    handleCameraSwitch,
    handleGridToggle,
    handleFlashToggle,
    handleFocusReset,
    handleFocus
  };
};
