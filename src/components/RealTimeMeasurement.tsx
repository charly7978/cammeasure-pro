import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';
import { PrecisionAnalysisSystem } from '@/lib/precisionAnalysis';
import { Advanced3DMeasurementSystem } from '@/lib/advanced3DMeasurement';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
  precision?: {
    accuracy: number;
    stability: number;
    errorEstimate: number;
    qualityScore: number;
  };
  depth?: number;
  volume?: number;
  surfaceArea?: number;
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
  const { isLoaded } = useOpenCV();
  const { detectAdvanced, isReady } = useMeasurementWorker();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 200; // Procesar cada 200ms para mejor respuesta profesional
  
  // Sistemas avanzados de análisis
  const [precisionSystem] = useState(() => new PrecisionAnalysisSystem());
  const [measurement3DSystem] = useState(() => new Advanced3DMeasurementSystem({
    focalLength: calibration?.focalLength || 4.0,
    sensorWidth: calibration?.sensorSize || 6.17,
    sensorHeight: calibration?.sensorSize || 6.17,
    imageWidth: 1920,
    imageHeight: 1080
  }));

  const processFrame = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current || !isReady()) {
      rafRef.current = requestAnimationFrame(processFrame);
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

    // Usar detección avanzada con configuración profesional
    detectAdvanced({
      imageData,
      minArea: 1500, // Área mínima optimizada para objetos profesionales
      enableMultiScale: true,
      enableTemporalStabilization: true,
      maxObjects: 2, // Máximo 2 objetos para análisis detallado
      confidenceThreshold: 0.5, // Umbral de confianza profesional
      onDetect: (rects) => {
        // Usar factor de conversión del sistema inteligente
        const factor = calibration?.isCalibrated ? calibration.pixelsPerMm : 10;
        const unit = 'mm';

        console.log('Professional calibration data:', calibration);
        console.log('Advanced conversion factor:', factor);

        // Análisis de calidad de imagen
        const imageQuality = precisionSystem.analyzeImageQuality(imageData, rects);

        // Filtrar con criterios profesionales más estrictos
        const professionalRects = rects
          .filter(rect => {
            const aspectRatio = rect.width / rect.height;
            const imageArea = canvas.width * canvas.height;
            const sizeRatio = rect.area / imageArea;
            
            return rect.area >= 1500 && 
                   sizeRatio >= 0.005 && sizeRatio <= 0.4 && // Rango profesional
                   aspectRatio > 0.2 && aspectRatio < 8.0 &&
                   rect.width > 30 && rect.height > 30 &&
                   (rect.confidence || 0) > 0.4; // Confianza mínima profesional
          })
          .map(rect => ({
            ...rect,
            qualityScore: calculateAdvancedQualityScore(rect, canvas.width, canvas.height, imageQuality)
          }))
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, 2); // Top 2 objetos para análisis profesional

        const objects: DetectedObject[] = await Promise.all(
          professionalRects.map(async (rect, i) => {
            // Convertir píxeles a milímetros con precisión profesional
            const widthMm = rect.width / factor;
            const heightMm = rect.height / factor;
            const areaMm2 = rect.area / (factor * factor);
            
            // Análisis de precisión profesional
            const precisionMetrics = precisionSystem.analyzeMeasurementPrecision(
              Math.max(widthMm, heightMm), // Valor principal
              undefined, // Sin valor de referencia
              rect.confidence || 0.8,
              {
                lightingCondition: imageQuality.lighting.score > 0.7 ? 'medium' : 'low',
                stabilityScore: imageQuality.stability.score,
                distanceToObject: estimateDistance(rect, canvas.width, canvas.height),
                cameraAngle: estimateAngle(rect, canvas.width, canvas.height)
              }
            );

            // Estimación 3D profesional
            const depthMap = measurement3DSystem.estimateDepthMonocular(imageData, [rect]);
            const object3D = measurement3DSystem.reconstruct3DObject(
              depthMap,
              { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              factor
            );

            console.log(`Professional Object ${i + 1}:`, {
              pixelDimensions: { width: rect.width, height: rect.height, area: rect.area },
              mmDimensions: { width: widthMm, height: heightMm, area: areaMm2 },
              precision: precisionMetrics,
              volume3D: object3D.volume,
              confidence: rect.confidence,
              factor: factor
            });
            
            return {
              id: `prof_obj_${i}_${Date.now()}`,
              bounds: rect,
              dimensions: {
                width: widthMm,
                height: heightMm,
                area: areaMm2,
                unit: unit,
              },
              confidence: rect.confidence || 0.8,
              center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
              precision: {
                accuracy: precisionMetrics.accuracy,
                stability: precisionMetrics.stability,
                errorEstimate: precisionMetrics.errorEstimate,
                qualityScore: precisionMetrics.qualityScore
              },
              depth: object3D.dimensions.depth,
              volume: object3D.volume,
              surfaceArea: object3D.surfaceArea
            };
          })
        );

        onObjectsDetected(objects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detectAdvanced, calibration, onObjectsDetected, precisionSystem, measurement3DSystem, isReady]);

  // Función para calcular la calidad del objeto detectado
  const calculateQualityScore = (rect: any, imageWidth: number, imageHeight: number): number => {
    // Factores de calidad:
    
    // 1. Tamaño relativo (objetos ni muy pequeños ni muy grandes)
    const imageArea = imageWidth * imageHeight;
    const sizeRatio = rect.area / imageArea;
    const sizeScore = sizeRatio > 0.01 && sizeRatio < 0.2 ? 1 : 0.5;
    
    // 2. Posición central (objetos en el centro son mejores)
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - imageWidth / 2, 2) + 
      Math.pow(centerY - imageHeight / 2, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
    const positionScore = 1 - (distanceFromCenter / maxDistance);
    
    // 3. Forma regular (relación de aspecto cercana a 1 es mejor)
    const aspectRatio = rect.width / rect.height;
    const shapeScore = 1 - Math.abs(aspectRatio - 1) / 2;
    
    // 4. Confianza del detector
    const confidenceScore = rect.confidence || 0.7;
    
    // Combinar todos los factores
    return (sizeScore * 0.3 + positionScore * 0.3 + shapeScore * 0.2 + confidenceScore * 0.2);
  };

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

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
};
