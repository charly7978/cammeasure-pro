import React, { createContext, useState, ReactNode } from 'react';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  calibrationMethod?: 'manual' | 'reference' | 'auto';
  lastCalibrationDate?: string;
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
    focalLength: 4.2,
    sensorSize: 6.17,
    pixelsPerMm: 6.5, // Factor realista para cámaras móviles modernas
    referenceObjectSize: 25.4,
    isCalibrated: true, // ACTIVADO por defecto para mediciones reales
    calibrationMethod: 'auto',
    lastCalibrationDate: new Date().toISOString()
  });

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;