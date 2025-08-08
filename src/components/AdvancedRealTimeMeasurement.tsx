/**
 * COMPONENTE DE MEDICIÓN EN TIEMPO REAL AVANZADO
 * Utiliza el nuevo sistema de detección profesional de objetos
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useAdvancedObjectDetection } from '@/hooks/useAdvancedObjectDetection';
import { useCalibration } from '@/hooks/useCalibration';
import type { DetectedObject } from '@/workers/advancedObjectDetection';

export interface MeasuredObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { 
    width: number; 
    height: number; 
    area: number; 
    perimeter: number;
    diagonal: number;
    unit: string 
  };
  properties: {
    aspectRatio: number;
    circularity: number;
    solidity: number;
    orientation: number;
    shapeType: string;
  };
  confidence: number;
  center: { x: number; y: number };
  timestamp: number;
}

interface AdvancedRealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: MeasuredObject[]) => void;
  isActive: boolean;
  measurementConfig?: {
    processingMode?: 'fast' | 'balanced' | 'accurate';
    enableMultiObject?: boolean;
    minConfidence?: number;
    updateInterval?: number;
  };
}

export const AdvancedRealTimeMeasurement: React.FC<AdvancedRealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
  measurementConfig = {}
}) => {
  // Hooks
  const {
    isInitialized,
    isProcessing,
    capabilities,
    detectObjects,
    lastDetection,
    lastMetadata,
    error,
    getPerformanceStats
  } = useAdvancedObjectDetection();
  
  const { calibration } = useCalibration();
  
  // Referencias
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  
  // Configuración
  const config = {
    processingMode: 'balanced',
    enableMultiObject: true,
    minConfidence: 0.4,
    updateInterval: 200, // ms entre procesamiento de frames
    ...measurementConfig
  };
  
  // Efecto principal de procesamiento
  useEffect(() => {
    if (isActive && isInitialized) {
      console.log('🚀 Iniciando medición en tiempo real avanzada');
      startRealTimeProcessing();
    } else {
      stopRealTimeProcessing();
    }
    
    return () => {
      stopRealTimeProcessing();
    };
  }, [isActive, isInitialized]);
  
  // Función de procesamiento de frames
  const processFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !canvasRef.current || !isInitialized) {
      if (isActive) {
        rafRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }
    
    const now = Date.now();
    frameCountRef.current++;
    
    // Control de frecuencia de procesamiento
    if (now - lastProcessTime.current < config.updateInterval) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Verificar que el video esté listo
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    try {
      // Capturar frame del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      lastProcessTime.current = now;
      
      // Procesar detección de objetos (sin await para no bloquear)
      detectObjects(imageData, {
        processingMode: config.processingMode,
        enableMultiScale: true,
        enableTemporalConsistency: true,
        minConfidence: config.minConfidence,
        maxObjects: config.enableMultiObject ? 5 : 1
      }).then(detectedObjects => {
        // Convertir objetos detectados a objetos medidos
        const measuredObjects = convertToMeasuredObjects(detectedObjects);
        
        // Notificar objetos detectados
        onObjectsDetected(measuredObjects);
        
        // Log de rendimiento cada 30 frames
        if (frameCountRef.current % 30 === 0) {
          logPerformanceStats();
        }
        
      }).catch(error => {
        console.error('❌ Error en detección:', error);
      });
      
    } catch (error) {
      console.error('❌ Error procesando frame:', error);
    }
    
    // Continuar procesamiento
    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, isInitialized, detectObjects, onObjectsDetected, config]);
  
  // Iniciar procesamiento en tiempo real
  const startRealTimeProcessing = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);
  
  // Detener procesamiento
  const stopRealTimeProcessing = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  }, []);
  
  // Convertir objetos detectados a objetos medidos
  const convertToMeasuredObjects = useCallback((detectedObjects: DetectedObject[]): MeasuredObject[] => {
    return detectedObjects.map(obj => {
      // Calcular factor de conversión
      const conversionFactor = calculateConversionFactor();
      
      // Convertir dimensiones de píxeles a unidades reales
      const realWidth = (obj.bounds.width / conversionFactor);
      const realHeight = (obj.bounds.height / conversionFactor);
      const realArea = (obj.bounds.area / (conversionFactor * conversionFactor));
      const realPerimeter = (obj.properties.perimeter / conversionFactor);
      const realDiagonal = Math.sqrt(realWidth * realWidth + realHeight * realHeight);
      
      return {
        id: obj.id,
        bounds: obj.bounds,
        dimensions: {
          width: realWidth,
          height: realHeight,
          area: realArea,
          perimeter: realPerimeter,
          diagonal: realDiagonal,
          unit: 'mm'
        },
        properties: {
          aspectRatio: obj.properties.aspectRatio,
          circularity: obj.properties.circularity,
          solidity: obj.properties.solidity,
          orientation: obj.properties.orientation,
          shapeType: obj.properties.shapeType
        },
        confidence: obj.confidence,
        center: {
          x: obj.bounds.centerX,
          y: obj.bounds.centerY
        },
        timestamp: obj.timestamp
      };
    });
  }, []);
  
  // Calcular factor de conversión píxeles a mm
  const calculateConversionFactor = useCallback((): number => {
    if (calibration?.isCalibrated && calibration?.pixelsPerMm > 0) {
      return calibration.pixelsPerMm;
    }
    
    // Factor automático basado en resolución de video
    if (!videoRef.current) return 8.0;
    
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    const totalPixels = videoWidth * videoHeight;
    
    // Factores optimizados según resolución
    if (totalPixels > 8000000) { // 4K+
      return 10.0;
    } else if (totalPixels > 2000000) { // Full HD+
      return 7.5;
    } else { // HD o menor
      return 5.0;
    }
  }, [calibration, videoRef]);
  
  // Log de estadísticas de rendimiento
  const logPerformanceStats = useCallback(() => {
    if (lastMetadata) {
      const stats = getPerformanceStats();
      console.log('📊 Estadísticas de rendimiento:', {
        processingTime: `${lastMetadata.processingTime.toFixed(1)}ms`,
        algorithm: lastMetadata.algorithm,
        objectCount: lastMetadata.objectCount,
        averageConfidence: `${(lastMetadata.averageConfidence * 100).toFixed(1)}%`,
        averageProcessingTime: `${stats.averageProcessingTime.toFixed(1)}ms`,
        successRate: `${(stats.successRate * 100).toFixed(1)}%`,
        totalDetections: stats.totalDetections,
        frameCount: frameCountRef.current
      });
    }
  }, [lastMetadata, getPerformanceStats]);
  
  // Efecto para mostrar estado de inicialización
  useEffect(() => {
    if (isInitialized && capabilities) {
      console.log('✅ Sistema de detección avanzada listo:', {
        hasOpenCV: capabilities.hasOpenCV,
        features: capabilities.supportedFeatures,
        maxObjects: capabilities.maxObjectsPerFrame,
        minConfidence: capabilities.minConfidence
      });
    }
  }, [isInitialized, capabilities]);
  
  // Efecto para manejar errores
  useEffect(() => {
    if (error) {
      console.error('❌ Error en sistema de detecci��n:', error);
    }
  }, [error]);
  
  return (
    <>
      {/* Canvas oculto para captura de frames */}
      <canvas 
        ref={canvasRef} 
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      {/* Información de debug (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div 
          style={{
            position: 'fixed',
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontSize: '12px',
            zIndex: 9999,
            fontFamily: 'monospace'
          }}
        >
          <div>🔧 Debug Info:</div>
          <div>Initialized: {isInitialized ? '✅' : '❌'}</div>
          <div>Processing: {isProcessing ? '🔄' : '⏸️'}</div>
          <div>OpenCV: {capabilities?.hasOpenCV ? '✅' : '❌'}</div>
          <div>Objects: {lastDetection.length}</div>
          <div>Frames: {frameCountRef.current}</div>
          {lastMetadata && (
            <>
              <div>Time: {lastMetadata.processingTime.toFixed(1)}ms</div>
              <div>Conf: {(lastMetadata.averageConfidence * 100).toFixed(1)}%</div>
            </>
          )}
          {error && <div style={{color: 'red'}}>Error: {error}</div>}
        </div>
      )}
    </>
  );
};