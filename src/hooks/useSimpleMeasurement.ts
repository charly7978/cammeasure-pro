// HOOK SIMPLE PARA MEDICIÓN MANUAL Y AUTOMÁTICA
import { useState, useCallback, useRef } from 'react';
import { SimpleMeasurementSystem, SimpleMeasurement } from '@/lib/simpleMeasurement';

interface UseSimpleMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  pixelsPerMm: number;
  onMeasurementUpdate: (measurement: SimpleMeasurement) => void;
  onError: (error: string) => void;
}

export const useSimpleMeasurement = ({ 
  videoRef, 
  pixelsPerMm, 
  onMeasurementUpdate, 
  onError 
}: UseSimpleMeasurementProps) => {
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastMeasurement, setLastMeasurement] = useState<SimpleMeasurement | null>(null);
  const measurementSystem = useRef(new SimpleMeasurementSystem());
  
  // CAPTURAR FRAME DEL VIDEO
  const captureVideoFrame = useCallback((): ImageData | null => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== 4) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [videoRef]);
  
  // MEDICIÓN MANUAL POR CLICK
  const measureByClick = useCallback(async (x: number, y: number) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      console.log(`🎯 INICIANDO MEDICIÓN MANUAL EN: ${x}, ${y}`);
      
      const imageData = captureVideoFrame();
      if (!imageData) {
        throw new Error('No se pudo capturar frame del video');
      }
      
      const measurement = measurementSystem.current.measureByClick(
        imageData, 
        x, 
        y, 
        pixelsPerMm
      );
      
      setLastMeasurement(measurement);
      onMeasurementUpdate(measurement);
      
      console.log('✅ MEDICIÓN MANUAL COMPLETADA');
      
    } catch (error) {
      console.error('❌ Error en medición manual:', error);
      onError(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, captureVideoFrame, pixelsPerMm, onMeasurementUpdate, onError]);
  
  // MEDICIÓN AUTOMÁTICA SIMPLE
  const measureAutomatic = useCallback(async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      console.log('🔄 INICIANDO MEDICIÓN AUTOMÁTICA SIMPLE');
      
      const imageData = captureVideoFrame();
      if (!imageData) {
        throw new Error('No se pudo capturar frame del video');
      }
      
      const contours = measurementSystem.current.detectBasicContours(imageData);
      const measurement = measurementSystem.current.measureSimpleObject(contours, pixelsPerMm);
      
      setLastMeasurement(measurement);
      onMeasurementUpdate(measurement);
      
      console.log('✅ MEDICIÓN AUTOMÁTICA COMPLETADA');
      
    } catch (error) {
      console.error('❌ Error en medición automática:', error);
      onError(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, captureVideoFrame, pixelsPerMm, onMeasurementUpdate, onError]);
  
  return {
    isProcessing,
    lastMeasurement,
    measureByClick,
    measureAutomatic
  };
};