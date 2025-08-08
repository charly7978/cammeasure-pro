import { useRef, useCallback, useEffect, useState } from 'react';

interface MeasurementObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
  area: number;
  areaMm2: number;
  confidence: number;
}

interface MeasurementResult {
  objects: MeasurementObject[];
  timestamp: number;
}

interface CalibrationData {
  pixelsPerMm: number;
  referenceSize: number;
}

export function useRealTimeMeasurement() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/realTimeMeasurementWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event) => {
        const message = event.data;
        
        if (message.type === 'READY') {
          setIsReady(true);
          setError(null);
          console.log('Worker de medición listo');
        } else if (message.type === 'MEASUREMENT_RESULT') {
          setMeasurements({
            objects: message.objects,
            timestamp: message.timestamp
          });
          setIsProcessing(false);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Error en worker:', error);
        setError('Error en el worker de medición');
        setIsProcessing(false);
      };

      // Inicializar worker
      workerRef.current.postMessage({ type: 'INIT' });

    } catch (err) {
      console.error('Error creando worker:', err);
      setError('No se pudo crear el worker de medición');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Función para medir objetos en una imagen
  const measureObjects = useCallback((
    imageData: ImageData, 
    calibrationData: CalibrationData
  ) => {
    if (!workerRef.current || !isReady) {
      console.warn('Worker no está listo');
      return;
    }

    setIsProcessing(true);
    setError(null);

    workerRef.current.postMessage({
      type: 'MEASURE',
      imageData,
      calibrationData
    });
  }, [isReady]);

  // Función para obtener ImageData del canvas
  const getImageDataFromCanvas = useCallback((canvas: HTMLCanvasElement): ImageData | null => {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.error('Error obteniendo ImageData:', err);
      return null;
    }
  }, []);

  // Función para medir desde video
  const measureFromVideo = useCallback((
    video: HTMLVideoElement,
    calibrationData: CalibrationData
  ) => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Crear canvas temporal
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dibujar frame actual del video
    ctx.drawImage(video, 0, 0);
    
    // Obtener ImageData y medir
    const imageData = getImageDataFromCanvas(canvas);
    if (imageData) {
      measureObjects(imageData, calibrationData);
    }
  }, [measureObjects, getImageDataFromCanvas]);

  return {
    isReady,
    measurements,
    isProcessing,
    error,
    measureObjects,
    measureFromVideo,
    getImageDataFromCanvas
  };
}