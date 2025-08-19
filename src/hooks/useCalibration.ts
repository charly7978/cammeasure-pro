import { useRealCalibration } from '@/lib/calibrationContext';
import { CalibrationData } from '@/lib/types';

/**
 * Custom hook to access the calibration context.
 * Provides an easy way to get calibration data and state across the app.
 *
 * @returns The calibration context value with proper typing.
 * @throws An error if used outside of a CalibrationProvider.
 */
export const useCalibration = () => {
  const context = useRealCalibration();
  
  // Convertir el contexto real a la interfaz esperada por el resto de la aplicación
  const calibration: CalibrationData | null = context.calibrationData ? {
    focalLength: 4.0, // Valor por defecto
    sensorSize: 6.17, // Valor por defecto
    pixelsPerMm: context.calibrationData.pixelsPerMm,
    referenceObjectSize: 25.4, // 1 pulgada en mm
    isCalibrated: context.calibrationData.isCalibrated,
    calibrationMethod: 'manual',
    cameraMatrix: [
      [context.calibrationData.cameraMatrix.fx, 0, context.calibrationData.cameraMatrix.cx],
      [0, context.calibrationData.cameraMatrix.fy, context.calibrationData.cameraMatrix.cy],
      [0, 0, 1]
    ],
    distortionCoefficients: [
      context.calibrationData.distortionCoeffs.k1,
      context.calibrationData.distortionCoeffs.k2,
      context.calibrationData.distortionCoeffs.p1,
      context.calibrationData.distortionCoeffs.p2,
      context.calibrationData.distortionCoeffs.k3
    ],
    imageSize: context.calibrationData.imageSize || { width: 640, height: 480 },
    realWorldScale: 1.0
  } : null;

  const setCalibration = (data: CalibrationData) => {
    // Convertir CalibrationData a RealCalibrationResult
    const realCalibrationResult = {
      cameraMatrix: {
        fx: data.cameraMatrix[0][0],
        fy: data.cameraMatrix[1][1],
        cx: data.cameraMatrix[0][2],
        cy: data.cameraMatrix[1][2]
      },
      distortionCoeffs: {
        k1: data.distortionCoefficients[0],
        k2: data.distortionCoefficients[1],
        p1: data.distortionCoefficients[2],
        p2: data.distortionCoefficients[3],
        k3: data.distortionCoefficients[4]
      },
      rotationVectors: [],
      translationVectors: [],
      reprojectionError: 0,
      pixelsPerMm: data.pixelsPerMm,
      isCalibrated: data.isCalibrated,
      confidence: 0.9
    };
    
    context.loadCalibration(realCalibrationResult);
  };

  return {
    calibration,
    setCalibration
  };
};
