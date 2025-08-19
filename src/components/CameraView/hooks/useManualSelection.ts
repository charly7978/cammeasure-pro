import { useState, useCallback } from 'react';
import { DetectedObject } from '@/lib/types';

export const useManualSelection = (
  onRealTimeObjects: (objects: DetectedObject[]) => void,
  processFrameAutomatically: () => void
) => {
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [manualMeasurements, setManualMeasurements] = useState<any>(null);

  const toggleManualMode = useCallback(() => {
    setIsManualMode(prev => !prev);
  }, []);

  const handleManualObjectSelection = useCallback((object: DetectedObject, measurements: any) => {
    console.log('🎯 OBJETO SELECCIONADO MANUALMENTE:', object);
    setSelectedObject(object);
    setManualMeasurements(measurements);
    
    // Detener medición automática cuando se selecciona manualmente
    // Esto se maneja en el componente principal
    
    // Notificar al componente padre
    onRealTimeObjects([object]);
  }, [onRealTimeObjects]);

  const handleManualSelectionError = useCallback((error: string) => {
    console.error('❌ Error en selección manual:', error);
    // Mostrar error al usuario
  }, []);

  return {
    isManualMode,
    selectedObject,
    manualMeasurements,
    toggleManualMode,
    handleManualObjectSelection,
    handleManualSelectionError
  };
};
