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
    focalLength: 4.0,
    sensorSize: 6.17,
    pixelsPerMm: 8, // Valor realista para mediciones en mm/cm
    referenceObjectSize: 25.4,
    isCalibrated: true // Activado por defecto para mostrar medidas en mm/cm
  });

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;