// EXPORTACIÓN CENTRALIZADA - TODOS LOS TIPOS Y ALGORITMOS
// Este archivo centraliza todas las exportaciones para evitar duplicaciones

// ============================================================================
// EXPORTACIÓN DE TIPOS
// ============================================================================
export * from './types';

// ============================================================================
// EXPORTACIÓN DE ALGORITMOS UNIFICADOS
// ============================================================================
export { unifiedOpenCV } from './unifiedOpenCVSystem';
export { detectObjectsWithOpenCV } from './opencv';
export { real3DDepthCalculator, calculateDepthFromStereo, calculateObjectDepth, setSGBMParameters, calibrateSystem } from './realDepthCalculation';

// ============================================================================
// EXPORTACIÓN DE CONTEXTO
// ============================================================================
export { RealCalibrationProvider } from './calibrationContext';
