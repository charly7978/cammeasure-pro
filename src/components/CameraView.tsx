
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  SwitchCamera, 
  Settings,
  Zap,
  Grid3X3,
  Focus,
  Target,
  Pause,
  Play
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { DetectedObject } from '@/lib/types';
import { detectContoursSimple, realDepthCalculator } from '@/lib';

interface CameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  onRealTimeObjects: (objects: DetectedObject[]) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onImageCapture,
  isActive,
  calibrationData,
  onRealTimeObjects
}) => {
  const { 
    videoRef, 
    cameraStream, 
    isCapturing,
    startCamera, 
    stopCamera, 
    switchCamera,
    requestCameraPermissions 
  } = useCamera();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const [showGrid, setShowGrid] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [isRealTimeMeasurement, setIsRealTimeMeasurement] = useState(true);
  const [videoContainer, setVideoContainer] = useState({ width: 0, height: 0 });
  
  // ESTADOS PARA MEDICIÓN AUTOMÁTICA
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<any>(null);
  const [frameCount, setFrameCount] = useState(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  // INICIALIZACIÓN INMEDIATA DE CÁMARA - SIN DEPENDER DE isActive
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let resizeHandler: (() => void) | null = null;
    
    const initialize = async () => {
      try {
        console.log('🚀 INICIANDO INICIALIZACIÓN DE CÁMARA');
        
        // 1. SOLICITAR PERMISOS INMEDIATAMENTE
        const granted = await requestCameraPermissions();
        if (!isMounted) return;
        
        console.log('📱 Permisos de cámara:', granted ? 'CONCEDIDOS' : 'DENEGADOS');
        setHasPermissions(granted);
        
        if (granted) {
          // 2. INICIAR CÁMARA INMEDIATAMENTE
          console.log('📹 INICIANDO CÁMARA...');
          await startCamera();
          console.log('✅ CÁMARA INICIADA EXITOSAMENTE');
          
          // 3. ACTUALIZAR DIMENSIONES
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setVideoContainer({ width: rect.width, height: rect.height });
          }
          
          // 4. INICIAR MEDICIÓN AUTOMÁTICA CON RETRASO
          setTimeout(() => {
            if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current) return;
            
            console.log('🎯 INICIANDO MEDICIÓN AUTOMÁTICA ESTABLE');
            
            // Procesar cada 1000ms para máxima estabilidad
            intervalId = setInterval(() => {
              if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current || isProcessing) return;
              
              try {
                processFrameAutomatically();
              } catch (error) {
                console.error('Error en procesamiento automático:', error);
              }
            }, 1000); // MUY LENTO PARA ESTABILIDAD
          }, 2000);
        } else {
          console.error('❌ PERMISOS DE CÁMARA DENEGADOS');
        }
      } catch (error) {
        console.error('❌ Error en inicialización de cámara:', error);
      }
    };
    
    // MANEJADOR DE RESIZE
    resizeHandler = () => {
      if (containerRef.current && isMounted) {
        const rect = containerRef.current.getBoundingClientRect();
        setVideoContainer({ width: rect.width, height: rect.height });
      }
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // INICIAR TODO INMEDIATAMENTE
    console.log('🎬 EJECUTANDO INICIALIZACIÓN INMEDIATA');
    initialize();
    
    // LIMPIEZA COMPLETA
    return () => {
      console.log('🧹 LIMPIANDO RECURSOS DE CÁMARA');
      isMounted = false;
      
      // Detener cámara
      stopCamera();
      
      // Limpiar intervalos
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      // Limpiar event listeners
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
    };
  }, []); // SIN DEPENDENCIAS - SOLO UNA VEZ AL MONTAR

  // MANEJAR CAMBIOS DE isActive SEPARADAMENTE
  useEffect(() => {
    if (isActive && hasPermissions && cameraStream) {
      console.log('🎯 TAB ACTIVO - CÁMARA YA INICIADA');
    } else if (!isActive && cameraStream) {
      console.log('⏸️ TAB INACTIVO - MANTENIENDO CÁMARA');
    }
  }, [isActive, hasPermissions, cameraStream]);

  // FUNCIÓN ELIMINADA - AHORA MANEJADA EN useEffect

  const handleCameraSwitch = async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    
    try {
      await switchCamera(newDirection);
      setCurrentCamera(newDirection);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // MEDICIÓN AUTOMÁTICA EN TIEMPO REAL
  const processFrameAutomatically = async () => {
    // PROTECCIÓN CONTRA ERRORES CRÍTICOS
    if (!videoRef?.current || !overlayCanvasRef?.current || !isActive || isProcessing) {
      console.log('⚠️ Condiciones no cumplidas para procesamiento');
      return;
    }

    // VERIFICAR QUE EL VIDEO ESTÉ LISTO
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log('⚠️ Video no está listo aún');
      return;
    }

    try {
      setIsProcessing(true);
      const startTime = performance.now();

      // 1. CAPTURAR FRAME ACTUAL
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ No se pudo obtener contexto del canvas');
        return;
      }

      const video = videoRef.current;
      
      // VERIFICAR DIMENSIONES DEL VIDEO
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        console.log('⚠️ Dimensiones del video no válidas');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 2. DETECTAR CONTORNOS AUTOMÁTICAMENTE
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 Detectando contornos específicos del objeto...');
      
      // DETECCIÓN ESPECÍFICA DEL OBJETO EN FOCO
      const detectionResult = await detectSpecificObject(imageData, canvas.width, canvas.height);
      console.log('📊 Objetos específicos detectados:', detectionResult.length);
      
      // 3. SELECCIONAR OBJETO MÁS PROMINENTE Y ESPECÍFICO
      const prominentObject = selectMostSpecificObject(detectionResult, canvas.width, canvas.height);

      if (prominentObject) {
        try {
          // 4. CALCULAR MEDICIONES EN TIEMPO REAL
          const measurements = await calculateRealTimeMeasurements(prominentObject, imageData);
          
          // 5. ACTUALIZAR ESTADO
          const measurement = {
            id: `frame_${frameCount}`,
            timestamp: Date.now(),
            object: prominentObject,
            measurements,
            processingTime: performance.now() - startTime
          };

          setCurrentMeasurement(measurement);
          setDetectedObjects([prominentObject]);
          onRealTimeObjects([prominentObject]);

          // 6. DIBUJAR OVERLAY EN TIEMPO REAL
          drawRealTimeOverlay(ctx, prominentObject, measurements);
        } catch (measurementError) {
          console.error('❌ Error al calcular mediciones:', measurementError);
        }
      }

      // 7. ACTUALIZAR CONTADORES
      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('❌ Error crítico en procesamiento automático:', error);
      // NO RE-LANZAR EL ERROR PARA EVITAR QUE LA APLICACIÓN SE CIERRE
    } finally {
      setIsProcessing(false);
    }
  };

  // Seleccionar objeto más prominente
  const selectMostProminentObject = (rects: any[]): DetectedObject | null => {
    if (rects.length === 0) return null;

    // Convertir BoundingRect a DetectedObject
    const detectedObjects: DetectedObject[] = rects.map((rect, index) => ({
      // Propiedades de BoundingRect
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      area: rect.width * rect.height,
      
      // Propiedades de DetectedObject
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
        area: rect.width * rect.height,
        unit: 'px'
      },
      confidence: 0.8, // Confianza por defecto
      depth: undefined,
      realWidth: undefined,
      realHeight: undefined,
      volume: undefined,
      surfaceArea: undefined,
      curvature: undefined,
      roughness: undefined,
      orientation: undefined,
      materialProperties: undefined
    }));

    return detectedObjects.reduce((mostProminent, current) => {
      const currentScore = current.dimensions.area * current.confidence;
      const prominentScore = mostProminent.dimensions.area * mostProminent.confidence;
      return currentScore > prominentScore ? current : mostProminent;
    });
  };

  // DETECCIÓN ESPECÍFICA DEL OBJETO EN FOCO
  const detectSpecificObject = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🎯 INICIANDO DETECCIÓN ESPECÍFICA DEL OBJETO');
      
      // VERIFICAR DATOS DE ENTRADA
      if (!imageData || !imageData.data || width <= 0 || height <= 0) {
        console.warn('⚠️ Datos de entrada inválidos para detección');
        return [];
      }
      
      // 1. CONVERTIR A ESCALA DE GRISES
      const grayData = new Uint8Array(width * height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        grayData[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      
      // 2. DETECCIÓN DE BORDES CON OPERADOR CANNY MEJORADO
      const edges = detectCannyEdges(grayData, width, height);
      
      // 3. DETECCIÓN DE CONTORNOS ESPECÍFICOS
      const contours = findSpecificContours(edges, width, height);
      
      // 4. FILTRAR POR FORMA Y TAMAÑO
      const filteredContours = filterByShapeAndSize(contours, width, height);
      
      console.log('✅ DETECCIÓN ESPECÍFICA COMPLETADA:', filteredContours.length, 'objetos válidos');
      return filteredContours;
      
    } catch (error) {
      console.error('❌ Error en detección específica:', error);
      // RETORNAR ARRAY VACÍO EN LUGAR DE RE-LANZAR EL ERROR
      return [];
    }
  };

  // OPERADOR CANNY MEJORADO PARA DETECCIÓN ESPECÍFICA
  const detectCannyEdges = (grayData: Uint8Array, width: number, height: number): Uint8Array => {
    const edges = new Uint8Array(width * height);
    
    // 1. APLICAR FILTRO GAUSSIANO
    const blurred = applyGaussianFilter(grayData, width, height);
    
    // 2. CALCULAR GRADIENTES
    const gradients = calculateGradients(blurred, width, height);
    
    // 3. SUPRESIÓN DE MÁXIMOS NO MÁXIMOS
    const suppressed = nonMaxSuppression(gradients, width, height);
    
    // 4. UMBRALIZACIÓN DOBLE
    const thresholded = doubleThreshold(suppressed, width, height);
    
    return thresholded;
  };

  // FILTRO GAUSSIANO
  const applyGaussianFilter = (data: Uint8Array, width: number, height: number): Uint8Array => {
    const result = new Uint8Array(width * height);
    const kernel = [
      [1, 4, 6, 4, 1],
      [4, 16, 24, 16, 4],
      [6, 24, 36, 24, 6],
      [4, 16, 24, 16, 4],
      [1, 4, 6, 4, 1]
    ];
    const kernelSum = 256;
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        let sum = 0;
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            sum += data[(y + ky) * width + (x + kx)] * kernel[ky + 2][kx + 2];
          }
        }
        result[y * width + x] = sum / kernelSum;
      }
    }
    
    return result;
  };

  // CALCULAR GRADIENTES
  const calculateGradients = (data: Uint8Array, width: number, height: number): any => {
    const gradients = {
      magnitude: new Uint8Array(width * height),
      direction: new Float32Array(width * height)
    };
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx = data[y * width + (x + 1)] - data[y * width + (x - 1)];
        const gy = data[(y + 1) * width + x] - data[(y - 1) * width + x];
        
        gradients.magnitude[y * width + x] = Math.sqrt(gx * gx + gy * gy);
        gradients.direction[y * width + x] = Math.atan2(gy, gx);
      }
    }
    
    return gradients;
  };

  // SUPRESIÓN DE MÁXIMOS NO MÁXIMOS
  const nonMaxSuppression = (gradients: any, width: number, height: number): Uint8Array => {
    const result = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const magnitude = gradients.magnitude[idx];
        const direction = gradients.direction[idx];
        
        // Interpolar en la dirección del gradiente
        const interpolated = interpolateAlongGradient(gradients, x, y, direction, width, height);
        
        if (magnitude >= interpolated) {
          result[idx] = magnitude;
        }
      }
    }
    
    return result;
  };

  // INTERPOLAR A LO LARGO DEL GRADIENTE
  const interpolateAlongGradient = (gradients: any, x: number, y: number, direction: number, width: number, height: number): number => {
    const cos = Math.cos(direction);
    const sin = Math.sin(direction);
    
    const x1 = x + cos;
    const y1 = y + sin;
    const x2 = x - cos;
    const y2 = y - sin;
    
    if (x1 < 0 || x1 >= width || y1 < 0 || y1 >= height ||
        x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) {
      return 0;
    }
    
    const mag1 = gradients.magnitude[Math.floor(y1) * width + Math.floor(x1)];
    const mag2 = gradients.magnitude[Math.floor(y2) * width + Math.floor(x2)];
    
    return (mag1 + mag2) / 2;
  };

  // UMBRALIZACIÓN DOBLE
  const doubleThreshold = (data: Uint8Array, width: number, height: number): Uint8Array => {
    const result = new Uint8Array(width * height);
    const highThreshold = 50;
    const lowThreshold = 20;
    
    // Primer umbral
    for (let i = 0; i < data.length; i++) {
      if (data[i] >= highThreshold) {
        result[i] = 255; // Fuerte
      } else if (data[i] >= lowThreshold) {
        result[i] = 128; // Débil
      }
    }
    
    // Segundo umbral - conectar bordes débiles
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (result[idx] === 128) {
          // Verificar si hay bordes fuertes vecinos
          let hasStrongNeighbor = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (result[(y + dy) * width + (x + dx)] === 255) {
                hasStrongNeighbor = true;
                break;
              }
            }
            if (hasStrongNeighbor) break;
          }
          
          if (hasStrongNeighbor) {
            result[idx] = 255;
          } else {
            result[idx] = 0;
          }
        }
      }
    }
    
    return result;
  };

  // ENCONTRAR CONTORNOS ESPECÍFICOS
  const findSpecificContours = (edges: Uint8Array, width: number, height: number): any[] => {
    const visited = new Set<number>();
    const contours: any[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (edges[index] === 255 && !visited.has(index)) {
          // Nuevo contorno específico encontrado
          const contour = floodFillSpecificContour(edges, width, height, x, y, visited);
          if (contour.points.length > 20) { // Filtrar contornos muy pequeños
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  };

  // FLOOD FILL PARA CONTORNOS ESPECÍFICOS
  const floodFillSpecificContour = (edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>): any => {
    const points: { x: number; y: number }[] = [];
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
    
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const index = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          edges[index] !== 255 || visited.has(index)) {
        continue;
      }
      
      visited.add(index);
      points.push({ x, y });
      
      // Actualizar bounding box
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Agregar vecinos en 8 direcciones
      stack.push(
        { x: x + 1, y: y }, { x: x - 1, y: y },
        { x: x, y: y + 1 }, { x: x, y: y - 1 },
        { x: x + 1, y: y + 1 }, { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 }, { x: x - 1, y: y - 1 }
      );
    }
    
    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
    
    const area = boundingBox.width * boundingBox.height;
    
    return {
      points,
      boundingBox,
      area
    };
  };

  // FILTRAR POR FORMA Y TAMAÑO
  const filterByShapeAndSize = (contours: any[], width: number, height: number): any[] => {
    return contours.filter(contour => {
      const { width: w, height: h, area } = contour.boundingBox;
      
      // Filtrar por tamaño mínimo y máximo
      const minArea = 500; // 500 píxeles mínimo
      const maxArea = width * height * 0.8; // Máximo 80% de la imagen
      
      if (area < minArea || area > maxArea) return false;
      
      // Filtrar por proporción (evitar líneas muy delgadas)
      const aspectRatio = w / h;
      if (aspectRatio < 0.1 || aspectRatio > 10) return false;
      
      // Filtrar por densidad de puntos (evitar contornos muy dispersos)
      const density = area / contour.points.length;
      if (density < 0.5) return false;
      
      return true;
    });
  };

  // Seleccionar objeto más específico y prominente
  const selectMostSpecificObject = (contours: any[], width: number, height: number): DetectedObject | null => {
    if (contours.length === 0) return null;

    // Convertir contornos a DetectedObject con análisis de especificidad
    const detectedObjects: DetectedObject[] = contours.map((contour, index) => {
      const { x, y, width: w, height: h, area } = contour.boundingBox;
      
      // Calcular especificidad basada en posición y forma
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      
      // Distancia desde el centro de la imagen (objetos centrales son más específicos)
      const imageCenterX = width / 2;
      const imageCenterY = height / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(centerX - imageCenterX, 2) + Math.pow(centerY - imageCenterY, 2)
      );
      
      // Normalizar distancia (0 = centro, 1 = borde)
      const normalizedDistance = distanceFromCenter / (Math.sqrt(width * width + height * height) / 2);
      
      // Calcular especificidad (0 = menos específico, 1 = más específico)
      const specificity = 1 - normalizedDistance;
      
      // Calcular confianza basada en especificidad y área
      const confidence = (specificity * 0.7) + (Math.min(area / (width * height), 0.3));
      
      return {
        // Propiedades de BoundingRect
        x: x,
        y: y,
        width: w,
        height: h,
        area: area,
        
        // Propiedades de DetectedObject
        id: `obj_${index}`,
        type: 'detected',
        boundingBox: {
          x: x,
          y: y,
          width: w,
          height: h
        },
        dimensions: {
          width: w,
          height: h,
          area: area,
          unit: 'px'
        },
        confidence: Math.min(confidence, 1), // Limitar a máximo 1
        depth: undefined,
        realWidth: undefined,
        realHeight: undefined,
        volume: undefined,
        surfaceArea: undefined,
        curvature: undefined,
        roughness: undefined,
        orientation: undefined,
        materialProperties: undefined
      };
    });

    // Seleccionar por especificidad y confianza
    return detectedObjects.reduce((mostSpecific, current) => {
      const currentScore = current.confidence * current.dimensions.area;
      const specificScore = mostSpecific.confidence * mostSpecific.dimensions.area;
      return currentScore > specificScore ? current : mostSpecific;
    });
  };

  // Calcular mediciones en tiempo real
  const calculateRealTimeMeasurements = async (object: DetectedObject, imageData: ImageData) => {
    try {
      // VERIFICAR OBJETO VÁLIDO
      if (!object || !object.dimensions || !object.dimensions.width || !object.dimensions.height) {
        console.warn('⚠️ Objeto inválido para mediciones');
        return {
          width: 0, height: 0, area: 0,
          realWidth: 0, realHeight: 0, realArea: 0,
          depth: 0, volume: 0, surfaceArea: 0, distance: 0,
          perimeter: 0, diagonal: 0, aspectRatio: 0,
          unit: 'mm'
        };
      }
      
      const { width, height, area } = object.dimensions;
      
      // CONVERTIR PÍXELES A UNIDADES REALES (mm/cm)
      const pixelsPerMm = calibrationData?.pixelsPerMm || 10; // Valor por defecto: 10 píxeles = 1mm
      const realWidth = width / pixelsPerMm; // mm
      const realHeight = height / pixelsPerMm; // mm
      const realArea = area / (pixelsPerMm * pixelsPerMm); // mm²
      
      // Cálculo de profundidad estimada
      let estimatedDepth = 0;
      try {
        estimatedDepth = await estimateDepthFromObjectSize(object, imageData);
      } catch (depthError) {
        console.warn('⚠️ Error al calcular profundidad, usando valor por defecto:', depthError);
        estimatedDepth = 100; // Valor por defecto en mm
      }
      
      // Cálculo de volumen estimado en mm³
      const estimatedVolume = estimateVolumeFromDimensions(realWidth, realHeight, estimatedDepth);
      
      // Cálculo de superficie en mm²
      const surfaceArea = calculateSurfaceArea(realWidth, realHeight, estimatedDepth);
      
      // Cálculo de distancia desde la cámara
      let distanceFromCamera = 0;
      try {
        distanceFromCamera = calculateDistanceFromCamera(object, imageData);
      } catch (distanceError) {
        console.warn('⚠️ Error al calcular distancia, usando valor por defecto:', distanceError);
        distanceFromCamera = 200; // Valor por defecto en mm
      }

      return {
        // Medidas en píxeles (originales)
        width: width,
        height: height,
        area: area,
        
        // Medidas en unidades reales (mm)
        realWidth: realWidth,
        realHeight: realHeight,
        realArea: realArea,
        
        // Medidas 3D
        depth: estimatedDepth,
        volume: estimatedVolume,
        surfaceArea: surfaceArea,
        distance: distanceFromCamera,
        
        // Medidas derivadas
        perimeter: 2 * (realWidth + realHeight), // mm
        diagonal: Math.sqrt(realWidth * realWidth + realHeight * realHeight), // mm
        aspectRatio: realWidth / realHeight,
        
        // Unidades
        unit: 'mm'
      };
    } catch (error) {
      console.error('❌ Error crítico al calcular mediciones:', error);
      // RETORNAR MEDICIONES POR DEFECTO EN LUGAR DE RE-LANZAR EL ERROR
      return {
        width: 0, height: 0, area: 0,
        realWidth: 0, realHeight: 0, realArea: 0,
        depth: 0, volume: 0, surfaceArea: 0, distance: 0,
        perimeter: 0, diagonal: 0, aspectRatio: 0,
        unit: 'mm'
      };
    }
  };

  // Estimación de profundidad
  const estimateDepthFromObjectSize = async (object: DetectedObject, imageData: ImageData): Promise<number> => {
    try {
      const depthMap = await realDepthCalculator.calculateRealDepth(
        imageData, 
        { 
          width: object.dimensions.width, 
          height: object.dimensions.height,
          x: object.boundingBox.x,
          y: object.boundingBox.y
        }
      );
      
      // Obtener profundidad promedio del objeto
      const objectDepths = extractObjectDepths(depthMap, object.boundingBox);
      return objectDepths.reduce((sum, depth) => sum + depth, 0) / objectDepths.length;
    } catch (error) {
      // Fallback: estimación basada en perspectiva
      return estimateDepthFromPerspective(object, imageData);
    }
  };

  // Extraer profundidades del objeto
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

  // Dibujar overlay en tiempo real
  const drawRealTimeOverlay = (ctx: CanvasRenderingContext2D, object: DetectedObject, measurements: any) => {
    try {
      // VERIFICAR PARÁMETROS VÁLIDOS
      if (!ctx || !object || !object.boundingBox || !measurements) {
        console.warn('⚠️ Parámetros inválidos para dibujar overlay');
        return;
      }
      
      const { x, y, width, height } = object.boundingBox;
      
      // VERIFICAR DIMENSIONES VÁLIDAS
      if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        console.warn('⚠️ Dimensiones inválidas del bounding box');
        return;
      }
      
      // Limpiar canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar bounding box específico del objeto
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Dibujar centro del objeto
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Dibujar mediciones en UNIDADES REALES (mm/cm)
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      
      // Medidas en píxeles
      ctx.fillText(`Píxeles: ${measurements.width?.toFixed(0) || '0'} × ${measurements.height?.toFixed(0) || '0'}`, x, y - 60);
      
      // Medidas en unidades reales
      if (measurements.realWidth && measurements.realHeight) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`Ancho: ${measurements.realWidth.toFixed(1)}mm`, x, y - 40);
        ctx.fillText(`Alto: ${measurements.realHeight.toFixed(1)}mm`, x, y - 20);
        ctx.fillText(`Área: ${measurements.realArea?.toFixed(1) || '0'}mm²`, x, y - 5);
      }
      
      // Medidas 3D
      if (measurements.depth) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`Profundidad: ${measurements.depth.toFixed(1)}mm`, x, y + 15);
      }
      
      if (measurements.volume) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText(`Volumen: ${measurements.volume.toFixed(1)}mm³`, x, y + 35);
      }
      
      if (measurements.perimeter) {
        ctx.fillStyle = '#ff00ff';
        ctx.fillText(`Perímetro: ${measurements.perimeter.toFixed(1)}mm`, x, y + 55);
      }
      
      // Dibujar indicador de confianza
      const confidence = object.confidence || 0;
      ctx.fillStyle = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff0000';
      ctx.fillText(`Confianza: ${(confidence * 100).toFixed(0)}%`, x, y + 75);
      
      // Dibujar indicador de especificidad
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`🎯 Objeto Específico Detectado`, x, y + 95);
      
    } catch (error) {
      console.error('❌ Error al dibujar overlay:', error);
      // NO RE-LANZAR EL ERROR PARA EVITAR QUE LA APLICACIÓN SE CIERRE
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !onImageCapture) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get ImageData from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    onImageCapture(imageData);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setFocusPoint({ x, y });
    
    // Auto-hide focus point after 2 seconds
    setTimeout(() => setFocusPoint(null), 2000);
  };

  if (!hasPermissions) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Camera className="w-12 h-12 text-muted-foreground mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Permisos de Cámara Requeridos</h3>
          <p className="text-sm text-muted-foreground">
            Se necesita acceso a la cámara para realizar mediciones
          </p>
        </div>
        <div className="space-y-2">
          <Button onClick={() => requestCameraPermissions()} className="bg-gradient-primary">
            <Camera className="w-4 h-4 mr-2" />
            Conceder Permisos
          </Button>
          
          <Button 
            onClick={async () => {
              try {
                console.log('🔄 FORZANDO REINICIALIZACIÓN DE CÁMARA...');
                const granted = await requestCameraPermissions();
                if (granted) {
                  await startCamera();
                  console.log('✅ CÁMARA REINICIADA MANUALMENTE');
                }
              } catch (error) {
                console.error('❌ Error al reinicializar cámara:', error);
              }
            }} 
            variant="outline"
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Forzar Reinicialización
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera Controls - Compactos */}
      <div className="flex items-center justify-between bg-card/50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary text-primary text-xs">
            <Camera className="w-3 h-3 mr-1" />
                            {currentCamera === 'back' ? 'Principal' : 'Frontal'}
          </Badge>
          
          {cameraStream && (
            <Badge variant="secondary" className="animate-measurement-pulse text-xs">
              <div className="w-2 h-2 bg-measurement-active rounded-full mr-1"></div>
              En Vivo
            </Badge>
          )}

          {isRealTimeMeasurement && detectedObjects.length > 0 && (
            <Badge variant="outline" className="border-measurement-active text-measurement-active text-xs">
              <Target className="w-3 h-3 mr-1" />
              🎯 Detectado
            </Badge>
          )}

          {isProcessing && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-xs animate-pulse">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
              Procesando
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
                                           <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  const newState = !isRealTimeMeasurement;
                  setIsRealTimeMeasurement(newState);
                  
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
              }}
              className={`h-8 w-8 p-0 ${isRealTimeMeasurement ? "bg-measurement-active text-background" : ""}`}
            >
              {isRealTimeMeasurement ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className={`h-8 w-8 p-0 ${showGrid ? "bg-primary text-primary-foreground" : ""}`}
          >
            <Grid3X3 className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFlashEnabled(!flashEnabled)}
            className={`h-8 w-8 p-0 ${flashEnabled ? "bg-calibration text-background" : ""}`}
          >
            <Zap className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCameraSwitch}
            disabled={isCapturing}
            className="h-8 w-8 p-0"
          >
            <SwitchCamera className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Camera View AMPLIADA - Tamaño mucho más grande */}
      <Card className="relative overflow-hidden bg-black shadow-2xl">
        <div 
          ref={containerRef}
          className="relative w-full bg-black"
          style={{ 
            height: '70vh',
            minHeight: '500px'
          }}
          onLoadedData={() => {
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              setVideoContainer({ width: rect.width, height: rect.height });
            }
          }}
        >
                     <video
             ref={videoRef}
             className="w-full h-full object-cover"
             autoPlay
             playsInline
             muted
             onClick={handleVideoClick}
                           onLoadedMetadata={() => {
                try {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setVideoContainer({ width: rect.width, height: rect.height });
                  }
                  
                  // FORZAR MEDICIÓN AUTOMÁTICA CUANDO EL VIDEO ESTÉ LISTO
                  console.log('🎯 VIDEO LISTO - FORZANDO MEDICIÓN AUTOMÁTICA');
                  setTimeout(() => {
                    try {
                      if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
                        processFrameAutomatically();
                      }
                    } catch (error) {
                      console.error('❌ Error al forzar medición desde onLoadedMetadata:', error);
                    }
                  }, 1000);
                } catch (error) {
                  console.error('❌ Error en onLoadedMetadata:', error);
                }
              }}
           />

          {/* Canvas para overlay de mediciones en tiempo real */}
          {isRealTimeMeasurement && (
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          )}
          
          {/* Grid Overlay - Más sutil */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="33.33" height="33.33" patternUnits="userSpaceOnUse">
                    <path d="M 33.33 0 L 0 0 0 33.33" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
              </svg>
            </div>
          )}
          
          {/* Focus Point Indicator */}
          {focusPoint && (
            <div 
              className="absolute w-12 h-12 border-2 border-calibration rounded-full pointer-events-none animate-calibration-glow"
              style={{
                left: `${focusPoint.x}%`,
                top: `${focusPoint.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Focus className="w-3 h-3 text-calibration absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          )}
          
          {/* Center Crosshair - Más sutil */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-6 h-6 border border-measurement-active/60 rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-measurement-active rounded-full"></div>
            </div>
          </div>

          {/* Capture Button - Posición fija */}
          {onImageCapture && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
              <Button
                onClick={captureFrame}
                disabled={isCapturing || !cameraStream}
                size="lg"
                className="w-14 h-14 rounded-full bg-gradient-primary shadow-2xl border-4 border-background hover:scale-105 transition-transform"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Estado de medición en tiempo real */}
      {isRealTimeMeasurement && currentMeasurement && (
        <Card className="p-4 bg-green-900/20 border-green-500/30">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-green-400">Medición en Tiempo Real</h3>
          </div>
          
                     <div className="grid grid-cols-3 gap-4 text-sm">
             <div>
               <p className="text-gray-300">Ancho</p>
               <p className="font-mono text-green-400 font-bold">
                 {currentMeasurement.measurements.realWidth ? 
                   `${currentMeasurement.measurements.realWidth.toFixed(1)}mm` : 
                   `${currentMeasurement.measurements.width.toFixed(1)}px`
                 }
               </p>
             </div>
             <div>
               <p className="text-gray-300">Alto</p>
               <p className="font-mono text-cyan-400 font-bold">
                 {currentMeasurement.measurements.realHeight ? 
                   `${currentMeasurement.measurements.realHeight.toFixed(1)}mm` : 
                   `${currentMeasurement.measurements.height.toFixed(1)}px`
                 }
               </p>
             </div>
             <div>
               <p className="text-gray-300">Área</p>
               <p className="font-mono text-blue-400 font-bold">
                 {currentMeasurement.measurements.realArea ? 
                   `${currentMeasurement.measurements.realArea.toFixed(1)}mm²` : 
                   `${currentMeasurement.measurements.area.toFixed(0)}px²`
                 }
               </p>
             </div>
             {currentMeasurement.measurements.depth && (
               <div>
                 <p className="text-gray-300">Profundidad</p>
                 <p className="font-mono text-orange-400 font-bold">
                   {currentMeasurement.measurements.depth.toFixed(1)}mm
                 </p>
               </div>
             )}
             {currentMeasurement.measurements.volume && (
               <div>
                 <p className="text-gray-300">Volumen</p>
                 <p className="font-mono text-yellow-400 font-bold">
                   {currentMeasurement.measurements.volume.toFixed(1)}mm³
                 </p>
               </div>
             )}
             {currentMeasurement.measurements.perimeter && (
               <div>
                 <p className="text-gray-300">Perímetro</p>
                 <p className="font-mono text-purple-400 font-bold">
                   {currentMeasurement.measurements.perimeter.toFixed(1)}mm
                 </p>
               </div>
             )}
             <div>
               <p className="text-gray-300">Frame</p>
               <p className="font-mono text-white font-bold">
                 {frameCount}
               </p>
             </div>
           </div>
        </Card>
      )}
    </div>
  );
};
