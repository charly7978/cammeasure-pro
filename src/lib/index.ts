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

// Tipos básicos
export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProcessingResult {
  success: boolean;
  data: any;
  processingTime: number;
  error?: string;
}

// Utilidades de procesamiento de imagen
export const createImageData = (width: number, height: number): ImageData => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D');
  
  canvas.width = width;
  canvas.height = height;
  
  return ctx.createImageData(width, height);
};

export const imageDataToCanvas = (imageData: ImageData): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D');
  
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const canvasToImageData = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D');
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

// Utilidades matemáticas
export const calculateDistance = (p1: Point2D, p2: Point2D): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const calculateArea = (points: Point2D[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
};

export const calculatePerimeter = (points: Point2D[]): number => {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const distance = calculateDistance(points[i], points[j]);
    perimeter += distance;
  }
  
  return perimeter;
};

// Utilidades de validación
export const isValidImageData = (imageData: any): boolean => {
  return (
    imageData &&
    imageData.data &&
    ArrayBuffer.isView(imageData.data) &&
    imageData.width > 0 &&
    imageData.height > 0 &&
    imageData.data.length === imageData.width * imageData.height * 4
  );
};

export const isValidContour = (contour: any): boolean => {
  return (
    contour &&
    contour.points &&
    Array.isArray(contour.points) &&
    contour.points.length >= 3 &&
    contour.boundingBox &&
    typeof contour.area === 'number' &&
    typeof contour.perimeter === 'number'
  );
};

// Constantes de configuración
export const DEFAULT_CONFIG = {
  edgeDetection: {
    kernelSize: 3,
    sigma: 1.0,
    lowThreshold: 50,
    highThreshold: 150
  },
  contourDetection: {
    minArea: 100,
    maxArea: 1000000,
    minPerimeter: 50,
    confidenceThreshold: 0.6
  },
  measurement: {
    enable3D: true,
    enableAdvancedProperties: true,
    precision: 2,
    units: 'mm'
  }
};

// Función de inicialización del sistema
export const initializeSystem = async (): Promise<boolean> => {
  try {
    console.log('🚀 Inicializando sistema de medición avanzado...');
    
    // Verificar compatibilidad del navegador
    if (!window.HTMLCanvasElement || !window.CanvasRenderingContext2D) {
      throw new Error('Canvas 2D no soportado');
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('API de cámara no soportada');
    }
    
    console.log('✅ Sistema inicializado correctamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error inicializando sistema:', error);
    return false;
  }
};

// Función de limpieza del sistema
export const cleanupSystem = (): void => {
  try {
    console.log('🧹 Limpiando sistema...');
    
    // Limpiar recursos si es necesario
    // Por ahora solo logging
    
    console.log('✅ Sistema limpiado');
  } catch (error) {
    console.error('❌ Error limpiando sistema:', error);
  }
};
