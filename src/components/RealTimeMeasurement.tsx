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
  // Nuevas propiedades 3D reales
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
  
  const PROCESS_INTERVAL = 500; // Procesar cada 500ms para detección 2D

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
      minArea: 3000,
      onDetect: (rects) => {
        console.log('🔍 Objetos 2D detectados:', rects.length);

        // Verificar calibración
        if (!calibration || !calibration.isCalibrated || calibration.pixelsPerMm <= 0) {
          console.warn('⚠️ Sin calibración válida - medidas en píxeles');
          
          const objects: DetectedObject[] = rects.map((rect, i) => ({
            id: `obj_${i}_${Date.now()}`,
            bounds: rect,
            dimensions: {
              width: rect.width,
              height: rect.height,
              area: rect.area,
              unit: 'px',
            },
            confidence: rect.confidence || 0.7,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            isReal3D: false
          }));
          
          setDetected2DObjects(rects);
          onObjectsDetected(objects);
          rafRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Usar factor de conversión de la calibración
        const factor = calibration.pixelsPerMm;
        console.log('📏 Factor de conversión:', factor, 'px/mm');

        // Filtrar y procesar rectángulos
        const filteredRects = rects
          .filter(rect => {
            const aspectRatio = rect.width / rect.height;
            const imageArea = canvas.width * canvas.height;
            
            return rect.area >= 3000 && 
                   rect.area <= imageArea * 0.3 &&
                   aspectRatio > 0.25 && aspectRatio < 4.0 &&
                   rect.width > 60 && rect.height > 60;
          })
          .map(rect => ({
            ...rect,
            qualityScore: calculateQualityScore(rect, canvas.width, canvas.height)
          }))
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, 1); // Solo el mejor objeto

        // Guardar objetos 2D para procesamiento 3D
        setDetected2DObjects(filteredRects);

        // Crear objetos 2D básicos
        const objects2D: DetectedObject[] = filteredRects.map((rect, i) => {
          const widthMm = rect.width / factor;
          const heightMm = rect.height / factor;
          const areaMm2 = rect.area / (factor * factor);
          
          console.log(`📊 Objeto 2D ${i + 1}:`, {
            pixelWidth: rect.width,
            pixelHeight: rect.height,
            mmWidth: widthMm.toFixed(2),
            mmHeight: heightMm.toFixed(2),
            mmArea: areaMm2.toFixed(2)
          });
          
          return {
            id: `obj_${i}_${Date.now()}`,
            bounds: rect,
            dimensions: {
              width: widthMm,
              height: heightMm,
              area: areaMm2,
              unit: 'mm',
            },
            confidence: rect.qualityScore,
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            isReal3D: false
          };
        });

        // Combinar con objetos 3D si están disponibles
        const combinedObjects = combineWith3DData(objects2D, objects3D);
        onObjectsDetected(combinedObjects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, objects3D, onObjectsDetected]);

  // Función para calcular calidad del objeto
  const calculateQualityScore = (rect: any, imageWidth: number, imageHeight: number): number => {
    const imageArea = imageWidth * imageHeight;
    const sizeRatio = rect.area / imageArea;
    const idealSizeRatio = 0.05;
    const sizeScore = Math.exp(-Math.pow((sizeRatio - idealSizeRatio) / idealSizeRatio, 2));
    
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - imageCenterX, 2) + 
      Math.pow(centerY - imageCenterY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
    const positionScore = 1 - (distanceFromCenter / maxDistance);
    
    const aspectRatio = rect.width / rect.height;
    const shapeScore = aspectRatio > 0.3 && aspectRatio < 3.0 ? 
      1 - Math.abs(Math.log(aspectRatio)) / 2 : 0.3;
    
    const confidenceScore = rect.confidence || 0.7;
    
    const perimeter = 2 * (rect.width + rect.height);
    const compactness = (4 * Math.PI * rect.area) / (perimeter * perimeter);
    const definitionScore = Math.min(compactness * 2, 1.0);
    
    return (
      sizeScore * 0.25 + 
      positionScore * 0.25 + 
      shapeScore * 0.2 + 
      confidenceScore * 0.15 + 
      definitionScore * 0.15
    );
  };

  // Combinar datos 2D con mediciones 3D reales
  const combineWith3DData = (objects2D: DetectedObject[], objects3D: Real3DObject[]): DetectedObject[] => {
    return objects2D.map(obj2D => {
      // Buscar objeto 3D correspondiente
      const matching3D = objects3D.find(obj3D => {
        const overlap = calculateOverlap(obj2D.bounds, obj3D.bounds);
        return overlap > 0.7; // 70% de superposición
      });

      if (matching3D) {
        console.log('🎯 Combinando datos 2D + 3D real para objeto:', obj2D.id);
        
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

  // Manejar objetos 3D detectados
  const handle3DObjects = useCallback((newObjects3D: Real3DObject[]) => {
    console.log('🎉 Objetos 3D reales recibidos:', newObjects3D.length);
    setObjects3D(newObjects3D);
    
    // Log detallado de mediciones 3D
    newObjects3D.forEach((obj, index) => {
      console.log(`📏 Objeto 3D ${index + 1} - Mediciones reales:`, {
        width: `${obj.measurements3D.width3D.toFixed(2)}mm`,
        height: `${obj.measurements3D.height3D.toFixed(2)}mm`,
        depth: `${obj.measurements3D.depth3D.toFixed(2)}mm`,
        volume: `${obj.measurements3D.volume3D.toFixed(2)}mm³`,
        distance: `${obj.measurements3D.distance.toFixed(2)}mm`,
        confidence: `${(obj.measurements3D.confidence * 100).toFixed(1)}%`,
        points3D: obj.measurements3D.points3D.length
      });
    });
  }, []);

  useEffect(() => {
    if (isActive) {
      console.log('🚀 Iniciando detección en tiempo real (2D + 3D real)');
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
      
      {/* Componente de medición 3D real */}
      <Real3DMeasurement
        videoRef={videoRef}
        onObjects3DDetected={handle3DObjects}
        isActive={isActive}
        detectedObjects={detected2DObjects}
      />
    </>
  );
};