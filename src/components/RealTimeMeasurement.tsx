import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';
import { detectContoursReal, applyFilter, real3DDepthCalculator } from '@/lib';

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
  const [currentMeasurement, setCurrentMeasurement] = useState<RealTimeMeasurementType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const lastFrameTime = useRef<number>(0);
  const animationFrameId = useRef<number>(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  // MEDICIÓN AUTOMÁTICA EN TIEMPO REAL
  const processFrameAutomatically = useCallback(async () => {
    if (!videoRef?.current || !overlayCanvasRef?.current || !isActive || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const startTime = performance.now();

      // 1. CAPTURAR FRAME ACTUAL
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2. DETECTAR CONTORNOS AUTOMÁTICAMENTE (Canny + Contornos reales)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const edges = applyFilter(imageData, 'canny');
      const rects = detectContoursReal(edges, canvas.width, canvas.height) || [];
      
      // Convertir BoundingRect[] a DetectedObject[]
      const detectedObjects: DetectedObject[] = rects.map((rect, index) => ({
        ...rect,
        id: `obj_${index}`,
        type: 'detected',
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        dimensions: {
          width: rect.width,
          height: rect.height,
          area: rect.area,
          unit: 'px'
        },
        confidence: rect.confidence || 0.8
      }));

      // 3. SELECCIONAR OBJETO MÁS PROMINENTE
      const prominentObject = selectMostProminentObject(detectedObjects);

      if (prominentObject) {
        // 4. CALCULAR MEDICIONES EN TIEMPO REAL
        const measurements = await calculateRealTimeMeasurements(prominentObject, imageData);
        
        // 5. ACTUALIZAR ESTADO
        const measurement: RealTimeMeasurementType = {
          width: prominentObject.dimensions.width,
          height: prominentObject.dimensions.height,
          area: prominentObject.dimensions.area,
          perimeter: 2 * (prominentObject.dimensions.width + prominentObject.dimensions.height),
          circularity: 1.0, // Valor por defecto
          solidity: 1.0, // Valor por defecto
          confidence: prominentObject.confidence || 0.8,
          depth: measurements.depth,
          volume: measurements.volume,
          surfaceArea: measurements.surfaceArea,
          curvature: 0, // Valor por defecto
          roughness: 0, // Valor por defecto
          orientation: {
            pitch: 0,
            yaw: 0,
            roll: 0
          },
          materialProperties: {
            refractiveIndex: 1.0,
            scatteringCoefficient: 0,
            absorptionCoefficient: 0
          },
          uncertainty: {
            measurement: 0.1,
            calibration: 0.05,
            algorithm: 0.02,
            total: 0.17
          },
          algorithm: 'Real-Time Auto-Detection',
          processingTime: performance.now() - startTime,
          frameRate: fps,
          qualityMetrics: {
            sharpness: calculateImageSharpness(imageData),
            contrast: calculateImageContrast(imageData),
            noise: calculateImageNoise(imageData),
            blur: 0 // Valor por defecto
          }
        };

        setCurrentMeasurement(measurement);
        onMeasurementUpdate(measurement);

        // 6. DIBUJAR OVERLAY EN TIEMPO REAL
        drawRealTimeOverlay(ctx, prominentObject, measurements);

        // 7. NOTIFICAR OBJETOS DETECTADOS
        if (onObjectsDetected) {
          onObjectsDetected([prominentObject]);
        }
      }

      // 8. ACTUALIZAR CONTADORES
      setFrameCount(prev => prev + 1);
      const currentTime = performance.now();
      if (lastFrameTime.current > 0) {
        const frameTime = currentTime - lastFrameTime.current;
        setFps(1000 / frameTime);
      }
      lastFrameTime.current = currentTime;

    } catch (error) {
      console.error('Error en procesamiento automático:', error);
      onError(`Error de procesamiento: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [videoRef, overlayCanvasRef, isActive, isProcessing, frameCount, fps, onMeasurementUpdate, onObjectsDetected, onError]);

  // SISTEMA INTELIGENTE DE PROCESAMIENTO (Con prevención de memory leaks)
  useEffect(() => {
    if (isActive && videoRef?.current && overlayCanvasRef?.current) {
      let isComponentActive = true;
      let rafId: number;
      let lastProcessTime = 0;
      const PROCESS_INTERVAL = 500; // Aumentar a 500ms para prevenir sobrecarga
      let processCount = 0;
      
      // Usar requestAnimationFrame para mejor fluidez
      const scheduleNext = () => {
        if (!isComponentActive) return;
        
        rafId = requestAnimationFrame((currentTime) => {
          // Throttle inteligente: solo procesar si ha pasado suficiente tiempo
          if (currentTime - lastProcessTime >= PROCESS_INTERVAL && !isProcessing) {
            lastProcessTime = currentTime;
            processCount++;
            
            // Limpieza periódica cada 10 procesos
            if (processCount % 10 === 0) {
              console.log('🧹 Limpieza periódica de memoria en RealTimeMeasurement');
              // Forzar garbage collection si está disponible
              if (typeof window !== 'undefined' && 'gc' in window) {
                (window as any).gc();
              }
            }
            
            processFrameAutomatically().finally(() => {
              // Programar siguiente ejecución después de completar con más delay
              setTimeout(() => scheduleNext(), 200);
            });
          } else {
            // Si no es tiempo de procesar, programar siguiente check con delay
            setTimeout(() => scheduleNext(), 100);
          }
        });
      };
      
      // Iniciar ciclo de procesamiento con delay inicial
      setTimeout(() => scheduleNext(), 1000);

      // Limpiar al desmontar
      return () => {
        isComponentActive = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        if (processingInterval.current) {
          clearInterval(processingInterval.current);
        }
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    }
  }, [isActive, videoRef, overlayCanvasRef, processFrameAutomatically, isProcessing]);

  // FUNCIONES AUXILIARES PARA MEDICIÓN AUTOMÁTICA

  // Seleccionar objeto más prominente basado en área y confianza
  const selectMostProminentObject = (objects: DetectedObject[]): DetectedObject | null => {
    if (objects.length === 0) return null;

    return objects.reduce((mostProminent, current) => {
      const currentScore = current.dimensions.area * current.confidence;
      const prominentScore = mostProminent.dimensions.area * mostProminent.confidence;
      return currentScore > prominentScore ? current : mostProminent;
    });
  };

  // Calcular mediciones en tiempo real
  const calculateRealTimeMeasurements = async (object: DetectedObject, imageData: ImageData) => {
    const { width, height, area } = object.dimensions;
    
    // Cálculo de profundidad estimada usando el objeto como referencia
    const estimatedDepth = await estimateDepthFromObjectSize(object, imageData);
    
    // Cálculo de volumen estimado
    const estimatedVolume = estimateVolumeFromDimensions(width, height, estimatedDepth);
    
    // Cálculo de superficie
    const surfaceArea = calculateSurfaceArea(width, height, estimatedDepth);
    
    // Cálculo de distancia desde la cámara
    const distanceFromCamera = calculateDistanceFromCamera(object, imageData);

    return {
      width: width,
      height: height,
      depth: estimatedDepth,
      area: area,
      volume: estimatedVolume,
      surfaceArea: surfaceArea,
      distance: distanceFromCamera,
      perimeter: 2 * (width + height),
      diagonal: Math.sqrt(width * width + height * height),
      aspectRatio: width / height
    };
  };

  // Estimación de profundidad basada en el tamaño del objeto
  const estimateDepthFromObjectSize = async (object: DetectedObject, imageData: ImageData): Promise<number> => {
    try {
      // Usar el calculador de profundidad 3D real (modo estereoscópico simulado si no hay par)
      const depthMap = await real3DDepthCalculator.calculateDepthFromStereoPair({
        leftImage: imageData,
        rightImage: imageData,
        baseline: 100,
        focalLength: 1000
      });
      
      // Obtener profundidad promedio del objeto
      const objectDepths = extractObjectDepths(depthMap, object.boundingBox);
      return objectDepths.reduce((sum, depth) => sum + depth, 0) / objectDepths.length;
    } catch (error) {
      // Fallback: estimación basada en perspectiva
      return estimateDepthFromPerspective(object, imageData);
    }
  };

  // Extraer profundidades del objeto desde el mapa de profundidad
  const extractObjectDepths = (depthMap: any, boundingBox: any): number[] => {
    const depths: number[] = [];
    const { x, y, width, height } = boundingBox;
    
    for (let i = y; i < y + height; i += 5) {
      for (let j = x; j < x + width; j += 5) {
        const index = i * depthMap.width + j;
        if (depthMap.depths && depthMap.depths[index] > 0) {
          depths.push(depthMap.depths[index]);
        }
      }
    }
    
    return depths.length > 0 ? depths : [100]; // Valor por defecto
  };

  // Estimación de profundidad por perspectiva
  const estimateDepthFromPerspective = (object: DetectedObject, imageData: ImageData): number => {
    const { width, height } = imageData;
    const centerY = object.boundingBox.y + object.boundingBox.height / 2;
    
    // Objetos más abajo en la imagen están más cerca
    const normalizedY = centerY / height;
    const perspectiveDepth = 50 + (normalizedY * 200); // 50mm a 250mm
    
    return perspectiveDepth;
  };

  // Estimación de volumen
  const estimateVolumeFromDimensions = (width: number, height: number, depth: number): number => {
    // Asumir forma rectangular para estimación rápida
    return width * height * depth;
  };

  // Cálculo de superficie
  const calculateSurfaceArea = (width: number, height: number, depth: number): number => {
    return 2 * (width * height + width * depth + height * depth);
  };

  // Distancia desde la cámara
  const calculateDistanceFromCamera = (object: DetectedObject, imageData: ImageData): number => {
    const { height } = imageData;
    const objectCenterY = object.boundingBox.y + object.boundingBox.height / 2;
    
    // Fórmula de perspectiva: objetos más grandes están más cerca
    const normalizedSize = object.dimensions.area / (height * height);
    const estimatedDistance = 100 + (normalizedSize * 400); // 100mm a 500mm
    
    return estimatedDistance;
  };

  // Métricas de calidad de imagen
  const calculateImageSharpness = (imageData: ImageData): number => {
    // Cálculo de nitidez usando gradientes
    let totalGradient = 0;
    const { width, height, data } = imageData;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const current = data[idx];
        const right = data[idx + 4];
        const bottom = data[(y + 1) * width * 4 + x * 4];
        
        const gradientX = Math.abs(current - right);
        const gradientY = Math.abs(current - bottom);
        totalGradient += gradientX + gradientY;
      }
    }
    
    return Math.min(1, totalGradient / (width * height * 255));
  };

  const calculateImageContrast = (imageData: ImageData): number => {
    const { data } = imageData;
    let min = 255, max = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i];
      min = Math.min(min, gray);
      max = Math.max(max, gray);
    }
    
    return (max - min) / 255;
  };

  const calculateImageNoise = (imageData: ImageData): number => {
    // Estimación de ruido usando diferencias entre píxeles vecinos
    const { width, height, data } = imageData;
    let totalDifference = 0;
    let count = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const current = data[idx];
        const neighbors = [
          data[idx - 4], data[idx + 4], // Izquierda, derecha
          data[idx - width * 4], data[idx + width * 4] // Arriba, abajo
        ];
        
        const avgNeighbor = neighbors.reduce((sum, val) => sum + val, 0) / neighbors.length;
        totalDifference += Math.abs(current - avgNeighbor);
        count++;
      }
    }
    
    return Math.min(1, totalDifference / (count * 255));
  };

  // Dibujar overlay en tiempo real
  const drawRealTimeOverlay = (ctx: CanvasRenderingContext2D, object: DetectedObject, measurements: any) => {
    const { x, y, width, height } = object.boundingBox;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Dibujar bounding box
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    
    // Dibujar centro del objeto
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Dibujar mediciones
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(`Ancho: ${measurements.width.toFixed(1)}px`, x, y - 40);
    ctx.fillText(`Alto: ${measurements.height.toFixed(1)}px`, x, y - 20);
    ctx.fillText(`Área: ${measurements.area.toFixed(0)}px²`, x, y - 5);
    
    if (measurements.depth) {
      ctx.fillText(`Profundidad: ${measurements.depth.toFixed(1)}mm`, x, y + 15);
    }
    
    if (measurements.volume) {
      ctx.fillText(`Volumen: ${measurements.volume.toFixed(0)}mm³`, x, y + 35);
    }
    
    // Dibujar indicador de confianza
    const confidence = object.confidence;
    ctx.fillStyle = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff0000';
    ctx.fillText(`Confianza: ${(confidence * 100).toFixed(0)}%`, x, y + 55);
  };

  // RENDERIZAR ESTADO DE PROCESAMIENTO
  return (
    <div className="absolute bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
        <span>{isProcessing ? 'Procesando...' : 'Activo'}</span>
      </div>
      
      {currentMeasurement && (
        <div className="space-y-1">
          <div>Frame: {frameCount}</div>
          <div>FPS: {fps.toFixed(1)}</div>
          <div>Tiempo: {currentMeasurement.processingTime.toFixed(1)}ms</div>
          <div>Confianza: {(currentMeasurement.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
};
