import { useState, useCallback, RefObject, useRef } from 'react';
import { DetectedObject } from '@/lib/types';
import { detectBasicObjects, calculateRealMeasurements, drawObjectOverlay } from '../utils/objectDetection';

export const useAutoDetection = (
  videoRef: RefObject<HTMLVideoElement>,
  overlayCanvasRef: RefObject<HTMLCanvasElement>,
  isActive: boolean,
  calibrationData: any,
  onRealTimeObjects: (objects: DetectedObject[]) => void
) => {
  const [isAutoMode, setAutoMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentMeasurement, setCurrentMeasurement] = useState<any>(null);
  const [frameCount, setFrameCount] = useState(0);
  
  // ELIMINAR INTERVALO INNECESARIO - SOLO PROCESAR CUANDO SE SOLICITE
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  const processFrameAutomatically = useCallback(async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current || !isActive || isProcessing) {
        return;
      }

      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        return;
      }

      setIsProcessing(true);
      console.log('🔍 INICIANDO DETECCIÓN AUTOMÁTICA OPTIMIZADA...');

      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // DETECCIÓN OPTIMIZADA - UN SOLO OBJETO PREDOMINANTE
      const detectedObjects = await detectBasicObjects(imageData, canvas.width, canvas.height);
      
      if (detectedObjects.length > 0) {
        const mainObject = detectedObjects[0]; // SOLO EL PRIMERO (MÁS PREDOMINANTE)
        
        // CALCULAR MEDICIONES REALES
        const realMeasurements = await calculateRealMeasurements(mainObject, imageData);
        
        const measurement = {
          id: `frame_${frameCount}`,
          timestamp: Date.now(),
          object: mainObject,
          measurements: realMeasurements,
          processingTime: performance.now()
        };

        setCurrentMeasurement(measurement);
        setDetectedObjects([mainObject]); // SOLO UN OBJETO
        onRealTimeObjects([mainObject]);

        // DIBUJAR OVERLAY OPTIMIZADO
        drawObjectOverlay(ctx, mainObject, realMeasurements);
        console.log('✅ DETECCIÓN AUTOMÁTICA OPTIMIZADA COMPLETADA - UN SOLO OBJETO');
      }

      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('❌ Error en detección automática optimizada:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [videoRef, overlayCanvasRef, isActive, isProcessing, frameCount, onRealTimeObjects]);

  const toggleAutoMode = useCallback(() => {
    try {
      const newState = !isAutoMode;
      setAutoMode(newState);
      
      // FORZAR MEDICIÓN INMEDIATA AL ACTIVAR
      if (newState) {
        console.log('🎯 ACTIVANDO MEDICIÓN - FORZANDO EJECUCIÓN INMEDIATA');
        setTimeout(() => {
          try {
            if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
              processFrameAutomatically();
            }
          } catch (error) {
            console.error('❌ Error al forzar medición:', error);
          }
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error al cambiar estado de medición:', error);
    }
  }, [isAutoMode, videoRef, overlayCanvasRef, isProcessing, processFrameAutomatically]);

  const forceMeasurement = useCallback(() => {
    try {
      if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
        processFrameAutomatically();
      }
    } catch (error) {
      console.error('❌ Error al forzar medición:', error);
    }
  }, [videoRef, overlayCanvasRef, isProcessing, processFrameAutomatically]);

  return {
    isAutoMode,
    isProcessing,
    detectedObjects,
    currentMeasurement,
    frameCount,
    toggleAutoMode,
    processFrameAutomatically,
    forceMeasurement
  };
};
