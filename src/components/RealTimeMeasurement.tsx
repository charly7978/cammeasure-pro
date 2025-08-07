import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';
import { Real3DMeasurement, type Real3DObject } from './Real3DMeasurement';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
  // Propiedades 3D reales
  measurements3D?: {
    width3D: number;
    height3D: number;
    depth3D: number;
    volume3D: number;
    distance: number;
    confidence: number;
  };
  isReal3D?: boolean;
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
  const [detected2DObjects, setDetected2DObjects] = useState<any[]>([]);
  const [objects3D, setObjects3D] = useState<Real3DObject[]>([]);
  const frameCountRef = useRef<number>(0);
  
  // OPTIMIZACIÓN INTELIGENTE: Intervalos adaptativos
  const PROCESS_INTERVAL = 400; // 400ms para balance perfecto entre calidad y rendimiento
  const FRAME_SKIP = 2; // Procesar cada 2 frames para mejor rendimiento

  const processFrame = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    frameCountRef.current++;
    
    // Skip frames para optimización
    if (frameCountRef.current % FRAME_SKIP !== 0) {
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
      minArea: 2500, // Área mínima optimizada
      onDetect: (rects) => {
        console.log('🔍 Objetos detectados con algoritmos avanzados:', rects.length);

        // SIEMPRE usar calibración por defecto para medidas en mm/cm
        const factor = calibration?.pixelsPerMm || 6.5; // Factor por defecto si no hay calibración
        const isCalibrated = calibration?.isCalibrated || false;
        
        console.log('📏 Factor de conversión:', factor, 'px/mm', isCalibrated ? '(calibrado)' : '(por defecto)');

        // Filtrar y procesar rectángulos con algoritmos avanzados
        const filteredRects = rects
          .filter(rect => {
            const aspectRatio = rect.width / rect.height;
            const imageArea = canvas.width * canvas.height;
            
            return rect.area >= 2500 && 
                   rect.area <= imageArea * 0.35 &&
                   aspectRatio > 0.2 && aspectRatio < 6.0 &&
                   rect.width > 35 && rect.height > 35;
          })
          .map(rect => ({
            ...rect,
            qualityScore: calculateAdvancedQualityScore(rect, canvas.width, canvas.height)
          }))
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, 3); // Top 3 objetos para balance rendimiento/calidad

        // Guardar objetos 2D para procesamiento 3D
        setDetected2DObjects(filteredRects);

        // Crear objetos 2D con mediciones REALES en mm/cm
        const objects2D: DetectedObject[] = filteredRects.map((rect, i) => {
          const widthMm = rect.width / factor;
          const heightMm = rect.height / factor;
          const areaMm2 = rect.area / (factor * factor);
          
          console.log(`📊 Objeto ${i + 1} - Mediciones REALES:`, {
            pixelWidth: rect.width,
            pixelHeight: rect.height,
            realWidthMm: widthMm.toFixed(2),
            realHeightMm: heightMm.toFixed(2),
            realAreaMm2: areaMm2.toFixed(2),
            confidence: (rect.qualityScore * 100).toFixed(1) + '%'
          });
          
          return {
            id: `obj_${i}_${Date.now()}`,
            bounds: rect,
            dimensions: {
              width: widthMm,
              height: heightMm,
              area: areaMm2,
              unit: 'mm', // SIEMPRE en milímetros para mediciones reales
            },
            confidence: rect.qualityScore,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            isReal3D: false // Se actualizará cuando lleguen datos 3D
          };
        });

        // Combinar con objetos 3D si están disponibles
        const combinedObjects = combineWith3DData(objects2D, objects3D);
        onObjectsDetected(combinedObjects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, objects3D, onObjectsDetected]);

  // Función AVANZADA para calcular calidad del objeto
  const calculateAdvancedQualityScore = (rect: any, imageWidth: number, imageHeight: number): number => {
    const imageArea = imageWidth * imageHeight;
    const sizeRatio = rect.area / imageArea;
    const idealSizeRatio = 0.08; // 8% del área de la imagen es ideal
    
    // Puntuación por tamaño (distribución gaussiana)
    const sizeScore = Math.exp(-Math.pow((sizeRatio - idealSizeRatio) / idealSizeRatio, 2));
    
    // Puntuación por posición central (más peso al centro)
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - imageCenterX, 2) + 
      Math.pow(centerY - imageCenterY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
    const positionScore = Math.pow(1 - (distanceFromCenter / maxDistance), 2);
    
    // Puntuación por forma (relación de aspecto)
    const aspectRatio = rect.width / rect.height;
    const idealAspectRatio = 1.0; // Objetos cuadrados/rectangulares son ideales
    const aspectScore = 1 / (1 + Math.abs(Math.log(aspectRatio / idealAspectRatio)));
    
    // Puntuación por confianza del detector
    const detectorConfidence = rect.confidence || 0.8;
    
    // Puntuación por definición de bordes (si está disponible)
    const edgeScore = rect.circularity ? Math.min(rect.circularity * 2, 1.0) : 0.7;
    
    // Puntuación por solidez (si está disponible)
    const solidityScore = rect.solidity || 0.8;
    
    // Combinar todos los factores con pesos optimizados
    const totalScore = (
      sizeScore * 0.25 + 
      positionScore * 0.25 + 
      aspectScore * 0.15 + 
      detectorConfidence * 0.15 + 
      edgeScore * 0.1 + 
      solidityScore * 0.1
    );
    
    return Math.min(totalScore, 1.0);
  };

  // Combinar datos 2D con mediciones 3D reales
  const combineWith3DData = (objects2D: DetectedObject[], objects3D: Real3DObject[]): DetectedObject[] => {
    return objects2D.map(obj2D => {
      // Buscar objeto 3D correspondiente con algoritmo mejorado
      const matching3D = objects3D.find(obj3D => {
        const overlap = calculateOverlap(obj2D.bounds, obj3D.bounds);
        const sizeCompatibility = calculateSizeCompatibility(obj2D.bounds, obj3D.bounds);
        return overlap > 0.6 && sizeCompatibility > 0.7; // Criterios más estrictos
      });

      if (matching3D) {
        console.log('🎯 Combinando datos 2D + 3D REAL para objeto:', obj2D.id);
        console.log('📏 Mediciones 3D REALES:', {
          width3D: matching3D.measurements3D.width3D.toFixed(2) + 'mm',
          height3D: matching3D.measurements3D.height3D.toFixed(2) + 'mm',
          depth3D: matching3D.measurements3D.depth3D.toFixed(2) + 'mm',
          volume3D: matching3D.measurements3D.volume3D.toFixed(2) + 'mm³',
          distance: matching3D.measurements3D.distance.toFixed(2) + 'mm'
        });
        
        return {
          ...obj2D,
          measurements3D: {
            width3D: matching3D.measurements3D.width3D,
            height3D: matching3D.measurements3D.height3D,
            depth3D: matching3D.measurements3D.depth3D,
            volume3D: matching3D.measurements3D.volume3D,
            distance: matching3D.measurements3D.distance,
            confidence: matching3D.measurements3D.confidence
          },
          isReal3D: true,
          confidence: Math.max(obj2D.confidence, matching3D.confidence)
        };
      }

      return obj2D;
    });
  };

  // Calcular superposición entre rectángulos
  const calculateOverlap = (rect1: any, rect2: any): number => {
    const x1 = Math.max(rect1.x, rect2.x);
    const y1 = Math.max(rect1.y, rect2.y);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const overlapArea = (x2 - x1) * (y2 - y1);
    const rect1Area = rect1.width * rect1.height;
    const rect2Area = rect2.width * rect2.height;
    const unionArea = rect1Area + rect2Area - overlapArea;
    
    return overlapArea / unionArea;
  };

  // Calcular compatibilidad de tamaño
  const calculateSizeCompatibility = (rect1: any, rect2: any): number => {
    const area1 = rect1.width * rect1.height;
    const area2 = rect2.width * rect2.height;
    const ratio = Math.min(area1, area2) / Math.max(area1, area2);
    return ratio;
  };

  // Manejar objetos 3D detectados
  const handle3DObjects = useCallback((newObjects3D: Real3DObject[]) => {
    console.log('🎉 Objetos 3D REALES recibidos:', newObjects3D.length);
    setObjects3D(newObjects3D);
    
    // Log detallado de mediciones 3D REALES
    newObjects3D.forEach((obj, index) => {
      console.log(`📏 Objeto 3D ${index + 1} - Mediciones REALES:`, {
        width: `${obj.measurements3D.width3D.toFixed(2)}mm`,
        height: `${obj.measurements3D.height3D.toFixed(2)}mm`,
        depth: `${obj.measurements3D.depth3D.toFixed(2)}mm`,
        volume: `${obj.measurements3D.volume3D.toFixed(2)}mm³`,
        distance: `${obj.measurements3D.distance.toFixed(2)}mm`,
        confidence: `${(obj.measurements3D.confidence * 100).toFixed(1)}%`,
        points3D: obj.measurements3D.points3D.length,
        method: 'Structure from Motion'
      });
    });
  }, []);

  useEffect(() => {
    if (isActive) {
      console.log('🚀 Iniciando detección AVANZADA en tiempo real (2D + 3D REAL)');
      console.log('⚙️ Configuración optimizada:', {
        interval: PROCESS_INTERVAL + 'ms',
        frameSkip: FRAME_SKIP,
        minArea: '2500px',
        maxObjects: 3,
        algorithms: 'OpenCV + Nativo Avanzado'
      });
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

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Componente de medición 3D REAL reactivado */}
      <Real3DMeasurement
        videoRef={videoRef}
        onObjects3DDetected={handle3DObjects}
        isActive={isActive}
        detectedObjects={detected2DObjects}
      />
    </>
  );
};