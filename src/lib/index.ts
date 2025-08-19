// EXPORTACIÓN CENTRALIZADA - TODOS LOS TIPOS Y ALGORITMOS
// Este archivo centraliza todas las exportaciones para evitar duplicaciones

// ============================================================================
// EXPORTACIÓN DE TIPOS
// ============================================================================
export * from './types';

// ============================================================================
// EXPORTACIÓN DE ALGORITMOS
// ============================================================================
// EXPORTAR FUNCIONES AVANZADAS DE PROCESAMIENTO DE IMAGEN
export { 
  detectContoursReal, 
  detectEdgesSobel, 
  analyzeTextureReal, 
  applyFilter,
  // NUEVAS FUNCIONES AVANZADAS
  applyCLAHE,
  applyBilateralFilter,
  detectGaborEdges,
  detectAdvancedCanny,
  applyGaussianBlur
} from './imageProcessing';

// EXPORTAR FUNCIONES DE CÁLCULO 3D AVANZADAS
export { 
  real3DDepthCalculator, 
  calculateDepthFromStereo, 
  calculateObjectDepth, 
  setSGBMParameters, 
  calibrateSystem,
  // NUEVAS FUNCIONES 3D
  calculateInvariantMoments,
  analyzeLocalTexture,
  estimate3DDepth
} from './realDepthCalculation';

// ============================================================================
// EXPORTACIÓN DE CONTEXTO
// ============================================================================
export { CalibrationProvider } from './calibrationContext';
