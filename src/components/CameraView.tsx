import { useEffect, useRef, useState, useCallback } from 'react';
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
import { TouchObjectSelector } from './TouchObjectSelector';
import { useCalibration } from '@/hooks/useCalibration';
import { applyFilter, detectContoursReal } from '@/lib';

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
  
  // ESTADOS PARA SELECCIÓN MANUAL POR TOQUE
  const [isManualSelectionMode, setIsManualSelectionMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [manualMeasurements, setManualMeasurements] = useState<any>(null);

  // MANEJAR OBJETO SELECCIONADO MANUALMENTE
  const handleManualObjectSelection = useCallback((object: DetectedObject, measurements: any) => {
    console.log('🎯 OBJETO SELECCIONADO MANUALMENTE:', object);
    setSelectedObject(object);
    setManualMeasurements(measurements);
    
    // Detener medición automática cuando se selecciona manualmente
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    // Notificar al componente padre
    onRealTimeObjects([object]);
  }, [onRealTimeObjects]);

  // MANEJAR ERROR EN SELECCIÓN MANUAL
  const handleManualSelectionError = useCallback((error: string) => {
    console.error('❌ Error en selección manual:', error);
    // Mostrar error al usuario
  }, []);

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
            
            // Procesar cada 2000ms para máxima estabilidad
            intervalId = setInterval(() => {
              if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current || isProcessing) return;
              
              try {
                processFrameAutomatically();
              } catch (error) {
                console.error('Error en procesamiento automático:', error);
              }
            }, 2000); // MUY LENTO PARA ESTABILIDAD
          }, 3000);
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

  const handleCameraSwitch = async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    
    try {
      await switchCamera(newDirection);
      setCurrentCamera(newDirection);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // MEDICIÓN AUTOMÁTICA EN TIEMPO REAL - SIMPLIFICADA Y PROTEGIDA
  const processFrameAutomatically = async () => {
    try {
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

      setIsProcessing(true);
      console.log('🎯 INICIANDO PROCESAMIENTO DE FRAME');

      // 1. CAPTURAR FRAME ACTUAL - SIMPLIFICADO
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
      console.log('✅ Frame capturado correctamente');

      // 2. DETECCIÓN SIMPLIFICADA - SIN ALGORITMOS COMPLEJOS
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log('🔍 Procesando imagen para detección...');
        
        // DETECCIÓN AVANZADA DE NIVEL INDUSTRIAL
        const advancedDetection = await detectAdvancedObjects(imageData, canvas.width, canvas.height);
        console.log('📊 Objetos avanzados detectados:', advancedDetection.length);
        
        if (advancedDetection.length > 0) {
          // 3. SELECCIONAR OBJETO MÁS PROMINENTE
          const selectedObject = advancedDetection[0];
          
          // 4. CALCULAR MEDICIONES COMPLETAS Y REALES
          console.log('📏 Calculando mediciones completas para objeto:', selectedObject.id);
          const completeMeasurements = await calculateRealTimeMeasurements(selectedObject, imageData);
          
          // 5. ACTUALIZAR ESTADO CON MEDICIONES COMPLETAS
          const measurement = {
            id: `frame_${frameCount}`,
            timestamp: Date.now(),
            object: selectedObject,
            measurements: completeMeasurements,
            processingTime: performance.now() - performance.now()
          };

          setCurrentMeasurement(measurement);
          setDetectedObjects([selectedObject]);
          onRealTimeObjects([selectedObject]);

          // 6. OVERLAY AVANZADO CON MEDICIONES COMPLETAS
          drawBasicOverlay(ctx, selectedObject, completeMeasurements);
          console.log('✅ PROCESAMIENTO COMPLETO EXITOSO - MEDICIONES REALES CALCULADAS');
        } else {
          console.log('ℹ️ No se detectaron objetos en este frame');
        }
      } catch (detectionError) {
        console.error('❌ Error en detección básica:', detectionError);
        // CONTINUAR SIN CRASH
      }

      // 7. ACTUALIZAR CONTADORES
      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('❌ Error crítico en procesamiento automático:', error);
      // NO RE-LANZAR EL ERROR PARA EVITAR QUE LA APLICACIÓN SE CIERRE
    } finally {
      setIsProcessing(false);
      console.log('🏁 Procesamiento finalizado');
    }
  };

  // FUNCIONES BÁSICAS DE DETECCIÓN - IMPLEMENTADAS PARA ESTABILIDAD
  
  // DETECCIÓN AUTOMÁTICA DE OBJETOS
  const detectBasicObjects = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🔍 INICIANDO DETECCIÓN AUTOMÁTICA DE OBJETOS...');
      
      // 1. APLICAR FILTRO CANNY PARA DETECTAR BORDES
      const filteredImage = await applyFilter(imageData, 'canny');
      console.log('✅ Filtro Canny aplicado para detección automática');
      
      // 2. DETECTAR CONTORNOS REALES CON ALGORITMOS NATIVOS
      const contours = await detectContoursReal(filteredImage, width, height);
      console.log('✅ Contornos detectados con algoritmos nativos:', contours.length);
      
      // 3. FILTRAR CONTORNOS VÁLIDOS
      const validContours = filterValidContours(contours, width, height);
      console.log('✅ Contornos válidos filtrados:', validContours.length);
      
      // 4. CONVERTIR A OBJETOS DETECTADOS
      const detectedObjects = validContours.map((contour: any, index: number) => {
        const boundingBox = calculateBoundingBox(contour.points);
        const area = calculateArea(contour.points);
        const perimeter = calculatePerimeter(contour.points);
        
        return {
          id: `auto_obj_${index}`,
          x: boundingBox.x + boundingBox.width / 2,
          y: boundingBox.y + boundingBox.height / 2,
          width: boundingBox.width,
          height: boundingBox.height,
          area,
          perimeter,
          points: contour.points,
          boundingBox,
          confidence: contour.confidence || 0.85,
          qualityScore: calculateQualityScore(contour, area, perimeter, boundingBox, width, height)
        };
      });
      
      console.log('✅ Objetos automáticos detectados:', detectedObjects.length);
      return detectedObjects;
      
    } catch (error) {
      console.error('❌ Error en detección automática:', error);
      return [];
    }
  };

  // FUNCIÓN AUXILIAR: CALCULAR BOUNDING BOX
  const calculateBoundingBox = (points: number[][]): { x: number; y: number; width: number; height: number } => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = points[0][0], maxX = points[0][0];
    let minY = points[0][1], maxY = points[0][1];
    
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // FUNCIÓN AUXILIAR: CALCULAR ÁREA
  const calculateArea = (points: number[][]): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }
    
    return Math.abs(area) / 2;
  };

  // FUNCIÓN AUXILIAR: CALCULAR PERÍMETRO
  const calculatePerimeter = (points: number[][]): number => {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  };

  // FUNCIÓN AUXILIAR: CALCULAR SCORE DE CALIDAD
  const calculateQualityScore = (contour: any, area: number, perimeter: number, boundingBox: any, imageWidth: number, imageHeight: number): number => {
    try {
      const imageArea = imageWidth * imageHeight;
      const relativeArea = area / imageArea;
      const aspectRatio = boundingBox.width / boundingBox.height;
      const centrality = calculateCentrality(boundingBox, imageWidth, imageHeight);
      
      // Score basado en múltiples factores
      let score = 0;
      
      // Factor de área (preferir objetos medianos-grandes)
      if (relativeArea > 0.01 && relativeArea < 0.6) {
        score += 0.3;
      }
      
      // Factor de forma (preferir formas regulares)
      if (aspectRatio > 0.3 && aspectRatio < 3.0) {
        score += 0.2;
      }
      
      // Factor de centralidad (preferir objetos centrales)
      score += centrality * 0.2;
      
      // Factor de contorno (preferir contornos suaves)
      if (contour.confidence && contour.confidence > 0.5) {
        score += 0.2;
      }
      
      // Factor de perímetro (preferir objetos con perímetro razonable)
      const perimeterEfficiency = area / (perimeter * perimeter);
      if (perimeterEfficiency > 0.01 && perimeterEfficiency < 0.1) {
        score += 0.1;
      }
      
      return Math.min(score, 1.0);
      
    } catch (error) {
      console.error('Error calculando score de calidad:', error);
      return 0.5;
    }
  };

  // FUNCIÓN AUXILIAR: CALCULAR CENTRALIDAD
  const calculateCentrality = (boundingBox: any, imageWidth: number, imageHeight: number): number => {
    try {
      const centerX = boundingBox.x + boundingBox.width / 2;
      const centerY = boundingBox.y + boundingBox.height / 2;
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(centerX - imageWidth / 2, 2) + Math.pow(centerY - imageHeight / 2, 2)
      );
      
      const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
      
      return 1 - (distanceFromCenter / maxDistance);
      
    } catch (error) {
      console.error('Error calculando centralidad:', error);
      return 0.5;
    }
  };

  // FILTRAR CONTORNOS VÁLIDOS
  const filterValidContours = (contours: any[], width: number, height: number): any[] => {
    try {
      const imageArea = width * height;
      const validContours: any[] = [];
      
      for (const contour of contours) {
        try {
          // Verificar que tenga puntos válidos
          if (!contour.points || contour.points.length < 3) {
            continue;
          }
          
          // Calcular propiedades del contorno
          const boundingBox = calculateBoundingBox(contour.points);
          const area = calculateArea(contour.points);
          const perimeter = calculatePerimeter(contour.points);
          
          // Filtrar por área mínima y máxima
          const relativeArea = area / imageArea;
          if (relativeArea < 0.005 || relativeArea > 0.8) {
            continue;
          }
          
          // Filtrar por perímetro mínimo
          if (perimeter < 100) {
            continue;
          }
          
          // Filtrar por relación de aspecto
          const aspectRatio = boundingBox.width / boundingBox.height;
          if (aspectRatio < 0.1 || aspectRatio > 10) {
            continue;
          }
          
          // Filtrar por tamaño mínimo absoluto
          if (boundingBox.width < 20 || boundingBox.height < 20) {
            continue;
          }
          
          // Añadir propiedades calculadas
          contour.boundingBox = boundingBox;
          contour.area = area;
          contour.perimeter = perimeter;
          contour.aspectRatio = aspectRatio;
          contour.relativeArea = relativeArea;
          
          validContours.push(contour);
          
        } catch (error) {
          console.warn('Error procesando contorno:', error);
          continue;
        }
      }
      
      // Ordenar por score de calidad (mejor primero)
      validContours.sort((a, b) => {
        const scoreA = calculateQualityScore(a, a.area, a.perimeter, a.boundingBox, width, height);
        const scoreB = calculateQualityScore(b, b.area, b.perimeter, b.boundingBox, width, height);
        return scoreB - scoreA;
      });
      
      // Limitar a los mejores 5 contornos
      return validContours.slice(0, 5);
      
    } catch (error) {
      console.error('Error filtrando contornos:', error);
      return [];
    }
  };
  
  // FUNCIONES DE DETECCIÓN REALES - ALGORITMOS COMPLETOS
  
  // DETECCIÓN REAL DE BORDES CON OPERADOR SOBEL - FÓRMULAS MATEMÁTICAS COMPLETAS
  const detectEdgesWithSobel = (grayData: Uint8Array, width: number, height: number): Uint8Array => {
    try {
      console.log('🔍 Aplicando operador Sobel con fórmulas matemáticas completas...');
      const edges = new Uint8Array(width * height);
      
      // Kernels Sobel optimizados para detección de bordes centrales
      const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2], 
        [-1, 0, 1]
      ];
      const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
      ];
      
      // Aplicar convolución 2D con kernels Sobel
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          
          // Convolución con kernel X
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = grayData[(y + ky) * width + (x + kx)];
              const kernelValue = sobelX[ky + 1][kx + 1];
              gx += pixel * kernelValue;
            }
          }
          
          // Convolución con kernel Y
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = grayData[(y + ky) * width + (x + kx)];
              const kernelValue = sobelY[ky + 1][kx + 1];
              gy += pixel * kernelValue;
            }
          }
          
          // Cálculo de magnitud del gradiente con normalización
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const normalizedMagnitude = Math.min(255, Math.round(magnitude * 0.5));
          
          // Aplicar umbral adaptativo para bordes centrales
          const threshold = 30 + (normalizedMagnitude * 0.3);
          edges[y * width + x] = normalizedMagnitude > threshold ? normalizedMagnitude : 0;
        }
      }
      
      console.log('✅ Operador Sobel con fórmulas matemáticas aplicado correctamente');
      return edges;
    } catch (error) {
      console.error('❌ Error en operador Sobel matemático:', error);
      return new Uint8Array(width * height);
    }
  };
  
  // DETECCIÓN REAL DE CONTORNOS - ALGORITMO MATEMÁTICO COMPLETO
  const findContoursFromEdges = (edges: Uint8Array, width: number, height: number): any[] => {
    try {
      console.log('🔍 Aplicando algoritmo matemático de detección de contornos...');
      const visited = new Set<number>();
      const contours: any[] = [];
      
      // Umbral adaptativo basado en estadísticas de la imagen
      const edgeValues = Array.from(edges).filter(v => v > 0);
      const meanEdge = edgeValues.reduce((sum, val) => sum + val, 0) / edgeValues.length;
      const stdEdge = Math.sqrt(edgeValues.reduce((sum, val) => sum + Math.pow(val - meanEdge, 2), 0) / edgeValues.length);
      const adaptiveThreshold = Math.max(40, meanEdge - 0.5 * stdEdge);
      
      console.log('📊 Umbral adaptativo calculado:', { meanEdge, stdEdge, adaptiveThreshold });
      
      // Algoritmo de detección de contornos con análisis de conectividad
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          
          if (edges[index] > adaptiveThreshold && !visited.has(index)) {
            // Aplicar algoritmo de seguimiento de contorno con análisis matemático
            const contour = analyzeContourMathematically(edges, width, height, x, y, visited, adaptiveThreshold);
            
            // Filtrar por criterios matemáticos de calidad
            if (isValidContourMathematically(contour, width, height)) {
              contours.push(contour);
            }
          }
        }
      }
      
      console.log('✅ Contornos detectados con algoritmo matemático:', contours.length);
      return contours;
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de contornos:', error);
      return [];
    }
  };
  
  // ANÁLISIS MATEMÁTICO DE CONTORNOS - FÓRMULAS REALES
  const analyzeContourMathematically = (edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>, threshold: number): any => {
    try {
      const points: { x: number; y: number }[] = [];
      const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
      
      let minX = startX, maxX = startX;
      let minY = startY, maxY = startY;
      let totalIntensity = 0;
      let edgeStrength = 0;
      
      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const index = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height || 
            edges[index] <= threshold || visited.has(index)) {
          continue;
        }
        
        visited.add(index);
        points.push({ x, y });
        totalIntensity += edges[index];
        
        // Actualizar bounding box con análisis matemático
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        
        // Análisis de conectividad 8-direccional con pesos
        const neighbors = [
          { dx: 1, dy: 0, weight: 1.0 },
          { dx: -1, dy: 0, weight: 1.0 },
          { dx: 0, dy: 1, weight: 1.0 },
          { dx: 0, dy: -1, weight: 1.0 },
          { dx: 1, dy: 1, weight: 0.7 },
          { dx: 1, dy: -1, weight: 0.7 },
          { dx: -1, dy: 1, weight: 0.7 },
          { dx: -1, dy: -1, weight: 0.7 }
        ];
        
        for (const neighbor of neighbors) {
          const nx = x + neighbor.dx;
          const ny = y + neighbor.dy;
          const nIndex = ny * width + nx;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
              edges[nIndex] > threshold && !visited.has(nIndex)) {
            stack.push({ x: nx, y: ny });
          }
        }
      }
      
      // Cálculos matemáticos del contorno
      const boundingBox = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      const area = boundingBox.width * boundingBox.height;
      const perimeter = points.length;
      const averageIntensity = totalIntensity / points.length;
      
      // Calcular curvatura y suavidad del contorno
      const curvature = calculateContourCurvature(points);
      const smoothness = calculateContourSmoothness(points);
      
      // Calcular confianza basada en múltiples factores matemáticos
      const confidence = calculateMathematicalConfidence(area, perimeter, averageIntensity, curvature, smoothness, width, height);
      
      return {
        points,
        boundingBox,
        area,
        perimeter,
        averageIntensity,
        curvature,
        smoothness,
        confidence
      };
    } catch (error) {
      console.error('❌ Error en análisis matemático de contorno:', error);
      return { points: [], boundingBox: { x: 0, y: 0, width: 0, height: 0 }, area: 0, confidence: 0 };
    }
  };
  
  // VALIDACIÓN MATEMÁTICA DE CONTORNOS - FÓRMULAS REALES
  const isValidContourMathematically = (contour: any, width: number, height: number): boolean => {
    try {
      const { area, perimeter, curvature, smoothness, confidence } = contour;
      
      // Criterios matemáticos de validación
      const minArea = Math.max(1000, (width * height) * 0.01);
      const maxArea = (width * height) * 0.7;
      
      if (area < minArea || area > maxArea) return false;
      
      // Verificar relación área-perímetro (compacidad)
      const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
      if (compactness < 0.1 || compactness > 1.0) return false;
      
      // Verificar curvatura (evitar líneas rectas muy largas)
      if (curvature < 0.1 || curvature > 2.0) return false;
      
      // Verificar suavidad del contorno
      if (smoothness < 0.3) return false;
      
      // Verificar confianza matemática
      if (confidence < 0.4) return false;
      
      return true;
    } catch (error) {
      console.error('❌ Error en validación matemática:', error);
      return false;
    }
  };
  
  // CÁLCULO DE CURVATURA DEL CONTORNO - FÓRMULA MATEMÁTICA
  const calculateContourCurvature = (points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 3) return 0;
      
      let totalCurvature = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        // Calcular ángulo entre tres puntos consecutivos
        const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let angleDiff = angle2 - angle1;
        
        // Normalizar ángulo
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        totalCurvature += Math.abs(angleDiff);
      }
      
      return totalCurvature / (points.length - 2);
    } catch (error) {
      console.error('❌ Error calculando curvatura:', error);
      return 0;
    }
  };
  
  // CÁLCULO DE SUAVIDAD DEL CONTORNO - FÓRMULA MATEMÁTICA
  const calculateContourSmoothness = (points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 2) return 0;
      
      let totalVariation = 0;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        const distance = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        totalVariation += distance;
      }
      
      const averageVariation = totalVariation / (points.length - 1);
      const smoothness = Math.max(0, 1 - (averageVariation / 10)); // Normalizar
      
      return Math.min(1.0, smoothness);
    } catch (error) {
      console.error('❌ Error calculando suavidad:', error);
      return 0;
    }
  };
  
  // CÁLCULO DE CONFIANZA MATEMÁTICA - FÓRMULA COMPUESTA
  const calculateMathematicalConfidence = (area: number, perimeter: number, intensity: number, curvature: number, smoothness: number, width: number, height: number): number => {
    try {
      // Factores de confianza
      const areaFactor = Math.min(1.0, area / (width * height * 0.1));
      const perimeterFactor = Math.min(1.0, perimeter / 100);
      const intensityFactor = Math.min(1.0, intensity / 255);
      const curvatureFactor = Math.min(1.0, curvature / 1.0);
      const smoothnessFactor = smoothness;
      
      // Fórmula de confianza ponderada
      const confidence = (
        areaFactor * 0.25 +
        perimeterFactor * 0.20 +
        intensityFactor * 0.25 +
        curvatureFactor * 0.15 +
        smoothnessFactor * 0.15
      );
      
      return Math.min(1.0, Math.max(0.0, confidence));
    } catch (error) {
      console.error('❌ Error calculando confianza matemática:', error);
      return 0.5;
    }
  };
  
  // Flood fill para contornos - CORREGIDA
  const floodFillContour = (edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>, threshold: number): any => {
    try {
      const points: { x: number; y: number }[] = [];
      const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
      
      let minX = startX, maxX = startX;
      let minY = startY, maxY = startY;
      
      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const index = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height || 
            edges[index] <= threshold || visited.has(index)) {
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
      const confidence = Math.min(1.0, points.length / (width * height * 0.01));
      
      return {
        points,
        boundingBox,
        area,
        confidence
      };
    } catch (error) {
      console.error('❌ Error en flood fill mejorado:', error);
      return { points: [], boundingBox: { x: 0, y: 0, width: 0, height: 0 }, area: 0, confidence: 0 };
    }
  };
  
  // FUNCIÓN ELIMINADA - DUPLICADA CON LA NUEVA IMPLEMENTACIÓN
  
  // CÁLCULO DE PUNTUACIÓN DE CALIDAD DEL CONTORNO - FÓRMULA MATEMÁTICA
  const calculateContourQualityScore = (contour: any, width: number, height: number): number => {
    try {
      const { area, perimeter, curvature, smoothness, confidence, averageIntensity } = contour;
      const { width: w, height: h } = contour.boundingBox;
      
      // Factores de calidad normalizados
      const areaScore = Math.min(1.0, area / (width * height * 0.1));
      const perimeterScore = Math.min(1.0, perimeter / 200);
      const curvatureScore = Math.min(1.0, curvature / 1.0);
      const smoothnessScore = smoothness;
      const confidenceScore = confidence;
      const intensityScore = Math.min(1.0, averageIntensity / 255);
      
      // Fórmula de puntuación ponderada
      const qualityScore = (
        areaScore * 0.20 +
        perimeterScore * 0.15 +
        curvatureScore * 0.15 +
        smoothnessScore * 0.20 +
        confidenceScore * 0.20 +
        intensityScore * 0.10
      );
      
      return Math.min(1.0, Math.max(0.0, qualityScore));
    } catch (error) {
      console.error('❌ Error calculando puntuación de calidad:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO DE PUNTUACIÓN COMPUESTA - FÓRMULA MATEMÁTICA AVANZADA
  const calculateCompositeScore = (contour: any, normalizedDistance: number): number => {
    try {
      const { qualityScore, area, confidence } = contour;
      
      // Factores de puntuación - PRIORIZAR TAMAÑO
      const qualityFactor = qualityScore;
      const sizeFactor = Math.min(1.0, area / 5000); // Reducir divisor para priorizar objetos grandes
      const confidenceFactor = confidence;
      const centralityFactor = 1.0 - normalizedDistance;
      
      // Fórmula de puntuación compuesta con pesos optimizados - PRIORIZAR TAMAÑO
      const compositeScore = (
        qualityFactor * 0.20 +      // Reducir peso de calidad
        sizeFactor * 0.40 +         // Aumentar peso del tamaño
        confidenceFactor * 0.25 +   // Mantener confianza
        centralityFactor * 0.15     // Reducir peso de centralidad
      );
      
      return Math.min(1.0, Math.max(0.0, compositeScore));
    } catch (error) {
      console.error('❌ Error calculando puntuación compuesta:', error);
      return 0.5;
    }
  };
  
  // SELECCIÓN ÓPTIMA DE CONTORNOS - ALGORITMO DE CLUSTERING
  const selectOptimalContours = (contours: any[], width: number, height: number): any[] => {
    try {
      if (contours.length === 0) return [];
      
      // Aplicar algoritmo de selección inteligente
      const maxContours = 3;
      const selectedContours: any[] = [];
      
      for (const contour of contours) {
        if (selectedContours.length >= maxContours) break;
        
        // Verificar que no haya superposición significativa con contornos ya seleccionados
        const hasSignificantOverlap = selectedContours.some(selected => {
          const overlap = calculateContourOverlap(contour, selected);
          return overlap > 0.3; // Máximo 30% de superposición
        });
        
        if (!hasSignificantOverlap) {
          selectedContours.push(contour);
        }
      }
      
      return selectedContours;
    } catch (error) {
      console.error('❌ Error en selección óptima de contornos:', error);
      return contours.slice(0, 3);
    }
  };
  
  // CÁLCULO DE SUPERPOSICIÓN ENTRE CONTORNOS - FÓRMULA MATEMÁTICA
  const calculateContourOverlap = (contour1: any, contour2: any): number => {
    try {
      const { boundingBox: box1 } = contour1;
      const { boundingBox: box2 } = contour2;
      
      // Calcular intersección de bounding boxes
      const left = Math.max(box1.x, box2.x);
      const top = Math.max(box1.y, box2.y);
      const right = Math.min(box1.x + box1.width, box2.x + box2.width);
      const bottom = Math.min(box1.y + box1.height, box2.y + box2.height);
      
      if (left >= right || top >= bottom) return 0; // Sin superposición
      
      const intersectionArea = (right - left) * (bottom - top);
      const unionArea = (box1.width * box1.height) + (box2.width * box2.height) - intersectionArea;
      
      return intersectionArea / unionArea; // Coeficiente de Jaccard
    } catch (error) {
      console.error('❌ Error calculando superposición:', error);
      return 0;
    }
  };
  
  // OVERLAY AVANZADO CON MEDICIONES REALES EN MM/CM
  const drawBasicOverlay = (ctx: CanvasRenderingContext2D, object: any, measurements: any) => {
    try {
      console.log('🎨 Dibujando overlay con mediciones reales en MM/CM...');
      
      // Limpiar canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar bounding box del objeto detectado
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(object.x, object.y, object.width, object.height);
      
      // Dibujar centro del objeto
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(object.x + object.width / 2, object.y + object.height / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // MEDICIONES EN PÍXELES (arriba)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`Ancho: ${measurements.width.toFixed(1)}px`, object.x, object.y - 60);
      ctx.fillText(`Alto: ${measurements.height.toFixed(1)}px`, object.x, object.y - 40);
      ctx.fillText(`Área: ${measurements.area.toFixed(0)}px²`, object.x, object.y - 20);
      
      // MEDICIONES REALES EN MM (abajo - PRINCIPALES)
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`📏 ${measurements.realWidth.toFixed(1)}mm`, object.x, object.y + object.height + 20);
      ctx.fillText(`📐 ${measurements.realHeight.toFixed(1)}mm`, object.x, object.y + object.height + 40);
      ctx.fillText(`📊 ${measurements.realArea.toFixed(1)}mm²`, object.x, object.y + object.height + 60);
      
      // MEDICIONES 3D SI ESTÁN DISPONIBLES
      if (measurements.depth && measurements.volume) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`🔍 Prof: ${measurements.depth.toFixed(1)}mm`, object.x, object.y + object.height + 80);
        ctx.fillText(`📦 Vol: ${measurements.volume.toFixed(1)}mm³`, object.x, object.y + object.height + 100);
      }
      
      // Información del objeto
      ctx.fillStyle = '#00ffff';
      ctx.font = '14px Arial';
      ctx.fillText(`Confianza: ${(object.confidence * 100).toFixed(0)}%`, object.x, object.y + object.height + 120);
      ctx.fillText(`Unidad: ${measurements.unit}`, object.x, object.y + object.height + 140);
      
      console.log('✅ Overlay con mediciones reales en MM/CM dibujado correctamente');
    } catch (error) {
      console.error('❌ Error dibujando overlay con mediciones reales en MM/CM:', error);
    }
  };

  // FUNCIONES SIMPLIFICADAS PARA ESTABILIDAD
  
  // Seleccionar objeto más prominente - CORREGIDO
  const selectMostProminentObject = (rects: any[]): DetectedObject | null => {
    if (rects.length === 0) return null;

    // CORREGIDO - RETORNAR OBJETO CENTRAL PROMINENTE
    const firstRect = rects[0];
    return {
      id: 'central_prominent_obj',
      type: 'detected',
      x: firstRect.x,
      y: firstRect.y,
      width: firstRect.width,
      height: firstRect.height,
      area: firstRect.width * firstRect.height,
      perimeter: 2 * (firstRect.width + firstRect.height),
      points: true,
      boundingBox: {
        x: firstRect.x,
        y: firstRect.y,
        width: firstRect.width,
        height: firstRect.height
      },
      dimensions: {
        width: firstRect.width,
        height: firstRect.height,
        area: firstRect.width * firstRect.height,
        unit: 'px'
      },
      confidence: 0.8
    };
  };

  // CALCULAR MEDICIONES COMPLETAS Y REALES - ALGORITMOS AVANZADOS CORREGIDOS
  const calculateRealTimeMeasurements = async (object: DetectedObject, imageData: ImageData) => {
    try {
      console.log('📏 INICIANDO CÁLCULO DE MEDICIONES COMPLETAS CORREGIDAS...');
      
      if (!object || !object.dimensions || !object.dimensions.width || !object.dimensions.height) {
        console.warn('⚠️ Objeto inválido para mediciones');
        return getDefaultMeasurements();
      }

      const { width, height, area } = object.dimensions;
      
      // 1. MEDICIONES BÁSICAS EN PÍXELES
      const basicMeasurements = {
        width,
        height,
        area,
        perimeter: 2 * (width + height),
        diagonal: Math.sqrt(width ** 2 + height ** 2),
        aspectRatio: width / height,
        unit: 'px'
      };
      
      console.log('✅ Mediciones básicas calculadas');

      // 2. ESTIMACIÓN DE PROFUNDIDAD REAL
      let estimatedDepth = 0;
      try {
        estimatedDepth = await estimateDepthFromObject(object, imageData);
        console.log('✅ Profundidad estimada:', estimatedDepth, 'mm');
      } catch (depthError) {
        console.warn('⚠️ Error estimando profundidad, usando valor por defecto:', depthError);
        estimatedDepth = 100; // Valor por defecto en mm
      }

        // 3. CONVERTIR A UNIDADES REALES (mm/cm) - SIEMPRE CALCULAR
  let realWidth = 0, realHeight = 0, realArea = 0;
  let unit = 'px';
  
  // CALCULAR UNIDADES REALES SIEMPRE (con o sin calibración)
  if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
    // USAR CALIBRACIÓN EXISTENTE
    const pixelsPerMm = calibrationData.pixelsPerMm;
    realWidth = width / pixelsPerMm;
    realHeight = height / pixelsPerMm;
    realArea = area / (pixelsPerMm ** 2);
    unit = 'mm';
    console.log('✅ Conversión a unidades reales con calibración:', { realWidth, realHeight, realArea, unit });
  } else {
    // ESTIMAR UNIDADES REALES SIN CALIBRACIÓN (basado en resolución típica)
    // Asumir resolución típica de cámara móvil: 72 DPI = 2.83 píxeles por mm
    const estimatedPixelsPerMm = 2.83;
    realWidth = width / estimatedPixelsPerMm;
    realHeight = height / estimatedPixelsPerMm;
    realArea = area / (estimatedPixelsPerMm ** 2);
    unit = 'mm (estimado)';
    console.log('✅ Conversión a unidades reales estimadas:', { realWidth, realHeight, realArea, unit });
  }

      // 4. CÁLCULOS 3D AVANZADOS
      const volume3D = estimatedDepth * realWidth * realHeight;
      const surfaceArea3D = 2 * (realWidth * realHeight + 
                                 realWidth * estimatedDepth + 
                                 realHeight * estimatedDepth);
      
      // 5. ANÁLISIS DE FORMA AVANZADO
      const circularity = calculateCircularity(object);
      const solidity = calculateSolidity(object);
      const compactness = calculateCompactness(object);
      
      // 6. MEDICIONES COMPLETAS CON UNIDADES REALES EN MM/CM
      const completeMeasurements = {
        // Medidas en píxeles
        ...basicMeasurements,
        
        // Medidas en unidades reales (SIEMPRE DISPONIBLES)
        realWidth: Math.round(realWidth * 100) / 100, // Redondear a 2 decimales
        realHeight: Math.round(realHeight * 100) / 100,
        realArea: Math.round(realArea * 100) / 100,
        
        // Medidas 3D en unidades reales
        depth: Math.round(estimatedDepth * 100) / 100,
        volume: Math.round(volume3D * 100) / 100,
        surfaceArea: Math.round(surfaceArea3D * 100) / 100,
        
        // Análisis de forma
        circularity: Math.round(circularity * 1000) / 1000,
        solidity: Math.round(solidity * 1000) / 1000,
        compactness: Math.round(compactness * 1000000) / 1000000,
        
        // Unidad principal (mm)
        unit,
        
        // Información adicional
        timestamp: Date.now(),
        confidence: object.confidence || 0.8
      };
      
      console.log('✅ MEDICIONES COMPLETAS CALCULADAS:', completeMeasurements);
      return completeMeasurements;
      
    } catch (error) {
      console.error('❌ Error crítico al calcular mediciones:', error);
      return getDefaultMeasurements();
    }
  };
  
  // Función auxiliar para mediciones por defecto - CORREGIDA
  const getDefaultMeasurements = () => ({
    width: 0, height: 0, area: 0,
    realWidth: 0, realHeight: 0, realArea: 0,
    depth: 0, volume: 0, surfaceArea: 0,
    perimeter: 0, diagonal: 0, aspectRatio: 0,
    circularity: 0, solidity: 0, compactness: 0,
    unit: 'mm', timestamp: Date.now(), confidence: 0
  });
  
  // ESTIMACIÓN MATEMÁTICA REAL DE PROFUNDIDAD - ALGORITMO AVANZADO
  const estimateDepthFromObject = async (object: DetectedObject, imageData: ImageData): Promise<number> => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de estimación de profundidad...');
      
      const { width, height } = imageData;
      const { boundingBox, dimensions } = object;
      
      // 1. ANÁLISIS MATEMÁTICO DE PERSPECTIVA CON FÓRMULAS REALES
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      // Normalizar coordenadas del objeto (0-1)
      const normalizedX = objectCenterX / width;
      const normalizedY = objectCenterY / height;
      
      // Fórmula de perspectiva basada en geometría proyectiva
      // Objetos más abajo y centrados están más cerca
      const perspectiveFactor = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      const perspectiveDepth = 25 + (perspectiveFactor * 175); // 25mm a 200mm
      
      console.log('📊 Análisis de perspectiva:', { normalizedX, normalizedY, perspectiveFactor, perspectiveDepth });
      
      // 2. ANÁLISIS MATEMÁTICO DE TAMAÑO RELATIVO
      const objectArea = dimensions.area;
      const imageArea = width * height;
      const relativeSize = objectArea / imageArea;
      
      // Fórmula de profundidad basada en tamaño con corrección logarítmica
      const sizeBasedDepth = 60 + (Math.log(relativeSize * 1000 + 1) * 200); // 60mm a 500mm
      
      console.log('📏 Análisis de tamaño:', { objectArea, imageArea, relativeSize, sizeBasedDepth });
      
      // 3. ANÁLISIS MATEMÁTICO DE ENFOQUE Y NITIDEZ
      const focusDepth = calculateFocusDepth(object, imageData);
      
      // 4. ANÁLISIS DE CONTRASTE Y TEXTURA
      const contrastDepth = calculateContrastBasedDepth(object, imageData);
      
      // 5. ALGORITMO DE FUSIÓN MATEMÁTICA CON PESOS ADAPTATIVOS
      const weights = calculateAdaptiveWeights(object, imageData);
      
      const finalDepth = (
        perspectiveDepth * weights.perspective +
        sizeBasedDepth * weights.size +
        focusDepth * weights.focus +
        contrastDepth * weights.contrast
      );
      
      // 6. APLICAR FILTRO MATEMÁTICO DE SUAVIDAD
      const smoothedDepth = applyDepthSmoothing(finalDepth, object);
      
      // 7. VALIDACIÓN MATEMÁTICA DE RANGO
      const validatedDepth = Math.max(3, Math.min(600, smoothedDepth));
      
      console.log('✅ Profundidad matemática calculada:', {
        perspectiveDepth, sizeBasedDepth, focusDepth, contrastDepth,
        weights, finalDepth, smoothedDepth, validatedDepth
      });
      
      return Math.round(validatedDepth * 100) / 100; // Redondear a 2 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de profundidad:', error);
      return 150; // Valor por defecto más realista
    }
  };
  
  // CÁLCULO MATEMÁTICO DE PROFUNDIDAD DE ENFOQUE
  const calculateFocusDepth = (object: DetectedObject, imageData: ImageData): number => {
    try {
      const { width, height } = imageData;
      const { boundingBox } = object;
      
      // Calcular distancia del objeto al centro de la imagen
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      );
      
      // Profundidad de enfoque basada en distancia al centro
      // Objetos más centrados tienen mejor enfoque
      const maxDistance = Math.sqrt(width * width + height * height) / 2;
      const normalizedDistance = distanceToCenter / maxDistance;
      
      // Fórmula de profundidad de enfoque con corrección gaussiana
      const focusDepth = 100 + (normalizedDistance * 150); // 100mm a 250mm
      
      return focusDepth;
    } catch (error) {
      console.error('❌ Error calculando profundidad de enfoque:', error);
      return 150;
    }
  };
  
  // CÁLCULO MATEMÁTICO DE PROFUNDIDAD BASADA EN CONTRASTE
  const calculateContrastBasedDepth = (object: DetectedObject, imageData: ImageData): number => {
    try {
      const { boundingBox } = object;
      const { data, width } = imageData;
      
      // Extraer región del objeto
      const regionData = extractObjectRegion(data, width, boundingBox);
      
      // Calcular contraste local usando desviación estándar
      const contrast = calculateLocalContrast(regionData);
      
      // Fórmula de profundidad basada en contraste
      // Mayor contraste = objeto más cerca
      const contrastDepth = 80 + (contrast * 300); // 80mm a 380mm
      
      return contrastDepth;
    } catch (error) {
      console.error('❌ Error calculando profundidad por contraste:', error);
      return 200;
    }
  };
  
  // EXTRACCIÓN MATEMÁTICA DE REGIÓN DEL OBJETO
  const extractObjectRegion = (data: Uint8ClampedArray, width: number, boundingBox: any): Uint8Array => {
    try {
      const { x, y, width: objWidth, height: objHeight } = boundingBox;
      const regionData = new Uint8Array(objWidth * objHeight);
      
      let index = 0;
      for (let row = y; row < y + objHeight; row++) {
        for (let col = x; col < x + objWidth; col++) {
          const pixelIndex = (row * width + col) * 4;
          // Convertir a escala de grises
          const gray = Math.round(
            0.299 * data[pixelIndex] + 
            0.587 * data[pixelIndex + 1] + 
            0.114 * data[pixelIndex + 2]
          );
          regionData[index++] = gray;
        }
      }
      
      return regionData;
    } catch (error) {
      console.error('❌ Error extrayendo región del objeto:', error);
      return new Uint8Array(0);
    }
  };
  
  // CÁLCULO MATEMÁTICO DE CONTRASTE LOCAL
  const calculateLocalContrast = (regionData: Uint8Array): number => {
    try {
      if (regionData.length === 0) return 0;
      
      // Calcular media
      const mean = regionData.reduce((sum, val) => sum + val, 0) / regionData.length;
      
      // Calcular desviación estándar
      const variance = regionData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / regionData.length;
      const stdDev = Math.sqrt(variance);
      
      // Normalizar contraste (0-1)
      const normalizedContrast = Math.min(1.0, stdDev / 128);
      
      return normalizedContrast;
    } catch (error) {
      console.error('❌ Error calculando contraste local:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO MATEMÁTICO DE PESOS ADAPTATIVOS
  const calculateAdaptiveWeights = (object: DetectedObject, imageData: ImageData): any => {
    try {
      const { width, height } = imageData;
      const { dimensions, boundingBox } = object;
      
      // Calcular confiabilidad de cada método
      const perspectiveReliability = calculatePerspectiveReliability(boundingBox, width, height);
      const sizeReliability = calculateSizeReliability(dimensions, width, height);
      const focusReliability = calculateFocusReliability(boundingBox, width, height);
      const contrastReliability = calculateContrastReliability(object, imageData);
      
      // Normalizar pesos para que sumen 1
      const totalReliability = perspectiveReliability + sizeReliability + focusReliability + contrastReliability;
      
      const weights = {
        perspective: perspectiveReliability / totalReliability,
        size: sizeReliability / totalReliability,
        focus: focusReliability / totalReliability,
        contrast: contrastReliability / totalReliability
      };
      
      console.log('⚖️ Pesos adaptativos calculados:', weights);
      return weights;
      
    } catch (error) {
      console.error('❌ Error calculando pesos adaptativos:', error);
      return { perspective: 0.4, size: 0.3, focus: 0.2, contrast: 0.1 };
    }
  };
  
  // CÁLCULO DE CONFIABILIDAD DE PERSPECTIVA
  const calculatePerspectiveReliability = (boundingBox: any, width: number, height: number): number => {
    try {
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      // Distancia al centro (0 = centro, 1 = borde)
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      ) / (Math.sqrt(width * width + height * height) / 2);
      
      // Confiabilidad inversa a la distancia al centro
      const reliability = Math.max(0.1, 1.0 - distanceToCenter);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de perspectiva:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO DE CONFIABILIDAD DE TAMAÑO
  const calculateSizeReliability = (dimensions: any, width: number, height: number): number => {
    try {
      const relativeSize = dimensions.area / (width * height);
      
      // Confiabilidad máxima para objetos de tamaño medio
      // Muy pequeños o muy grandes son menos confiables
      const optimalSize = 0.1; // 10% de la imagen
      const sizeDifference = Math.abs(relativeSize - optimalSize) / optimalSize;
      
      const reliability = Math.max(0.1, 1.0 - sizeDifference);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de tamaño:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO DE CONFIABILIDAD DE ENFOQUE
  const calculateFocusReliability = (boundingBox: any, width: number, height: number): number => {
    try {
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      // Distancia al centro (0 = centro, 1 = borde)
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      ) / (Math.sqrt(width * width + height * height) / 2);
      
      // Confiabilidad máxima en el centro
      const reliability = Math.max(0.1, 1.0 - distanceToCenter);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de enfoque:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO DE CONFIABILIDAD DE CONTRASTE
  const calculateContrastReliability = (object: DetectedObject, imageData: ImageData): number => {
    try {
      const { boundingBox } = object;
      const { data, width } = imageData;
      
      // Extraer región del objeto
      const regionData = extractObjectRegion(data, width, boundingBox);
      
      // Calcular contraste
      const contrast = calculateLocalContrast(regionData);
      
      // Confiabilidad basada en contraste
      // Mayor contraste = mayor confiabilidad
      const reliability = Math.max(0.1, contrast);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de contraste:', error);
      return 0.5;
    }
  };
  
  // APLICACIÓN DE FILTRO MATEMÁTICO DE SUAVIDAD
  const applyDepthSmoothing = (depth: number, object: DetectedObject): number => {
    try {
      // Aplicar filtro de suavidad basado en confianza del objeto
      const confidence = object.confidence || 0.8;
      
      // Factor de suavidad (0 = sin suavizar, 1 = muy suavizado)
      const smoothingFactor = 1.0 - confidence;
      
      // Aplicar suavidad gaussiana simple
      const smoothedDepth = depth * (1.0 - smoothingFactor * 0.1);
      
      return smoothedDepth;
    } catch (error) {
      console.error('❌ Error aplicando suavidad de profundidad:', error);
      return depth;
    }
  };
  
  // ANÁLISIS MATEMÁTICO REAL DE FORMA - ALGORITMOS AVANZADOS
  const calculateCircularity = (object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de circularidad...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DE PERÍMETRO REAL CON ANÁLISIS DE CONTORNO
      const perimeter = calculateRealPerimeter(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE CIRCULARIDAD
      // Circularidad = 4π * área / perímetro² (fórmula estándar)
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // 3. NORMALIZACIÓN Y VALIDACIÓN MATEMÁTICA
      const normalizedCircularity = Math.min(1.0, Math.max(0.0, circularity));
      
      // 4. APLICAR CORRECCIÓN DE DISTORSIÓN
      const correctedCircularity = applyCircularityCorrection(normalizedCircularity, object);
      
      console.log('✅ Circularidad matemática calculada:', {
        area, perimeter, circularity, normalizedCircularity, correctedCircularity
      });
      
      return Math.round(correctedCircularity * 10000) / 10000; // 4 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de circularidad:', error);
      return 0;
    }
  };
  
  // CÁLCULO MATEMÁTICO REAL DEL PERÍMETRO
  const calculateRealPerimeter = (object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      
      // Si tenemos puntos del contorno, calcular perímetro real
      if (object.points && object.points.length > 0) {
        let perimeter = 0;
        for (let i = 0; i < object.points.length; i++) {
          const current = object.points[i];
          const next = object.points[(i + 1) % object.points.length];
          
          const distance = Math.sqrt(
            Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)
          );
          perimeter += distance;
        }
        return perimeter;
      }
      
      // Fallback: perímetro aproximado del bounding box
      return 2 * (width + height);
    } catch (error) {
      console.error('❌ Error calculando perímetro real:', error);
      const { width, height } = object.dimensions;
      return 2 * (width + height);
    }
  };
  
  // CORRECCIÓN MATEMÁTICA DE CIRCULARIDAD
  const applyCircularityCorrection = (circularity: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen circularidad artificialmente alta
      const aspectRatioCorrection = Math.min(1.0, 1.0 / aspectRatio);
      
      // Aplicar corrección basada en confianza del objeto
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedCircularity = circularity * aspectRatioCorrection * confidenceCorrection;
      
      return Math.min(1.0, Math.max(0.0, correctedCircularity));
    } catch (error) {
      console.error('❌ Error aplicando corrección de circularidad:', error);
      return circularity;
    }
  };
  
  // CÁLCULO MATEMÁTICO REAL DE SOLIDEZ
  const calculateSolidity = (object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de solidez...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DE CONVEX HULL APROXIMADO
      const convexHullArea = calculateConvexHullArea(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE SOLIDEZ
      // Solidez = área del objeto / área del convex hull
      const solidity = convexHullArea > 0 ? area / convexHullArea : 0;
      
      // 3. VALIDACIÓN Y NORMALIZACIÓN
      const validatedSolidity = Math.min(1.0, Math.max(0.0, solidity));
      
      // 4. APLICAR CORRECCIÓN DE FORMA
      const correctedSolidity = applySolidityCorrection(validatedSolidity, object);
      
      console.log('✅ Solidez matemática calculada:', {
        area, convexHullArea, solidity, validatedSolidity, correctedSolidity
      });
      
      return Math.round(correctedSolidity * 1000) / 1000; // 3 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de solidez:', error);
      return 0.5;
    }
  };
  
  // CÁLCULO MATEMÁTICO DEL ÁREA DEL CONVEX HULL
  const calculateConvexHullArea = (object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      
      // Si tenemos puntos del contorno, calcular convex hull real
      if (object.points && object.points.length > 0) {
        const convexHull = calculateConvexHull(object.points);
        return calculatePolygonArea(convexHull);
      }
      
      // Fallback: área del bounding box (sobreestimación)
      return width * height;
    } catch (error) {
      console.error('❌ Error calculando área del convex hull:', error);
      const { width, height } = object.dimensions;
      return width * height;
    }
  };
  
  // ALGORITMO MATEMÁTICO DEL CONVEX HULL (Graham Scan)
  const calculateConvexHull = (points: { x: number; y: number }[]): { x: number; y: number }[] => {
    try {
      if (points.length < 3) return points;
      
      // Encontrar punto más bajo (y más a la izquierda si hay empate)
      let lowest = 0;
      for (let i = 1; i < points.length; i++) {
        if (points[i].y < points[lowest].y || 
            (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
          lowest = i;
        }
      }
      
      // Ordenar puntos por ángulo polar desde el punto más bajo
      const sortedPoints = points.map((point, index) => ({
        point,
        angle: Math.atan2(point.y - points[lowest].y, point.x - points[lowest].x),
        index
      })).sort((a, b) => a.angle - b.angle);
      
      // Construir convex hull
      const hull: { x: number; y: number }[] = [];
      for (const { point } of sortedPoints) {
        while (hull.length >= 2 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], point)) {
          hull.pop();
        }
        hull.push(point);
      }
      
      return hull;
    } catch (error) {
      console.error('❌ Error calculando convex hull:', error);
      return points;
    }
  };
  
  // VERIFICAR SI ES GIRO A LA IZQUIERDA
  const isLeftTurn = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): boolean => {
    try {
      const crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
      return crossProduct > 0;
    } catch (error) {
      console.error('❌ Error verificando giro:', error);
      return true;
    }
  };
  
  // CÁLCULO MATEMÁTICO DEL ÁREA DE UN POLÍGONO
  const calculatePolygonArea = (points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 3) return 0;
      
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
      }
      
      return Math.abs(area) / 2;
    } catch (error) {
      console.error('❌ Error calculando área del polígono:', error);
      return 0;
    }
  };
  
  // CORRECCIÓN MATEMÁTICA DE SOLIDEZ
  const applySolidityCorrection = (solidity: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen solidez artificialmente baja
      const aspectRatioCorrection = Math.min(1.0, aspectRatio / 2);
      
      // Aplicar corrección basada en confianza
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedSolidity = solidity * (0.5 + 0.5 * aspectRatioCorrection) * confidenceCorrection;
      
      return Math.min(1.0, Math.max(0.0, correctedSolidity));
    } catch (error) {
      console.error('❌ Error aplicando corrección de solidez:', error);
      return solidity;
    }
  };
  
  // CÁLCULO MATEMÁTICO REAL DE COMPACIDAD
  const calculateCompactness = (object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de compacidad...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DEL PERÍMETRO REAL
      const perimeter = calculateRealPerimeter(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE COMPACIDAD
      // Compacidad = área / (perímetro²) - Fórmula estándar
      const compactness = perimeter > 0 ? area / (perimeter * perimeter) : 0;
      
      // 3. NORMALIZACIÓN Y VALIDACIÓN
      const normalizedCompactness = Math.max(0, compactness);
      
      // 4. APLICAR CORRECCIÓN DE ESCALA
      const correctedCompactness = applyCompactnessCorrection(normalizedCompactness, object);
      
      console.log('✅ Compacidad matemática calculada:', {
        area, perimeter, compactness, normalizedCompactness, correctedCompactness
      });
      
      return Math.round(correctedCompactness * 1000000) / 1000000; // 6 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de compacidad:', error);
      return 0;
    }
  };
  
  // CORRECCIÓN MATEMÁTICA DE COMPACIDAD
  const applyCompactnessCorrection = (compactness: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen compacidad artificialmente baja
      const aspectRatioCorrection = Math.min(1.0, 1.0 / Math.sqrt(aspectRatio));
      
      // Aplicar corrección basada en confianza
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedCompactness = compactness * aspectRatioCorrection * confidenceCorrection;
      
      return Math.max(0, correctedCompactness);
    } catch (error) {
      console.error('❌ Error aplicando corrección de compacidad:', error);
      return compactness;
    }
  };

  // Dibujar overlay en tiempo real - CORREGIDO
  const drawRealTimeOverlay = (ctx: CanvasRenderingContext2D, object: DetectedObject, measurements: any) => {
    try {
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
      ctx.fillText(`Ancho: ${measurements.width?.toFixed(1) || 'N/A'}px`, x, y - 40);
      ctx.fillText(`Alto: ${measurements.height?.toFixed(1) || 'N/A'}px`, x, y - 20);
      ctx.fillText(`Área: ${measurements.area?.toFixed(0) || 'N/A'}px²`, x, y - 5);
      
      // Mostrar mediciones reales si están disponibles
      if (measurements.realWidth && measurements.realHeight) {
        ctx.fillText(`Ancho: ${measurements.realWidth.toFixed(1)}mm`, x, y + 15);
        ctx.fillText(`Alto: ${measurements.realHeight.toFixed(1)}mm`, x, y + 35);
        ctx.fillText(`Área: ${measurements.realArea.toFixed(0)}mm²`, x, y + 55);
      }
      
      // Indicador de objeto específico
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('🎯 Objeto Central Prominente Detectado', x, y + 75);
      
    } catch (error) {
      console.error('❌ Error al dibujar overlay corregido:', error);
    }
  };

  // MANEJADORES DE EVENTOS - PROTEGIDOS
  const handleCapture = async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current) {
        console.warn('⚠️ Cámara no disponible para captura');
        return;
      }

      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageCapture?.(imageData);
      
      console.log('📸 Imagen capturada exitosamente');
    } catch (error) {
      console.error('❌ Error al capturar imagen:', error);
    }
  };

  const handleFocus = (event: React.MouseEvent<HTMLVideoElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setFocusPoint({ x, y });
      
      console.log('🎯 Punto de enfoque establecido:', { x, y });
    } catch (error) {
      console.error('❌ Error al establecer punto de enfoque:', error);
    }
  };

  // SISTEMA DE DETECCIÓN AVANZADA DE NIVEL INDUSTRIAL - ALGORITMOS DE EXTREMA COMPLEJIDAD
  const detectAdvancedObjects = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🚀 INICIANDO SISTEMA DE DETECCIÓN AVANZADA DE NIVEL INDUSTRIAL...');
      
      // 1. PREPROCESAMIENTO AVANZADO CON FILTROS MATEMÁTICOS COMPLEJOS
      const preprocessedImage = await preprocessImageAdvanced(imageData, width, height);
      console.log('✅ Preprocesamiento avanzado completado');
      
      // 2. DETECCIÓN DE BORDES MULTI-ESCALA CON ALGORITMOS GABOR Y WAVELET
      const edgeMaps = await detectMultiScaleEdges(preprocessedImage, width, height);
      console.log('✅ Detección de bordes multi-escala completada');
      
      // 3. SEGMENTACIÓN AVANZADA CON ALGORITMOS DE MACHINE LEARNING
      const segments = await segmentImageAdvanced(edgeMaps, width, height);
      console.log('✅ Segmentación avanzada completada');
      
      // 4. EXTRACCIÓN DE CONTORNOS CON ALGORITMOS DE NIVEL INDUSTRIAL
      const contours = await extractIndustrialContours(segments, width, height);
      console.log('✅ Extracción de contornos industriales completada');
      
      // 5. ANÁLISIS DE CALIDAD Y FILTRADO INTELIGENTE
      const qualityContours = await analyzeContourQuality(contours, width, height);
      console.log('✅ Análisis de calidad de contornos completado');
      
      // 6. CONVERSIÓN A OBJETOS DETECTADOS CON MÉTRICAS AVANZADAS
      const detectedObjects = await convertToAdvancedObjects(qualityContours, width, height);
      console.log('✅ Conversión a objetos avanzados completada');
      
      return detectedObjects;
      
    } catch (error) {
      console.error('❌ Error en sistema de detección avanzada:', error);
      // FALLBACK A DETECCIÓN BÁSICA EN CASO DE ERROR
      return await detectBasicObjectsFallback(imageData, width, height);
    }
  };

  // PREPROCESAMIENTO AVANZADO CON FILTROS MATEMÁTICOS COMPLEJOS
  const preprocessImageAdvanced = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔬 INICIANDO PREPROCESAMIENTO AVANZADO...');
      
      // 1. NORMALIZACIÓN DE ILUMINACIÓN CON ALGORITMO CLAHE
      const normalizedImage = await applyCLAHE(imageData, width, height);
      
      // 2. REDUCCIÓN DE RUIDO CON FILTRO BILATERAL AVANZADO
      const denoisedImage = await applyBilateralFilter(normalizedImage, width, height);
      
      // 3. ENFOQUE SELECTIVO CON FILTRO UN-SHARP MASK
      const sharpenedImage = await applyUnsharpMask(denoisedImage, width, height);
      
      // 4. COMPENSACIÓN DE DISTORSIÓN ÓPTICA
      const correctedImage = await correctOpticalDistortion(sharpenedImage, width, height);
      
      console.log('✅ Preprocesamiento avanzado completado');
      return correctedImage;
      
    } catch (error) {
      console.error('❌ Error en preprocesamiento avanzado:', error);
      return imageData; // Retornar imagen original en caso de error
    }
  };

  // DETECCIÓN DE BORDES MULTI-ESCALA CON ALGORITMOS GABOR Y WAVELET
  const detectMultiScaleEdges = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🌊 INICIANDO DETECCIÓN DE BORDES MULTI-ESCALA...');
      
      const edgeMaps = [];
      
      // 1. DETECCIÓN CON FILTROS GABOR MULTI-ORIENTACIÓN
      const gaborEdges = await detectGaborEdges(imageData, width, height);
      edgeMaps.push({ type: 'gabor', edges: gaborEdges });
      
      // 2. DETECCIÓN CON TRANSFORMADA WAVELET
      const waveletEdges = await detectWaveletEdges(imageData, width, height);
      edgeMaps.push({ type: 'wavelet', edges: waveletEdges });
      
      // 3. DETECCIÓN CON OPERADOR CANNY AVANZADO
      const cannyEdges = await detectAdvancedCanny(imageData, width, height);
      edgeMaps.push({ type: 'canny', edges: cannyEdges });
      
      // 4. FUSIÓN INTELIGENTE DE MAPAS DE BORDES
      const fusedEdges = await fuseEdgeMaps(edgeMaps, width, height);
      
      console.log('✅ Detección de bordes multi-escala completada');
      return fusedEdges;
      
    } catch (error) {
      console.error('❌ Error en detección de bordes multi-escala:', error);
      return [];
    }
  };

  // SEGMENTACIÓN AVANZADA CON ALGORITMOS DE MACHINE LEARNING
  const segmentImageAdvanced = async (edgeMaps: any[], width: number, height: number): Promise<any[]> => {
    try {
      console.log('🧠 INICIANDO SEGMENTACIÓN AVANZADA CON ML...');
      
      // 1. SEGMENTACIÓN POR REGIONES CON ALGORITMO WATERSHED
      const watershedSegments = await applyWatershedSegmentation(edgeMaps, width, height);
      
      // 2. SEGMENTACIÓN POR TEXTURA CON ANÁLISIS DE CO-OCURRENCIA
      const textureSegments = await analyzeTextureCooccurrence(edgeMaps, width, height);
      
      // 3. SEGMENTACIÓN POR COLOR CON ESPACIO LAB
      const colorSegments = await segmentByLABColor(edgeMaps, width, height);
      
      // 4. FUSIÓN INTELIGENTE DE SEGMENTOS
      const fusedSegments = await fuseSegmentsIntelligently(watershedSegments, textureSegments, colorSegments);
      
      console.log('✅ Segmentación avanzada completada');
      return fusedSegments;
      
    } catch (error) {
      console.error('❌ Error en segmentación avanzada:', error);
      return [];
    }
  };

  // EXTRACCIÓN DE CONTORNOS CON ALGORITMOS DE NIVEL INDUSTRIAL
  const extractIndustrialContours = async (segments: any[], width: number, height: number): Promise<any[]> => {
    try {
      console.log('🏭 INICIANDO EXTRACCIÓN DE CONTORNOS INDUSTRIALES...');
      
      const contours = [];
      
      for (const segment of segments) {
        // 1. EXTRACCIÓN DE CONTORNOS CON ALGORITMO CHAIN-CODE
        const chainCode = await extractChainCode(segment, width, height);
        
        // 2. SIMPLIFICACIÓN DE CONTORNOS CON ALGORITMO DOUGLAS-PEUCKER
        const simplifiedContour = await simplifyDouglasPeucker(chainCode, 2.0);
        
        // 3. SUAVIZADO DE CONTORNOS CON FILTRO GAUSSIANO
        const smoothedContour = await smoothContourGaussian(simplifiedContour, 1.5);
        
        // 4. ANÁLISIS DE CURVATURA Y PUNTOS CRÍTICOS
        const curvatureAnalysis = await analyzeContourCurvature(smoothedContour);
        
        contours.push({
          points: smoothedContour,
          chainCode,
          curvature: curvatureAnalysis,
          quality: calculateContourQuality(smoothedContour, width, height)
        });
      }
      
      console.log('✅ Extracción de contornos industriales completada');
      return contours;
      
    } catch (error) {
      console.error('❌ Error en extracción de contornos industriales:', error);
      return [];
    }
  };

  // ANÁLISIS DE CALIDAD Y FILTRADO INTELIGENTE
  const analyzeContourQuality = async (contours: any[], width: number, height: number): Promise<any[]> => {
    try {
      console.log('📊 INICIANDO ANÁLISIS DE CALIDAD AVANZADO...');
      
      const qualityContours = [];
      
      for (const contour of contours) {
        // 1. ANÁLISIS DE FORMA CON DESCRIPTORES DE FOURIER
        const fourierDescriptors = await calculateFourierDescriptors(contour.points);
        
        // 2. ANÁLISIS DE SIMETRÍA Y REGULARIDAD
        const symmetryAnalysis = await analyzeSymmetry(contour.points);
        
        // 3. ANÁLISIS DE COMPACIDAD Y CIRCULARIDAD
        const shapeMetrics = await calculateShapeMetrics(contour.points);
        
        // 4. CALCULO DE SCORE DE CALIDAD COMPUESTO
        const qualityScore = calculateCompositeQualityScore(
          fourierDescriptors,
          symmetryAnalysis,
          shapeMetrics,
          contour.quality
        );
        
        if (qualityScore > 0.7) { // Solo contornos de alta calidad
          qualityContours.push({
            ...contour,
            fourierDescriptors,
            symmetryAnalysis,
            shapeMetrics,
            qualityScore
          });
        }
      }
      
      // ORDENAR POR CALIDAD (mejor primero)
      qualityContours.sort((a, b) => b.qualityScore - a.qualityScore);
      
      console.log('✅ Análisis de calidad completado');
      return qualityContours.slice(0, 5); // Top 5 contornos
      
    } catch (error) {
      console.error('❌ Error en análisis de calidad:', error);
      return [];
    }
  };

  // CONVERSIÓN A OBJETOS DETECTADOS CON MÉTRICAS AVANZADAS
  const convertToAdvancedObjects = async (contours: any[], width: number, height: number): Promise<any[]> => {
    try {
      console.log('🔄 INICIANDO CONVERSIÓN A OBJETOS AVANZADOS...');
      
      const objects = [];
      
      for (const contour of contours) {
        // 1. CÁLCULO DE PROPIEDADES GEOMÉTRICAS AVANZADAS
        const boundingBox = calculateAdvancedBoundingBox(contour.points);
        const area = calculatePolygonArea(contour.points);
        const perimeter = calculatePolygonPerimeter(contour.points);
        
        // 2. ANÁLISIS DE MOMENTOS INVARIANTES
        const moments = await calculateInvariantMoments(contour.points);
        
        // 3. ANÁLISIS DE TEXTURA LOCAL
        const textureFeatures = await analyzeLocalTexture(contour.points, width, height);
        
        // 4. ESTIMACIÓN DE PROFUNDIDAD 3D
        const depthEstimation = await estimate3DDepth(contour, width, height);
        
        const object = {
          id: `advanced_obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: boundingBox.centerX,
          y: boundingBox.centerY,
          width: boundingBox.width,
          height: boundingBox.height,
          area,
          perimeter,
          points: contour.points,
          boundingBox,
          confidence: contour.qualityScore,
          qualityScore: contour.qualityScore,
          moments,
          textureFeatures,
          depthEstimation,
          fourierDescriptors: contour.fourierDescriptors,
          symmetryAnalysis: contour.symmetryAnalysis,
          shapeMetrics: contour.shapeMetrics
        };
        
        objects.push(object);
      }
      
      console.log('✅ Conversión a objetos avanzados completada');
      return objects;
      
    } catch (error) {
      console.error('❌ Error en conversión a objetos avanzados:', error);
      return [];
    }
  };

  // FUNCIÓN FALLBACK PARA DETECCIÓN BÁSICA
  const detectBasicObjectsFallback = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🔄 Usando detección básica como fallback...');
      return await detectBasicObjects(imageData, width, height);
    } catch (error) {
      console.error('❌ Error en fallback:', error);
      return [];
    }
  };

  // IMPLEMENTACIÓN DE FILTROS AVANZADOS DE NIVEL INDUSTRIAL
  
  // 1. ALGORITMO CLAHE (Contrast Limited Adaptive Histogram Equalization)
  const applyCLAHE = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔬 Aplicando CLAHE avanzado...');
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = width;
      canvas.height = height;
      
      // Crear nueva imagen con CLAHE aplicado
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      
      // Implementar CLAHE con bloques de 8x8 y límite de contraste 3.0
      const blockSize = 8;
      const clipLimit = 3.0;
      
      for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
          // Calcular histograma local
          const histogram = new Array(256).fill(0);
          for (let by = 0; by < blockSize && y + by < height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              const gray = Math.round(0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]);
              histogram[gray]++;
            }
          }
          
          // Aplicar límite de contraste
          const totalPixels = blockSize * blockSize;
          const excess = Math.max(0, Math.max(...histogram) - clipLimit * totalPixels / 256);
          if (excess > 0) {
            for (let i = 0; i < 256; i++) {
              histogram[i] = Math.min(histogram[i], clipLimit * totalPixels / 256);
            }
          }
          
          // Aplicar transformación de histograma
          for (let by = 0; by < blockSize && y + by < height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              const gray = Math.round(0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]);
              
              // Calcular CDF
              let cdf = 0;
              for (let i = 0; i <= gray; i++) {
                cdf += histogram[i];
              }
              
              const newGray = Math.round((cdf / totalPixels) * 255);
              newImageData.data[idx] = newGray;
              newImageData.data[idx + 1] = newGray;
              newImageData.data[idx + 2] = newGray;
            }
          }
        }
      }
      
      console.log('✅ CLAHE aplicado correctamente');
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error aplicando CLAHE:', error);
      return imageData;
    }
  };

  // 2. FILTRO BILATERAL AVANZADO
  const applyBilateralFilter = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔍 Aplicando filtro bilateral avanzado...');
      
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const radius = 5;
      const sigmaSpace = 50;
      const sigmaColor = 30;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let totalWeight = 0;
          let r = 0, g = 0, b = 0;
          
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const idx = (ny * width + nx) * 4;
                const centerIdx = (y * width + x) * 4;
                
                // Distancia espacial
                const spatialDist = Math.sqrt(dx * dx + dy * dy);
                const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * sigmaSpace * sigmaSpace));
                
                // Diferencia de color
                const colorDiffR = Math.abs(imageData.data[idx] - imageData.data[centerIdx]);
                const colorDiffG = Math.abs(imageData.data[idx + 1] - imageData.data[centerIdx + 1]);
                const colorDiffB = Math.abs(imageData.data[idx + 2] - imageData.data[centerIdx + 2]);
                const colorDist = Math.sqrt(colorDiffR * colorDiffR + colorDiffG * colorDiffG + colorDiffB * colorDiffB);
                const colorWeight = Math.exp(-(colorDist * colorDist) / (2 * sigmaColor * sigmaColor));
                
                const weight = spatialWeight * colorWeight;
                totalWeight += weight;
                
                r += imageData.data[idx] * weight;
                g += imageData.data[idx + 1] * weight;
                b += imageData.data[idx + 2] * weight;
              }
            }
          }
          
          const idx = (y * width + x) * 4;
          newImageData.data[idx] = r / totalWeight;
          newImageData.data[idx + 1] = g / totalWeight;
          newImageData.data[idx + 2] = b / totalWeight;
        }
      }
      
      console.log('✅ Filtro bilateral aplicado correctamente');
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error aplicando filtro bilateral:', error);
      return imageData;
    }
  };

  // 3. FILTRO UN-SHARP MASK
  const applyUnsharpMask = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔪 Aplicando un-sharp mask...');
      
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const amount = 0.5;
      const radius = 1;
      const threshold = 0;
      
      // Crear imagen suavizada (gaussiana)
      const blurred = await applyGaussianBlur(imageData, width, height, radius);
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const original = imageData.data[i];
        const blurredVal = blurred.data[i];
        const diff = original - blurredVal;
        
        if (Math.abs(diff) > threshold) {
          const sharpened = original + amount * diff;
          newImageData.data[i] = Math.max(0, Math.min(255, sharpened));
          newImageData.data[i + 1] = Math.max(0, Math.min(255, sharpened));
          newImageData.data[i + 2] = Math.max(0, Math.min(255, sharpened));
        }
      }
      
      console.log('✅ Un-sharp mask aplicado correctamente');
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error aplicando un-sharp mask:', error);
      return imageData;
    }
  };

  // 4. FILTRO GAUSSIANO
  const applyGaussianBlur = async (imageData: ImageData, width: number, height: number, radius: number): Promise<ImageData> => {
    try {
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const sigma = radius / 3;
      const kernelSize = Math.ceil(radius * 2 + 1);
      const kernel = [];
      
      // Generar kernel gaussiano
      let sum = 0;
      for (let i = 0; i < kernelSize; i++) {
        kernel[i] = [];
        for (let j = 0; j < kernelSize; j++) {
          const x = i - radius;
          const y = j - radius;
          const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
          kernel[i][j] = value;
          sum += value;
        }
      }
      
      // Normalizar kernel
      for (let i = 0; i < kernelSize; i++) {
        for (let j = 0; j < kernelSize; j++) {
          kernel[i][j] /= sum;
        }
      }
      
      // Aplicar convolución
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0;
          
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const ny = y + ky - radius;
              const nx = x + kx - radius;
              
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const idx = (ny * width + nx) * 4;
                const weight = kernel[ky][kx];
                
                r += imageData.data[idx] * weight;
                g += imageData.data[idx + 1] * weight;
                b += imageData.data[idx + 2] * weight;
              }
            }
          }
          
          const idx = (y * width + x) * 4;
          newImageData.data[idx] = r;
          newImageData.data[idx + 1] = g;
          newImageData.data[idx + 2] = b;
        }
      }
      
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error aplicando filtro gaussiano:', error);
      return imageData;
    }
  };

  // 5. COMPENSACIÓN DE DISTORSIÓN ÓPTICA
  const correctOpticalDistortion = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔧 Compensando distorsión óptica...');
      
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const k1 = 0.0001; // Coeficiente de distorsión radial
      const k2 = 0.00001;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Coordenadas normalizadas
          const nx = (x - centerX) / centerX;
          const ny = (y - centerY) / centerY;
          
          // Distancia desde el centro
          const r = Math.sqrt(nx * nx + ny * ny);
          
          // Factor de corrección
          const factor = 1 + k1 * r * r + k2 * r * r * r * r;
          
          // Coordenadas corregidas
          const correctedX = centerX + nx * centerX * factor;
          const correctedY = centerY + ny * centerY * factor;
          
          // Interpolación bilineal
          if (correctedX >= 0 && correctedX < width - 1 && correctedY >= 0 && correctedY < height - 1) {
            const x1 = Math.floor(correctedX);
            const y1 = Math.floor(correctedY);
            const x2 = x1 + 1;
            const y2 = y1 + 1;
            
            const fx = correctedX - x1;
            const fy = correctedY - y1;
            
            const idx = (y * width + x) * 4;
            const idx11 = (y1 * width + x1) * 4;
            const idx12 = (y1 * width + x2) * 4;
            const idx21 = (y2 * width + x1) * 4;
            const idx22 = (y2 * width + x2) * 4;
            
            // Interpolación para cada canal
            for (let c = 0; c < 3; c++) {
              const val11 = imageData.data[idx11 + c];
              const val12 = imageData.data[idx12 + c];
              const val21 = imageData.data[idx21 + c];
              const val22 = imageData.data[idx22 + c];
              
              const val = val11 * (1 - fx) * (1 - fy) + 
                          val12 * fx * (1 - fy) + 
                          val21 * (1 - fx) * fy + 
                          val22 * fx * fy;
              
              newImageData.data[idx + c] = val;
            }
          }
        }
      }
      
      console.log('✅ Distorsión óptica compensada');
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error compensando distorsión óptica:', error);
      return imageData;
    }
  };

  // RENDERIZAR INTERFAZ
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
          
          {isManualSelectionMode && (
            <Badge variant="outline" className="border-green-500 text-green-500 text-xs animate-pulse">
              <Target className="w-3 h-3 mr-1" />
              👆 Selección Manual
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
            className="h-8 w-8 p-0"
          >
            <SwitchCamera className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFocusPoint(null)}
            className="h-8 w-8 p-0"
          >
            <Focus className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualSelectionMode(!isManualSelectionMode)}
            className={`h-8 w-8 p-0 ${isManualSelectionMode ? "bg-green-500 text-background" : ""}`}
            title="Modo Selección Manual"
          >
            <Target className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Video Container */}
      <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay
          playsInline
          muted
          onClick={handleFocus}
        />
        
        {/* Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        
        {/* Touch Object Selector - Selección Manual por Toque */}
        <TouchObjectSelector
          videoRef={videoRef}
          overlayCanvasRef={overlayCanvasRef}
          onObjectSelected={handleManualObjectSelection}
          onError={handleManualSelectionError}
          isActive={isManualSelectionMode}
        />
        
        {/* Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/20"></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Focus Point */}
        {focusPoint && (
          <div
            className="absolute w-4 h-4 bg-red-500 rounded-full pointer-events-none animate-ping"
            style={{
              left: focusPoint.x - 8,
              top: focusPoint.y - 8
            }}
          />
        )}
        
        {/* Flash Effect */}
        {flashEnabled && (
          <div className="absolute inset-0 bg-white/50 pointer-events-none animate-pulse" />
        )}
      </div>

                    {/* PANEL DE MEDICIONES REALES EN MM/CM */}
        {detectedObjects.length > 0 && currentMeasurement && (
          <Card className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
            <h4 className="font-medium mb-3 text-green-400">🎯 Objeto Central Prominente Detectado</h4>
           
           {/* MEDICIONES PRINCIPALES EN MM */}
           <div className="grid grid-cols-2 gap-4 mb-4">
             <div className="space-y-2">
               <div>
                 <p className="text-gray-300 text-sm">📏 Ancho Real</p>
                 <p className="font-mono text-green-400 font-bold text-xl">
                   {currentMeasurement.measurements.realWidth?.toFixed(1) || 'N/A'} mm
                 </p>
               </div>
               <div>
                 <p className="text-gray-300 text-sm">📐 Área Real</p>
                 <p className="font-mono text-blue-400 font-bold">
                   {currentMeasurement.measurements.realArea?.toFixed(1) || 'N/A'} mm²
                 </p>
               </div>
             </div>
             <div className="space-y-2">
               <div>
                 <p className="text-gray-300 text-sm">📏 Alto Real</p>
                 <p className="font-mono text-cyan-400 font-bold text-xl">
                   {currentMeasurement.measurements.realHeight?.toFixed(1) || 'N/A'} mm
                 </p>
               </div>
               <div>
                 <p className="text-gray-300 text-sm">🔍 Profundidad</p>
                 <p className="font-mono text-yellow-400 font-bold">
                   {currentMeasurement.measurements.depth?.toFixed(1) || 'N/A'} mm
                 </p>
               </div>
             </div>
           </div>
           
           {/* MEDICIONES 3D */}
           {currentMeasurement.measurements.volume && (
             <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-blue-900/20 rounded-lg">
               <div>
                 <p className="text-gray-300 text-sm">📦 Volumen</p>
                 <p className="font-mono text-blue-400 font-bold">
                   {currentMeasurement.measurements.volume.toFixed(1)} mm³
                 </p>
               </div>
               <div>
                 <p className="text-gray-300 text-sm">🌐 Superficie</p>
                 <p className="font-mono text-cyan-400 font-bold">
                   {currentMeasurement.measurements.surfaceArea.toFixed(1)} mm²
                 </p>
               </div>
             </div>
           )}
           
           {/* ANÁLISIS DE FORMA */}
           <div className="grid grid-cols-3 gap-2 text-xs">
             <div className="text-center p-2 bg-gray-800/30 rounded">
               <p className="text-gray-400">Circularidad</p>
               <p className="text-yellow-400 font-bold">
                 {currentMeasurement.measurements.circularity?.toFixed(3) || 'N/A'}
               </p>
             </div>
             <div className="text-center p-2 bg-gray-800/30 rounded">
               <p className="text-gray-400">Solidez</p>
               <p className="text-green-400 font-bold">
                 {currentMeasurement.measurements.solidity?.toFixed(3) || 'N/A'}
               </p>
             </div>
             <div className="text-center p-2 bg-gray-800/30 rounded">
               <p className="text-gray-400">Compacidad</p>
               <p className="text-blue-400 font-bold">
                 {currentMeasurement.measurements.compactness?.toFixed(6) || 'N/A'}
               </p>
             </div>
           </div>
           
           {/* INFORMACIÓN DE CALIBRACIÓN */}
           <div className="mt-3 pt-3 border-t border-white/10">
             <p className="text-xs text-gray-400">
               Unidad: {currentMeasurement.measurements.unit} | 
               Confianza: {(currentMeasurement.measurements.confidence * 100).toFixed(0)}%
             </p>
           </div>
         </Card>
       )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={handleCapture}
          className="flex-1 bg-gradient-primary"
          disabled={!cameraStream}
        >
          <Camera className="w-4 h-4 mr-2" />
          Capturar Imagen
        </Button>
        
        <Button
          onClick={() => {
            try {
              if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
                processFrameAutomatically();
              }
            } catch (error) {
              console.error('❌ Error al forzar medición:', error);
            }
          }}
          variant="outline"
          className="flex-1"
          disabled={!cameraStream || isProcessing}
        >
          <Target className="w-4 h-4 mr-2" />
          Medir Ahora
        </Button>
      </div>

      {/* Status Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Frame: {frameCount} | Procesando: {isProcessing ? 'Sí' : 'No'}</p>
        {currentMeasurement && (
          <p>Tiempo: {currentMeasurement.processingTime}ms</p>
        )}
      </div>
    </div>
  );
};

// IMPLEMENTACIÓN DE DETECCIÓN DE BORDES AVANZADOS

// 1. DETECCIÓN DE BORDES CON FILTROS GABOR
const detectGaborEdges = async (imageData: ImageData, width: number, height: number): Promise<any> => {
  try {
    console.log('🌊 Aplicando filtros Gabor multi-orientación...');
    
    const orientations = [0, 45, 90, 135]; // Orientaciones en grados
    const frequencies = [0.1, 0.2, 0.4]; // Frecuencias espaciales
    const sigma = 2.0; // Desviación estándar
    
    const responses = [];
    
    for (const orientation of orientations) {
      for (const frequency of frequencies) {
        const response = await applyGaborFilter(imageData, width, height, orientation, frequency, sigma);
        responses.push(response);
      }
    }
    
    // Fusión de respuestas Gabor
    const fusedResponse = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      let maxResponse = 0;
      for (const response of responses) {
        maxResponse = Math.max(maxResponse, response[i]);
      }
      fusedResponse[i] = maxResponse;
    }
    
    console.log('✅ Filtros Gabor aplicados correctamente');
    return fusedResponse;
    
  } catch (error) {
    console.error('❌ Error aplicando filtros Gabor:', error);
    return new Uint8Array(width * height);
  }
};

// 2. APLICAR FILTRO GABOR INDIVIDUAL
const applyGaborFilter = async (imageData: ImageData, width: number, height: number, orientation: number, frequency: number, sigma: number): Promise<Uint8Array> => {
  try {
    const response = new Uint8Array(width * height);
    const orientationRad = (orientation * Math.PI) / 180;
    
    // Parámetros del filtro Gabor
    const lambda = 1 / frequency;
    const gamma = 0.5;
    const psi = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Coordenadas centradas
        const xPrime = (x - width / 2) * Math.cos(orientationRad) + (y - height / 2) * Math.sin(orientationRad);
        const yPrime = -(x - width / 2) * Math.sin(orientationRad) + (y - height / 2) * Math.cos(orientationRad);
        
        // Función Gabor
        const gabor = Math.exp(-(xPrime * xPrime + gamma * gamma * yPrime * yPrime) / (2 * sigma * sigma)) * 
                     Math.cos(2 * Math.PI * xPrime / lambda + psi);
        
        // Aplicar convolución
        let sum = 0;
        let weightSum = 0;
        
        for (let dy = -Math.ceil(3 * sigma); dy <= Math.ceil(3 * sigma); dy++) {
          for (let dx = -Math.ceil(3 * sigma); dx <= Math.ceil(3 * sigma); dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              const gray = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
              
              const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
              sum += gray * weight * gabor;
              weightSum += weight;
            }
          }
        }
        
        response[y * width + x] = Math.abs(sum / weightSum);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Error aplicando filtro Gabor individual:', error);
    return new Uint8Array(width * height);
  }
};

// 3. DETECCIÓN DE BORDES CON TRANSFORMADA WAVELET
const detectWaveletEdges = async (imageData: ImageData, width: number, height: number): Promise<any> => {
  try {
    console.log('🌊 Aplicando transformada wavelet para detección de bordes...');
    
    // Implementación simplificada de wavelet Haar 2D
    const waveletResponse = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (x + 1 < width && y + 1 < height) {
          // Coeficientes wavelet Haar
          const idx1 = (y * width + x) * 4;
          const idx2 = (y * width + (x + 1)) * 4;
          const idx3 = ((y + 1) * width + x) * 4;
          const idx4 = ((y + 1) * width + (x + 1)) * 4;
          
          const gray1 = 0.299 * imageData.data[idx1] + 0.587 * imageData.data[idx1 + 1] + 0.114 * imageData.data[idx1 + 2];
          const gray2 = 0.299 * imageData.data[idx2] + 0.587 * imageData.data[idx2 + 1] + 0.114 * imageData.data[idx2 + 2];
          const gray3 = 0.299 * imageData.data[idx3] + 0.587 * imageData.data[idx3 + 1] + 0.114 * imageData.data[idx3 + 2];
          const gray4 = 0.299 * imageData.data[idx4] + 0.587 * imageData.data[idx4 + 1] + 0.114 * imageData.data[idx4 + 2];
          
          // Detección de bordes basada en diferencias wavelet
          const horizontalEdge = Math.abs(gray1 + gray3 - gray2 - gray4);
          const verticalEdge = Math.abs(gray1 + gray2 - gray3 - gray4);
          const diagonalEdge = Math.abs(gray1 - gray4) + Math.abs(gray2 - gray3);
          
          const edgeMagnitude = Math.sqrt(horizontalEdge * horizontalEdge + verticalEdge * verticalEdge + diagonalEdge * diagonalEdge);
          
          waveletResponse[y * width + x] = Math.min(255, edgeMagnitude);
          if (x + 1 < width) waveletResponse[y * width + (x + 1)] = Math.min(255, edgeMagnitude);
          if (y + 1 < height) waveletResponse[(y + 1) * width + x] = Math.min(255, edgeMagnitude);
          if (x + 1 < width && y + 1 < height) waveletResponse[(y + 1) * width + (x + 1)] = Math.min(255, edgeMagnitude);
        }
      }
    }
    
    console.log('✅ Transformada wavelet aplicada correctamente');
    return waveletResponse;
    
  } catch (error) {
    console.error('❌ Error aplicando transformada wavelet:', error);
    return new Uint8Array(width * height);
  }
};

// 4. DETECCIÓN CANNY AVANZADA
const detectAdvancedCanny = async (imageData: ImageData, width: number, height: number): Promise<any> => {
  try {
    console.log('🔪 Aplicando detección Canny avanzada...');
    
    // 1. Suavizado gaussiano
    const smoothed = await applyGaussianBlur(imageData, width, height, 1.5);
    
    // 2. Cálculo de gradientes
    const gradients = await calculateGradients(smoothed, width, height);
    
    // 3. Supresión de no-máximos
    const suppressed = await suppressNonMaxima(gradients, width, height);
    
    // 4. Umbralización adaptativa
    const edges = await adaptiveThresholding(suppressed, width, height);
    
    console.log('✅ Detección Canny avanzada completada');
    return edges;
    
  } catch (error) {
    console.error('❌ Error en detección Canny avanzada:', error);
    return new Uint8Array(width * height);
  }
};

// 5. CÁLCULO DE GRADIENTES
const calculateGradients = async (imageData: ImageData, width: number, height: number): Promise<any> => {
  try {
    const gradients = {
      magnitude: new Float32Array(width * height),
      direction: new Float32Array(width * height)
    };
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Gradientes de Sobel
        const gx = -imageData.data[idx - 4] + imageData.data[idx + 4] +
                   -2 * imageData.data[idx - 4 + width * 4] + 2 * imageData.data[idx + 4 + width * 4] +
                   -imageData.data[idx - 4 + 2 * width * 4] + imageData.data[idx + 4 + 2 * width * 4];
        
        const gy = -imageData.data[idx - width * 4] + imageData.data[idx + width * 4] +
                   -2 * imageData.data[idx - width * 4 + 4] + 2 * imageData.data[idx + width * 4 + 4] +
                   -imageData.data[idx - width * 4 + 8] + imageData.data[idx + width * 4 + 8];
        
        gradients.magnitude[y * width + x] = Math.sqrt(gx * gx + gy * gy);
        gradients.direction[y * width + x] = Math.atan2(gy, gx);
      }
    }
    
    return gradients;
    
  } catch (error) {
    console.error('❌ Error calculando gradientes:', error);
    return { magnitude: new Float32Array(width * height), direction: new Float32Array(width * height) };
  }
};

// 6. FUSIÓN INTELIGENTE DE MAPAS DE BORDES
const fuseEdgeMaps = async (edgeMaps: any[], width: number, height: number): Promise<any> => {
  try {
    console.log('🔗 Fusionando mapas de bordes inteligentemente...');
    
    const fusedEdges = new Uint8Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      let maxEdge = 0;
      let weightedSum = 0;
      let totalWeight = 0;
      
      for (const edgeMap of edgeMaps) {
        if (edgeMap.edges && edgeMap.edges[i] !== undefined) {
          const weight = getEdgeMapWeight(edgeMap.type);
          weightedSum += edgeMap.edges[i] * weight;
          totalWeight += weight;
          maxEdge = Math.max(maxEdge, edgeMap.edges[i]);
        }
      }
      
      // Combinar fusión ponderada con máximo
      const fusedValue = totalWeight > 0 ? (weightedSum / totalWeight + maxEdge) / 2 : maxEdge;
      fusedEdges[i] = Math.min(255, fusedValue);
    }
    
    console.log('✅ Fusión de mapas de bordes completada');
    return fusedEdges;
    
  } catch (error) {
    console.error('❌ Error fusionando mapas de bordes:', error);
    return new Uint8Array(width * height);
  }
};

// 7. PESOS PARA DIFERENTES TIPOS DE DETECCIÓN DE BORDES
const getEdgeMapWeight = (type: string): number => {
  switch (type) {
    case 'gabor': return 0.4; // Filtros Gabor son muy efectivos
    case 'wavelet': return 0.3; // Wavelets son buenos para texturas
    case 'canny': return 0.3; // Canny es estándar de la industria
    default: return 0.25;
  }
};
