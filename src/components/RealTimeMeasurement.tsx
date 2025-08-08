
import React, { useCallback, useEffect, useRef } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';
import { DetectedObject as OpenCVDetectedObject, DetectionResult } from '@/lib/opencvManager';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
  
  // DATOS 3D REALES - MEDICIÓN PROFESIONAL
  depth?: number;
  realWidth?: number;
  realHeight?: number;
  realDepth?: number;
  volume?: number;
  surfaceArea?: number;
  estimatedMass?: number;
  distanceToCamera?: number;
  viewingAngle?: number;
  geometricShape?: string;
  errorEstimate?: number;
  measurementQuality?: number;
  
  precision?: {
    accuracy: number;
    stability: number;
    errorEstimate: number;
    qualityScore: number;
  };
}

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: DetectedObject[]) => void;
  isActive: boolean;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
}) => {
  const { isLoaded, detectObjects, capabilities } = useOpenCV();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 200; // Intervalo optimizado para procesamiento en tiempo real

  const processFrame = useCallback(async () => {
    if (!isActive || !videoRef.current || !canvasRef.current) {
      if (isActive) {
        rafRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    const now = Date.now();
    if (now - lastProcessTime.current < PROCESS_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    lastProcessTime.current = now;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      // 🎯 DETECCIÓN REAL CON OPENCV
      const detectionResult = await detectObjects(imageData, {
        enable3D: true,
        confidenceThreshold: 500,
        maxObjects: 10,
        cameraParams: calibration ? {
          focalLength: 800,
          principalPointX: canvas.width / 2,
          principalPointY: canvas.height / 2,
          sensorWidth: 6.17,
          sensorHeight: 4.63,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
          pixelsPerMm: calibration.pixelsPerMm || 129.87
        } : undefined
      });

      // Convertir objetos de OpenCV al formato esperado
      const convertedObjects: DetectedObject[] = detectionResult.objects.map((obj: OpenCVDetectedObject) => ({
        id: obj.id,
        bounds: {
          x: obj.bounds.x,
          y: obj.bounds.y,
          width: obj.bounds.width,
          height: obj.bounds.height,
          area: obj.bounds.area
        },
        dimensions: {
          width: obj.realWidth || (obj.bounds.width / (calibration?.pixelsPerMm || 1)),
          height: obj.realHeight || (obj.bounds.height / (calibration?.pixelsPerMm || 1)),
          area: obj.realWidth && obj.realHeight ? obj.realWidth * obj.realHeight : obj.bounds.area,
          unit: 'mm'
        },
        confidence: obj.confidence,
        center: {
          x: obj.bounds.centerX,
          y: obj.bounds.centerY
        },
        // Datos 3D reales
        depth: obj.depth,
        realWidth: obj.realWidth,
        realHeight: obj.realHeight,
        realDepth: obj.realDepth,
        volume: obj.volume,
        surfaceArea: obj.surfaceArea,
        estimatedMass: obj.estimatedMass,
        distanceToCamera: obj.distanceToCamera,
        viewingAngle: obj.viewingAngle,
        geometricShape: obj.geometricShape,
        errorEstimate: obj.errorEstimate,
        measurementQuality: obj.measurementQuality,
        precision: {
          accuracy: obj.measurementQuality || 0.5,
          stability: 0.8,
          errorEstimate: obj.errorEstimate || 0,
          qualityScore: obj.measurementQuality || 0.5
        }
      }));

      // Filtrar objetos válidos para medición
      const validObjects = convertedObjects.filter(obj => {
        return obj.confidence > 0.3 && 
               obj.bounds.area > 500 &&
               obj.dimensions.width > 5 &&
               obj.dimensions.height > 5;
      });

      if (validObjects.length > 0) {
        console.log(`🎯 DETECCIÓN REAL - ${validObjects.length} objetos detectados con ${detectionResult.algorithm}`);
        console.log('📊 Estadísticas:', detectionResult.metadata);
        onObjectsDetected(validObjects);
      }

    } catch (error) {
      console.error('❌ Error en detección en tiempo real:', error);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detectObjects, calibration, onObjectsDetected]);

  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(processFrame);
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
  }, [isActive, processFrame]);

  // Mostrar estado de OpenCV
  useEffect(() => {
    if (isLoaded) {
      console.log('✅ OpenCV cargado - Capacidades disponibles:', capabilities);
    } else {
      console.log('⏳ Cargando OpenCV...');
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
        <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
          Cargando OpenCV...
        </div>
      )}
    </div>
  );
};
