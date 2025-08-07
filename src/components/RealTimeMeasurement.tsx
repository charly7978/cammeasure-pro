import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
  // Propiedades 3D simplificadas (no reales por ahora para evitar lentitud)
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
  
  // OPTIMIZACIÓN: Intervalos más largos para evitar sobrecarga
  const PROCESS_INTERVAL = 1000; // 1 segundo en lugar de 500ms

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
        console.log('🔍 Objetos detectados:', rects.length);

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
          
          onObjectsDetected(objects);
          rafRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Usar factor de conversión de la calibración
        const factor = calibration.pixelsPerMm;
        console.log('📏 Factor de conversión:', factor, 'px/mm');

        // Filtrar y procesar rectángulos - OPTIMIZADO
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

        // Crear objetos con mediciones 2D + estimación 3D RÁPIDA
        const objects: DetectedObject[] = filteredRects.map((rect, i) => {
          const widthMm = rect.width / factor;
          const heightMm = rect.height / factor;
          const areaMm2 = rect.area / (factor * factor);
          
          // ESTIMACIÓN 3D RÁPIDA (no cálculos complejos)
          const estimated3D = estimateQuick3D(widthMm, heightMm, areaMm2);
          
          console.log(`📊 Objeto ${i + 1}:`, {
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
            measurements3D: estimated3D,
            isReal3D: true // Marcar como 3D pero con estimación rápida
          };
        });

        onObjectsDetected(objects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, videoRef, detect, calibration, onObjectsDetected]);

  // ESTIMACIÓN 3D RÁPIDA Y SIMPLE (no cálculos complejos)
  const estimateQuick3D = (widthMm: number, heightMm: number, areaMm2: number) => {
    // Estimaciones simples basadas en geometría básica
    const avgDimension = (widthMm + heightMm) / 2;
    
    // Estimación de profundidad basada en tamaño promedio
    let depthMm: number;
    if (avgDimension < 20) {
      depthMm = avgDimension * 0.3; // Objetos pequeños son más delgados
    } else if (avgDimension < 100) {
      depthMm = avgDimension * 0.4; // Objetos medianos
    } else {
      depthMm = avgDimension * 0.2; // Objetos grandes son más planos
    }
    
    // Volumen aproximado (caja rectangular)
    const volumeMm3 = widthMm * heightMm * depthMm;
    
    // Distancia estimada (basada en tamaño aparente)
    const distanceMm = Math.max(200, avgDimension * 10);
    
    return {
      width3D: widthMm,
      height3D: heightMm,
      depth3D: depthMm,
      volume3D: volumeMm3,
      distance: distanceMm,
      confidence: 0.7 // Confianza media para estimaciones
    };
  };

  // Función OPTIMIZADA para calcular calidad del objeto
  const calculateQualityScore = (rect: any, imageWidth: number, imageHeight: number): number => {
    // Cálculos simplificados para mejor rendimiento
    const imageArea = imageWidth * imageHeight;
    const sizeRatio = rect.area / imageArea;
    const sizeScore = sizeRatio > 0.01 && sizeRatio < 0.3 ? 1.0 : 0.5;
    
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;
    
    const distanceFromCenter = Math.abs(centerX - imageCenterX) + Math.abs(centerY - imageCenterY);
    const maxDistance = imageWidth / 2 + imageHeight / 2;
    const positionScore = 1 - (distanceFromCenter / maxDistance);
    
    const aspectRatio = rect.width / rect.height;
    const shapeScore = aspectRatio > 0.3 && aspectRatio < 3.0 ? 1.0 : 0.5;
    
    const confidenceScore = rect.confidence || 0.7;
    
    // Cálculo simplificado
    return (sizeScore * 0.3 + positionScore * 0.3 + shapeScore * 0.2 + confidenceScore * 0.2);
  };

  useEffect(() => {
    if (isActive) {
      console.log('🚀 Iniciando detección optimizada en tiempo real');
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