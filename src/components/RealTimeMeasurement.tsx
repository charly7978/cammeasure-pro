import { useEffect, useRef, useCallback, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { detectContours, type BoundingRect } from '@/lib/imageProcessing';

export interface DetectedObject {
  id: string;
  type: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dimensions: {
    width: number;
    height: number;
    area: number;
    unit: string;
  };
  isReal3D?: boolean;
  measurements3D?: {
    width3D: number;
    height3D: number;
    depth3D: number;
    volume3D: number;
    distance: number;
    confidence: number;
  };
}

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: DetectedObject[]) => void;
  isActive: boolean;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

// Función para dibujar líneas de medición con flechas
const drawMeasurementLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  // Dibujar línea principal
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  // Dibujar flechas en los extremos
  const arrowSize = 5;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  // Flecha en el inicio
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + arrowSize * Math.cos(angle + Math.PI - Math.PI / 6), y1 + arrowSize * Math.sin(angle + Math.PI - Math.PI / 6));
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + arrowSize * Math.cos(angle + Math.PI + Math.PI / 6), y1 + arrowSize * Math.sin(angle + Math.PI + Math.PI / 6));
  ctx.stroke();
  
  // Flecha en el final
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + arrowSize * Math.cos(angle - Math.PI / 6), y2 + arrowSize * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + arrowSize * Math.cos(angle + Math.PI / 6), y2 + arrowSize * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
  overlayCanvasRef
}) => {
  const { isLoaded, cv } = useOpenCV();
  const processingRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [calibrationData, setCalibrationData] = useState<{ pixelsPerMm: number } | null>(null);

  // Obtener datos de calibración del localStorage
  useEffect(() => {
    const savedCalibration = localStorage.getItem('calibrationData');
    if (savedCalibration) {
      try {
        const parsed = JSON.parse(savedCalibration);
        if (parsed.pixelsPerMm) {
          setCalibrationData({ pixelsPerMm: parsed.pixelsPerMm });
        }
      } catch (error) {
        console.warn('Error al cargar datos de calibración:', error);
      }
    }
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !isActive || processingRef.current || !isLoaded || !cv) {
      return;
    }
    
    processingRef.current = true;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!canvas) {
        processingRef.current = false;
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        processingRef.current = false;
        return;
      }

      // Configurar canvas con las dimensiones del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar frame actual en el canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Obtener ImageData para procesamiento con OpenCV
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detectar contornos usando OpenCV
      const { rects: prominentObjects, prominentObject } = detectContours(cv, imageData, 500); // minArea de 500 píxeles

      // Convertir objetos prominentes a formato DetectedObject
      const detectedObjects: DetectedObject[] = prominentObjects.map((rect, index) => {
        // Calcular dimensiones reales si hay calibración
        let realWidth = rect.width;
        let realHeight = rect.height;
        let unit = 'px';

        if (calibrationData && calibrationData.pixelsPerMm > 0) {
          realWidth = rect.width / calibrationData.pixelsPerMm;
          realHeight = rect.height / calibrationData.pixelsPerMm;
          unit = 'mm';
        }

        return {
          id: `obj-${Date.now()}-${index}`,
          type: rect.circularity && rect.circularity > 0.8 ? 'circle' : 
                rect.aspectRatio && rect.aspectRatio > 0.8 && rect.aspectRatio < 1.2 ? 'square' : 'rectangle',
          confidence: rect.confidence || 0.5,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          dimensions: {
            width: realWidth,
            height: realHeight,
            area: realWidth * realHeight,
            unit: unit
          },
          isReal3D: false, // Por ahora solo detección 2D
          measurements3D: calibrationData ? {
            width3D: realWidth,
            height3D: realHeight,
            depth3D: realWidth * 0.5, // Estimación aproximada
            volume3D: realWidth * realHeight * (realWidth * 0.5),
            distance: 100, // Distancia estimada en mm
            confidence: rect.confidence || 0.5
          } : undefined
        };
      });

      // Dibujar overlay con mediciones si hay canvas de overlay
      if (overlayCanvasRef?.current) {
        const overlayCtx = overlayCanvasRef.current.getContext('2d');
        if (overlayCtx) {
          // Configurar canvas de overlay
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
          
          // Limpiar canvas
          overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          
          // Dibujar detecciones y mediciones
          prominentObjects.forEach((rect, index) => {
            const isBestObject = prominentObject && rect === prominentObject;
            
            // Dibujar rectángulo de detección
            overlayCtx.strokeStyle = isBestObject ? '#00ff00' : '#ff0000';
            overlayCtx.lineWidth = isBestObject ? 3 : 2;
            overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            
            // Mostrar confianza
            if (rect.confidence) {
              overlayCtx.fillStyle = isBestObject ? '#00ff00' : '#ff0000';
              overlayCtx.font = '12px Arial';
              overlayCtx.fillText(`${(rect.confidence * 100).toFixed(1)}%`, rect.x, rect.y - 5);
            }
            
            // Mostrar tipo de objeto
            const objectType = rect.circularity && rect.circularity > 0.8 ? 'Círculo' : 
                              rect.aspectRatio && rect.aspectRatio > 0.8 && rect.aspectRatio < 1.2 ? 'Cuadrado' : 'Rectángulo';
            overlayCtx.fillStyle = isBestObject ? '#00ff00' : '#ff0000';
            overlayCtx.font = '10px Arial';
            overlayCtx.fillText(objectType, rect.x, rect.y + rect.height + 15);
            
            // Mostrar mediciones solo para el objeto más prominente
            if (isBestObject && calibrationData) {
              const { pixelsPerMm } = calibrationData;
              const realWidth = rect.width / pixelsPerMm;
              const realHeight = rect.height / pixelsPerMm;
              
              // Dibujar líneas de medición mejoradas
              overlayCtx.strokeStyle = '#00ff00';
              overlayCtx.lineWidth = 2;
              overlayCtx.setLineDash([5, 5]);
              
              // Línea de ancho con flechas
              drawMeasurementLine(overlayCtx, rect.x, rect.y + rect.height + 20, rect.x + rect.width, rect.y + rect.height + 20);
              
              // Línea de alto con flechas
              drawMeasurementLine(overlayCtx, rect.x + rect.width + 20, rect.y, rect.x + rect.width + 20, rect.y + rect.height);
              
              overlayCtx.setLineDash([]);
              
              // Mostrar dimensiones con mejor formato
              overlayCtx.fillStyle = '#00ff00';
              overlayCtx.font = 'bold 14px Arial';
              overlayCtx.textAlign = 'center';
              overlayCtx.fillText(`${realWidth.toFixed(1)} mm`, 
                rect.x + rect.width / 2, rect.y + rect.height + 35);
              overlayCtx.fillText(`${realHeight.toFixed(1)} mm`, 
                rect.x + rect.width + 35, rect.y + rect.height / 2);
              overlayCtx.textAlign = 'left';
              
              // Mostrar área y propiedades adicionales
              const area = realWidth * realHeight;
              const perimeter = 2 * (realWidth + realHeight);
              overlayCtx.font = '12px Arial';
              overlayCtx.fillText(`Área: ${area.toFixed(1)} mm²`, rect.x, rect.y - 25);
              overlayCtx.fillText(`Perímetro: ${perimeter.toFixed(1)} mm`, rect.x, rect.y - 10);
              
              // Mostrar propiedades geométricas si están disponibles
              if (rect.circularity !== undefined) {
                overlayCtx.fillText(`Circularidad: ${(rect.circularity * 100).toFixed(1)}%`, rect.x + rect.width + 5, rect.y - 25);
              }
              if (rect.solidity !== undefined) {
                overlayCtx.fillText(`Solidez: ${(rect.solidity * 100).toFixed(1)}%`, rect.x + rect.width + 5, rect.y - 10);
              }
            }
          });
          
          // Si no hay objeto prominente pero hay detecciones, mostrar mensaje
          if (!prominentObject && prominentObjects.length > 0) {
            overlayCtx.fillStyle = '#ffff00';
            overlayCtx.font = '16px Arial';
            overlayCtx.textAlign = 'center';
            overlayCtx.fillText('Detectando objeto más prominente...', canvas.width / 2, 30);
            overlayCtx.textAlign = 'left';
          }
        }
      }

      onObjectsDetected(detectedObjects);
    } catch (error) {
      console.error('Error procesando frame:', error);
      // En caso de error, enviar array vacío
      onObjectsDetected([]);
    } finally {
      processingRef.current = false;
    }
  }, [videoRef, onObjectsDetected, isActive, isLoaded, cv, calibrationData, overlayCanvasRef]);

  useEffect(() => {
    if (isActive && isLoaded) {
      // Reducir frecuencia de procesamiento para mejorar rendimiento
      intervalRef.current = setInterval(processFrame, 200); // 200ms = 5 FPS
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isLoaded, processFrame]);

  // Canvas oculto para procesamiento de imágenes
  return (
    <canvas 
      ref={canvasRef} 
      className="hidden" 
      style={{ display: 'none' }}
    />
  );
};
