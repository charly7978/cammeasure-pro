import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
}

interface CalibrationContextValue {
  calibration: CalibrationData | null;
  setCalibration: (data: Partial<CalibrationData>) => void;
}

const CalibrationContext = createContext<CalibrationContextValue | null>(null);

export const CalibrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [calibration, setCal] = useState<CalibrationData>({
    focalLength: 4.0,
    sensorSize: 6.17,
    pixelsPerMm: 8,
    referenceObjectSize: 25.4,
    isCalibrated: false
  });

  const setCalibration = (data: Partial<CalibrationData>) => {
    setCal(prev => ({ ...prev, ...data }));
  };

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export { CalibrationContext };