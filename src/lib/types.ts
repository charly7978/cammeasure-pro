// TIPOS CENTRALIZADOS - ELIMINACIÓN COMPLETA DE DUPLICACIONES
// Todas las interfaces y tipos de la aplicación en un solo lugar

// ============================================================================
// INTERFACES DE MEDICIÓN UNIFICADAS
// ============================================================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
  confidence: number;
  timestamp: number;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence?: number;
  
  // Propiedades geométricas avanzadas
  circularity?: number;
  solidity?: number;
  extent?: number;
  aspectRatio?: number;
  compactness?: number;
  perimeter?: number;
  contourPoints?: number;
  centerX?: number;
  centerY?: number;
  huMoments?: number[];
  isConvex?: boolean;
  boundingCircleRadius?: number;
  
  // Propiedades avanzadas
  textureFeatures?: {
    haralickFeatures: number[];
    lbpFeatures: number[];
    gaborFeatures: number[];
    cooccurrenceMatrix: number[][];
  };
  
  shapeDescriptors?: {
    fourierDescriptors: number[];
    zernikeMoments: number[];
    chebyshevMoments: number[];
    legendreMoments: number[];
  };
  
  semanticFeatures?: {
    objectClass: string;
    classConfidence: number;
    semanticSegmentation: Uint8Array;
    instanceMask: Uint8Array;
  };
}

export interface Dimensions {
  width: number;
  height: number;
  area: number;
  unit: string;
  perimeter?: number;
}

export interface DetectedObject extends BoundingRect {
  points: Point3D[];
  id: string;
  type: string;
  depth?: number;
  realWidth?: number;
  realHeight?: number;
  volume?: number;
  surfaceArea?: number;
  curvature?: number;
  roughness?: number;
  
  // Propiedades de contornos y siluetas
  contours?: Array<{x: number, y: number}>;
  silhouette?: Array<{x: number, y: number}> | number[][];
  
  // Propiedades de bounding box y dimensiones
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  dimensions: Dimensions;
  isReal3D?: boolean;
  measurements3D?: {
    width3D: number;
    height3D: number;
    depth3D: number;
    volume3D: number;
    distance: number;
    confidence: number;
  };
  
  // MEDICIONES 3D REALES
  depth3D?: {
    distance: number;    // Distancia a la cámara en mm
    depth: number;       // Profundidad del objeto en mm
    volume: number;      // Volumen estimado en mm³
    confidence: number;  // Confianza de la medición 3D
    method: 'stereo' | 'monocular' | 'estimated';
  };
  
  // Propiedades geométricas adicionales
  geometricProperties?: {
    aspectRatio: number;
    solidity: number;
    circularity: number;
    perimeter: number;
  };
  
  orientation?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  
  materialProperties?: {
    refractiveIndex: number;
    scatteringCoefficient: number;
    absorptionCoefficient: number;
    density: number;
    elasticity: number;
  };
}

export interface AdvancedMeasurementResult {
  // Identificación del objeto
  objectId: string;
  timestamp: number;
  
  // Mediciones 2D
  measurements2D: {
    width: number;
    height: number;
    area: number;
    perimeter: number;
    circularity: number;
    solidity: number;
    aspectRatio: number;
    compactness: number;
    confidence: number;
  };
  
  // Mediciones 3D
  measurements3D: {
    width3D: number;
    height3D: number;
    depth3D: number;
    volume3D: number;
    distance3D: number;
    surfaceArea3D: number;
    confidence: number;
  };
  
  // Propiedades avanzadas
  advancedProperties: {
    curvature: number;
    roughness: number;
    orientation: {
      pitch: number;
      yaw: number;
      roll: number;
    };
    materialProperties: {
      refractiveIndex: number;
      scatteringCoefficient: number;
      absorptionCoefficient: number;
      density: number;
      elasticity: number;
    };
  };
  
  // Análisis de incertidumbre
  uncertainty: {
    measurement: number;
    calibration: number;
    algorithm: number;
    stereo: number;
    total: number;
  };
  
  // Metadatos del algoritmo
  algorithm: string;
  processingTime: number;
  frameRate: number;
  qualityMetrics: {
    imageQuality: number;
    detectionQuality: number;
    depthQuality: number;
    reconstructionQuality: number;
  };
  
  // Datos de calibración
  calibration: {
    isCalibrated: boolean;
    calibrationQuality: number;
    lastCalibration: number;
    calibrationUncertainty: number;
  };
}

export interface Advanced3DMeasurement {
  // Mediciones 3D básicas
  width3D: number;
  height3D: number;
  depth3D: number;
  volume3D: number;
  distance3D: number;
  surfaceArea3D: number;
  
  // Propiedades geométricas avanzadas
  curvature: number;
  roughness: number;
  orientation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  
  // Propiedades de material
  materialProperties: {
    refractiveIndex: number;
    scatteringCoefficient: number;
    absorptionCoefficient: number;
    density: number;
    elasticity: number;
  };
  
  // Análisis de incertidumbre 3D
  uncertainty3D: {
    measurement: number;
    calibration: number;
    algorithm: number;
    stereo: number;
    total: number;
  };
  
  // Metadatos del algoritmo
  algorithm: string;
  processingTime: number;
  confidence: number;
  qualityMetrics: {
    stereoQuality: number;
    depthAccuracy: number;
    reconstructionQuality: number;
    pointCloudDensity: number;
  };
  
  // Nube de puntos 3D
  pointCloud: {
    points: number[][];
    colors: number[][];
    normals: number[][];
    confidence: number[];
  };
  
  // Malla 3D reconstruida
  mesh3D: {
    vertices: number[][];
    faces: number[][];
    uvs: number[][];
    normals: number[][];
  };
}

export interface RealTimeMeasurement {
  width: number;
  height: number;
  area: number;
  perimeter: number;
  circularity: number;
  solidity: number;
  confidence: number;
  
  // Propiedades avanzadas
  depth?: number;
  volume?: number;
  surfaceArea?: number;
  curvature?: number;
  roughness?: number;
  
  orientation?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  
  // Análisis de material
  materialProperties?: {
    refractiveIndex: number;
    scatteringCoefficient: number;
    absorptionCoefficient: number;
  };
  
  // Incertidumbre
  uncertainty: {
    measurement: number;
    calibration: number;
    algorithm: number;
    total: number;
  };
  
  // Metadatos del algoritmo
  algorithm: string;
  processingTime: number;
  frameRate: number;
  qualityMetrics: {
    sharpness: number;
    contrast: number;
    noise: number;
    blur: number;
  };
}

// ============================================================================
// INTERFACES DE CALIBRACIÓN UNIFICADAS
// ============================================================================

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  calibrationMethod: 'manual' | 'reference' | 'auto';
  lastCalibrationDate?: string;
  
  // Parámetros avanzados reales
  cameraMatrix: number[][];
  distortionCoefficients: number[];
  imageSize: { width: number; height: number };
  realWorldScale: number;
}

// ============================================================================
// INTERFACES DE CONFIGURACIÓN UNIFICADAS
// ============================================================================

export interface AdvancedMeasurementConfig {
  // Configuración de algoritmos
  enableMultiScale: boolean;
  enableTextureAnalysis: boolean;
  enableShapeAnalysis: boolean;
  enableSemanticSegmentation: boolean;
  enableDepthEstimation: boolean;
  enableMLEnhancement: boolean;
  
  // Parámetros de procesamiento
  processingQuality: 'low' | 'medium' | 'high' | 'ultra';
  temporalBufferSize: number;
  confidenceThreshold: number;
  uncertaintyThreshold: number;
  
  // Configuración de ML
  mlModelPath?: string;
  enableRealTimeLearning: boolean;
  adaptiveThresholds: boolean;
}

// ============================================================================
// INTERFACES DE WORKER UNIFICADAS
// ============================================================================

export interface MeasurementWorkerMessage {
  type: 'INIT' | 'DETECT' | 'MEASURE' | 'ANALYZE' | 'CALIBRATE';
  taskId: string;
  data: any;
  timestamp: number;
}

export interface MeasurementWorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  taskId: string;
  data?: any;
  error?: string;
  progress?: number;
  timestamp: number;
}

export interface DetectionResult {
  taskId: string;
  objects: DetectedObject[];
  processingTime: number;
  algorithm: 'advanced_native' | 'ml_enhanced';
  confidence: number;
  metadata: {
    textureAnalysis: boolean;
    shapeAnalysis: boolean;
    semanticAnalysis: boolean;
    depthEstimation: boolean;
  };
}

// ============================================================================
// INTERFACES DE OPENCV UNIFICADAS
// ============================================================================

export interface OpenCVFunctions {
  // Funciones de procesamiento de imagen
  cvtColor: (src: ImageData, dst: ImageData, code: number) => void;
  GaussianBlur: (src: ImageData, dst: ImageData, ksize: number[], sigma: number) => void;
  Canny: (src: ImageData, dst: ImageData, threshold1: number, threshold2: number) => void;
  findContours: (src: ImageData, contours: any[], hierarchy: any[], mode: number, method: number) => void;
  contourArea: (contour: any) => number;
  boundingRect: (contour: any) => { x: number; y: number; width: number; height: number };
  arcLength: (contour: any, closed: boolean) => number;
  moments: (contour: any) => { m00: number; m10: number; m01: number };
  isContourConvex: (contour: any) => boolean;
  minEnclosingCircle: (contour: any) => { center: { x: number; y: number }; radius: number };
  convexHull: (contour: any, hull: any, clockwise: boolean, returnPoints: boolean) => void;
  HuMoments: (moments: any) => Float32Array;
  
  // Constantes
  COLOR_RGBA2GRAY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  MORPH_RECT: number;
  MORPH_CLOSE: number;
  MORPH_ELLIPSE: number;
  
  // Funciones de estructura
  getStructuringElement: (shape: number, size: number[]) => any;
  morphologyEx: (src: ImageData, dst: ImageData, op: number, kernel: any) => void;
  dilate: (src: ImageData, dst: ImageData, kernel: any, anchor: any, iterations: number) => void;
  equalizeHist: (src: ImageData, dst: ImageData) => void;
  
  // Funciones de filtrado
  bilateralFilter: (src: ImageData, dst: ImageData, d: number, sigmaColor: number, sigmaSpace: number) => void;
  CLAHE: (clipLimit: number, tileGridSize: number[]) => any;
}

// ============================================================================
// INTERFACES DE PROFUNDIDAD UNIFICADAS
// ============================================================================

export interface DepthMap {
  width: number;
  height: number;
  depths: Float64Array;
  confidence: Float64Array;
  uncertainty: Float64Array;
  phaseMap: Float64Array;
  disparityMap: Float64Array;
  opticalFlow: Float64Array;
}

export interface RealMeasurement3D {
  width3D: number;
  height3D: number;
  depth3D: number;
  volume3D: number;
  distance: number;
  points3D: Point3D[];
  confidence: number;
  surfaceArea: number;
  orientation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  curvature: number;
  roughness: number;
  materialProperties: {
    refractiveIndex: number;
    scatteringCoefficient: number;
    absorptionCoefficient: number;
  };
}

// ============================================================================
// TIPOS DE MEDICIÓN UNIFICADOS
// ============================================================================

export type MeasurementMode = '2d' | '3d' | 'depth' | 'area' | 'volume';

export interface MeasurementPoint {
  x: number;
  y: number;
  distance?: number;
  confidence?: number;
}

export interface MeasurementResult {
  mode: MeasurementMode;
  points: MeasurementPoint[];
  measurements: {
    width?: number;
    height?: number;
    area?: number;
    volume?: number;
    distance?: number;
  };
  // Propiedades adicionales para compatibilidad
  area?: number;
  volume?: number;
  distance2D?: number;
  distance3D?: number;
  unit?: string;
  timestamp: number;
  confidence: number;
}
