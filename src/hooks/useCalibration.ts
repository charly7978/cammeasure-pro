import { useRealCalibration } from '@/lib/calibrationContext';

/**
 * Custom hook to access the calibration context.
 * Provides an easy way to get calibration data and state across the app.
 *
 * @returns The calibration context value.
 * @throws An error if used outside of a CalibrationProvider.
 */
export const useCalibration = () => {
  const { calibrationData, setCalibrationData } = useRealCalibration();
  
  return {
    calibration: calibrationData,
    setCalibration: setCalibrationData
  };
};
