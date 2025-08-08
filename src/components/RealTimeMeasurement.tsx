
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
  const PROCESS_INTERVAL = 150; // Intervalo optimizado para precisión

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

    // Usar resolución nativa del video para máxima precisión
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Configuración optimizada para medición precisa
    ctx.imageSmoothingEnabled = false; // Sin suavizado para preservar bordes
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    detect({
      imageData,
      minArea: 1200, // Área mínima optimizada
      onDetect: (rects) => {
        const conversionData = calculateAdvancedConversionFactor(calibration, canvas.width, canvas.height, video);
        
        console.log('Procesamiento de medición avanzado:', {
          rectsDetected: rects.length,
          videoResolution: `${video.videoWidth}x${video.videoHeight}`,
          canvasResolution: `${canvas.width}x${canvas.height}`,
          conversionData
        });

        const validatedObjects = rects
          .filter(rect => validateObjectForPrecisionMeasurement(rect, canvas.width, canvas.height))
          .slice(0, 1) // Un objeto para máxima precisión
          .map((rect, i) => {
            const realMeasurements = calculatePrecisionMeasurements(rect, conversionData);
            
            console.log(`Objeto ${i + 1} - Medición de precisión:`, {
              pixelDimensions: { width: rect.width, height: rect.height, area: rect.area },
              realMeasurements,
              confidence: rect.confidence,
              conversionFactor: conversionData.pixelsPerMm
            });
            
            return {
              id: `precision_obj_${i}_${Date.now()}`,
              bounds: rect,
              dimensions: {
                width: realMeasurements.width,
                height: realMeasurements.height,
                area: realMeasurements.area,
                unit: 'mm',
              },
              confidence: rect.confidence || 0.8,
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

  // Sistema de calibración avanzado con múltiples factores
  const calculateAdvancedConversionFactor = (calibration: any, imageWidth: number, imageHeight: number, video: HTMLVideoElement) => {
    let pixelsPerMm: number;
    let confidenceLevel: number;
    
    if (calibration?.isCalibrated && calibration?.pixelsPerMm > 0) {
      pixelsPerMm = calibration.pixelsPerMm;
      confidenceLevel = 0.95;
      console.log('Usando calibración manual:', { pixelsPerMm, confidenceLevel });
    } else {
      // Algoritmo de auto-calibración avanzado basado en especificaciones de cámara
      const cameraSpecs = detectCameraSpecifications(video);
      const autoCalibration = calculateAutoCalibration(cameraSpecs, imageWidth, imageHeight);
      
      pixelsPerMm = autoCalibration.pixelsPerMm;
      confidenceLevel = autoCalibration.confidence;
      
      console.log('Auto-calibración avanzada:', {
        cameraSpecs,
        autoCalibration,
        resultingFactor: pixelsPerMm
      });
    }
    
    return {
      pixelsPerMm,
      confidenceLevel,
      method: calibration?.isCalibrated ? 'manual' : 'auto',
      imageResolution: { width: imageWidth, height: imageHeight }
    };
  };

  const detectCameraSpecifications = (video: HTMLVideoElement) => {
    const resolution = {
      width: video.videoWidth,
      height: video.videoHeight,
      total: video.videoWidth * video.videoHeight
    };

    // Detectar tipo de cámara basado en resolución
    let cameraType = 'unknown';
    let estimatedFocalLength = 4.0; // mm
    let estimatedSensorSize = 6.17; // mm diagonal
    
    if (resolution.total >= 3840 * 2160) { // 4K
      cameraType = '4K_smartphone';
      estimatedFocalLength = 4.25;
      estimatedSensorSize = 7.56; // Sensor más grande para 4K
    } else if (resolution.total >= 1920 * 1080) { // Full HD
      cameraType = 'HD_smartphone';
      estimatedFocalLength = 4.0;
      estimatedSensorSize = 6.17;
    } else if (resolution.total >= 1280 * 720) { // HD
      cameraType = 'HD_basic';
      estimatedFocalLength = 3.8;
      estimatedSensorSize = 5.76;
    } else {
      cameraType = 'basic';
      estimatedFocalLength = 3.5;
      estimatedSensorSize = 5.0;
    }

    return {
      resolution,
      cameraType,
      estimatedFocalLength,
      estimatedSensorSize
    };
  };

  const calculateAutoCalibration = (cameraSpecs: any, imageWidth: number, imageHeight: number) => {
    const { estimatedFocalLength, estimatedSensorSize, resolution } = cameraSpecs;
    
    // Distancia de medición típica optimizada
    const typicalMeasurementDistance = 250; // mm (25cm)
    
    // Cálculo del campo de visión
    const sensorDiagonal = estimatedSensorSize;
    const fov = 2 * Math.atan(sensorDiagonal / (2 * estimatedFocalLength));
    
    // Tamaño real del campo de visión a la distancia de medición
    const realFieldDiagonal = 2 * typicalMeasurementDistance * Math.tan(fov / 2);
    
    // Diagonal de la imagen en píxeles
    const imageDiagonal = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);
    
    // Factor de conversión
    let pixelsPerMm = imageDiagonal / realFieldDiagonal;
    
    // Ajustes basados en el tipo de cámara
    let confidence = 0.7;
    switch (cameraSpecs.cameraType) {
      case '4K_smartphone':
        pixelsPerMm *= 1.05; // Corrección para cámaras 4K
        confidence = 0.85;
        break;
      case 'HD_smartphone':
        pixelsPerMm *= 1.02; // Corrección menor
        confidence = 0.75;
        break;
      case 'HD_basic':
        pixelsPerMm *= 0.98;
        confidence = 0.65;
        break;
      default:
        pixelsPerMm *= 0.95;
        confidence = 0.6;
    }
    
    // Clampear dentro de rangos razonables
    pixelsPerMm = Math.max(3, Math.min(25, pixelsPerMm));
    
    return { pixelsPerMm, confidence };
  };

  const validateObjectForPrecisionMeasurement = (rect: any, imageWidth: number, imageHeight: number): boolean => {
    const imageArea = imageWidth * imageHeight;
    const objectAreaRatio = rect.area / imageArea;
    const aspectRatio = rect.width / rect.height;
    const perimeter = 2 * (rect.width + rect.height);
    const compactness = (4 * Math.PI * rect.area) / (perimeter * perimeter);
    
    // Criterios estrictos para medición de precisión
    const validSize = rect.area >= 1000 && rect.area <= imageArea * 0.5;
    const validAspectRatio = aspectRatio >= 0.1 && aspectRatio <= 8.0;
    const validPosition = rect.x >= 10 && rect.y >= 10 && 
                         rect.x + rect.width <= imageWidth - 10 && 
                         rect.y + rect.height <= imageHeight - 10;
    const validAreaRatio = objectAreaRatio >= 0.002 && objectAreaRatio <= 0.5;
    const validDimensions = rect.width >= 25 && rect.height >= 25;
    const validCompactness = compactness >= 0.2; // Formas no muy irregulares
    const validConfidence = (rect.confidence || 0.5) >= 0.4;
    
    const isValid = validSize && validAspectRatio && validPosition && 
                   validAreaRatio && validDimensions && validCompactness && validConfidence;
    
    if (!isValid) {
      console.log('Objeto rechazado para medición de precisión:', {
        area: rect.area,
        aspectRatio: aspectRatio.toFixed(2),
        areaRatio: objectAreaRatio.toFixed(4),
        compactness: compactness.toFixed(3),
        confidence: (rect.confidence || 0.5).toFixed(2),
        position: `${rect.x},${rect.y}`,
        size: `${rect.width}x${rect.height}`,
        failedCriteria: {
          size: !validSize,
          aspectRatio: !validAspectRatio,
          position: !validPosition,
          areaRatio: !validAreaRatio,
          dimensions: !validDimensions,
          compactness: !validCompactness,
          confidence: !validConfidence
        }
      });
    }
    
    return isValid;
  };

  const calculatePrecisionMeasurements = (rect: any, conversionData: any) => {
    const { pixelsPerMm, confidenceLevel } = conversionData;
    
    // Cálculos básicos
    const rawWidth = rect.width / pixelsPerMm;
    const rawHeight = rect.height / pixelsPerMm;
    const rawArea = rect.area / (pixelsPerMm * pixelsPerMm);
    
    // Correcciones por distorsión de perspectiva y óptica
    const perspectiveCorrection = calculatePerspectiveCorrection(rect, conversionData);
    const opticalCorrection = calculateOpticalCorrection(rect, conversionData);
    
    // Aplicar correcciones
    const correctedWidth = rawWidth * perspectiveCorrection * opticalCorrection;
    const correctedHeight = rawHeight * perspectiveCorrection * opticalCorrection;
    const correctedArea = rawArea * perspectiveCorrection * perspectiveCorrection * opticalCorrection * opticalCorrection;
    
    return {
      width: correctedWidth,
      height: correctedHeight,
      area: correctedArea,
      corrections: {
        perspective: perspectiveCorrection,
        optical: opticalCorrection,
        confidence: confidenceLevel
      }
    };
  };

  const calculatePerspectiveCorrection = (rect: any, conversionData: any) => {
    const { imageResolution } = conversionData;
    const centerX = imageResolution.width / 2;
    const centerY = imageResolution.height / 2;
    
    const objectCenterX = rect.x + rect.width / 2;
    const objectCenterY = rect.y + rect.height / 2;
    
    // Distancia del centro normalizada
    const distanceFromCenter = Math.sqrt(
      Math.pow((objectCenterX - centerX) / centerX, 2) + 
      Math.pow((objectCenterY - centerY) / centerY, 2)
    );
    
    // Corrección de perspectiva (objetos más lejos del centro aparecen más pequeños)
    const perspectiveCorrection = 1.0 + (distanceFromCenter * 0.08); // 8% máximo de corrección
    
    return Math.min(1.15, perspectiveCorrection); // Límite de corrección
  };

  const calculateOpticalCorrection = (rect: any, conversionData: any) => {
    // Corrección por distorsión de barril/cojín típica en smartphones
    const { imageResolution } = conversionData;
    const objectSize = Math.sqrt(rect.area);
    const imageSize = Math.sqrt(imageResolution.width * imageResolution.height);
    const sizeRatio = objectSize / imageSize;
    
    // Objetos pequeños necesitan menos corrección óptica
    const opticalCorrection = 1.0 + (sizeRatio * 0.05); // 5% máximo
    
    return Math.min(1.08, opticalCorrection);
  };

  useEffect(() => {
    if (isActive) {
      console.log('Iniciando sistema de medición de precisión con OpenCV avanzado:', isLoaded);
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
