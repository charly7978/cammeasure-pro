import { useContext } from 'react';
import { CalibrationContext } from '@/lib/calibrationContext';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
}

export const useCalibration = (): {
  calibration: CalibrationData | null;
  setCalibration: (data: Partial<CalibrationData>) => void;
} => {
  const context = useContext(CalibrationContext);
  
  if (!context) {
    throw new Error('useCalibration must be used within a CalibrationProvider');
  }
  
  return context;
};
