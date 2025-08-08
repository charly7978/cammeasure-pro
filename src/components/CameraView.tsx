import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, RotateCcw, Settings } from 'lucide-react';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
}

interface CameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  onRealTimeObjects: (objects: DetectedObject[]) => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onImageCapture,
  isActive,
  calibrationData,
  onRealTimeObjects,
  videoRef: externalVideoRef
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Función para inicializar la cámara
  const initializeCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: currentCamera,
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          aspectRatio: { ideal: 16/9 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
        setIsStreamActive(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setIsStreamActive(false);
    }
  };

  // Función para cambiar entre cámaras
  const handleCameraSwitch = async () => {
    setCurrentCamera(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Función para capturar frame
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ajustar canvas al tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dibujar el frame actual del video en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Obtener ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Llamar callback con los datos de la imagen
    onImageCapture?.(imageData);
  };

  // Función para manejar objetos detectados en tiempo real
  const handleObjectsDetected = (objects: DetectedObject[]) => {
    onRealTimeObjects(objects);
  };

  // Función para manejar clic en el video (para captura manual)
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    // Capturar frame al hacer clic en el video
    captureFrame();
  };

  // Inicializar cámara cuando el componente se monta o cambia la cámara
  useEffect(() => {
    if (isActive) {
      initializeCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsStreamActive(false);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, currentCamera]);

  // Actualizar dimensiones del canvas cuando cambia el tamaño del video
  useEffect(() => {
    const updateDimensions = () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Mantener proporción del video
        const aspectRatio = video.videoWidth / video.videoHeight;
        const maxWidth = 640;
        const maxHeight = 480;
        
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', updateDimensions);
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', updateDimensions);
      };
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Controles de cámara */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <span className="font-medium">Cámara {currentCamera === 'environment' ? 'Trasera' : 'Frontal'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {calibrationData && (
            <Badge variant="outline" className="text-xs">
              {calibrationData.isCalibrated ? '✅ Calibrado' : '⚠️ Sin Calibrar'}
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCameraSwitch}
            disabled={!isStreamActive}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Cambiar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={captureFrame}
            disabled={!isStreamActive}
          >
            <Settings className="w-4 h-4 mr-1" />
            Capturar
          </Button>
        </div>
      </div>

      {/* Vista de cámara */}
      <Card className="relative overflow-hidden bg-black">
        {error ? (
          <div className="flex items-center justify-center h-64 text-center">
            <div className="space-y-2">
              <Camera className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={initializeCamera} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-auto"
              playsInline
              muted
              onClick={handleVideoClick}
              style={{ cursor: 'pointer' }}
            />
            
            {/* Canvas oculto para captura */}
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />
            
            {/* Overlay de información */}
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/50 text-white">
                {isStreamActive ? '🟢 Activa' : '🔴 Inactiva'}
              </Badge>
            </div>
            
            {/* Instrucciones */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-black/50 text-white text-xs p-2 rounded">
                💡 Haz clic en el video para capturar una imagen para análisis detallado
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Información de calibración */}
      {calibrationData && (
        <div className="text-xs text-muted-foreground">
          <p>Factor de conversión: {calibrationData.pixelsPerMm.toFixed(2)} píxeles/mm</p>
          <p>Estado: {calibrationData.isCalibrated ? 'Calibrado' : 'Sin calibrar'}</p>
        </div>
      )}
    </div>
  );
};
