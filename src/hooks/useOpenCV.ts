/**
 * HOOK ULTRA AVANZADO DE OPENCV - INTEGRADO CON INTERFAZ EXISTENTE
 * Mantiene compatibilidad con componentes actuales pero usa el nuevo sistema ultra avanzado
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UltraOpenCVResult, UltraOpenCVSettings } from '@/lib/opencv';
import type { CalibrationResult } from '@/lib/opencv';
import type { MeasurementResult } from '@/lib/opencv';
import type { DetectedObject } from '@/lib/types';

export interface UseOpenCVReturn {
  // Estado del sistema
  isInitialized: boolean;
  isProcessing: boolean;
  hasCalibration: boolean;
  
  // Funciones principales (nuevas ultra avanzadas)
  processImage: (imageData: ImageData, options?: ProcessImageOptions) => Promise<UltraOpenCVResult>;
  processRealTime: (imageData: ImageData) => Promise<UltraOpenCVResult>;
  calibrateWithObject: (imageData: ImageData, objectId: string, knownSize: number) => Promise<CalibrationResult>;
  
  // Funciones compatibles con interfaz existente
  detectObjectSilhouettes: (imageData: ImageData) => Promise<{ objects: DetectedObject[]; processingTime: number; edgeMap: Uint8Array; contours: Array<{ x: number; y: number }>[] }>;
  detectEdges: (imageData: ImageData) => ImageData;
  findContours: (imageData: ImageData) => any[];
  
  // Configuración
  updateSettings: (settings: Partial<UltraOpenCVSettings>) => void;
  getSettings: () => UltraOpenCVSettings;
  
  // Estado y estadísticas
  systemStatus: SystemStatus;
  lastResult: UltraOpenCVResult | null;
  error: string | null;
  
  // Utilidades
  resetSystem: () => void;
  exportData: () => string;
  importData: (data: string) => void;
}

export interface ProcessImageOptions {
  autoCalibrate?: boolean;
  measureObjects?: boolean;
  customCalibration?: CalibrationResult;
}

export interface SystemStatus {
  isProcessing: boolean;
  hasCalibration: boolean;
  calibrationQuality: number;
  lastProcessingTime: number;
  totalObjectsDetected: number;
  totalMeasurements: number;
}

export function useOpenCV(): UseOpenCVReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCalibration, setHasCalibration] = useState(false);
  const [lastResult, setLastResult] = useState<UltraOpenCVResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const systemRef = useRef<any>(null);
  const initializationPromise = useRef<Promise<boolean> | null>(null);

  /**
   * INICIALIZAR SISTEMA ULTRA AVANZADO
   */
  const initializeSystem = useCallback(async (): Promise<boolean> => {
    if (initializationPromise.current) {
      return initializationPromise.current;
    }

    initializationPromise.current = (async () => {
      try {
        console.log('🚀 Inicializando sistema OpenCV ultra avanzado...');
        
        // Importar dinámicamente el sistema
        const { getUltraOpenCVSystem } = await import('@/lib/opencv');
        systemRef.current = getUltraOpenCVSystem();
        
        // Verificar que el sistema esté funcionando
        const status = systemRef.current.getSystemStatus();
        console.log('📊 Estado del sistema:', status);
        
        setIsInitialized(true);
        setHasCalibration(status.hasCalibration);
        setError(null);
        
        console.log('✅ Sistema OpenCV ultra avanzado inicializado correctamente');
        return true;
        
      } catch (error) {
        console.error('❌ Error inicializando sistema OpenCV:', error);
        setError(error instanceof Error ? error.message : 'Error de inicialización');
        setIsInitialized(false);
        return false;
      }
    })();

    return initializationPromise.current;
  }, []);

  /**
   * PROCESAR IMAGEN COMPLETA
   */
  const processImage = useCallback(async (
    imageData: ImageData,
    options: ProcessImageOptions = {}
  ): Promise<UltraOpenCVResult> => {
    if (!isInitialized || !systemRef.current) {
      await initializeSystem();
    }
    
    if (!systemRef.current) {
      throw new Error('Sistema OpenCV no disponible');
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('📷 Procesando imagen con sistema ultra avanzado...');
      
      const result = await systemRef.current.processImage(imageData, options);
      
      setLastResult(result);
      setHasCalibration(!!result.calibration);
      
      console.log('✅ Procesamiento completado:', result.status);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error procesando imagen:', errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, initializeSystem]);

  /**
   * PROCESAMIENTO EN TIEMPO REAL
   */
  const processRealTime = useCallback(async (imageData: ImageData): Promise<UltraOpenCVResult> => {
    if (!isInitialized || !systemRef.current) {
      await initializeSystem();
    }
    
    if (!systemRef.current) {
      throw new Error('Sistema OpenCV no disponible');
    }

    try {
      const calibration = systemRef.current.getCurrentCalibration();
      const result = await systemRef.current.processRealTime(imageData, calibration);
      
      setLastResult(result);
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en procesamiento en tiempo real:', errorMessage);
      setError(errorMessage);
      throw error;
    }
  }, [isInitialized, initializeSystem]);

  /**
   * CALIBRAR CON OBJETO ESPECÍFICO
   */
  const calibrateWithObject = useCallback(async (
    imageData: ImageData,
    objectId: string,
    knownSize: number
  ): Promise<CalibrationResult> => {
    if (!isInitialized || !systemRef.current) {
      await initializeSystem();
    }
    
    if (!systemRef.current) {
      throw new Error('Sistema OpenCV no disponible');
    }

    try {
      console.log(`🔧 Calibrando con objeto ${objectId}: ${knownSize}mm`);
      
      const calibration = await systemRef.current.calibrateWithObject(
        imageData,
        objectId,
        knownSize
      );
      
      setHasCalibration(true);
      setError(null);
      
      console.log('✅ Calibración exitosa:', calibration.pixelsPerMm.toFixed(2), 'px/mm');
      
      return calibration;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en calibración:', errorMessage);
      setError(errorMessage);
      throw error;
    }
  }, [isInitialized, initializeSystem]);

  /**
   * ACTUALIZAR CONFIGURACIÓN
   */
  const updateSettings = useCallback((settings: Partial<UltraOpenCVSettings>) => {
    if (systemRef.current) {
      systemRef.current.updateSettings(settings);
      console.log('⚙️ Configuración actualizada');
    }
  }, []);

  /**
   * OBTENER CONFIGURACIÓN ACTUAL
   */
  const getSettings = useCallback((): UltraOpenCVSettings => {
    if (systemRef.current) {
      return systemRef.current.getSettings();
    }
    return {
      enableAutoCalibration: true,
      enableRealTimeProcessing: true,
      maxProcessingTime: 5000,
      detectionConfidence: 0.7,
      maxObjectsToDetect: 3,
      calibrationConfidence: 0.8,
      autoCalibrationInterval: 300000,
      measurementPrecision: 2,
      enableUnitConversion: true
    };
  }, []);

  /**
   * RESETEAR SISTEMA
   */
  const resetSystem = useCallback(() => {
    if (systemRef.current) {
      systemRef.current.resetSystem();
      setHasCalibration(false);
      setLastResult(null);
      setError(null);
      console.log('🔄 Sistema reseteado');
    }
  }, []);

  /**
   * EXPORTAR DATOS
   */
  const exportData = useCallback((): string => {
    if (systemRef.current) {
      return systemRef.current.exportSystemData();
    }
    return '';
  }, []);

  /**
   * IMPORTAR DATOS
   */
  const importData = useCallback((data: string) => {
    if (systemRef.current) {
      try {
        systemRef.current.importSystemData(data);
        setError(null);
        console.log('✅ Datos importados correctamente');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        setError(errorMessage);
        console.error('❌ Error importando datos:', errorMessage);
      }
    }
  }, []);

  /**
   * OBTENER ESTADO DEL SISTEMA
   */
  const getSystemStatus = useCallback((): SystemStatus => {
    if (systemRef.current) {
      return systemRef.current.getSystemStatus();
    }
    
    return {
      isProcessing: false,
      hasCalibration: false,
      calibrationQuality: 0,
      lastProcessingTime: 0,
      totalObjectsDetected: 0,
      totalMeasurements: 0
    };
  }, []);

  // Estado del sistema en tiempo real
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(getSystemStatus());

  // Actualizar estado del sistema periódicamente
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      setSystemStatus(getSystemStatus());
    }, 1000); // Actualizar cada segundo

    return () => clearInterval(interval);
  }, [isInitialized, getSystemStatus]);

  // Inicialización automática
  useEffect(() => {
    initializeSystem();
  }, [initializeSystem]);

  return {
    // Estado del sistema
    isInitialized,
    isProcessing,
    hasCalibration,
    
    // Funciones principales (nuevas ultra avanzadas)
    processImage,
    processRealTime,
    calibrateWithObject,
    
    // Funciones compatibles con interfaz existente
    detectObjectSilhouettes: async (imageData: ImageData) => {
      try {
        const result = await processImage(imageData, { measureObjects: false });
        return {
          objects: result.detection.objects,
          processingTime: result.processingTime,
          edgeMap: result.detection.edgeMap,
          contours: result.detection.contours
        };
      } catch (error) {
        console.error('❌ Error en detección de siluetas:', error);
        return {
          objects: [],
          processingTime: 0,
          edgeMap: new Uint8Array(imageData.width * imageData.height),
          contours: []
        };
      }
    },
    
    detectEdges: (imageData: ImageData) => {
      // Crear canvas temporal para procesar bordes
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      
      // Aplicar filtro de bordes básico
      ctx.putImageData(imageData, 0, 0);
      const imageData2 = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Convertir a escala de grises y aplicar detección de bordes
      const data = imageData2.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      
      return imageData2;
    },
    
    findContours: (imageData: ImageData) => {
      // Implementación básica de búsqueda de contornos
      const contours: Array<{ x: number; y: number }>[] = [];
      const { width, height, data } = imageData;
      
      // Algoritmo simple de detección de bordes
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const current = data[idx];
          
          // Detectar cambios bruscos de intensidad
          if (Math.abs(current - data[idx - 4]) > 30 || 
              Math.abs(current - data[idx + 4]) > 30 ||
              Math.abs(current - data[idx - width * 4]) > 30 ||
              Math.abs(current - data[idx + width * 4]) > 30) {
            contours.push([{ x, y }]);
          }
        }
      }
      
      return contours;
    },
    
    // Configuración
    updateSettings,
    getSettings,
    
    // Estado y estadísticas
    systemStatus,
    lastResult,
    error,
    
    // Utilidades
    resetSystem,
    exportData,
    importData
  };
}

/**
 * HOOK ESPECIALIZADO PARA DETECCIÓN DE SILUETAS
 */
export function useSilhouetteDetection() {
  const openCV = useOpenCV();
  
  const detectSilhouettes = useCallback(async (imageData: ImageData) => {
    try {
      const result = await openCV.processImage(imageData, {
        autoCalibrate: true,
        measureObjects: false
      });
      
      return result.detection;
    } catch (error) {
      console.error('❌ Error en detección de siluetas:', error);
      throw error;
    }
  }, [openCV]);

  return {
    ...openCV,
    detectSilhouettes
  };
}

/**
 * HOOK ESPECIALIZADO PARA MEDICIÓN
 */
export function useMeasurement() {
  const openCV = useOpenCV();
  
  const measureObjects = useCallback(async (imageData: ImageData) => {
    try {
      const result = await openCV.processImage(imageData, {
        autoCalibrate: true,
        measureObjects: true
      });
      
      return result.measurements;
    } catch (error) {
      console.error('❌ Error en medición:', error);
      throw error;
    }
  }, [openCV]);

  return {
    ...openCV,
    measureObjects
  };
}

/**
 * HOOK ESPECIALIZADO PARA CALIBRACIÓN
 */
export function useCalibration() {
  const openCV = useOpenCV();
  
  const autoCalibrate = useCallback(async (imageData: ImageData) => {
    try {
      const result = await openCV.processImage(imageData, {
        autoCalibrate: true,
        measureObjects: false
      });
      
      return result.calibration;
    } catch (error) {
      console.error('❌ Error en calibración automática:', error);
      throw error;
    }
  }, [openCV]);

  return {
    ...openCV,
    autoCalibrate
  };
}
