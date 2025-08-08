import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  CameraOff, 
  RotateCcw,
  Download,
  Target
} from 'lucide-react';
import { MeasurementOverlay } from './MeasurementOverlay';

interface CameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  objects?: any[];
  externalVideoRef?: React.RefObject<HTMLVideoElement>;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onImageCapture,
  isActive,
  calibrationData,
  objects,
  externalVideoRef
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 });
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });
  
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const initializeCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      // Forzar zoom 1x cuando sea compatible
      try {
        const track = stream.getVideoTracks()[0];
        // @ts-ignore
        const caps = track.getCapabilities?.();
        // @ts-ignore
        if (caps && typeof caps.zoom === 'object') {
          // @ts-ignore
          await track.applyConstraints({ advanced: [{ zoom: 1 }] });
        }
        // Intentar enfoque continuo si existe
        // @ts-ignore
        if (caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          // @ts-ignore
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
      } catch (_) {}

      setCameraStream(stream);
      setHasPermissions(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('No se pudo acceder a la c?mara. Verifica los permisos.');
      setHasPermissions(false);
    }
  };

  const handleCameraSwitch = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    await initializeCamera();
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageCapture?.(imageData);
    } catch (err) {
      setError('Error al capturar imagen');
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      initializeCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  useLayoutEffect(() => {
    const updateDims = () => {
      if (videoRef.current) {
        setVideoDims({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });
      }
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDims({ w: rect.width, h: rect.height });
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', updateDims);
    }
    return () => {
      window.removeEventListener('resize', updateDims);
      videoRef.current?.removeEventListener('loadedmetadata', updateDims);
    };
  }, []);

  if (error) {
    return (
      <Card className="p-6 text-center">
        <CameraOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error de C?mara</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={initializeCamera}>Reintentar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <span className="font-medium">C?mara Principal</span>
          <Badge variant={hasPermissions ? 'default' : 'secondary'}>{hasPermissions ? '?? Activa' : '?? Inactiva'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCameraSwitch} disabled={!hasPermissions}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Restablecer
          </Button>
          <Button onClick={captureFrame} disabled={!hasPermissions || isCapturing} className="bg-gradient-primary">
            <Camera className="w-4 h-4 mr-2" />
            {isCapturing ? 'Capturando...' : 'Capturar'}
          </Button>
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <div ref={containerRef} className="relative bg-black w-full h-[60vh]">
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {hasPermissions && (
            <MeasurementOverlay
              objects={objects || []}
              isActive={isActive}
              calibrationData={calibrationData}
              videoWidth={videoDims.w}
              videoHeight={videoDims.h}
              containerWidth={containerDims.w}
              containerHeight={containerDims.h}
            />
          )}

          {!hasPermissions && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <CameraOff className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">C?mara no disponible</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {hasPermissions && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Informaci?n de C?mara
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Estado</p>
              <p className="font-medium text-green-600">Activa</p>
            </div>
            <div>
              <p className="text-muted-foreground">Objetos Detectados</p>
              <p className="font-medium">{Array.isArray(objects) ? objects.length : 0}</p>
            </div>
            {calibrationData && (
              <>
                <div>
                  <p className="text-muted-foreground">Factor de Calibraci?n</p>
                  <p className="font-medium">{calibrationData.pixelsPerMm.toFixed(1)} px/mm</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado de Calibraci?n</p>
                  <p className="font-medium">{calibrationData.isCalibrated ? '? Calibrado' : '?? Sin Calibrar'}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
