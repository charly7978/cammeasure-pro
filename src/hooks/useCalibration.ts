import { useSimpleCalibration } from '@/hooks/useSimpleCalibration';

/**
 * Custom hook to access the calibration context.
 * Provides an easy way to get calibration data and state across the app.
 *
 * @returns The calibration context value.
 */
export const useCalibration = () => {
  return useSimpleCalibration();
};
