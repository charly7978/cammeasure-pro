// ARCHIVO DE TIPOS CENTRALIZADO
// Define todas las interfaces y tipos utilizados en la aplicación

// ============================================================================
// TIPOS DE CALIBRACIÓN
// ============================================================================

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  calibrationMethod: 'manual' | 'auto' | 'camera' | 'reference';
  cameraMatrix: number[][];
  distortionCoefficients: number[];
  imageSize: { width: number; height: number };
  realWorldScale: number;
  lastCalibrationDate?: string;
}

// ============================================================================
// TIPOS DE DETECCIÓN
// ============================================================================

export interface DetectedObject {
  id: string;
  contour: ContourPoint[];
  center: Point2D;
  boundingBox: BoundingBox;
  area: number;
  perimeter: number;
  confidence: number;
  type: 'object' | 'edge' | 'contour';
  properties: {
    circularity: number;
    compactness: number;
    solidity: number;
    extent: number;
    aspectRatio: number;
  };
  dimensions: {
    width: number;
    height: number;
    area: number;
    unit: string;
  };
  points?: ContourPoint[];
}

export interface ContourPoint {
  x: number;
  y: number;
}

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

// ============================================================================
// TIPOS DE MEDICIÓN
// ============================================================================

export interface MeasurementResult {
  objectId: string;
  dimensions: {
    width: number;
    height: number;
    area: number;
    perimeter: number;
  };
  realWorldDimensions: {
    widthMm: number;
    heightMm: number;
    areaMm2: number;
    perimeterMm: number;
  };
  shapeProperties: {
    circularity: number;
    compactness: number;
    solidity: number;
    extent: number;
    aspectRatio: number;
  };
  confidence: number;
  timestamp: string;
  processingTime: number;
}

// ============================================================================
// TIPOS DE PROCESAMIENTO DE IMAGEN
// ============================================================================

export interface ImageProcessingResult {
  success: boolean;
  data: any;
  processingTime: number;
  error?: string;
}

export interface EdgeDetectionResult {
  edges: Uint8ClampedArray;
  gradientMagnitude: Float32Array;
  gradientDirection: Float32Array;
  processingTime: number;
}

export interface ContourDetectionResult {
  contours: ContourPoint[][];
  hierarchy: any[];
  processingTime: number;
  confidence: number;
}

// ============================================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================================

export interface DetectionParams {
  algorithm: 'sobel' | 'canny' | 'laplacian' | 'scharr';
  threshold: number;
  sensitivity: number;
  maxObjects: number;
  minArea: number;
  maxArea: number;
}

export interface MeasurementParams {
  units: 'mm' | 'cm' | 'm' | 'in';
  precision: number;
  includeShapeProperties: boolean;
  include3D: boolean;
  calibrationData: CalibrationData;
}

// ============================================================================
// TIPOS DE ESTADO
// ============================================================================

export interface DetectionState {
  isDetecting: boolean;
  detectedObjects: DetectedObject[];
  confidence: number;
  error: string | null;
  processingTime: number;
}

export interface MeasurementState {
  isCalculating: boolean;
  currentMeasurements: MeasurementResult | null;
  measurementHistory: MeasurementResult[];
  error: string | null;
  processingTime: number;
}

// ============================================================================
// TIPOS DE EVENTOS
// ============================================================================

export interface TouchEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'touch' | 'click';
}

export interface ObjectSelectionEvent {
  object: DetectedObject;
  touchPoint: Point2D;
  timestamp: number;
}

// ============================================================================
// TIPOS DE CONFIGURACIÓN DE CÁMARA
// ============================================================================

export interface CameraConfig {
  width: number;
  height: number;
  fps: number;
  facingMode: 'user' | 'environment';
  aspectRatio: number;
}

export interface DeviceInfo {
  model: string;
  platform: string;
  cameraCount: number;
  maxResolution: { width: number; height: number };
  hasGyroscope: boolean;
  hasAccelerometer: boolean;
}
