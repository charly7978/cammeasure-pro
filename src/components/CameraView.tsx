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
        await startCamera();
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
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRealTimeMeasurement(!isRealTimeMeasurement)}
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
            height: '70vh', // Altura fija grande
            minHeight: '500px' // Altura mínima
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
            }}
          />

          {/* Real-time Measurement Overlay - MÁS TRANSPARENTE Y FIJO */}
          {isRealTimeMeasurement && (
            <MeasurementOverlay
              objects={detectedObjects}
              videoWidth={videoRef.current?.videoWidth || 1}
              videoHeight={videoRef.current?.videoHeight || 1}
              containerWidth={videoContainer.width}
              containerHeight={videoContainer.height}
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

        {/* Real-time Processing Component */}
        {isRealTimeMeasurement && (
          <RealTimeMeasurement
            videoRef={videoRef}
            onObjectsDetected={handleObjectsDetected}
            isActive={isActive && isRealTimeMeasurement}
          />
        )}
      </Card>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};