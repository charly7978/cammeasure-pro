
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
import { CameraDirection } from '@capacitor/camera';
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
  const [currentCamera, setCurrentCamera] = useState<CameraDirection>(CameraDirection.Rear);
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

  useEffect(() => {
    initializeCamera();
    
    // Update container dimensions when video loads
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setVideoContainer({ width: rect.width, height: rect.height });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    
    return () => {
      stopCamera();
      window.removeEventListener('resize', updateDimensions);
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && hasPermissions && !cameraStream) {
      startCamera();
    } else if (!isActive && cameraStream) {
      stopCamera();
    }
    
    // FORZAR INICIO DE MEDICIÓN AUTOMÁTICA
    if (isActive && hasPermissions && cameraStream) {
      console.log('🎯 FORZANDO INICIO DE MEDICIÓN AUTOMÁTICA');
      setTimeout(() => {
        if (videoRef?.current && overlayCanvasRef?.current) {
          processFrameAutomatically();
        }
      }, 1000); // Esperar 1 segundo para que la cámara esté lista
    }
  }, [isActive, hasPermissions, cameraStream]);

  // INICIAR MEDICIÓN AUTOMÁTICA EN TIEMPO REAL
  useEffect(() => {
    if (isActive && isRealTimeMeasurement && videoRef?.current && overlayCanvasRef?.current) {
      console.log('🚀 INICIANDO MEDICIÓN AUTOMÁTICA EN TIEMPO REAL');
      
      // FORZAR PRIMERA MEDICIÓN INMEDIATA
      setTimeout(() => {
        console.log('🎯 FORZANDO PRIMERA MEDICIÓN INMEDIATA');
        processFrameAutomatically();
      }, 500);
      
      // Procesar cada 200ms para medición en tiempo real
      processingInterval.current = setInterval(() => {
        if (!isProcessing) {
          console.log('📸 Procesando frame automáticamente...');
          processFrameAutomatically();
        }
      }, 200);
    }

    return () => {
      if (processingInterval.current) {
        console.log('⏹️ Deteniendo medición automática');
        clearInterval(processingInterval.current);
      }
    };
  }, [isActive, isRealTimeMeasurement, videoRef, overlayCanvasRef, isProcessing]);

  const initializeCamera = async () => {
    try {
      const granted = await requestCameraPermissions();
      setHasPermissions(granted);
      
      if (granted) {
        await startCamera();
        
        // FORZAR MEDICIÓN AUTOMÁTICA DESPUÉS DE INICIAR CÁMARA
        setTimeout(() => {
          console.log('🎯 FORZANDO MEDICIÓN DESPUÉS DE INICIAR CÁMARA');
          if (videoRef?.current && overlayCanvasRef?.current) {
            processFrameAutomatically();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error initializing camera:', error);
    }
  };

  const handleCameraSwitch = async () => {
    const newDirection = currentCamera === CameraDirection.Rear 
      ? CameraDirection.Front 
      : CameraDirection.Rear;
    
    try {
      await switchCamera(newDirection);
      setCurrentCamera(newDirection);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // MEDICIÓN AUTOMÁTICA EN TIEMPO REAL
  const processFrameAutomatically = async () => {
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

      // 2. DETECTAR CONTORNOS AUTOMÁTICAMENTE
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      console.log('🔍 Detectando contornos en frame...');
      
      // DETECCIÓN ROBUSTA CON ALGORITMO COMPLETO
      const detectionResult = await detectContoursSimple(imageData, 100); // Área mínima más pequeña
      console.log('📊 Objetos detectados:', detectionResult.rects.length);
      
      // 3. SELECCIONAR OBJETO MÁS PROMINENTE
      const prominentObject = selectMostProminentObject(detectionResult.rects);

      if (prominentObject) {
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
      }

      // 7. ACTUALIZAR CONTADORES
      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('Error en procesamiento automático:', error);
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

  // Calcular mediciones en tiempo real
  const calculateRealTimeMeasurements = async (object: DetectedObject, imageData: ImageData) => {
    const { width, height, area } = object.dimensions;
    
    // Cálculo de profundidad estimada
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
        <Button onClick={initializeCamera} className="bg-gradient-primary">
          <Camera className="w-4 h-4 mr-2" />
          Conceder Permisos
        </Button>
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
            {currentCamera === CameraDirection.Rear ? 'Principal' : 'Frontal'}
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
               const newState = !isRealTimeMeasurement;
               setIsRealTimeMeasurement(newState);
               
               // FORZAR MEDICIÓN INMEDIATA AL ACTIVAR
               if (newState) {
                 console.log('🎯 ACTIVANDO MEDICIÓN - FORZANDO EJECUCIÓN INMEDIATA');
                 setTimeout(() => {
                   if (videoRef?.current && overlayCanvasRef?.current) {
                     processFrameAutomatically();
                   }
                 }, 500);
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
               if (containerRef.current) {
                 const rect = containerRef.current.getBoundingClientRect();
                 setVideoContainer({ width: rect.width, height: rect.height });
               }
               
               // FORZAR MEDICIÓN AUTOMÁTICA CUANDO EL VIDEO ESTÉ LISTO
               console.log('🎯 VIDEO LISTO - FORZANDO MEDICIÓN AUTOMÁTICA');
               setTimeout(() => {
                 if (videoRef?.current && overlayCanvasRef?.current) {
                   processFrameAutomatically();
                 }
               }, 1000);
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
                {currentMeasurement.measurements.width.toFixed(1)}px
              </p>
            </div>
            <div>
              <p className="text-gray-300">Alto</p>
              <p className="font-mono text-cyan-400 font-bold">
                {currentMeasurement.measurements.height.toFixed(1)}px
              </p>
            </div>
            <div>
              <p className="text-gray-300">Área</p>
              <p className="font-mono text-blue-400 font-bold">
                {currentMeasurement.measurements.area.toFixed(0)}px²
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
                  {currentMeasurement.measurements.volume.toFixed(0)}mm³
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
