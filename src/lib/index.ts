// EXPORTACIÓN CENTRALIZADA - TODOS LOS TIPOS Y ALGORITMOS
// Este archivo centraliza todas las exportaciones para evitar duplicaciones

// ============================================================================
// EXPORTACIÓN DE TIPOS
// ============================================================================
export * from './types';

// ============================================================================
// EXPORTACIÓN DE ALGORITMOS
// ============================================================================
export { detectContoursReal, detectEdgesSobel, analyzeTextureReal, applyFilter } from './imageProcessing';
export { real3DDepthCalculator, calculateDepthFromStereo, calculateObjectDepth, setSGBMParameters, calibrateSystem } from './realDepthCalculation';

// ============================================================================
// EXPORTACIÓN DE CONTEXTO
// ============================================================================
export { RealCalibrationProvider as CalibrationProvider } from './calibrationContext';
