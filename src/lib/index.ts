// ARCHIVO DE EXPORTACIÓN CENTRALIZADO
// Exporta todos los módulos de algoritmos, hooks y componentes

// ============================================================================
// ALGORITMOS AVANZADOS
// ============================================================================

// Detección de bordes
export {
  EdgeDetectionFactory,
  SobelEdgeDetector,
  LaplacianEdgeDetector,
  ScharrEdgeDetector,
  type EdgeDetectionResult,
  type EdgeDetectionParams
} from './algorithms/edgeDetection';

// Detección de contornos
export {
  ContourDetectionFactory,
  ContourDetector,
  ChainCodeContourDetector,
  type ContourDetectionResult,
  type ContourDetectionParams,
  type Contour,
  type ContourPoint
} from './algorithms/contourDetection';

// Motor de mediciones
export {
  MeasurementFactory,
  AdvancedMeasurementEngine,
  type MeasurementResult,
  type MeasurementParams
} from './algorithms/measurementEngine';

// ============================================================================
// HOOKS ESPECIALIZADOS
// ============================================================================

// Hook de detección
export {
  useDetection,
  getDefaultDetectionParams,
  getOptimizedDetectionParams,
  type DetectionState,
  type DetectionParams,
  type DetectedObject
} from '../hooks/useDetection';

// Hook de mediciones
export {
  useMeasurement,
  getDefaultMeasurementConfig,
  getOptimizedMeasurementConfig,
  createEmptyMeasurementResult,
  type MeasurementState,
  type MeasurementConfig,
  type MeasurementRequest
} from '../hooks/useMeasurement';

// Hook de calibración
export { useCalibration } from '../hooks/useCalibration';

// ============================================================================
// COMPONENTES REFACTORIZADOS
// ============================================================================

// Componente principal de cámara
export { CameraView } from '../components/CameraView';

// Componentes auxiliares
export { CameraControls } from '../components/CameraControls';
export { DetectionOverlay } from '../components/DetectionOverlay';
export { MeasurementDisplay } from '../components/MeasurementDisplay';
export { TouchObjectSelector } from '../components/TouchObjectSelector';

// ============================================================================
// TIPOS Y UTILIDADES
// ============================================================================

// Exportar todos los tipos desde el archivo centralizado
export * from './types';

// Exportar utilidades desde el archivo centralizado
export {
  createImageData,
  imageDataToCanvas,
  canvasToImageData,
  calculateDistance,
  calculateArea,
  calculatePerimeter,
  isValidImageData,
  isValidContour,
  DEFAULT_CONFIG,
  initializeSystem,
  cleanupSystem
} from './utils';
