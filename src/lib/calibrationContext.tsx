// CONTEXTO SIMPLIFICADO DE CALIBRACIÓN - VERSIÓN BÁSICA FUNCIONAL
// Implementación simplificada para evitar errores de pantalla blanca

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CalibrationData } from './types';

// INTERFAZ SIMPLIFICADA DEL CONTEXTO
interface SimpleCalibrationContextType {
  calibrationData: CalibrationData | null;
  setCalibrationData: (data: CalibrationData) => void;
  isCalibrated: boolean;
  pixelsPerMm: number;
}

// CONTEXTO SIMPLIFICADO
const RealCalibrationContext = createContext<SimpleCalibrationContextType | undefined>(undefined);

// PROVEEDOR SIMPLIFICADO
export const RealCalibrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({
    focalLength: 4.0,
    sensorSize: 6.17,
    pixelsPerMm: 3.78,
    referenceObjectSize: 25.4,
    isCalibrated: false,
    calibrationMethod: 'manual',
    cameraMatrix: [[1000, 0, 320], [0, 1000, 240], [0, 0, 1]],
    distortionCoefficients: [0, 0, 0, 0, 0],
    imageSize: { width: 640, height: 480 },
    realWorldScale: 1.0
  });

  const contextValue: SimpleCalibrationContextType = {
    calibrationData,
    setCalibrationData,
    isCalibrated: calibrationData.isCalibrated,
    pixelsPerMm: calibrationData.pixelsPerMm
  };

  return (
    <RealCalibrationContext.Provider value={contextValue}>
      {children}
    </RealCalibrationContext.Provider>
  );
};

// HOOK SIMPLIFICADO
export function useRealCalibration(): SimpleCalibrationContextType {
  const context = useContext(RealCalibrationContext);
  
  if (context === undefined) {
    throw new Error('useRealCalibration debe usarse dentro de RealCalibrationProvider');
  }
  
  return context;
}
