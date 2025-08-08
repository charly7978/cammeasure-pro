
import React, { createContext, useState, ReactNode } from 'react';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
}

interface CalibrationContextValue {
  calibration: CalibrationData | null;
  setCalibration: (data: CalibrationData) => void;
}

export const CalibrationContext = createContext<CalibrationContextValue | undefined>(
  undefined
);

export const CalibrationProvider = ({ children }: { children: ReactNode }) => {
  const [calibration, setCalibration] = useState<CalibrationData | null>({
    focalLength: 4.25, // Focal length realista de smartphone
    sensorSize: 6.17, // Sensor diagonal estándar 1/2.55"
    pixelsPerMm: 8.0, // Factor corregido más realista para 30cm de distancia
    referenceObjectSize: 25.4, // 1 pulgada en mm (referencia común)
    isCalibrated: false // Empezar sin calibrar para forzar calibración adecuada
  });

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;
