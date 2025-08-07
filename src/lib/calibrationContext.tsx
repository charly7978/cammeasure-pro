import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
}

interface CalibrationContextValue {
  calibration: CalibrationData | null;
  setCalibration: (data: CalibrationData) => void;
}

const CalibrationContext = createContext<CalibrationContextValue | undefined>(
  undefined
);

export const CalibrationProvider = ({ children }: { children: ReactNode }) => {
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export const useCalibration = () => {
  const ctx = useContext(CalibrationContext);
  if (!ctx) throw new Error('useCalibration must be used within CalibrationProvider');
  return ctx;
};
