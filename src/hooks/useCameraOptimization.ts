import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { DetectedObject } from '@/lib/types';

interface CameraState {
  isProcessing: boolean;
  frameCount: number;
  currentMeasurement: any;
  detectedObjects: DetectedObject[];
  isRealTimeMeasurement: boolean;
}

export const useCameraOptimization = () => {
  // Estado optimizado con useReducer pattern
  const [cameraState, setCameraState] = useState<CameraState>({
    isProcessing: false,
    frameCount: 0,
    currentMeasurement: null,
    detectedObjects: [],
    isRealTimeMeasurement: true
  });

  // Referencias para evitar re-renderizados innecesarios
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameSkipCounterRef = useRef<number>(0);
  const performanceMetricsRef = useRef<{
    averageProcessingTime: number;
    frameRate: number;
    lastUpdate: number;
  }>({
    averageProcessingTime: 0,
    frameRate: 0,
    lastUpdate: 0
  });

  // Configuración de rendimiento optimizada
  const PERFORMANCE_CONFIG = useMemo(() => ({
    MIN_FRAME_INTERVAL: 100, // 10 FPS máximo para estabilidad
    MAX_PROCESSING_TIME: 500, // 500ms máximo de procesamiento
    FRAME_SKIP_THRESHOLD: 3, // Saltar frames si hay retraso
    CACHE_DURATION: 2000, // Cache válido por 2 segundos
    DEBOUNCE_DELAY: 150 // Delay para operaciones costosas
  }), []);

  // Función optimizada para actualizar estado
  const updateCameraState = useCallback((updates: Partial<CameraState>) => {
    setCameraState(prev => ({ ...prev, ...updates }));
  }, []);

  // Función optimizada para incrementar contador de frames
  const incrementFrameCount = useCallback(() => {
    setCameraState(prev => ({ ...prev, frameCount: prev.frameCount + 1 }));
  }, []);

  // Función optimizada para establecer estado de procesamiento
  const setProcessingState = useCallback((isProcessing: boolean) => {
    setCameraState(prev => ({ ...prev, isProcessing }));
  }, []);

  // Función optimizada para actualizar mediciones
  const updateMeasurements = useCallback((measurement: any, objects: DetectedObject[]) => {
    setCameraState(prev => ({
      ...prev,
      currentMeasurement: measurement,
      detectedObjects: objects
    }));
  }, []);

  // Función optimizada para alternar medición en tiempo real
  const toggleRealTimeMeasurement = useCallback((enabled: boolean) => {
    setCameraState(prev => ({ ...prev, isRealTimeMeasurement: enabled }));
  }, []);

  // Función optimizada para verificar si se debe procesar un frame
  const shouldProcessFrame = useCallback((currentTime: number = performance.now()): boolean => {
    const timeSinceLastFrame = currentTime - lastFrameTimeRef.current;
    
    // Verificar intervalo mínimo entre frames
    if (timeSinceLastFrame < PERFORMANCE_CONFIG.MIN_FRAME_INTERVAL) {
      return false;
    }
    
    // Verificar si hay procesamiento en curso
    if (cameraState.isProcessing) {
      return false;
    }
    
    // Verificar si se debe saltar frames por rendimiento
    if (frameSkipCounterRef.current >= PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD) {
      frameSkipCounterRef.current = 0;
      return false;
    }
    
    return true;
  }, [cameraState.isProcessing, PERFORMANCE_CONFIG.MIN_FRAME_INTERVAL, PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD]);

  // Función optimizada para marcar inicio de procesamiento
  const startProcessing = useCallback(() => {
    const startTime = performance.now();
    setProcessingState(true);
    lastFrameTimeRef.current = startTime;
    
    // Configurar timeout de seguridad
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    processingTimeoutRef.current = setTimeout(() => {
      setProcessingState(false);
      console.warn('⚠️ Timeout de procesamiento - forzando finalización');
    }, PERFORMANCE_CONFIG.MAX_PROCESSING_TIME);
    
    return startTime;
  }, [setProcessingState, PERFORMANCE_CONFIG.MAX_PROCESSING_TIME]);

  // Función optimizada para marcar fin de procesamiento
  const finishProcessing = useCallback((startTime: number) => {
    const processingTime = performance.now() - startTime;
    
    // Limpiar timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    // Actualizar métricas de rendimiento
    const metrics = performanceMetricsRef.current;
    const alpha = 0.1; // Factor de suavidad para métricas
    metrics.averageProcessingTime = metrics.averageProcessingTime * (1 - alpha) + processingTime * alpha;
    metrics.frameRate = 1000 / (performance.now() - metrics.lastUpdate);
    metrics.lastUpdate = performance.now();
    
    // Verificar si se debe ajustar el rendimiento
    if (processingTime > PERFORMANCE_CONFIG.MAX_PROCESSING_TIME * 0.8) {
      frameSkipCounterRef.current++;
    } else {
      frameSkipCounterRef.current = Math.max(0, frameSkipCounterRef.current - 1);
    }
    
    setProcessingState(false);
    incrementFrameCount();
    
    return processingTime;
  }, [setProcessingState, incrementFrameCount, PERFORMANCE_CONFIG.MAX_PROCESSING_TIME]);

  // Función optimizada para procesamiento de frame con debouncing
  const processFrameWithDebounce = useCallback(async (
    processFunction: () => Promise<void>,
    force: boolean = false
  ) => {
    const currentTime = performance.now();
    
    if (!force && !shouldProcessFrame(currentTime)) {
      return false;
    }
    
    const startTime = startProcessing();
    
    try {
      await processFunction();
      finishProcessing(startTime);
      return true;
    } catch (error) {
      console.error('❌ Error en procesamiento de frame:', error);
      finishProcessing(startTime);
      return false;
    }
  }, [shouldProcessFrame, startProcessing, finishProcessing]);

  // Función optimizada para limpiar recursos
  const cleanupResources = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    setCameraState({
      isProcessing: false,
      frameCount: 0,
      currentMeasurement: null,
      detectedObjects: [],
      isRealTimeMeasurement: true
    });
    
    frameSkipCounterRef.current = 0;
    lastFrameTimeRef.current = 0;
  }, []);

  // Función optimizada para obtener métricas de rendimiento
  const getPerformanceMetrics = useCallback(() => {
    const metrics = performanceMetricsRef.current;
    return {
      averageProcessingTime: Math.round(metrics.averageProcessingTime * 100) / 100,
      frameRate: Math.round(metrics.frameRate * 100) / 100,
      frameSkipCount: frameSkipCounterRef.current,
      isProcessing: cameraState.isProcessing
    };
  }, [cameraState.isProcessing]);

  // Función optimizada para resetear métricas
  const resetPerformanceMetrics = useCallback(() => {
    performanceMetricsRef.current = {
      averageProcessingTime: 0,
      frameRate: 0,
      lastUpdate: performance.now()
    };
    frameSkipCounterRef.current = 0;
    lastFrameTimeRef.current = 0;
  }, []);

  // Función optimizada para ajustar configuración de rendimiento
  const adjustPerformanceConfig = useCallback((config: Partial<typeof PERFORMANCE_CONFIG>) => {
    const newConfig = { ...PERFORMANCE_CONFIG, ...config };
    
    // Ajustar dinámicamente basado en métricas de rendimiento
    const metrics = performanceMetricsRef.current;
    
    if (metrics.averageProcessingTime > PERFORMANCE_CONFIG.MAX_PROCESSING_TIME * 0.9) {
      newConfig.MIN_FRAME_INTERVAL = Math.min(200, newConfig.MIN_FRAME_INTERVAL + 20);
      newConfig.FRAME_SKIP_THRESHOLD = Math.min(5, newConfig.FRAME_SKIP_THRESHOLD + 1);
    } else if (metrics.averageProcessingTime < PERFORMANCE_CONFIG.MAX_PROCESSING_TIME * 0.5) {
      newConfig.MIN_FRAME_INTERVAL = Math.max(50, newConfig.MIN_FRAME_INTERVAL - 10);
      newConfig.FRAME_SKIP_THRESHOLD = Math.max(1, newConfig.FRAME_SKIP_THRESHOLD - 1);
    }
    
    return newConfig;
  }, [PERFORMANCE_CONFIG]);

  // Función optimizada para verificar estado de la cámara
  const getCameraStatus = useCallback(() => {
    const metrics = getPerformanceMetrics();
    const isHealthy = metrics.averageProcessingTime < PERFORMANCE_CONFIG.MAX_PROCESSING_TIME * 0.8;
    const isOptimal = metrics.frameRate > 8; // Más de 8 FPS es óptimo
    
    return {
      isHealthy,
      isOptimal,
      status: isHealthy ? (isOptimal ? 'optimal' : 'stable') : 'degraded',
      recommendations: []
    };
  }, [getPerformanceMetrics, PERFORMANCE_CONFIG.MAX_PROCESSING_TIME]);

  // Función optimizada para obtener recomendaciones de rendimiento
  const getPerformanceRecommendations = useCallback(() => {
    const metrics = getPerformanceMetrics();
    const recommendations: string[] = [];
    
    if (metrics.averageProcessingTime > PERFORMANCE_CONFIG.MAX_PROCESSING_TIME * 0.9) {
      recommendations.push('Considerar reducir la frecuencia de procesamiento');
      recommendations.push('Verificar si hay procesos en segundo plano');
    }
    
    if (metrics.frameRate < 5) {
      recommendations.push('La tasa de frames es muy baja, considerar optimizaciones');
      recommendations.push('Verificar la carga del dispositivo');
    }
    
    if (frameSkipCounterRef.current > PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD * 0.8) {
      recommendations.push('Muchos frames se están saltando, ajustar configuración');
    }
    
    return recommendations;
  }, [getPerformanceMetrics, PERFORMANCE_CONFIG.MAX_PROCESSING_TIME, PERFORMANCE_CONFIG.FRAME_SKIP_THRESHOLD]);

  // Cleanup automático al desmontar
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Retornar estado y funciones optimizadas
  return {
    // Estado
    ...cameraState,
    
    // Funciones de control
    updateCameraState,
    setProcessingState,
    updateMeasurements,
    toggleRealTimeMeasurement,
    
    // Funciones de procesamiento
    processFrameWithDebounce,
    shouldProcessFrame,
    startProcessing,
    finishProcessing,
    
    // Funciones de rendimiento
    getPerformanceMetrics,
    resetPerformanceMetrics,
    adjustPerformanceConfig,
    getCameraStatus,
    getPerformanceRecommendations,
    
    // Configuración
    PERFORMANCE_CONFIG,
    
    // Cleanup
    cleanupResources
  };
};
