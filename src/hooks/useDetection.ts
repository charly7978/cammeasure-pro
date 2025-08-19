// HOOK ESPECIALIZADO PARA DETECCIÓN AVANZADA DE OBJETOS
// Integra algoritmos de detección de bordes y contornos
// Proporciona detección automática e inteligente

import { useState, useCallback, useRef, useEffect } from 'react';
import { EdgeDetectionFactory, EdgeDetectionResult } from '@/lib/algorithms/edgeDetection';
import { ContourDetectionFactory, ContourDetectionResult } from '@/lib/algorithms/contourDetection';

export interface DetectionState {
  isDetecting: boolean;
  detectedObjects: any[];
  currentFrame: ImageData | null;
  processingTime: number;
  confidence: number;
  error: string | null;
}

export interface DetectionParams {
  edgeDetectionAlgorithm: 'sobel' | 'canny' | 'laplacian' | 'scharr';
  contourDetectionAlgorithm: 'suzuki' | 'chaincode';
  imageType: 'natural' | 'artificial' | 'medical' | 'satellite';
  enableRealTime: boolean;
  processingInterval: number;
  minObjectSize: number;
  maxObjectSize: number;
  confidenceThreshold: number;
}

export interface DetectedObject {
  id: string;
  type: 'auto_detected' | 'manual_selected';
  contour: any;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: {
    x: number;
    y: number;
  };
  area: number;
  perimeter: number;
  confidence: number;
  timestamp: number;
}

export const useDetection = (params: DetectionParams = getDefaultDetectionParams()) => {
  // ESTADO DE DETECCIÓN
  const [detectionState, setDetectionState] = useState<DetectionState>({
    isDetecting: false,
    detectedObjects: [],
    currentFrame: null,
    processingTime: 0,
    confidence: 0,
    error: null
  });

  // REFERENCIAS PARA PROCESAMIENTO
  const processingRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameBufferRef = useRef<ImageData[]>([]);
  const lastDetectionRef = useRef<DetectedObject[]>([]);

  // FUNCIÓN PRINCIPAL DE DETECCIÓN
  const detectObjects = useCallback(async (
    imageData: ImageData,
    forceDetection: boolean = false
  ): Promise<DetectedObject[]> => {
    if (processingRef.current && !forceDetection) {
      return lastDetectionRef.current;
    }

    try {
      processingRef.current = true;
      setDetectionState(prev => ({ ...prev, isDetecting: true, error: null }));

      const startTime = performance.now();

      // 1. DETECCIÓN DE BORDES AVANZADA
      const edgeResult = await detectEdgesAdvanced(imageData, params.edgeDetectionAlgorithm, params.imageType);

      // 2. DETECCIÓN DE CONTORNOS AVANZADA
      const contourResult = await detectContoursAdvanced(
        edgeResult.edges,
        imageData.width,
        imageData.height,
        params.contourDetectionAlgorithm,
        params.imageType
      );

      // 3. FILTRADO Y SELECCIÓN DE OBJETOS
      const filteredObjects = filterAndSelectObjects(
        contourResult.contours,
        params.minObjectSize,
        params.maxObjectSize,
        params.confidenceThreshold
      );

      // 4. CONVERTIR A FORMATO ESTÁNDAR
      const detectedObjects = convertContoursToObjects(filteredObjects, 'auto_detected');

      const processingTime = performance.now() - startTime;

      // 5. ACTUALIZAR ESTADO
      const newState: DetectionState = {
        isDetecting: false,
        detectedObjects,
        currentFrame: imageData,
        processingTime,
        confidence: contourResult.confidence,
        error: null
      };

      setDetectionState(newState);
      lastDetectionRef.current = detectedObjects;
      processingRef.current = false;

      return detectedObjects;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido en detección';
      
      setDetectionState(prev => ({
        ...prev,
        isDetecting: false,
        error: errorMessage
      }));

      processingRef.current = false;
      throw new Error(`Fallo en detección: ${errorMessage}`);
    }
  }, [params]);

  // DETECCIÓN DE BORDES AVANZADA
  const detectEdgesAdvanced = async (
    imageData: ImageData,
    algorithm: 'sobel' | 'canny' | 'laplacian' | 'scharr',
    imageType: string
  ): Promise<EdgeDetectionResult> => {
    try {
      const detector = EdgeDetectionFactory.createDetector(algorithm);
      
      if (algorithm === 'canny') {
        // Canny es un caso especial que usa Sobel internamente
        return detector.detectEdges(imageData, {
          kernelSize: 3,
          sigma: 1.0,
          lowThreshold: 50,
          highThreshold: 150,
          enableNonMaximaSuppression: true,
          enableHysteresisThresholding: true
        });
      } else {
        return detector.detectEdges(imageData);
      }
    } catch (error) {
      console.error('Error en detección de bordes:', error);
      throw new Error(`Fallo en detección de bordes: ${error}`);
    }
  };

  // DETECCIÓN DE CONTORNOS AVANZADA
  const detectContoursAdvanced = async (
    edgeImage: Uint8Array,
    width: number,
    height: number,
    algorithm: 'suzuki' | 'chaincode',
    imageType: string
  ): Promise<ContourDetectionResult> => {
    try {
      const detector = ContourDetectionFactory.createDetector(algorithm);
      
      if (algorithm === 'chaincode') {
        return detector.findContoursWithChainCode(edgeImage, width, height);
      } else {
        return detector.findContours(edgeImage, width, height, {
          mode: 'EXTERNAL',
          method: 'CHAIN_APPROX_SIMPLE',
          minArea: 100,
          maxArea: 1000000,
          minPerimeter: 50,
          enableApproximation: true,
          approximationEpsilon: 1.0
        });
      }
    } catch (error) {
      console.error('Error en detección de contornos:', error);
      throw new Error(`Fallo en detección de contornos: ${error}`);
    }
  };

  // FILTRADO Y SELECCIÓN INTELIGENTE DE OBJETOS
  const filterAndSelectObjects = (
    contours: any[],
    minSize: number,
    maxSize: number,
    confidenceThreshold: number
  ): any[] => {
    try {
      // 1. FILTRADO POR TAMAÑO
      const sizeFiltered = contours.filter(contour => {
        const area = contour.area;
        return area >= minSize && area <= maxSize;
      });

      // 2. FILTRADO POR CONFIANZA
      const confidenceFiltered = sizeFiltered.filter(contour => 
        contour.confidence >= confidenceThreshold
      );

      // 3. ORDENAR POR IMPORTANCIA (área + confianza + centralidad)
      const sorted = confidenceFiltered.sort((a, b) => {
        const scoreA = calculateObjectImportance(a);
        const scoreB = calculateObjectImportance(b);
        return scoreB - scoreA;
      });

      // 4. SELECCIONAR OBJETOS MÁS IMPORTANTES
      const selected = sorted.slice(0, 5); // Máximo 5 objetos

      return selected;
    } catch (error) {
      console.error('Error en filtrado de objetos:', error);
      return [];
    }
  };

  // CÁLCULO DE IMPORTANCIA DEL OBJETO
  const calculateObjectImportance = (contour: any): number => {
    try {
      const { area, confidence, center } = contour;
      const { width, height } = contour.boundingBox;
      
      // Factor de tamaño (normalizado)
      const sizeFactor = Math.min(area / 10000, 1);
      
      // Factor de confianza
      const confidenceFactor = confidence;
      
      // Factor de centralidad (objetos en el centro son más importantes)
      const imageCenterX = 320; // Asumiendo imagen 640x480
      const imageCenterY = 240;
      const distanceFromCenter = Math.sqrt(
        Math.pow(center.x - imageCenterX, 2) + 
        Math.pow(center.y - imageCenterY, 2)
      );
      const centralityFactor = Math.max(0, 1 - distanceFromCenter / 400);
      
      // Factor de forma (objetos más regulares son más importantes)
      const aspectRatio = width / height;
      const shapeFactor = aspectRatio > 0.5 && aspectRatio < 2 ? 1 : 0.7;
      
      // Puntuación combinada ponderada
      const importance = (
        sizeFactor * 0.3 +
        confidenceFactor * 0.3 +
        centralityFactor * 0.2 +
        shapeFactor * 0.2
      );
      
      return importance;
    } catch (error) {
      return 0;
    }
  };

  // CONVERSIÓN DE CONTORNOS A OBJETOS DETECTADOS
  const convertContoursToObjects = (
    contours: any[],
    type: 'auto_detected' | 'manual_selected'
  ): DetectedObject[] => {
    try {
      return contours.map((contour, index) => ({
        id: `${type}_${index}_${Date.now()}`,
        type,
        contour,
        boundingBox: contour.boundingBox,
        center: contour.center,
        area: contour.area,
        perimeter: contour.perimeter,
        confidence: contour.confidence,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error en conversión de contornos:', error);
      return [];
    }
  };

  // DETECCIÓN EN TIEMPO REAL
  const startRealTimeDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (params.enableRealTime) {
      intervalRef.current = setInterval(() => {
        if (frameBufferRef.current.length > 0) {
          const latestFrame = frameBufferRef.current[frameBufferRef.current.length - 1];
          detectObjects(latestFrame);
        }
      }, params.processingInterval);
    }
  }, [params.enableRealTime, params.processingInterval, detectObjects]);

  const stopRealTimeDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // DETECCIÓN MANUAL EN PUNTO ESPECÍFICO
  const detectObjectAtPoint = useCallback(async (
    imageData: ImageData,
    x: number,
    y: number,
    radius: number = 50
  ): Promise<DetectedObject[]> => {
    try {
      // 1. DETECTAR OBJETOS EN TODA LA IMAGEN
      const allObjects = await detectObjects(imageData, true);
      
      // 2. FILTRAR OBJETOS CERCA DEL PUNTO TOCADO
      const nearbyObjects = allObjects.filter(obj => {
        const distance = Math.sqrt(
          Math.pow(obj.center.x - x, 2) + 
          Math.pow(obj.center.y - y, 2)
        );
        return distance <= radius;
      });
      
      // 3. ORDENAR POR DISTANCIA AL PUNTO
      const sortedByDistance = nearbyObjects.sort((a, b) => {
        const distanceA = Math.sqrt(
          Math.pow(a.center.x - x, 2) + 
          Math.pow(a.center.y - y, 2)
        );
        const distanceB = Math.sqrt(
          Math.pow(b.center.x - x, 2) + 
          Math.pow(b.center.y - y, 2)
        );
        return distanceA - distanceB;
      });
      
      // 4. CONVERTIR A OBJETOS MANUALES
      const manualObjects = convertContoursToObjects(
        sortedByDistance.slice(0, 3).map(obj => obj.contour),
        'manual_selected'
      );
      
      return manualObjects;
      
    } catch (error) {
      console.error('Error en detección manual:', error);
      throw new Error(`Fallo en detección manual: ${error}`);
    }
  }, [detectObjects]);

  // AGREGAR FRAME AL BUFFER
  const addFrameToBuffer = useCallback((imageData: ImageData) => {
    frameBufferRef.current.push(imageData);
    
    // Mantener solo los últimos 5 frames
    if (frameBufferRef.current.length > 5) {
      frameBufferRef.current.shift();
    }
  }, []);

  // LIMPIAR ESTADO
  const clearDetection = useCallback(() => {
    setDetectionState({
      isDetecting: false,
      detectedObjects: [],
      currentFrame: null,
      processingTime: 0,
      confidence: 0,
      error: null
    });
    lastDetectionRef.current = [];
  }, []);

  // EFECTO PARA INICIAR/DETENER DETECCIÓN EN TIEMPO REAL
  useEffect(() => {
    if (params.enableRealTime) {
      startRealTimeDetection();
    } else {
      stopRealTimeDetection();
    }

    return () => {
      stopRealTimeDetection();
    };
  }, [params.enableRealTime, startRealTimeDetection, stopRealTimeDetection]);

  // EFECTO DE LIMPIEZA
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // ESTADO
    ...detectionState,
    
    // FUNCIONES PRINCIPALES
    detectObjects,
    detectObjectAtPoint,
    
    // FUNCIONES DE CONTROL
    startRealTimeDetection,
    stopRealTimeDetection,
    addFrameToBuffer,
    clearDetection,
    
    // REFERENCIAS
    frameBuffer: frameBufferRef.current,
    lastDetection: lastDetectionRef.current
  };
};

// FUNCIÓN PARA OBTENER PARÁMETROS POR DEFECTO
export const getDefaultDetectionParams = (): DetectionParams => ({
  edgeDetectionAlgorithm: 'canny',
  contourDetectionAlgorithm: 'suzuki',
  imageType: 'natural',
  enableRealTime: true,
  processingInterval: 100, // 10 FPS
  minObjectSize: 100,
  maxObjectSize: 1000000,
  confidenceThreshold: 0.6
});

// FUNCIÓN PARA OBTENER PARÁMETROS OPTIMIZADOS POR TIPO DE IMAGEN
export const getOptimizedDetectionParams = (imageType: string): DetectionParams => {
  const baseParams = getDefaultDetectionParams();
  
  switch (imageType) {
    case 'natural':
      return {
        ...baseParams,
        edgeDetectionAlgorithm: 'canny',
        contourDetectionAlgorithm: 'suzuki',
        confidenceThreshold: 0.5
      };
      
    case 'artificial':
      return {
        ...baseParams,
        edgeDetectionAlgorithm: 'sobel',
        contourDetectionAlgorithm: 'chaincode',
        confidenceThreshold: 0.7
      };
      
    case 'medical':
      return {
        ...baseParams,
        edgeDetectionAlgorithm: 'scharr',
        contourDetectionAlgorithm: 'suzuki',
        confidenceThreshold: 0.8,
        processingInterval: 200 // Más lento para mayor precisión
      };
      
    case 'satellite':
      return {
        ...baseParams,
        edgeDetectionAlgorithm: 'laplacian',
        contourDetectionAlgorithm: 'suzuki',
        confidenceThreshold: 0.6,
        minObjectSize: 50
      };
      
    default:
      return baseParams;
  }
};
