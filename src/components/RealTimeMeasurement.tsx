import React, { useCallback, useEffect, useRef } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
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
  const { detect } = useMeasurementWorker();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 300; // Procesar cada 300ms para reducir carga

  const processFrame = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) {
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

    detect({
      imageData,
      minArea: 2000, // Área mínima más grande para ser más selectivo
      onDetect: (rects) => {
        // Usar factor de conversión realista
        const factor = calibration?.isCalibrated ? calibration.pixelsPerMm : 8; // Factor por defecto más realista
        const unit = 'mm'; // Siempre usar mm como unidad base

        console.log('Calibration data:', calibration);
        console.log('Conversion factor:', factor);

        // Filtrar y ordenar los rectángulos por calidad
        const filteredRects = rects
          .filter(rect => {
            const aspectRatio = rect.width / rect.height;
            const imageArea = canvas.width * canvas.height;
            
            return rect.area >= 2000 && 
                   rect.area <= imageArea * 0.25 && // No más del 25% de la imagen
                   aspectRatio > 0.3 && aspectRatio < 4.0 &&
                   rect.width > 50 && rect.height > 50;
          })
          .map(rect => ({
            ...rect,
            // Calcular score de calidad basado en tamaño, posición y forma
            qualityScore: calculateQualityScore(rect, canvas.width, canvas.height)
          }))
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, 1); // Solo el mejor objeto

        const objects: DetectedObject[] = filteredRects.map((rect, i) => {
          // Convertir píxeles a milímetros
          const widthMm = rect.width / factor;
          const heightMm = rect.height / factor;
          const areaMm2 = rect.area / (factor * factor);
          
          console.log(`Object ${i + 1}:`, {
            pixelWidth: rect.width,
            pixelHeight: rect.height,
            pixelArea: rect.area,
            mmWidth: widthMm,
            mmHeight: heightMm,
            mmArea: areaMm2,
            factor: factor
          });
          
          return {
            id: `obj_${i}_${Date.now()}`,
            bounds: rect,
            dimensions: {
              width: widthMm,
              height: heightMm,
              area: areaMm2,
              unit: unit,
            },
            confidence: rect.qualityScore,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          };
        });

        onObjectsDetected(objects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected]);

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