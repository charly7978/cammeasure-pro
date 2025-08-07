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
      minArea: 1500, // Área mínima más grande para ser más selectivo
      onDetect: (rects) => {
        const factor = calibration?.isCalibrated ? calibration.pixelsPerMm : 1;
        const unit = calibration?.isCalibrated ? 'mm' : 'px';

        // Filtrar y ordenar los rectángulos por confianza
        const filteredRects = rects
          .filter(rect => {
            // Filtros adicionales para mayor precisión
            const aspectRatio = rect.width / rect.height;
            return rect.area >= 1500 && 
                   aspectRatio > 0.2 && aspectRatio < 5.0 &&
                   rect.width > 40 && rect.height > 40;
          })
          .sort((a, b) => {
            const confidenceA = a.confidence ?? 0.5;
            const confidenceB = b.confidence ?? 0.5;
            return (confidenceB * b.area) - (confidenceA * a.area);
          })
          .slice(0, 2); // Solo los 2 mejores

        const objects: DetectedObject[] = filteredRects.map((rect, i) => {
          const baseConfidence = rect.confidence ?? Math.min(0.6 + Math.min(rect.area / 8000, 0.4), 1);
          
          return {
            id: `obj_${i}_${Date.now()}`,
            bounds: rect,
            dimensions: {
              width: rect.width / factor,
              height: rect.height / factor,
              area: rect.area / (factor * factor),
              unit,
            },
            confidence: baseConfidence,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          };
        });

        onObjectsDetected(objects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected]);

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