
import React, { useCallback, useEffect, useRef } from 'react';
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
  const { detect } = useMeasurementWorker();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 200; // Intervalo optimizado

  const processFrame = useCallback(() => {
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

    // Configurar canvas con resolución optimizada
    const targetWidth = Math.min(video.videoWidth, 1280);
    const targetHeight = Math.min(video.videoHeight, 720);
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Dibujar frame actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Detectar objetos
    detect({
      imageData,
      minArea: 800,
      onDetect: (rects) => {
        const pixelsPerMm = calculatePixelsPerMm(calibration, canvas.width, canvas.height);
        
        console.log('🎯 Detección exitosa:', {
          rectsFound: rects.length,
          resolution: `${canvas.width}x${canvas.height}`,
          pixelsPerMm: pixelsPerMm.toFixed(2)
        });

        const validatedObjects = rects
          .filter(rect => validateObjectMeasurement(rect, canvas.width, canvas.height))
          .slice(0, 2)
          .map((rect, i) => {
            const realWidth = rect.width / pixelsPerMm;
            const realHeight = rect.height / pixelsPerMm;
            const realArea = rect.area / (pixelsPerMm * pixelsPerMm);
            
            console.log(`📏 Objeto ${i + 1}:`, {
              pixels: `${rect.width}x${rect.height}`,
              real: `${realWidth.toFixed(1)}x${realHeight.toFixed(1)}mm`,
              area: `${realArea.toFixed(1)}mm²`,
              confidence: `${(rect.confidence * 100).toFixed(1)}%`
            });
            
            return {
              id: `obj_${i}_${Date.now()}`,
              bounds: rect,
              dimensions: {
                width: realWidth,
                height: realHeight,
                area: realArea,
                unit: 'mm',
              },
              confidence: rect.confidence || 0.7,
              center: { 
                x: rect.x + rect.width / 2, 
                y: rect.y + rect.height / 2 
              },
            };
          });

        onObjectsDetected(validatedObjects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected]);

  const calculatePixelsPerMm = (calibration: any, imageWidth: number, imageHeight: number): number => {
    if (calibration?.isCalibrated && calibration?.pixelsPerMm > 0) {
      return calibration.pixelsPerMm;
    }
    
    // Auto-calibración mejorada basada en resolución
    const diagonalPixels = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);
    const estimatedDiagonalMm = 200; // ~20cm campo de visión típico a 25cm distancia
    
    let pixelsPerMm = diagonalPixels / estimatedDiagonalMm;
    
    // Ajustes por resolución
    if (imageWidth >= 1920) pixelsPerMm *= 1.1; // 4K+
    else if (imageWidth >= 1280) pixelsPerMm *= 1.05; // HD+
    else if (imageWidth < 640) pixelsPerMm *= 0.9; // Baja resolución
    
    // Clampear a valores razonables
    return Math.max(2, Math.min(20, pixelsPerMm));
  };

  const validateObjectMeasurement = (rect: any, imageWidth: number, imageHeight: number): boolean => {
    const imageArea = imageWidth * imageHeight;
    const objectAreaRatio = rect.area / imageArea;
    const aspectRatio = rect.width / rect.height;
    
    // Criterios de validación mejorados
    const validSize = rect.area >= 500 && rect.area <= imageArea * 0.4;
    const validAspect = aspectRatio >= 0.2 && aspectRatio <= 5.0;
    const validPosition = rect.x >= 5 && rect.y >= 5 && 
                         rect.x + rect.width <= imageWidth - 5 && 
                         rect.y + rect.height <= imageHeight - 5;
    const validAreaRatio = objectAreaRatio >= 0.001 && objectAreaRatio <= 0.4;
    const validDimensions = rect.width >= 20 && rect.height >= 20;
    const validConfidence = (rect.confidence || 0.5) >= 0.3;
    
    return validSize && validAspect && validPosition && 
           validAreaRatio && validDimensions && validConfidence;
  };

  useEffect(() => {
    if (isActive) {
      console.log('🚀 Iniciando medición en tiempo real...');
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
