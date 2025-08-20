import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Target, Zap, Activity } from 'lucide-react';

interface RealTimeMeasurementProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  onObjectsDetected?: (objects: DetectedObject[]) => void;
  isActive: boolean;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement>;
  onMeasurementUpdate: (measurement: RealTimeMeasurementType) => void;
  onError: (error: string) => void;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
  overlayCanvasRef,
  onMeasurementUpdate,
  onError
}) => {
  
  const { isReady: opencvLoaded, opencvFunctions } = useOpenCV();
  const { getPixelsPerMm, isCalibrated } = useCalibration();
  const [clickMode, setClickMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState<RealTimeMeasurementType | null>(null);
  const processTimeoutRef = useRef<NodeJS.Timeout>();
  
  const pixelsPerMm = isCalibrated() ? getPixelsPerMm() : 1;
  
  // CAPTURAR FRAME DEL VIDEO
  const captureVideoFrame = useCallback((): ImageData | null => {
    if (!videoRef?.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== 4) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [videoRef]);

  // MEDICIÓN COMPLETA CON OPENCV
  const performMeasurement = useCallback(async (imageData: ImageData, clickX?: number, clickY?: number): Promise<RealTimeMeasurementType> => {
    if (!opencvLoaded) {
      throw new Error('OpenCV no está cargado');
    }

    console.log('🎯 INICIANDO MEDICIÓN CON OPENCV...', clickX ? `Click en: ${clickX}, ${clickY}` : 'Automática');
    
    // Crear ImageData de destino para conversiones
    const grayImageData = new ImageData(imageData.width, imageData.height);
    const blurredImageData = new ImageData(imageData.width, imageData.height);
    const edgesImageData = new ImageData(imageData.width, imageData.height);
    
    // Convertir a gris
    opencvFunctions.cvtColor(imageData, grayImageData, opencvFunctions.COLOR_RGBA2GRAY);
    
    // Aplicar blur para reducir ruido
    opencvFunctions.GaussianBlur(grayImageData, blurredImageData, [5, 5], 2);
    
    // Detección de bordes con Canny
    opencvFunctions.Canny(blurredImageData, edgesImageData, 50, 150);
    
    // Preparar arrays para contornos
    const contours: any[] = [];
    const hierarchy: any[] = [];
    
    // Encontrar contornos
    opencvFunctions.findContours(edgesImageData, contours, hierarchy, opencvFunctions.RETR_EXTERNAL, opencvFunctions.CHAIN_APPROX_SIMPLE);
    
    if (contours.length === 0) {
      throw new Error('No se encontraron objetos para medir');
    }

    // Encontrar el contorno más relevante
    let targetContour = contours[0];
    let maxArea = 0;
    
    if (clickX !== undefined && clickY !== undefined) {
      // Buscar el contorno más grande cerca del punto clickeado
      const searchRadius = 100;
      for (const contour of contours) {
        const area = opencvFunctions.contourArea(contour);
        const boundingBox = opencvFunctions.boundingRect(contour);
        
        // Verificar si el click está cerca del contorno
        const distanceToCenter = Math.sqrt(
          Math.pow(clickX - (boundingBox.x + boundingBox.width / 2), 2) +
          Math.pow(clickY - (boundingBox.y + boundingBox.height / 2), 2)
        );
        
        if (distanceToCenter < searchRadius && area > maxArea) {
          maxArea = area;
          targetContour = contour;
        }
      }
    } else {
      // Buscar el contorno más grande cerca del centro
      const centerX = imageData.width / 2;
      const centerY = imageData.height / 2;
      
      for (const contour of contours) {
        const area = opencvFunctions.contourArea(contour);
        const boundingBox = opencvFunctions.boundingRect(contour);
        
        if (area > 100) { // Filtrar contornos muy pequeños
          // Preferir contornos cerca del centro
          const distanceToCenter = Math.sqrt(
            Math.pow(centerX - (boundingBox.x + boundingBox.width / 2), 2) +
            Math.pow(centerY - (boundingBox.y + boundingBox.height / 2), 2)
          );
          
          const score = area / (1 + distanceToCenter / 100); // Mayor área + más cerca del centro
          if (score > maxArea) {
            maxArea = score;
            targetContour = contour;
          }
        }
      }
    }
    
    // Calcular mediciones del contorno usando funciones OpenCV
    const boundingBox = opencvFunctions.boundingRect(targetContour);
    const area = opencvFunctions.contourArea(targetContour);
    const perimeter = opencvFunctions.arcLength(targetContour, true);
    
    // Convertir a unidades reales
    const width = boundingBox.width / pixelsPerMm;
    const height = boundingBox.height / pixelsPerMm;
    const realArea = area / (pixelsPerMm * pixelsPerMm);
    const realPerimeter = perimeter / pixelsPerMm;
    
    // Calcular métricas geométricas
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    const confidence = Math.min(1.0, Math.max(0.1, area / 1000));
    
    const measurement: RealTimeMeasurementType = {
      width,
      height,
      area: realArea,
      perimeter: realPerimeter,
      circularity: Math.max(0, Math.min(1, circularity)),
      solidity: 0.85,
      confidence,
      depth: width * 0.7, // Estimación
      volume: realArea * width * 0.7,
      surfaceArea: realArea * 2,
      curvature: Math.max(0, 1.0 - circularity),
      roughness: 0.1,
      orientation: { pitch: 0, yaw: 0, roll: 0 },
      materialProperties: {
        refractiveIndex: 1.0,
        scatteringCoefficient: 0,
        absorptionCoefficient: 0
      },
      uncertainty: {
        measurement: 1 - confidence,
        calibration: isCalibrated() ? 0.02 : 0.5,
        algorithm: 0.05,
        total: (1 - confidence) + (isCalibrated() ? 0.02 : 0.5) + 0.05
      },
      algorithm: 'OpenCV Canny + Contours',
      processingTime: Date.now(),
      frameRate: 30,
      qualityMetrics: {
        sharpness: confidence,
        contrast: 0.8,
        noise: 0.1,
        blur: 0.1
      }
    };

    console.log('✅ MEDICIÓN OPENCV COMPLETADA:', {
      área: Math.round(realArea),
      perímetro: Math.round(realPerimeter),
      confianza: (confidence * 100).toFixed(1) + '%',
      contornos: contours.length,
      algoritmo: measurement.algorithm
    });

    return measurement;
  }, [opencvLoaded, opencvFunctions, pixelsPerMm, isCalibrated]);


  // MEDICIÓN MANUAL POR CLICK
  const measureByClick = useCallback(async (x: number, y: number) => {
    if (isProcessing || !opencvLoaded) return;
    
    try {
      setIsProcessing(true);
      
      const imageData = captureVideoFrame();
      if (!imageData) {
        throw new Error('No se pudo capturar frame del video');
      }
      
      const measurement = await performMeasurement(imageData, x, y);
      setLastMeasurement(measurement);
      onMeasurementUpdate(measurement);
      
    } catch (error) {
      console.error('❌ Error en medición manual:', error);
      onError(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, opencvLoaded, captureVideoFrame, performMeasurement, onMeasurementUpdate, onError]);

  // MEDICIÓN AUTOMÁTICA
  const measureAutomatic = useCallback(async () => {
    if (isProcessing || !opencvLoaded) return;
    
    try {
      setIsProcessing(true);
      
      const imageData = captureVideoFrame();
      if (!imageData) {
        throw new Error('No se pudo capturar frame del video');
      }
      
      const measurement = await performMeasurement(imageData);
      setLastMeasurement(measurement);
      onMeasurementUpdate(measurement);
      
    } catch (error) {
      console.error('❌ Error en medición automática:', error);
      onError(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, opencvLoaded, captureVideoFrame, performMeasurement, onMeasurementUpdate, onError]);

  // Manejo de click en el video
  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!clickMode || !videoRef?.current) return;
    
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    measureByClick(x, y);
  };
  
  // Medición automática cada 3 segundos cuando está activa
  useEffect(() => {
    if (!isActive || clickMode || !opencvLoaded) return;
    
    const interval = setInterval(() => {
      measureAutomatic();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isActive, clickMode, opencvLoaded, measureAutomatic]);

  return (
    <>
      {/* OVERLAY PARA CLICKS */}
      {clickMode && videoRef?.current && (
        <div 
          className="absolute inset-0 cursor-crosshair z-10"
          onClick={handleVideoClick as any}
        />
      )}
      
      {/* PANEL DE INFORMACIÓN */}
      <div className="absolute bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm border border-blue-500/30 max-w-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : opencvLoaded ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className={`font-semibold text-xs ${opencvLoaded ? 'text-green-400' : 'text-red-400'}`}>
            <Activity className="inline w-3 h-3 mr-1" />
            OPENCV {opencvLoaded ? 'ACTIVO' : 'CARGANDO...'}
          </span>
        </div>
        
        {/* CONTROLES */}
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={clickMode ? "default" : "outline"}
            onClick={() => setClickMode(!clickMode)}
            className="text-xs"
          >
            <Target className="h-3 w-3 mr-1" />
            {clickMode ? 'Click Activo' : 'Click Manual'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={measureAutomatic}
            disabled={isProcessing || !opencvLoaded}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Medir
          </Button>
        </div>
        
        {/* ESTADO DEL SISTEMA */}
        <div className="text-xs mb-2 space-y-1">
          <div>
            <span className="text-gray-400">OpenCV: </span>
            <span className={opencvLoaded ? 'text-green-400' : 'text-yellow-400'}>
              {opencvLoaded ? 'Listo' : 'Cargando...'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Calibración: </span>
            <span className={isCalibrated() ? 'text-green-400' : 'text-red-400'}>
              {isCalibrated() ? 'OK' : 'Sin calibrar'}
            </span>
          </div>
        </div>
        
        {/* INFORMACIÓN DE MEDICIÓN */}
        {lastMeasurement && (
          <>
            <hr className="border-green-500/30 my-2" />
            <div className="text-xs text-green-300 space-y-1">
              <div>Área: {Math.round(lastMeasurement.area)} {isCalibrated() ? 'mm²' : 'px²'}</div>
              <div>Perímetro: {Math.round(lastMeasurement.perimeter)} {isCalibrated() ? 'mm' : 'px'}</div>
              <div>Dimensiones: {Math.round(lastMeasurement.width)} × {Math.round(lastMeasurement.height)}</div>
              <div>Confianza: {(lastMeasurement.confidence * 100).toFixed(1)}%</div>
            </div>
          </>
        )}
        
        {/* INSTRUCCIONES */}
        {clickMode && (
          <div className="text-xs text-yellow-300 mt-2">
            👆 Toca cualquier parte del objeto para medir
          </div>
        )}
      </div>
    </>
  );
};
