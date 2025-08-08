
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
    focalLength: 4.25, // More realistic smartphone focal length
    sensorSize: 6.17, // Standard 1/2.55" sensor diagonal
    pixelsPerMm: 12, // More conservative and realistic pixel density for measurements
    referenceObjectSize: 25.4, // 1 inch in mm (common reference)
    isCalibrated: false // Start uncalibrated to encourage proper calibration
  });

  return (
    <CalibrationContext.Provider value={{ calibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;
