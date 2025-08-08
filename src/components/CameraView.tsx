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
  Play,
  Maximize2,
  CameraOff
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { CameraDirection } from '@capacitor/camera';
import { RealTimeMeasurement, DetectedObject } from './RealTimeMeasurement';
import { MeasurementOverlay } from './MeasurementOverlay';

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
  const [currentCamera, setCurrentCamera] = useState<CameraDirection>(CameraDirection.Rear);
  const [showGrid, setShowGrid] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [isRealTimeMeasurement, setIsRealTimeMeasurement] = useState(true);
  const [videoContainer, setVideoContainer] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    initializeCamera();
    
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
    };
  }, []);

  useEffect(() => {
    if (isActive && hasPermissions && !cameraStream) {
      startCamera();
    } else if (!isActive && cameraStream) {
      stopCamera();
    }
  }, [isActive, hasPermissions]);

  const initializeCamera = async () => {
    try {
      const granted = await requestCameraPermissions();
      setHasPermissions(granted);
      
      if (granted) {
        // Configuración optimizada para medición de precisión
        await startCamera({
          video: {
            facingMode: 'environment',
            width: { ideal: 3840, min: 1920 }, // 4K preferred, 1080p minimum
            height: { ideal: 2160, min: 1080 },
            frameRate: { ideal: 30, min: 15 }
          }
        });
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

  const handleObjectsDetected = (objects: DetectedObject[]) => {
    setDetectedObjects(objects);
    onRealTimeObjects(objects);
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
            Se necesita acceso a la cámara para realizar mediciones de precisión
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
      {/* Camera Controls - Mejorados */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary text-primary">
            <Camera className="w-3 h-3 mr-1" />
            {currentCamera === CameraDirection.Rear ? 'Cámara Principal' : 'Cámara Frontal'}
          </Badge>
          
          {cameraStream && (
            <Badge variant="secondary" className="animate-measurement-pulse">
              <div className="w-2 h-2 bg-measurement-active rounded-full mr-1"></div>
              Medición en Vivo - OpenCV Avanzado
            </Badge>
          )}

          {isRealTimeMeasurement && detectedObjects.length > 0 && (
            <Badge variant="outline" className="border-measurement-active text-measurement-active">
              <Target className="w-3 h-3 mr-1" />
              {detectedObjects.length} objeto{detectedObjects.length !== 1 ? 's' : ''} detectado{detectedObjects.length !== 1 ? 's' : ''}
            </Badge>
          )}

          {videoRef.current && (
            <Badge variant="outline" className="border-calibration text-calibration text-xs">
              {videoRef.current.videoWidth}��{videoRef.current.videoHeight}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={isFullscreen ? "bg-primary text-primary-foreground" : ""}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRealTimeMeasurement(!isRealTimeMeasurement)}
            className={isRealTimeMeasurement ? "bg-measurement-active text-background" : ""}
          >
            {isRealTimeMeasurement ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className={showGrid ? "bg-primary text-primary-foreground" : ""}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFlashEnabled(!flashEnabled)}
            className={flashEnabled ? "bg-calibration text-background" : ""}
          >
            <Zap className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCameraSwitch}
            disabled={isCapturing}
          >
            <SwitchCamera className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Ventana de Previsualización Ampliada y Fija */}
      <Card className={`relative overflow-hidden bg-black ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
        <div 
          ref={containerRef}
          className={`relative bg-black ${isFullscreen ? 'h-full' : 'aspect-[16/9] min-h-[600px]'}`}
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
            }}
          />

          {/* Overlay de Medición Mejorado y Transparente */}
          {isRealTimeMeasurement && (
            <MeasurementOverlay
              objects={detectedObjects}
              videoWidth={videoRef.current?.videoWidth || 1}
              videoHeight={videoRef.current?.videoHeight || 1}
              containerWidth={videoContainer.width}
              containerHeight={videoContainer.height}
              isActive={isActive}
              calibrationData={calibrationData}
            />
          )}
          
          {/* Grid mejorado para medición de precisión */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="precision-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="0.2"/>
                  </pattern>
                  <pattern id="major-grid" width="33.33" height="33.33" patternUnits="userSpaceOnUse">
                    <path d="M 33.33 0 L 0 0 0 33.33" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#precision-grid)" />
                <rect width="100" height="100" fill="url(#major-grid)" />
              </svg>
            </div>
          )}
          
          {/* Focus Point Indicator */}
          {focusPoint && (
            <div 
              className="absolute w-16 h-16 border-2 border-calibration rounded-full pointer-events-none animate-calibration-glow"
              style={{
                left: `${focusPoint.x}%`,
                top: `${focusPoint.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Focus className="w-4 h-4 text-calibration absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          )}
          
          {/* Center Crosshair mejorado para medición de precisión */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-12 h-12 border-2 border-measurement-active rounded-full flex items-center justify-center animate-measurement-pulse">
              <div className="w-3 h-3 bg-measurement-active rounded-full"></div>
            </div>
            {/* Líneas de mira */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-measurement-active opacity-60 transform -translate-y-1/2"></div>
            <div className="absolute top-0 left-1/2 w-0.5 h-full bg-measurement-active opacity-60 transform -translate-x-1/2"></div>
          </div>
        </div>

        {/* Botón de captura mejorado */}
        {onImageCapture && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
            <Button
              onClick={captureFrame}
              disabled={isCapturing || !cameraStream}
              size="lg"
              className="w-20 h-20 rounded-full bg-gradient-primary shadow-measurement border-4 border-background hover:scale-110 transition-transform"
            >
              <Camera className="w-8 h-8" />
            </Button>
          </div>
        )}

        {/* Real-time Processing Component con algoritmos avanzados */}
        {isRealTimeMeasurement && (
          <RealTimeMeasurement
            videoRef={videoRef}
            onObjectsDetected={handleObjectsDetected}
            isActive={isActive && isRealTimeMeasurement}
          />
        )}

        {/* Botón para cerrar fullscreen */}
        {isFullscreen && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-4 right-4 bg-black/50 text-white border-white/30"
            onClick={() => setIsFullscreen(false)}
          >
            Cerrar
          </Button>
        )}
      </Card>

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
