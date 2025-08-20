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
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';
import { RealTimeMeasurement } from './RealTimeMeasurement';

interface CameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  onRealTimeObjects: (objects: DetectedObject[]) => void;
  onMeasurementUpdate: (measurement: RealTimeMeasurementType) => void;
  onError: (error: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onImageCapture,
  isActive,
  calibrationData,
  onRealTimeObjects,
  onMeasurementUpdate,
  onError
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
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isRealTimeMeasurement, setIsRealTimeMeasurement] = useState(true);


  // INICIALIZACIÓN INMEDIATA DE CÁMARA
  useEffect(() => {
    let isMounted = true;
    
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
          
          console.log('✅ CÁMARA INICIADA - MEDICIÓN OPENCV ACTIVADA');
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
    };
  }, []);


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

  // ACTIVAR/DESACTIVAR MEDICIÓN EN TIEMPO REAL
  const toggleRealTimeMode = () => {
    setIsRealTimeMeasurement(!isRealTimeMeasurement);
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

        {/* SELECTOR OPENCV DE MEDICIÓN */}
        {isRealTimeMeasurement && (
          <RealTimeMeasurement
            videoRef={videoRef}
            overlayCanvasRef={overlayCanvasRef}
            onObjectsDetected={onRealTimeObjects}
            onMeasurementUpdate={onMeasurementUpdate}
            onError={onError}
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
          variant={isRealTimeMeasurement ? "default" : "secondary"}
          size="icon"
          onClick={toggleRealTimeMode}
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
        
        <Badge variant="outline" className="bg-black/50 text-white border-white/30">
          {isRealTimeMeasurement ? 'MEDICIÓN ACTIVA' : 'PAUSADA'}
        </Badge>
      </div>

    </div>
  );
};