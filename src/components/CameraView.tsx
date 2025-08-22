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
import { unifiedOpenCV } from '@/lib/unifiedOpenCVSystem';
import { EnhancedCameraOverlay } from './EnhancedCameraOverlay';

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
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  
  // ESTADOS PARA MEDICIÓN AUTOMÁTICA
  const [isProcessing, setIsProcessing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);
  const lastProcessTime = useRef<number>(0);

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
          
          // INICIAR DETECCIÓN AUTOMÁTICA CUANDO LA CÁMARA ESTÉ LISTA
          if (isActive && isRealTimeMeasurement) {
            intervalId = setInterval(async () => {
              if (isMounted && videoRef.current && videoRef.current.readyState === 4) {
                const now = Date.now();
                // Limitar a 10 FPS para mejor rendimiento
                if (now - lastProcessTime.current >= 100) {
                  lastProcessTime.current = now;
                  await processVideoFrame();
                }
              }
            }, 100); // Verificar cada 100ms
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

  // Actualizar dimensiones del video cuando cambie
  useEffect(() => {
    const updateVideoDimensions = () => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        setVideoContainer({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
      }
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', updateVideoDimensions);
      video.addEventListener('resize', updateVideoDimensions);
      
      // Verificar dimensiones iniciales
      if (video.videoWidth > 0) {
        updateVideoDimensions();
      }
    }

    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', updateVideoDimensions);
        video.removeEventListener('resize', updateVideoDimensions);
      }
    };
  }, [videoRef.current]);

  // PROCESAR FRAME DE VIDEO CON OPENCV AVANZADO Y DEBUG
  const processVideoFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      
      // Configurar canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        return;
      }
      
      // Capturar frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // DETECCIÓN HÍPER AVANZADA CON OPENCV
      const result = await unifiedOpenCV.detectObjectSilhouettes(imageData, calibrationData);
      
      if (result.objects.length > 0) {
        console.log(`✅ Detectados ${result.objects.length} objetos en ${result.processingTime.toFixed(1)}ms`);
        
        setDetectedObjects(result.objects);
        onRealTimeObjects(result.objects);
      } else {
        // Si no se detectan objetos, mantener los anteriores por un momento
        setTimeout(() => {
          if (!isProcessing) {
            setDetectedObjects([]);
            onRealTimeObjects([]);
          }
        }, 500);
      }
      
      setFrameCount(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Error procesando frame:', error);
    } finally {
      setIsProcessing(false);
    }
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
        
        {/* ENHANCED CAMERA OVERLAY */}
        {videoContainer.width > 0 && videoContainer.height > 0 && (
          <EnhancedCameraOverlay
            detectedObjects={detectedObjects}
            width={videoContainer.width}
            height={videoContainer.height}
            isCalibrated={calibrationData?.isCalibrated || false}
            showDebugInfo={showDebugOverlay}
          />
        )}
        
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

      {/* CONTROLES MEJORADOS */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 px-4">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleSwitchCamera}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <SwitchCamera className="h-5 w-5" />
        </Button>

        <Button
          variant={showGrid ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowGrid(!showGrid)}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>

        <Button
          size="lg"
          onClick={captureImage}
          className="bg-white text-black hover:bg-gray-200 rounded-full w-16 h-16 shadow-lg"
        >
          <Camera className="h-6 w-6" />
        </Button>

        <Button
          variant={isRealTimeMeasurement ? "default" : "secondary"}
          size="icon"
          onClick={() => setIsRealTimeMeasurement(!isRealTimeMeasurement)}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          {isRealTimeMeasurement ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>

        <Button
          variant={showDebugOverlay ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowDebugOverlay(!showDebugOverlay)}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* INDICADORES DE ESTADO MEJORADOS */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Badge variant={hasPermissions ? "default" : "destructive"} className="backdrop-blur-sm">
          {hasPermissions ? "Cámara OK" : "Sin permisos"}
        </Badge>
        
        {isProcessing && (
          <Badge variant="secondary" className="bg-blue-500/80 text-white backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Procesando...
            </div>
          </Badge>
        )}
        
        {detectedObjects.length > 0 && (
          <Badge variant="default" className="bg-green-500/80 text-white backdrop-blur-sm">
            <Target className="w-3 h-3 mr-1 inline" />
            {detectedObjects.length} objeto{detectedObjects.length !== 1 ? 's' : ''}
          </Badge>
        )}

        <Badge variant="outline" className="bg-black/50 text-white border-white/30 backdrop-blur-sm">
          Frame: {frameCount}
        </Badge>

        {!calibrationData?.isCalibrated && (
          <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/50 backdrop-blur-sm">
            ⚠️ Sin calibrar
          </Badge>
        )}
      </div>

      {/* Panel de información rápida mejorado */}
      {detectedObjects.length > 0 && !showDebugOverlay && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md text-white p-4 rounded-lg shadow-xl max-w-xs border border-white/10">
          <div className="font-semibold mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <Target className="w-4 h-4" />
            Detección Híper Avanzada
          </div>
          
          {detectedObjects[0] && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-gray-400 text-xs">Ancho</p>
                  <p className="font-mono font-bold text-green-400">
                    {detectedObjects[0].dimensions.width.toFixed(1)} {detectedObjects[0].dimensions.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Alto</p>
                  <p className="font-mono font-bold text-cyan-400">
                    {detectedObjects[0].dimensions.height.toFixed(1)} {detectedObjects[0].dimensions.unit}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">Confianza</span>
                  <span className="font-mono text-yellow-400">
                    {Math.round(detectedObjects[0].confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};