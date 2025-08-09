
import React, { createContext, useState, ReactNode, useEffect } from 'react';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  // Nuevos campos para calibración avanzada
  realTimeAdjustment: number;
  distanceCorrection: number;
  perspectiveCorrection: number;
  lensDistortionCorrection: number;
  calibrationHistory: Array<{
    timestamp: number;
    pixelsPerMm: number;
    accuracy: number;
    method: string;
  }>;
  deviceCharacteristics: {
    model: string;
    resolution: { width: number; height: number };
    estimatedSensorSize: number;
    estimatedFocalLength: number;
  } | null;
}

interface CalibrationContextValue {
  calibration: CalibrationData | null;
  setCalibration: (data: CalibrationData) => void;
  updateRealTimeCalibration: (adjustment: number, accuracy: number) => void;
  validateCalibration: () => { isValid: boolean; accuracy: number; issues: string[] };
}

export const CalibrationContext = createContext<CalibrationContextValue | undefined>(
  undefined
);

export const CalibrationProvider = ({ children }: { children: ReactNode }) => {
  const [calibration, setCalibrationState] = useState<CalibrationData | null>({
    focalLength: 4.25,
    sensorSize: 6.17,
    pixelsPerMm: 10,
    referenceObjectSize: 25.4,
    isCalibrated: false,
    realTimeAdjustment: 1.0,
    distanceCorrection: 1.0,
    perspectiveCorrection: 1.0,
    lensDistortionCorrection: 1.0,
    calibrationHistory: [],
    deviceCharacteristics: null
  });

  // Auto-detectar características del dispositivo
  useEffect(() => {
    detectDeviceCharacteristics();
  }, []);

  const detectDeviceCharacteristics = async () => {
    try {
      // Obtener información del dispositivo si está disponible
      const userAgent = navigator.userAgent;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Estimar características basadas en User Agent
      let deviceModel = 'Unknown';
      let estimatedSensorSize = 6.17;
      let estimatedFocalLength = 4.25;
      
      if (userAgent.includes('iPhone')) {
        deviceModel = 'iPhone';
        estimatedSensorSize = 6.17;
        estimatedFocalLength = 4.25;
      } else if (userAgent.includes('Samsung')) {
        deviceModel = 'Samsung';
        estimatedSensorSize = 5.76;
        estimatedFocalLength = 4.3;
      } else if (userAgent.includes('Pixel')) {
        deviceModel = 'Google Pixel';
        estimatedSensorSize = 6.17;
        estimatedFocalLength = 4.38;
      }

      // Intentar obtener resolución de cámara
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        const deviceCharacteristics = {
          model: deviceModel,
          resolution: { 
            width: settings.width || 1920, 
            height: settings.height || 1080 
          },
          estimatedSensorSize,
          estimatedFocalLength
        };

        if (calibration) {
          setCalibrationState(prev => ({
            ...prev!,
            deviceCharacteristics,
            focalLength: estimatedFocalLength,
            sensorSize: estimatedSensorSize
          }));
        }

        // Detener stream
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('No se pudo acceder a la cámara para detectar características:', error);
      }
    } catch (error) {
      console.warn('Error detectando características del dispositivo:', error);
    }
  };

  const setCalibration = (data: CalibrationData) => {
    // Registrar en historial
    const historyEntry = {
      timestamp: Date.now(),
      pixelsPerMm: data.pixelsPerMm,
      accuracy: validateCalibrationData(data).accuracy,
      method: 'manual'
    };

    const updatedData = {
      ...data,
      calibrationHistory: [
        ...(calibration?.calibrationHistory || []).slice(-9), // Mantener solo últimas 10
        historyEntry
      ]
    };

    setCalibrationState(updatedData);
    
    console.log('📐 Calibración actualizada:', {
      pixelsPerMm: updatedData.pixelsPerMm,
      accuracy: historyEntry.accuracy,
      method: historyEntry.method
    });
  };

  const updateRealTimeCalibration = (adjustment: number, accuracy: number) => {
    if (!calibration) return;

    const historyEntry = {
      timestamp: Date.now(),
      pixelsPerMm: calibration.pixelsPerMm * adjustment,
      accuracy,
      method: 'realtime'
    };

    const updatedCalibration = {
      ...calibration,
      realTimeAdjustment: adjustment,
      pixelsPerMm: calibration.pixelsPerMm * adjustment,
      calibrationHistory: [
        ...calibration.calibrationHistory.slice(-9),
        historyEntry
      ]
    };

    setCalibrationState(updatedCalibration);
    
    console.log('🔄 Ajuste de calibración en tiempo real:', {
      adjustment,
      newPixelsPerMm: updatedCalibration.pixelsPerMm,
      accuracy
    });
  };

  const validateCalibration = (): { isValid: boolean; accuracy: number; issues: string[] } => {
    if (!calibration) {
      return { isValid: false, accuracy: 0, issues: ['No hay calibración configurada'] };
    }

    return validateCalibrationData(calibration);
  };

  const validateCalibrationData = (data: CalibrationData): { isValid: boolean; accuracy: number; issues: string[] } => {
    const issues: string[] = [];
    let accuracy = 1.0;

    // Validar rango de píxeles por mm
    if (data.pixelsPerMm < 2 || data.pixelsPerMm > 25) {
      issues.push(`Píxeles/mm fuera de rango válido: ${data.pixelsPerMm.toFixed(2)}`);
      accuracy *= 0.5;
    }

    // Validar distancia focal
    if (data.focalLength < 2 || data.focalLength > 10) {
      issues.push(`Distancia focal inusual: ${data.focalLength.toFixed(2)}mm`);
      accuracy *= 0.8;
    }

    // Validar tamaño del sensor
    if (data.sensorSize < 3 || data.sensorSize > 15) {
      issues.push(`Tamaño de sensor inusual: ${data.sensorSize.toFixed(2)}mm`);
      accuracy *= 0.8;
    }

    // Validar consistencia en historial
    if (data.calibrationHistory.length >= 3) {
      const recent = data.calibrationHistory.slice(-3);
      const variance = calculateVariance(recent.map(h => h.pixelsPerMm));
      const avgPixelsPerMm = recent.reduce((sum, h) => sum + h.pixelsPerMm, 0) / recent.length;
      
      if (variance / avgPixelsPerMm > 0.2) {
        issues.push('Calibración inconsistente en mediciones recientes');
        accuracy *= 0.7;
      }
    }

    // Validar características del dispositivo
    if (data.deviceCharacteristics) {
      const { resolution } = data.deviceCharacteristics;
      const expectedPixelsPerMm = estimatePixelsPerMm(resolution.width, resolution.height, data.focalLength, data.sensorSize);
      const difference = Math.abs(data.pixelsPerMm - expectedPixelsPerMm) / expectedPixelsPerMm;
      
      if (difference > 0.5) {
        issues.push('Calibración no coincide con características esperadas del dispositivo');
        accuracy *= 0.6;
      }
    }

    const isValid = issues.length === 0 && accuracy > 0.6;

    return { isValid, accuracy, issues };
  };

  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const estimatePixelsPerMm = (width: number, height: number, focalLength: number, sensorSize: number): number => {
    const diagonalPixels = Math.sqrt(width * width + height * height);
    const diagonalMm = sensorSize;
    return diagonalPixels / diagonalMm;
  };

  return (
    <CalibrationContext.Provider value={{ 
      calibration, 
      setCalibration, 
      updateRealTimeCalibration, 
      validateCalibration 
    }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;
