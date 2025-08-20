/**
 * SISTEMA OPENCV ULTRA AVANZADO - EXPORTACIONES UNIFICADAS
 * Punto de entrada principal para todo el sistema de detección y medición
 */

// Exportar el sistema principal unificado
export { UltraOpenCVSystem } from './UltraOpenCVSystem';
export type { UltraOpenCVResult, UltraOpenCVSettings } from './UltraOpenCVSystem';

// Exportar el detector de siluetas ultra avanzado
export { UltraSilhouetteDetector } from './UltraSilhouetteDetector';
export type { UltraSilhouetteResult, CalibrationData, DetectionParameters } from './UltraSilhouetteDetector';

// Exportar el sistema de calibración ultra preciso
export { UltraCalibrationSystem } from './UltraCalibrationSystem';
export type { CalibrationResult, CalibrationSettings } from './UltraCalibrationSystem';

// Exportar el sistema de medición ultra preciso
export { UltraMeasurementSystem } from './UltraMeasurementSystem';
export type { MeasurementResult, MeasurementSettings } from './UltraMeasurementSystem';

// Función de conveniencia para obtener el sistema completo
export const getUltraOpenCVSystem = () => {
  const { UltraOpenCVSystem } = require('./UltraOpenCVSystem');
  return UltraOpenCVSystem.getInstance();
};

// Función de conveniencia para detección rápida
export const detectSilhouettes = async (imageData: ImageData) => {
  const { UltraSilhouetteDetector } = require('./UltraSilhouetteDetector');
  const detector = UltraSilhouetteDetector.getInstance();
  return detector.detectSilhouettes(imageData);
};

// Función de conveniencia para calibración rápida
export const autoCalibrate = async (imageData: ImageData) => {
  const { UltraCalibrationSystem } = require('./UltraCalibrationSystem');
  const calibration = UltraCalibrationSystem.getInstance();
  return calibration.autoCalibrate(imageData);
};

// Función de conveniencia para medición rápida
export const measureObject = async (object: any, calibration: any) => {
  const { UltraMeasurementSystem } = require('./UltraMeasurementSystem');
  const measurement = UltraMeasurementSystem.getInstance();
  return measurement.measureObject(object, calibration);
};