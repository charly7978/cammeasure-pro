import { useContext } from 'react';
import { CalibrationContext } from '@/lib/calibrationContext';

/**
 * Custom hook to access the calibration context.
 * Provides an easy way to get calibration data and state across the app.
 *
 * @returns The calibration context value.
 * @throws An error if used outside of a CalibrationProvider.
 */
export const useCalibration = () => {
  const context = useContext(CalibrationContext);
  if (context === undefined) {
    throw new Error('useCalibration must be used within a CalibrationProvider');
  }
  return context;
};
