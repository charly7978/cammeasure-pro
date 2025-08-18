
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { CalibrationData } from './types';

interface CalibrationContextType {
  calibration: CalibrationData | null;
  setCalibration: (data: CalibrationData) => void;
  isCalibrating: boolean;
  setIsCalibrating: (calibrating: boolean) => void;
}

const defaultCalibration: CalibrationData = {
  focalLength: 4.0,
  sensorSize: 6.17,
  pixelsPerMm: 3.78,
  referenceObjectSize: 25.4,
  isCalibrated: false,
  calibrationMethod: 'manual',
  cameraMatrix: [[800, 0, 320], [0, 800, 240], [0, 0, 1]],
  distortionCoefficients: [0, 0, 0, 0, 0],
  imageSize: { width: 640, height: 480 },
  realWorldScale: 1.0
};

export const CalibrationContext = createContext<CalibrationContextType>({
  calibration: defaultCalibration,
  setCalibration: () => {},
  isCalibrating: false,
  setIsCalibrating: () => {}
});

export const CalibrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [calibration, setCalibration] = useState<CalibrationData | null>(defaultCalibration);
  const [isCalibrating, setIsCalibrating] = useState(false);

  return (
    <CalibrationContext.Provider value={{
      calibration,
      setCalibration,
      isCalibrating,
      setIsCalibrating
    }}>
      {children}
    </CalibrationContext.Provider>
  );
};
