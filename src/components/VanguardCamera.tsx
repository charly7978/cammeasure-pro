/**
 * COMPONENTE DE CÁMARA DE VANGUARDIA
 * Integra IA, medición 3D y AR profesional
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Zap,
  Settings,
  Maximize,
  Info,
  Crosshair,
  Activity
} from 'lucide-react';

import { VanguardDetectionSystem, VanguardObject, VanguardDetectionResult } from '@/lib/ai/VanguardDetectionSystem';
import { VanguardAROverlay } from './VanguardAROverlay';
import { useCamera } from '@/hooks/useCamera';
import { toast } from 'sonner';

interface VanguardCameraProps {
  onMeasurement?: (measurement: any) => void;
  isActive: boolean;
}

export const VanguardCamera: React.FC<VanguardCameraProps> = ({
  onMeasurement,
  isActive
}) => {
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vanguardSystem = useRef<VanguardDetectionSystem>(VanguardDetectionSystem.getInstance());
  
  // Estados
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObject, setDetectedObject] = useState<VanguardObject | null>(null);
  const [lastResult, setLastResult] = useState<VanguardDetectionResult | null>(null);
  const [fps, setFps] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  
  // Configuración
  const [config, setConfig] = useState({
    enable3D: true,
    showDebug: false,
    autoCalibrate: true,
    highAccuracy: true
  });

  // Hook de cámara
  const { 
    videoRef: cameraVideoRef, 
    cameraStream, 
    isCapturing,
    startCamera, 
    stopCamera
  } = useCamera();

  // Inicializar sistema de IA
  useEffect(() => {
    const initSystem = async () => {
      try {
        console.log('🚀 Inicializando Sistema Vanguard...');
        await vanguardSystem.current.initialize();
        setIsInitialized(true);
        toast.success('Sistema de IA inicializado', {
          description: 'Detección con inteligencia artificial lista'
        });
      } catch (error) {
        console.error('❌ Error inicializando sistema:', error);
        toast.error('Error al inicializar IA', {
          description: 'Usando modo de detección básico'
        });
      }
    };

    initSystem();

    return () => {
      vanguardSystem.current.dispose();
    };
  }, []);

  // Inicializar cámara
  useEffect(() => {
    if (isActive && isInitialized) {
      startCamera().catch(error => {
        console.error('Error iniciando cámara:', error);
        toast.error('Error al acceder a la cámara');
      });
    } else if (!isActive) {
      stopCamera();
    }
  }, [isActive, isInitialized]);

  // Actualizar dimensiones del video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoSize({
          width: video.videoWidth,
          height: video.videoHeight
        });
      }
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    video.addEventListener('resize', updateDimensions);

    return () => {
      video.removeEventListener('loadedmetadata', updateDimensions);
      video.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Procesar frames con IA
  useEffect(() => {
    if (!isActive || !isInitialized || !cameraStream) return;

    let animationId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas || isProcessing || video.readyState !== 4) {
        animationId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        setIsProcessing(true);
        
        // Configurar canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          animationId = requestAnimationFrame(processFrame);
          return;
        }

        // Capturar frame
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Procesar con IA
        const result = await vanguardSystem.current.detect(imageData);
        
        // Actualizar estado
        setLastResult(result);
        setDetectedObject(result.objects[0] || null);
        
        if (result.objects.length > 0 && onMeasurement) {
          onMeasurement({
            object: result.objects[0],
            measurements: result.measurements,
            timestamp: Date.now()
          });
        }

        // Calcular FPS
        frameCount++;
        const currentTime = performance.now();
        if (currentTime - lastTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastTime = currentTime;
        }

      } catch (error) {
        console.error('Error procesando frame:', error);
      } finally {
        setIsProcessing(false);
      }

      animationId = requestAnimationFrame(processFrame);
    };

    animationId = requestAnimationFrame(processFrame);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, isInitialized, cameraStream, onMeasurement]);

  // Capturar medición manual
  const captureMeasurement = useCallback(() => {
    if (detectedObject && lastResult) {
      const measurement = {
        object: detectedObject,
        measurements: lastResult.measurements,
        screenshot: canvasRef.current?.toDataURL(),
        timestamp: Date.now()
      };
      
      if (onMeasurement) {
        onMeasurement(measurement);
      }
      
      toast.success('Medición capturada', {
        description: `${detectedObject.label}: ${detectedObject.dimensions.width.toFixed(1)} × ${detectedObject.dimensions.height.toFixed(1)} ${detectedObject.dimensions.unit}`
      });
    } else {
      toast.error('No hay objeto detectado', {
        description: 'Apunte a un objeto para medir'
      });
    }
  }, [detectedObject, lastResult, onMeasurement]);

  return (
    <Card className="relative w-full h-full overflow-hidden bg-black">
      {/* Video de cámara */}
      <div ref={containerRef} className="relative w-full h-full">
        <video
          ref={(el) => {
            videoRef.current = el;
            if (cameraVideoRef) cameraVideoRef.current = el;
          }}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Canvas oculto para procesamiento */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Overlay AR de vanguardia */}
        {videoSize.width > 0 && videoSize.height > 0 && (
          <VanguardAROverlay
            object={detectedObject}
            width={videoSize.width}
            height={videoSize.height}
            confidence={lastResult?.confidence || 0}
            processingTime={lastResult?.processingTime || 0}
            depthEnabled={config.enable3D}
            calibrationConfidence={lastResult?.measurements.calibrationConfidence || 0}
          />
        )}
      </div>

      {/* Controles superiores */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        {/* Estado del sistema */}
        <div className="flex flex-col gap-2">
          <Badge 
            variant={isInitialized ? "default" : "secondary"} 
            className="backdrop-blur-md bg-black/50"
          >
            <Activity className="w-3 h-3 mr-1" />
            {isInitialized ? 'IA ACTIVA' : 'INICIANDO...'}
          </Badge>
          
          <Badge 
            variant="outline" 
            className="backdrop-blur-md bg-black/50 text-white border-white/30"
          >
            {fps} FPS
          </Badge>
        </div>

        {/* Configuración rápida */}
        <div className="flex gap-2">
          <Button
            variant={config.enable3D ? "default" : "secondary"}
            size="icon"
            onClick={() => setConfig(c => ({ ...c, enable3D: !c.enable3D }))}
            className="backdrop-blur-md bg-black/50"
          >
            <Maximize className="h-4 w-4" />
          </Button>
          
          <Button
            variant={config.showDebug ? "default" : "secondary"}
            size="icon"
            onClick={() => setConfig(c => ({ ...c, showDebug: !c.showDebug }))}
            className="backdrop-blur-md bg-black/50"
          >
            <Info className="h-4 w-4" />
          </Button>
          
          <Button
            variant={config.highAccuracy ? "default" : "secondary"}
            size="icon"
            onClick={() => setConfig(c => ({ ...c, highAccuracy: !c.highAccuracy }))}
            className="backdrop-blur-md bg-black/50"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Controles inferiores */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <Button
          size="lg"
          onClick={captureMeasurement}
          disabled={!detectedObject}
          className="rounded-full shadow-2xl backdrop-blur-md bg-white/90 hover:bg-white text-black"
        >
          <Camera className="h-6 w-6 mr-2" />
          Capturar Medición
        </Button>
      </div>

      {/* Panel de información cuando hay objeto */}
      {detectedObject && (
        <div className="absolute bottom-20 left-4 right-4">
          <Card className="backdrop-blur-md bg-black/80 border-white/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white font-semibold">
                  {detectedObject.label}
                </span>
              </div>
              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                {(detectedObject.confidence * 100).toFixed(0)}% confianza
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <p className="text-gray-400">Ancho</p>
                <p className="text-white font-mono font-bold">
                  {detectedObject.dimensions.width.toFixed(1)} {detectedObject.dimensions.unit}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Alto</p>
                <p className="text-white font-mono font-bold">
                  {detectedObject.dimensions.height.toFixed(1)} {detectedObject.dimensions.unit}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Profundidad</p>
                <p className="text-white font-mono font-bold">
                  {detectedObject.dimensions.depth.toFixed(1)} {detectedObject.dimensions.unit}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};