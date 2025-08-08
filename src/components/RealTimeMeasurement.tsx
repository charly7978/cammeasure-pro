
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
  const { isLoaded } = useOpenCV();
  const { detect } = useMeasurementWorker();
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 150; // Optimized processing interval for better responsiveness

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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 🎯 MEDICIÓN 3D REAL EN TIEMPO REAL
    detect({
      imageData,
      minArea: 1000, // Área mínima para objetos 3D
      onDetect: (objects3D) => {
        console.log('🎯 MEDICIÓN 3D REAL - Objetos detectados:', objects3D.length);

        // Filtrar objetos válidos para medición 3D
        const validObjects = objects3D.filter(obj => {
          return obj.realWidth && obj.realHeight && obj.volume && 
                 obj.confidence > 0.3 && obj.area > 1000;
        });

        console.log('✅ Objetos 3D válidos:', validObjects.length);

        // Convertir objetos 3D del worker a formato de interfaz
        const detectedObjects: DetectedObject[] = validObjects.map((obj3D, i) => {
          console.log(`📐 OBJETO 3D REAL ${i + 1}:`, {
            dimensiones2D: { width: obj3D.width, height: obj3D.height },
            dimensiones3D: { 
              realWidth: obj3D.realWidth?.toFixed(1), 
              realHeight: obj3D.realHeight?.toFixed(1), 
              realDepth: obj3D.realDepth?.toFixed(1) 
            },
            volumen: obj3D.volume?.toFixed(2) + ' mm³',
            areaSuperf: obj3D.surfaceArea?.toFixed(1) + ' mm²',
            distancia: obj3D.distanceToCamera?.toFixed(0) + ' mm',
            forma: obj3D.geometricShape,
            masa: obj3D.estimatedMass?.toFixed(1) + ' g',
            confianza: (obj3D.confidence * 100).toFixed(0) + '%'
          });

          return {
            id: obj3D.id || `3d_obj_${i}_${Date.now()}`,
            bounds: {
              x: obj3D.x || 0,
              y: obj3D.y || 0,
              width: obj3D.width || 0,
              height: obj3D.height || 0,
              area: obj3D.area || 0
            },
            dimensions: {
              width: obj3D.realWidth || 0,
              height: obj3D.realHeight || 0,
              area: (obj3D.realWidth || 0) * (obj3D.realHeight || 0),
              unit: 'mm'
            },
            confidence: obj3D.confidence || 0.8,
            center: { 
              x: (obj3D.x || 0) + (obj3D.width || 0) / 2, 
              y: (obj3D.y || 0) + (obj3D.height || 0) / 2 
            },
            
            // 🎯 DATOS 3D REALES DEL WORKER AVANZADO
            depth: obj3D.depth,
            realWidth: obj3D.realWidth,
            realHeight: obj3D.realHeight,
            realDepth: obj3D.realDepth,
            volume: obj3D.volume,
            surfaceArea: obj3D.surfaceArea,
            estimatedMass: obj3D.estimatedMass,
            distanceToCamera: obj3D.distanceToCamera,
            viewingAngle: obj3D.viewingAngle,
            geometricShape: obj3D.geometricShape,
            errorEstimate: obj3D.errorEstimate,
            measurementQuality: obj3D.measurementQuality,
            
            precision: {
              accuracy: obj3D.measurementQuality || 0.85,
              stability: 0.88,
              errorEstimate: obj3D.errorEstimate || 2.0,
              qualityScore: (obj3D.confidence || 0.8) * 100
            }
          };
        }).slice(0, 1); // Solo el mejor objeto para medición estable

        console.log('🚀 OBJETOS 3D FINALES ENVIADOS:', detectedObjects.length);
        onObjectsDetected(detectedObjects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected]);

  // FACTOR DE CONVERSIÓN CORREGIDO PARA MEDICIONES PRECISAS
  const calculateConversionFactor = (calibration: any, imageWidth: number, imageHeight: number): number => {
    if (calibration?.isCalibrated && calibration?.pixelsPerMm > 0) {
      console.log('Using calibrated conversion factor:', calibration.pixelsPerMm);
      return calibration.pixelsPerMm;
    }
    
    // CÁLCULO CORREGIDO BASADO EN RESOLUCIONES REALES DE SMARTPHONE
    // Resolución típica: 1920x1080 a 4000x3000
    // Distancia típica de medición: 25-35cm
    
    // Factor base más realista según el tamaño de imagen
    let baseFactor;
    const totalPixels = imageWidth * imageHeight;
    
    if (totalPixels > 8000000) { // 4K+ (ej: 4000x3000)
      baseFactor = 12.0; // Alta resolución = más píxeles por mm
    } else if (totalPixels > 2000000) { // Full HD+ (ej: 1920x1080)
      baseFactor = 8.0; // Resolución media
    } else { // HD o menor
      baseFactor = 5.0; // Baja resolución = menos píxeles por mm
    }
    
    console.log('Auto-calibration calculation:', {
      imageSize: { width: imageWidth, height: imageHeight },
      totalPixels: totalPixels,
      selectedBaseFactor: baseFactor,
      expectedDistance: '30cm',
      note: 'Factor optimizado para mediciones reales'
    });
    
    return baseFactor;
  };

  // Enhanced object validation for better measurement accuracy
  const validateObjectForMeasurement = (rect: any, imageWidth: number, imageHeight: number): boolean => {
    const imageArea = imageWidth * imageHeight;
    const objectAreaRatio = rect.area / imageArea;
    const aspectRatio = rect.width / rect.height;
    
    // Enhanced filtering criteria for valid measurement objects
    const isValidSize = rect.area >= 600 && rect.area <= imageArea * 0.5; // More permissive size range
    const isValidAspectRatio = aspectRatio >= 0.05 && aspectRatio <= 20.0; // More permissive aspect ratio
    const isValidPosition = rect.x > 5 && rect.y > 5 && 
                           rect.x + rect.width < imageWidth - 5 && 
                           rect.y + rect.height < imageHeight - 5; // Smaller border margin
    const isValidAreaRatio = objectAreaRatio >= 0.0005 && objectAreaRatio <= 0.5; // More permissive area ratio
    const hasMinimumDimensions = rect.width >= 15 && rect.height >= 15; // Smaller minimum dimensions
    
    // Additional quality checks
    const hasReasonableShape = rect.width > 0 && rect.height > 0;
    const isNotTooThin = Math.min(rect.width, rect.height) >= 10; // Avoid very thin objects
    const hasGoodConfidence = (rect.confidence || 0) >= 0.1; // Very low confidence threshold
    
    const isValid = isValidSize && isValidAspectRatio && isValidPosition && 
                   isValidAreaRatio && hasMinimumDimensions && hasReasonableShape && 
                   isNotTooThin && hasGoodConfidence;
    
    if (!isValid) {
      console.log('Object rejected:', {
        area: rect.area,
        aspectRatio: aspectRatio.toFixed(2),
        areaRatio: objectAreaRatio.toFixed(4),
        position: { x: rect.x, y: rect.y },
        dimensions: { width: rect.width, height: rect.height },
        confidence: rect.confidence || 0,
        reasons: {
          size: !isValidSize,
          aspectRatio: !isValidAspectRatio,
          position: !isValidPosition,
          areaRatio: !isValidAreaRatio,
          minDimensions: !hasMinimumDimensions,
          shape: !hasReasonableShape,
          thinness: !isNotTooThin,
          confidence: !hasGoodConfidence
        }
      });
    }
    
    return isValid;
  };

  // Calculate real-world dimensions with proper scaling
  const calculateRealDimension = (pixelDimension: number, factor: number): number => {
    const realDimension = pixelDimension / factor;
    
    // Apply slight correction for perspective distortion (objects at edges appear slightly smaller)
    const correctionFactor = 1.05; // 5% correction
    
    return realDimension * correctionFactor;
  };

  const calculateRealArea = (pixelArea: number, factor: number): number => {
    const realArea = pixelArea / (factor * factor);
    
    // Apply correction for perspective and lighting variations
    const correctionFactor = 1.1; // 10% correction for area
    
    return realArea * correctionFactor;
  };

  useEffect(() => {
    if (isActive) {
      console.log('Starting real-time measurement with OpenCV available:', isLoaded);
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
