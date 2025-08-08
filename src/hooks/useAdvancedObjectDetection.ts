/**
 * HOOK PARA DETECCIÓN AVANZADA DE OBJETOS
 * Interfaz React para el sistema de detección profesional
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectedObject } from '../workers/advancedObjectDetection';

export interface DetectionCapabilities {
  hasOpenCV: boolean;
  supportedFeatures: string[];
  maxObjectsPerFrame: number;
  minConfidence: number;
}

export interface DetectionMetadata {
  processingTime: number;
  algorithm: 'OpenCV' | 'Native';
  objectCount: number;
  averageConfidence: number;
}

export interface DetectionConfig {
  enableMultiScale?: boolean;
  enableTemporalConsistency?: boolean;
  minConfidence?: number;
  maxObjects?: number;
  processingMode?: 'fast' | 'balanced' | 'accurate';
}

export interface UseAdvancedObjectDetectionReturn {
  // Estado
  isInitialized: boolean;
  isProcessing: boolean;
  capabilities: DetectionCapabilities | null;
  lastDetection: DetectedObject[];
  lastMetadata: DetectionMetadata | null;
  error: string | null;
  
  // Funciones
  detectObjects: (imageData: ImageData, config?: DetectionConfig) => Promise<DetectedObject[]>;
  calibrateDetection: (imageData: ImageData, referenceSize: number) => Promise<void>;
  analyzeShape: (imageData: ImageData, region?: { x: number; y: number; width: number; height: number }) => Promise<any>;
  resetDetection: () => void;
  
  // Estadísticas
  getPerformanceStats: () => {
    averageProcessingTime: number;
    totalDetections: number;
    successRate: number;
  };
}

export const useAdvancedObjectDetection = (): UseAdvancedObjectDetectionReturn => {
  // Estados
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capabilities, setCapabilities] = useState<DetectionCapabilities | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectedObject[]>([]);
  const [lastMetadata, setLastMetadata] = useState<DetectionMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Referencias
  const workerRef = useRef<Worker | null>(null);
  const performanceStatsRef = useRef({
    processingTimes: [] as number[],
    totalDetections: 0,
    successfulDetections: 0
  });
  
  // Inicialización del worker
  useEffect(() => {
    initializeWorker();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);
  
  const initializeWorker = useCallback(async () => {
    try {
      // Crear worker desde el archivo de detección avanzada
      workerRef.current = new Worker(
        new URL('../workers/advancedObjectDetection.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Configurar manejadores de mensajes
      workerRef.current.onmessage = handleWorkerMessage;
      workerRef.current.onerror = handleWorkerError;
      
      // Inicializar el worker
      workerRef.current.postMessage({ type: 'INIT' });
      
    } catch (error) {
      console.error('❌ Error inicializando worker de detección:', error);
      setError('Error al inicializar el sistema de detección');
    }
  }, []);
  
  const handleWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, ...data } = event.data;
    
    switch (type) {
      case 'INITIALIZED':
        setIsInitialized(true);
        setCapabilities(data.capabilities);
        setError(null);
        console.log('✅ Sistema de detección inicializado:', data.capabilities);
        break;
        
      case 'OBJECTS_DETECTED':
        setIsProcessing(false);
        setLastDetection(data.objects);
        setLastMetadata(data.metadata);
        setError(null);
        
        // Actualizar estadísticas de rendimiento
        updatePerformanceStats(data.metadata);
        break;
        
      case 'DETECTION_ERROR':
        setIsProcessing(false);
        setError(data.error);
        console.error('❌ Error en detección:', data.error);
        break;
        
      case 'CALIBRATION_COMPLETE':
        setIsProcessing(false);
        console.log('✅ Calibración completada');
        break;
        
      case 'SHAPE_ANALYSIS_COMPLETE':
        setIsProcessing(false);
        console.log('✅ Análisis de forma completado:', data.analysis);
        break;
    }
  }, []);
  
  const handleWorkerError = useCallback((error: ErrorEvent) => {
    console.error('❌ Error del worker:', error);
    setError('Error interno del sistema de detección');
    setIsProcessing(false);
  }, []);
  
  const updatePerformanceStats = useCallback((metadata: DetectionMetadata) => {
    const stats = performanceStatsRef.current;
    
    stats.processingTimes.push(metadata.processingTime);
    stats.totalDetections++;
    
    if (metadata.objectCount > 0) {
      stats.successfulDetections++;
    }
    
    // Mantener solo las últimas 100 mediciones para el promedio
    if (stats.processingTimes.length > 100) {
      stats.processingTimes.shift();
    }
  }, []);
  
  // Función principal de detección
  const detectObjects = useCallback(async (
    imageData: ImageData, 
    config?: DetectionConfig
  ): Promise<DetectedObject[]> => {
    if (!isInitialized || !workerRef.current) {
      throw new Error('Sistema de detección no inicializado');
    }
    
    if (isProcessing) {
      console.warn('⚠️ Detección ya en progreso, ignorando nueva solicitud');
      return lastDetection;
    }
    
    setIsProcessing(true);
    setError(null);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        setIsProcessing(false);
        reject(new Error('Timeout en detección de objetos'));
      }, 10000); // 10 segundos de timeout
      
      const originalOnMessage = workerRef.current!.onmessage;
      
      workerRef.current!.onmessage = (event) => {
        if (event.data.type === 'OBJECTS_DETECTED') {
          clearTimeout(timeout);
          workerRef.current!.onmessage = originalOnMessage;
          resolve(event.data.objects);
        } else if (event.data.type === 'DETECTION_ERROR') {
          clearTimeout(timeout);
          workerRef.current!.onmessage = originalOnMessage;
          reject(new Error(event.data.error));
        } else {
          // Pasar otros mensajes al manejador original
          originalOnMessage?.(event);
        }
      };
      
      workerRef.current!.postMessage({
        type: 'DETECT',
        imageData,
        config: {
          enableMultiScale: true,
          enableTemporalConsistency: true,
          minConfidence: 0.3,
          maxObjects: 5,
          processingMode: 'balanced',
          ...config
        }
      });
    });
  }, [isInitialized, isProcessing, lastDetection]);
  
  // Función de calibración
  const calibrateDetection = useCallback(async (
    imageData: ImageData, 
    referenceSize: number
  ): Promise<void> => {
    if (!isInitialized || !workerRef.current) {
      throw new Error('Sistema de detección no inicializado');
    }
    
    setIsProcessing(true);
    setError(null);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        setIsProcessing(false);
        reject(new Error('Timeout en calibración'));
      }, 15000);
      
      const originalOnMessage = workerRef.current!.onmessage;
      
      workerRef.current!.onmessage = (event) => {
        if (event.data.type === 'CALIBRATION_COMPLETE') {
          clearTimeout(timeout);
          workerRef.current!.onmessage = originalOnMessage;
          resolve();
        } else {
          originalOnMessage?.(event);
        }
      };
      
      workerRef.current!.postMessage({
        type: 'CALIBRATE',
        imageData,
        config: { referenceSize }
      });
    });
  }, [isInitialized]);
  
  // Función de análisis de forma
  const analyzeShape = useCallback(async (
    imageData: ImageData,
    region?: { x: number; y: number; width: number; height: number }
  ): Promise<any> => {
    if (!isInitialized || !workerRef.current) {
      throw new Error('Sistema de detección no inicializado');
    }
    
    setIsProcessing(true);
    setError(null);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        setIsProcessing(false);
        reject(new Error('Timeout en análisis de forma'));
      }, 10000);
      
      const originalOnMessage = workerRef.current!.onmessage;
      
      workerRef.current!.onmessage = (event) => {
        if (event.data.type === 'SHAPE_ANALYSIS_COMPLETE') {
          clearTimeout(timeout);
          workerRef.current!.onmessage = originalOnMessage;
          resolve(event.data.analysis);
        } else {
          originalOnMessage?.(event);
        }
      };
      
      workerRef.current!.postMessage({
        type: 'ANALYZE_SHAPE',
        imageData,
        config: { region }
      });
    });
  }, [isInitialized]);
  
  // Función de reset
  const resetDetection = useCallback(() => {
    setLastDetection([]);
    setLastMetadata(null);
    setError(null);
    performanceStatsRef.current = {
      processingTimes: [],
      totalDetections: 0,
      successfulDetections: 0
    };
  }, []);
  
  // Función de estadísticas de rendimiento
  const getPerformanceStats = useCallback(() => {
    const stats = performanceStatsRef.current;
    
    const averageProcessingTime = stats.processingTimes.length > 0
      ? stats.processingTimes.reduce((sum, time) => sum + time, 0) / stats.processingTimes.length
      : 0;
    
    const successRate = stats.totalDetections > 0
      ? stats.successfulDetections / stats.totalDetections
      : 0;
    
    return {
      averageProcessingTime,
      totalDetections: stats.totalDetections,
      successRate
    };
  }, []);
  
  return {
    // Estado
    isInitialized,
    isProcessing,
    capabilities,
    lastDetection,
    lastMetadata,
    error,
    
    // Funciones
    detectObjects,
    calibrateDetection,
    analyzeShape,
    resetDetection,
    
    // Estadísticas
    getPerformanceStats
  };
};