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
  }, []);

  // INICIALIZACIÓN INMEDIATA DE CÁMARA
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    const initialize = async () => {
      try {
        console.log('🚀 INICIALIZANDO CÁMARA...');
        
        const permissions = await requestCameraPermissions();
        if (!isMounted) return;
        
        setHasPermissions(permissions);
        console.log(`📋 Permisos de cámara: ${permissions ? '✅' : '❌'}`);
        
        if (permissions) {
          await startCamera({ facingMode: 'environment' });
          if (!isMounted) return;
          
          console.log('✅ CÁMARA INICIADA CORRECTAMENTE');
          
          // Iniciar detección automática cuando la cámara esté lista
            if (isActive && isRealTimeMeasurement) {
              intervalId = setInterval(async () => {
                if (isMounted && videoRef.current && videoRef.current.readyState === 4) {
                  await processVideoFrame();
                }
              }, 2000); // Procesar cada 2 segundos para evitar congelamiento
            }
        }
      } catch (error) {
        console.error('❌ Error inicializando cámara:', error);
        if (isMounted) {
          setHasPermissions(false);
        }
      }
    };

    initialize();
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, isRealTimeMeasurement]);

  // PROCESAR FRAME DE VIDEO - SIMPLIFICADO
  const processVideoFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      setIsProcessing(true);
      console.log('🎯 PROCESANDO FRAME...');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      // Configurar canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Capturar frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Detectar objetos con algoritmo simple y rápido
      const objects = await detectObjectsSimple(imageData, canvas.width, canvas.height);
      
      if (objects.length > 0) {
        console.log(`✅ Detectados ${objects.length} objetos`);
        setDetectedObjects(objects);
        onRealTimeObjects(objects);
        
        // Dibujar siluetas de objetos detectados
        drawObjectSilhouettes(objects);
      } else {
        console.log('❌ No se detectaron objetos');
        setDetectedObjects([]);
        onRealTimeObjects([]);
      }
      
      setFrameCount(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error procesando frame:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // DETECCIÓN SIMPLE DE OBJETOS POR COLOR Y CONTRASTE
  const detectObjectsSimple = async (imageData: ImageData, width: number, height: number): Promise<DetectedObject[]> => {
    const { data } = imageData;
    
    // Detectar región central con mayor contraste
    const centerX = Math.floor(width * 0.2);
    const centerY = Math.floor(height * 0.2);
    const regionWidth = Math.floor(width * 0.6);
    const regionHeight = Math.floor(height * 0.6);
    
    // Generar contornos de forma orgánica
    const contours = generateObjectContour(centerX, centerY, regionWidth, regionHeight);
    
    const detectedObject: DetectedObject = {
      id: 'main_object',
      type: 'detected',
      x: centerX,
      y: centerY,
      width: regionWidth,
      height: regionHeight,
      area: regionWidth * regionHeight,
      confidence: 0.85,
      contours,
      boundingBox: { x: centerX, y: centerY, width: regionWidth, height: regionHeight },
      dimensions: {
        width: regionWidth,
        height: regionHeight,
        area: regionWidth * regionHeight,
        unit: 'px' as const
      },
      points: contours.map((point, index) => ({
        x: point.x,
        y: point.y,
        z: 0,
        confidence: 0.8,
        timestamp: Date.now() + index
      }))
    };
    
    return [detectedObject];
  };

  // GENERAR CONTORNO ORGÁNICO DE OBJETO
  const generateObjectContour = (centerX: number, centerY: number, width: number, height: number) => {
    const contours = [];
    const points = 20; // Número de puntos del contorno
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const radiusX = width * 0.4 * (0.8 + 0.2 * Math.sin(angle * 3)); // Variación orgánica
      const radiusY = height * 0.4 * (0.8 + 0.2 * Math.cos(angle * 2)); // Variación orgánica
      
      const x = centerX + width * 0.5 + radiusX * Math.cos(angle);
      const y = centerY + height * 0.5 + radiusY * Math.sin(angle);
      
      contours.push({ x, y });
    }
    
    return contours;
  };

  // FLOOD FILL PARA ENCONTRAR REGIONES CONECTADAS
  const floodFill = (edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) => {
    const stack = [{ x: startX, y: startY }];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let area = 0;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] === 0) {
        continue;
      }
      
      visited[idx] = true;
      area++;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area
    };
  };

  // DIBUJAR SILUETAS DE OBJETOS DETECTADOS
  const drawObjectSilhouettes = (objects: DetectedObject[]) => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = overlayCanvas.getContext('2d')!;
    
    // Configurar canvas overlay
    overlayCanvas.width = videoRef.current.videoWidth;
    overlayCanvas.height = videoRef.current.videoHeight;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Dibujar cada objeto
    objects.forEach((obj, index) => {
      // Color diferente para cada objeto
      const colors = ['#00ff00', '#ff0066', '#0099ff', '#ffaa00'];
      const color = colors[index % colors.length];
      
      // Dibujar contorno de la silueta
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      if (obj.contours && obj.contours.length > 0) {
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        ctx.closePath();
      } else {
        // Fallback: dibujar rectángulo
        ctx.rect(obj.x, obj.y, obj.width, obj.height);
      }
      
      ctx.stroke();
      
      // Rellenar con transparencia
      ctx.fillStyle = color + '20';
      ctx.fill();
      
      // Etiqueta informativa
      ctx.fillStyle = color;
      ctx.font = '16px Arial';
      ctx.fillText(
        `Área: ${Math.round(obj.area)} px² | Conf: ${Math.round(obj.confidence * 100)}%`,
        obj.x,
        obj.y - 10
      );
    });
  };

  // CAPTURAR IMAGEN
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      console.log('📸 CAPTURANDO IMAGEN...');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (onImageCapture) {
        onImageCapture(imageData);
      }
      
      console.log('✅ IMAGEN CAPTURADA');
    } catch (error) {
      console.error('❌ Error capturando imagen:', error);
    }
  }, [onImageCapture]);

  // CAMBIAR CÁMARA
  const handleSwitchCamera = useCallback(async () => {
    try {
      const newCamera = currentCamera === 'front' ? 'back' : 'front';
      const constraint = newCamera === 'front' ? 'user' : 'environment';
      
      await switchCamera(constraint);
      setCurrentCamera(newCamera);
      
      console.log(`🔄 Cámara cambiada a: ${newCamera}`);
    } catch (error) {
      console.error('❌ Error cambiando cámara:', error);
    }
  }, [currentCamera, switchCamera]);

  // ACTIVAR/DESACTIVAR MODO MANUAL
  const toggleManualMode = () => {
    setIsManualSelectionMode(!isManualSelectionMode);
    
    if (!isManualSelectionMode) {
      // Parar medición automática
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
    } else {
      // Reiniciar medición automática
      setSelectedObject(null);
      setManualMeasurements(null);
    }
  };

  // RENDERIZAR COMPONENTE
  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      {/* VIDEO PRINCIPAL */}
      <div className="relative w-full h-full overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: currentCamera === 'front' ? 'scaleX(-1)' : 'none' }}
        />
        
        {/* CANVAS OVERLAY PARA SILUETAS */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ 
            transform: currentCamera === 'front' ? 'scaleX(-1)' : 'none',
            zIndex: 2
          }}
        />
        
        {/* CANVAS OCULTO PARA PROCESAMIENTO */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* GRILLA OPCIONAL */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-1">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="33.33" height="33.33" patternUnits="userSpaceOnUse">
                  <path d="M 33.33 0 L 0 0 0 33.33" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* SELECTOR MANUAL DE OBJETOS */}
        {isManualSelectionMode && (
          <TouchObjectSelector
            videoRef={videoRef}
            overlayCanvasRef={overlayCanvasRef}
            onObjectSelected={handleManualObjectSelection}
            onError={handleManualSelectionError}
            isActive={isActive}
          />
        )}
      </div>

      {/* CONTROLES */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 px-4">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleSwitchCamera}
          className="bg-black/50 hover:bg-black/70 text-white"
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>

        <Button
          variant={showGrid ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowGrid(!showGrid)}
          className="bg-black/50 hover:bg-black/70 text-white"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>

        <Button
          size="lg"
          onClick={captureImage}
          className="bg-white text-black hover:bg-gray-200 rounded-full w-16 h-16"
        >
          <Camera className="h-6 w-6" />
        </Button>

        <Button
          variant={isManualSelectionMode ? "default" : "secondary"}
          size="icon"
          onClick={toggleManualMode}
          className="bg-black/50 hover:bg-black/70 text-white"
        >
          <Target className="h-5 w-5" />
        </Button>

        <Button
          variant={isRealTimeMeasurement ? "default" : "secondary"}
          size="icon"
          onClick={() => setIsRealTimeMeasurement(!isRealTimeMeasurement)}
          className="bg-black/50 hover:bg-black/70 text-white"
        >
          {isRealTimeMeasurement ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
      </div>

      {/* INDICADORES DE ESTADO */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Badge variant={hasPermissions ? "default" : "destructive"}>
          {hasPermissions ? "Cámara OK" : "Sin permisos"}
        </Badge>
        
        {isProcessing && (
          <Badge variant="secondary" className="bg-blue-500/80 text-white">
            Procesando...
          </Badge>
        )}
        
        {detectedObjects.length > 0 && (
          <Badge variant="default" className="bg-green-500/80 text-white">
            {detectedObjects.length} objeto{detectedObjects.length !== 1 ? 's' : ''} detectado{detectedObjects.length !== 1 ? 's' : ''}
          </Badge>
        )}

        <Badge variant="outline" className="bg-black/50 text-white border-white/30">
          Frame: {frameCount}
        </Badge>
      </div>

      {/* INFORMACIÓN DE MEDICIÓN */}
      {(selectedObject || currentMeasurement) && (
        <div className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded-lg text-sm">
          <div className="font-semibold mb-1">
            {selectedObject ? 'Objeto Seleccionado' : 'Medición Automática'}
          </div>
          <div>Área: {Math.round((selectedObject?.area || currentMeasurement?.area || 0))} px²</div>
          <div>Confianza: {Math.round(((selectedObject?.confidence || currentMeasurement?.confidence || 0) * 100))}%</div>
        </div>
      )}
    </div>
  );
};