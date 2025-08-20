// EXPORTACIÓN CENTRALIZADA - TODOS LOS TIPOS Y ALGORITMOS
// Este archivo centraliza todas las exportaciones para evitar duplicaciones

// ============================================================================
// EXPORTACIÓN DE TIPOS
// ============================================================================
export * from './types';

// ============================================================================
// EXPORTACIÓN DEL NUEVO SISTEMA ULTRA AVANZADO
// ============================================================================
export { 
  getUltraOpenCVSystem, 
  detectSilhouettes, 
  autoCalibrate, 
  measureObject,
  UltraOpenCVSystem,
  UltraSilhouetteDetector,
  UltraCalibrationSystem,
  UltraMeasurementSystem
} from './opencv';
// Exportaciones del sistema ultra avanzado ya incluidas arriba

// ============================================================================
// EXPORTACIÓN DE CONTEXTO
// ============================================================================
export { RealCalibrationProvider } from './calibrationContext';
