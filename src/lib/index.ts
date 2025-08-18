// EXPORTACIÓN CENTRALIZADA - TODOS LOS TIPOS Y ALGORITMOS
// Este archivo centraliza todas las exportaciones para evitar duplicaciones

// ============================================================================
// EXPORTACIÓN DE TIPOS
// ============================================================================
export * from './types';

// ============================================================================
// EXPORTACIÓN DE ALGORITMOS
// ============================================================================
export { detectContours, detectContoursSimple } from './imageProcessing';
export { realDepthCalculator } from './realDepthCalculation';

// ============================================================================
// EXPORTACIÓN DE CONTEXTO
// ============================================================================
export { CalibrationProvider } from './calibrationContext';
