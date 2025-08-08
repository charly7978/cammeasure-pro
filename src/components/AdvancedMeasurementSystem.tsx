/**
 * SISTEMA DE MEDICIÓN AVANZADO QUE FUNCIONA
 * Conecta los algoritmos matemáticos complejos con la interfaz
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { DetectedObject as OpenCVDetectedObject, DetectionResult } from '@/lib/opencvManager';

export interface AdvancedDetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { 
    width: number; 
    height: number; 
    depth: number;
    area: number; 
    volume: number;
    unit: string 
  };
  position3D: {
    worldCoordinates: { x: number; y: number; z: number };
    distanceFromCamera: number;
    orientation: { pitch: number; yaw: number; roll: number };
  };
  confidence: number;
  method: 'stereo' | 'photogrammetry' | 'structured_light' | 'monocular';
  accuracy: {
    reprojectionError: number;
    measurementUncertainty: number;
  };
}

interface AdvancedMeasurementSystemProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: AdvancedDetectedObject[]) => void;
  isActive: boolean;
  calibrationData?: {
    pixelsPerMm: number;
    isCalibrated: boolean;
    focalLength?: number;
    sensorSize?: number;
  };
}

export const AdvancedMeasurementSystem: React.FC<AdvancedMeasurementSystemProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
  calibrationData
}) => {
  const { isLoaded, detectObjects, capabilities } = useOpenCV();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const [processingStats, setProcessingStats] = useState({
    averageTime: 0,
    totalDetections: 0,
    successRate: 0
  });

  const PROCESS_INTERVAL = 300; // Intervalo para medición avanzada

  const processFrameAdvanced = useCallback(async () => {
    if (!isActive || !videoRef.current || !canvasRef.current) {
      if (isActive) {
        rafRef.current = requestAnimationFrame(processFrameAdvanced);
      }
      return;
    }

    const now = Date.now();
    if (now - lastProcessTime.current < PROCESS_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrameAdvanced);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrameAdvanced);
      return;
    }

    lastProcessTime.current = now;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrameAdvanced);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      // 🎯 MEDICIÓN AVANZADA CON OPENCV
      const detectionResult = await detectObjects(imageData, {
        enable3D: true,
        enableMultiScale: true,
        enableTemporalStabilization: true,
        confidenceThreshold: 1000,
        maxObjects: 5,
        cameraParams: calibrationData ? {
          focalLength: calibrationData.focalLength || 800,
          principalPointX: canvas.width / 2,
          principalPointY: canvas.height / 2,
          sensorWidth: calibrationData.sensorSize || 6.17,
          sensorHeight: (calibrationData.sensorSize || 6.17) * 0.75,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
          pixelsPerMm: calibrationData.pixelsPerMm || 129.87
        } : undefined
      });

      // Convertir a formato avanzado
      const advancedObjects: AdvancedDetectedObject[] = detectionResult.objects.map((obj: OpenCVDetectedObject) => ({
        id: obj.id,
        bounds: {
          x: obj.bounds.x,
          y: obj.bounds.y,
          width: obj.bounds.width,
          height: obj.bounds.height,
          area: obj.bounds.area
        },
        dimensions: {
          width: obj.realWidth || 0,
          height: obj.realHeight || 0,
          depth: obj.realDepth || 0,
          area: obj.realWidth && obj.realHeight ? obj.realWidth * obj.realHeight : 0,
          volume: obj.volume || 0,
          unit: 'mm'
        },
        position3D: {
          worldCoordinates: {
            x: obj.bounds.centerX,
            y: obj.bounds.centerY,
            z: obj.depth || 0
          },
          distanceFromCamera: obj.distanceToCamera || 0,
          orientation: {
            pitch: 0,
            yaw: 0,
            roll: 0
          }
        },
        confidence: obj.confidence,
        method: 'monocular' as const,
        accuracy: {
          reprojectionError: obj.errorEstimate || 0,
          measurementUncertainty: obj.errorEstimate || 0
        }
      }));

      // Filtrar objetos válidos para medición avanzada
      const validObjects = advancedObjects.filter(obj => {
        return obj.confidence > 0.5 && 
               obj.bounds.area > 1000 &&
               obj.dimensions.width > 10 &&
               obj.dimensions.height > 10 &&
               obj.dimensions.depth > 0;
      });

      if (validObjects.length > 0) {
        console.log(`🎯 MEDICIÓN AVANZADA - ${validObjects.length} objetos con ${detectionResult.algorithm}`);
        console.log('📊 Métricas avanzadas:', detectionResult.metadata);
        onObjectsDetected(validObjects);
      }

      // Actualizar estadísticas
      updateProcessingStats(detectionResult.processingTime, validObjects);

    } catch (error) {
      console.error('❌ Error en medición avanzada:', error);
    }

    rafRef.current = requestAnimationFrame(processFrameAdvanced);
  }, [isActive, videoRef, detectObjects, calibrationData, onObjectsDetected]);

  const updateProcessingStats = (processingTime: number, objects: AdvancedDetectedObject[]) => {
    setProcessingStats(prev => {
      const newTotalDetections = prev.totalDetections + 1;
      const newAverageTime = (prev.averageTime * prev.totalDetections + processingTime) / newTotalDetections;
      const newSuccessRate = objects.length > 0 ? (prev.successRate * prev.totalDetections + 1) / newTotalDetections : prev.successRate;

      return {
        averageTime: newAverageTime,
        totalDetections: newTotalDetections,
        successRate: newSuccessRate
      };
    });
  };

  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(processFrameAdvanced);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, processFrameAdvanced]);

  // Mostrar estado del sistema avanzado
  useEffect(() => {
    if (isLoaded) {
      console.log('✅ Sistema de medición avanzada activo');
      console.log('🔧 Capacidades OpenCV:', capabilities);
    } else {
      console.log('⏳ Inicializando sistema avanzado...');
    }
  }, [isLoaded, capabilities]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="hidden"
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {!isLoaded && (
        <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
          Inicializando medición avanzada...
        </div>
      )}
      {isActive && (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
          Tiempo: {processingStats.averageTime.toFixed(1)}ms | 
          Éxito: {(processingStats.successRate * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
};