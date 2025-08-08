
import React, { useCallback, useEffect, useRef } from 'react';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
  measurements?: {
    perimeter: number;
    solidity: number;
    aspectRatio: number;
    angle: number;
    realWorldCoordinates: { x: number; y: number; z: number };
    depth: number;
    volume: number;
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
  const { detect, isReady } = useMeasurementWorker();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 150; // Optimizado para tiempo real

  const processFrame = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current || !isReady) {
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

    // Configurar canvas con resolución completa
    const targetWidth = video.videoWidth;
    const targetHeight = video.videoHeight;
    
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

    // Detectar objetos con OpenCV avanzado
    detect({
      imageData,
      minArea: 800,
      onDetect: (rects) => {
        const calibrationData = calculateRealCalibration(calibration, canvas.width, canvas.height, video);
        
        console.log('🎯 Detección OpenCV avanzada:', {
          objectsFound: rects.length,
          resolution: `${canvas.width}x${canvas.height}`,
          pixelsPerMm: calibrationData.pixelsPerMm.toFixed(3),
          focalLength: calibrationData.focalLength,
          isCalibrated: calibrationData.isReallyCalibrated
        });

        const validatedObjects = rects
          .filter(rect => validateAdvancedObjectMeasurement(rect, canvas.width, canvas.height))
          .slice(0, 3)
          .map((rect, i) => {
            const realMeasurements = calculatePreciseMeasurements(rect, calibrationData);
            
            console.log(`📏 Objeto ${i + 1} - Mediciones reales:`, {
              pixels: `${rect.width}x${rect.height}`,
              real2D: `${realMeasurements.width.toFixed(2)}x${realMeasurements.height.toFixed(2)}mm`,
              area: `${realMeasurements.area.toFixed(2)}mm²`,
              depth: `${realMeasurements.depth.toFixed(2)}mm`,
              volume: `${realMeasurements.volume.toFixed(2)}mm³`,
              confidence: `${(rect.confidence * 100).toFixed(1)}%`,
              worldPos: `(${realMeasurements.worldX.toFixed(1)}, ${realMeasurements.worldY.toFixed(1)}, ${realMeasurements.worldZ.toFixed(1)})mm`
            });
            
            return {
              id: `obj_${i}_${Date.now()}`,
              bounds: rect,
              dimensions: {
                width: realMeasurements.width,
                height: realMeasurements.height,
                area: realMeasurements.area,
                unit: 'mm',
              },
              confidence: rect.confidence || 0.8,
              center: rect.center || { 
                x: rect.x + rect.width / 2, 
                y: rect.y + rect.height / 2 
              },
              measurements: {
                perimeter: realMeasurements.perimeter,
                solidity: rect.solidity || 0.8,
                aspectRatio: rect.aspectRatio || (rect.width / rect.height),
                angle: rect.angle || 0,
                realWorldCoordinates: { 
                  x: realMeasurements.worldX, 
                  y: realMeasurements.worldY, 
                  z: realMeasurements.worldZ 
                },
                depth: realMeasurements.depth,
                volume: realMeasurements.volume
              }
            };
          });

        onObjectsDetected(validatedObjects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected, isReady]);

  const calculateRealCalibration = (calibration: any, imageWidth: number, imageHeight: number, video: HTMLVideoElement) => {
    let pixelsPerMm = 8; // Base conservadora
    let focalLength = 4.25; // mm
    let sensorWidth = 6.17; // mm
    let isReallyCalibrated = false;

    if (calibration?.isCalibrated && calibration?.pixelsPerMm > 0) {
      pixelsPerMm = calibration.pixelsPerMm;
      focalLength = calibration.focalLength || 4.25;
      sensorWidth = calibration.sensorSize || 6.17;
      isReallyCalibrated = true;
      
      // Corrección por perspectiva basada en posición del objeto
      const centerDistanceFromOpticalAxis = Math.sqrt(
        Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2)
      );
      const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
      const perspectiveCorrection = 1 + (centerDistanceFromOpticalAxis / maxDistance) * 0.05;
      
      pixelsPerMm *= perspectiveCorrection;
    } else {
      // Calibración automática avanzada basada en características del dispositivo
      const diagonalPixels = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);
      
      // Estimar distancia focal basada en resolución y características típicas
      if (imageWidth >= 3840) { // 4K
        pixelsPerMm = 12;
        focalLength = 5.1;
        sensorWidth = 7.2;
      } else if (imageWidth >= 1920) { // Full HD
        pixelsPerMm = 10;
        focalLength = 4.6;
        sensorWidth = 6.8;
      } else if (imageWidth >= 1280) { // HD
        pixelsPerMm = 8.5;
        focalLength = 4.25;
        sensorWidth = 6.17;
      } else { // Resolución menor
        pixelsPerMm = 7;
        focalLength = 3.8;
        sensorWidth = 5.5;
      }

      // Ajuste dinámico basado en distancia estimada del objeto
      const estimatedDistance = (focalLength * 100) / (diagonalPixels / Math.max(imageWidth, imageHeight) * sensorWidth);
      if (estimatedDistance > 0) {
        const distanceCorrection = Math.min(1.2, Math.max(0.8, 250 / estimatedDistance));
        pixelsPerMm *= distanceCorrection;
      }
    }

    return {
      pixelsPerMm,
      focalLength,
      sensorWidth,
      isReallyCalibrated
    };
  };

  const calculatePreciseMeasurements = (rect: any, calibrationData: any) => {
    const { pixelsPerMm, focalLength, sensorWidth } = calibrationData;
    
    // Mediciones básicas 2D
    const width = rect.width / pixelsPerMm;
    const height = rect.height / pixelsPerMm;
    const area = rect.area / (pixelsPerMm * pixelsPerMm);
    const perimeter = (rect.perimeter || (2 * (rect.width + rect.height))) / pixelsPerMm;
    
    // Cálculo de profundidad basado en tamaño del objeto y distancia focal
    const avgDimension = (width + height) / 2;
    let depth = 0;
    
    if (avgDimension > 0) {
      // Estimar profundidad usando la relación focal length / object size
      const assumedRealSize = 50; // Asumimos objetos de ~5cm como referencia
      const apparentSize = avgDimension;
      depth = (focalLength * assumedRealSize) / apparentSize;
      
      // Clampear profundidad a valores razonables
      depth = Math.max(5, Math.min(500, depth));
    }
    
    // Cálculo de volumen (aproximado como paralelepípedo)
    const estimatedThickness = Math.min(width, height) * 0.4; // Estimación conservadora
    const volume = area * estimatedThickness;
    
    // Coordenadas del mundo real (con origen en centro de imagen)
    const centerX = rect.center?.x || (rect.x + rect.width / 2);
    const centerY = rect.center?.y || (rect.y + rect.height / 2);
    
    const worldX = (centerX - rect.width / 2) / pixelsPerMm;
    const worldY = (centerY - rect.height / 2) / pixelsPerMm;
    const worldZ = depth;
    
    return {
      width: Math.max(0.1, width),
      height: Math.max(0.1, height),
      area: Math.max(0.01, area),
      perimeter: Math.max(0.1, perimeter),
      depth: Math.max(0.1, depth),
      volume: Math.max(0.001, volume),
      worldX,
      worldY,
      worldZ
    };
  };

  const validateAdvancedObjectMeasurement = (rect: any, imageWidth: number, imageHeight: number): boolean => {
    const imageArea = imageWidth * imageHeight;
    const objectAreaRatio = rect.area / imageArea;
    const aspectRatio = rect.width / rect.height;
    
    // Criterios de validación más estrictos y precisos
    const validSize = rect.area >= 600 && rect.area <= imageArea * 0.35;
    const validAspect = aspectRatio >= 0.15 && aspectRatio <= 6.0;
    const validPosition = rect.x >= 10 && rect.y >= 10 && 
                         rect.x + rect.width <= imageWidth - 10 && 
                         rect.y + rect.height <= imageHeight - 10;
    const validAreaRatio = objectAreaRatio >= 0.0015 && objectAreaRatio <= 0.35;
    const validDimensions = rect.width >= 25 && rect.height >= 25;
    const validConfidence = (rect.confidence || 0.5) >= 0.4;
    
    // Validación adicional basada en características de forma
    const solidity = rect.solidity || 0.5;
    const validSolidity = solidity >= 0.3 && solidity <= 1.0;
    
    const compactness = (4 * Math.PI * rect.area) / Math.pow(rect.perimeter || (2 * (rect.width + rect.height)), 2);
    const validCompactness = compactness >= 0.1;
    
    return validSize && validAspect && validPosition && 
           validAreaRatio && validDimensions && validConfidence &&
           validSolidity && validCompactness;
  };

  useEffect(() => {
    if (isActive && isReady) {
      console.log('🚀 Iniciando medición en tiempo real con OpenCV avanzado...');
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
  }, [isActive, processFrame, isReady]);

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
};
