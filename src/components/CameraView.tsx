import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  SwitchCamera, 
  Grid3X3,
  Pause,
  Play
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { DetectedObject } from '@/lib/types';
import { unifiedOpenCV } from '@/lib/unifiedOpenCVSystem';

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
  const [frameCount, setFrameCount] = useState(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  // PROCESAR FRAME DE VIDEO CON OPENCV - SOLO DETECCIÓN AUTOMÁTICA DEL CENTRO
  const processVideoFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      setIsProcessing(true);
      console.log('🎯 PROCESANDO FRAME CON OPENCV - DETECCIÓN AUTOMÁTICA DEL CENTRO');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      // Configurar canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        console.log('❌ Canvas sin dimensiones válidas');
        return;
      }
      
      console.log(`📐 Canvas configurado: ${canvas.width}x${canvas.height}`);
      
      // Capturar frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      console.log(`📏 Procesando imagen: ${imageData.width}x${imageData.height}, calibrado: ${calibrationData?.isCalibrated ? 'SÍ' : 'NO'}`);
      
      // DETECCIÓN AUTOMÁTICA DEL CENTRO - SIN MODO TOQUE
      console.log('🚀 Llamando a unifiedOpenCV.detectObjectSilhouettes...');
      const result = await unifiedOpenCV.detectObjectSilhouettes(
        imageData, 
        calibrationData,
        null // Solo detección automática del centro
      );
      
      console.log(`📊 Resultado recibido: ${result.objects.length} objetos, tiempo: ${result.processingTime.toFixed(1)}ms`);
      
      if (result.objects.length > 0) {
        const obj = result.objects[0];
        console.log(`✅ OpenCV detectó ${result.objects.length} objetos en ${result.processingTime.toFixed(1)}ms`);
        console.log(`📊 Objeto principal: ${obj.dimensions.width.toFixed(1)}x${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}, área: ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`);
        
        setDetectedObjects(result.objects);
        onRealTimeObjects(result.objects);
        
        // Dibujar overlay con siluetas reales
        if (overlayCanvasRef.current) {
          console.log('🎨 Dibujando overlay...');
          unifiedOpenCV.drawDetectionOverlay(overlayCanvasRef.current, result);
        }
      } else {
        console.log('❌ No se detectaron objetos');
        setDetectedObjects([]);
        onRealTimeObjects([]);
        
        // Limpiar overlay
        if (overlayCanvasRef.current) {
          const ctx = overlayCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          }
        }
      }
      
      setFrameCount(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error procesando frame:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    } finally {
      setIsProcessing(false);
    }
  }, [calibrationData, onRealTimeObjects]);

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
  }, [isActive]);

  // DETECCIÓN AUTOMÁTICA RESTAURADA
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isActive && isRealTimeMeasurement && hasPermissions) {
      console.log('🔄 INICIANDO DETECCIÓN AUTOMÁTICA...');
      
      // Procesar frame inmediatamente
      setTimeout(() => {
        if (isMounted) processVideoFrame();
      }, 1000);
      
      // Luego procesar cada 2 segundos
      intervalId = setInterval(async () => {
        if (isMounted) {
          await processVideoFrame();
        }
      }, 2000);
    }
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, isRealTimeMeasurement, hasPermissions, processVideoFrame]);

  // CONFIGURAR CANVAS OVERLAY CUANDO CAMBIE EL TAMAÑO DE VIDEO
  useEffect(() => {
    if (overlayCanvasRef.current && videoRef.current) {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      
      const updateCanvasSize = () => {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      };
      
      if (video.videoWidth > 0) {
        updateCanvasSize();
      }
      
      video.addEventListener('loadedmetadata', updateCanvasSize);
      return () => video.removeEventListener('loadedmetadata', updateCanvasSize);
    }
  }, [videoRef.current]);

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
    </div>
  );
};