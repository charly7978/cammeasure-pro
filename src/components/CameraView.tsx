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

// Exponer función global para detener la cámara de medición cuando otra sección la necesite
declare global {
  interface Window {
    stopMeasurementCamera?: () => Promise<void>;
  }
}

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
          
          // Exponer la función para que otras partes (p. ej. calibración) puedan detener la cámara
          window.stopMeasurementCamera = stopCamera;
          
          // INICIAR DETECCIÓN AUTOMÁTICA CUANDO LA CÁMARA ESTÉ LISTA
          if (isActive && isRealTimeMeasurement) {
            intervalId = setInterval(async () => {
              if (isMounted && videoRef.current && videoRef.current.readyState === 4) {
                await processVideoFrame();
              }
            }, 3000); // Procesar cada 3 segundos para mejor estabilidad
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
      // Limpiar referencia global al salir
      if (window.stopMeasurementCamera === stopCamera) {
        delete window.stopMeasurementCamera;
      }
    };
  }, [isActive, isRealTimeMeasurement]);

  // PROCESAR FRAME DE VIDEO CON OPENCV AVANZADO Y DEBUG
  const processVideoFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      setIsProcessing(true);
      console.log('🎯 PROCESANDO FRAME CON OPENCV...');
      
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
      
      // Capturar frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      console.log(`📏 Procesando imagen: ${imageData.width}x${imageData.height}, calibrado: ${calibrationData?.isCalibrated ? 'SÍ' : 'NO'}`);
      
      // DETECCIÓN AVANZADA CON OPENCV UNIFICADO Y CALIBRACIÓN APLICADA
      const result = await unifiedOpenCV.detectObjectSilhouettes(imageData, calibrationData);
      
      if (result.objects.length > 0) {
        const obj = result.objects[0];
        console.log(`✅ OpenCV detectó ${result.objects.length} objetos en ${result.processingTime.toFixed(1)}ms`);
        console.log(`📊 Objeto principal: ${obj.dimensions.width.toFixed(1)}x${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}, área: ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`);
        
        setDetectedObjects(result.objects);
        onRealTimeObjects(result.objects);
        
        // Dibujar overlay con siluetas reales
        if (overlayCanvasRef.current) {
          unifiedOpenCV.drawDetectionOverlay(overlayCanvasRef.current, result);
        }
      } else {
        console.log('❌ No se detectaron objetos - reintentando con parámetros más sensibles...');
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
    } finally {
      setIsProcessing(false);
    }
  };

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
    <div className="relative h-[calc(100vh-200px)] bg-black rounded-lg overflow-hidden gpu-accelerated">
      {!hasPermissions ? (
        <Card className="h-full flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="text-center p-8">
            <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Permisos de Cámara Requeridos</h3>
            <p className="text-muted-foreground mb-4">
              Necesitamos acceso a tu cámara para realizar mediciones
            </p>
            <Button onClick={handleRequestPermissions} className="bg-gradient-primary">
              <Camera className="w-4 h-4 mr-2" />
              Permitir Acceso
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Video principal con overlay AR */}
          <div className="relative h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover gpu-accelerated"
            />
            
            {/* Canvas para procesamiento (oculto) */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Canvas overlay para detección AR */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none gpu-accelerated"
            />
            
            {/* Efectos AR de ambiente */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Efecto de escaneo animado */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50"
                   style={{
                     animation: 'scan 3s linear infinite',
                     top: `${(Date.now() / 30) % 100}%`
                   }} />
              
              {/* Partículas AR flotantes */}
              {isRealTimeMeasurement && [...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-blue-400/30 rounded-full ar-float"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
            
            {/* Grid overlay AR */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full opacity-20">
                  <defs>
                    <pattern id="ar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-400" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#ar-grid)" />
                </svg>
              </div>
            )}
            
            {/* Focus indicator AR */}
            {focusPoint && (
              <div
                className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 pointer-events-none ar-fade-in"
                style={{ left: focusPoint.x, top: focusPoint.y }}
              >
                <div className="w-full h-full border-2 border-blue-400 rounded-lg animate-pulse">
                  <div className="absolute inset-0 border border-blue-400/50 rounded-lg scale-150 animate-ping" />
                </div>
              </div>
            )}
            
            {/* Panel de información AR transparente */}
            {detectedObjects.length > 0 && (
              <div className="absolute top-4 left-4 right-4 ar-transparent rounded-xl p-4 ar-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-green-400 font-semibold text-sm">Objeto Detectado</span>
                </div>
                <div className="text-white text-xs space-y-1">
                  <p>Dimensiones: {detectedObjects[0].dimensions.width.toFixed(1)} x {detectedObjects[0].dimensions.height.toFixed(1)} {detectedObjects[0].dimensions.unit}</p>
                  <p>Confianza: {(detectedObjects[0].confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            )}
            
            {/* Controles AR flotantes */}
            <div className="absolute bottom-20 left-0 right-0 px-4">
              <div className="flex justify-center gap-3">
                {/* Botón de Grid */}
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-3 rounded-full ar-transparent backdrop-blur-md transition-all transform hover:scale-110 ${
                    showGrid ? 'bg-blue-500/30 text-blue-400' : 'text-gray-400'
                  }`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                
                {/* Botón de Flash */}
                <button
                  onClick={toggleFlash}
                  className={`p-3 rounded-full ar-transparent backdrop-blur-md transition-all transform hover:scale-110 ${
                    flashEnabled ? 'bg-yellow-500/30 text-yellow-400' : 'text-gray-400'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                </button>
                
                {/* Botón de Cambiar Cámara */}
                <button
                  onClick={handleSwitchCamera}
                  className="p-3 rounded-full ar-transparent backdrop-blur-md text-gray-400 hover:text-white transition-all transform hover:scale-110"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
                
                {/* Botón de Medición en Tiempo Real */}
                <button
                  onClick={() => setIsRealTimeMeasurement(!isRealTimeMeasurement)}
                  className={`p-3 rounded-full ar-transparent backdrop-blur-md transition-all transform hover:scale-110 ${
                    isRealTimeMeasurement ? 'bg-green-500/30 text-green-400' : 'text-gray-400'
                  }`}
                >
                  {isRealTimeMeasurement ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {/* Estado de procesamiento AR */}
            {isProcessing && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="ar-transparent rounded-full p-4 ar-fade-in">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            )}
            
            {/* Indicadores de esquina AR */}
            <div className="absolute inset-4 pointer-events-none">
              {/* Esquina superior izquierda */}
              <div className="absolute top-0 left-0 w-12 h-12">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-transparent" />
                <div className="absolute top-0 left-0 h-full w-0.5 bg-gradient-to-b from-blue-400 to-transparent" />
              </div>
              {/* Esquina superior derecha */}
              <div className="absolute top-0 right-0 w-12 h-12">
                <div className="absolute top-0 right-0 w-full h-0.5 bg-gradient-to-l from-blue-400 to-transparent" />
                <div className="absolute top-0 right-0 h-full w-0.5 bg-gradient-to-b from-blue-400 to-transparent" />
              </div>
              {/* Esquina inferior izquierda */}
              <div className="absolute bottom-0 left-0 w-12 h-12">
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-transparent" />
                <div className="absolute bottom-0 left-0 h-full w-0.5 bg-gradient-to-t from-blue-400 to-transparent" />
              </div>
              {/* Esquina inferior derecha */}
              <div className="absolute bottom-0 right-0 w-12 h-12">
                <div className="absolute bottom-0 right-0 w-full h-0.5 bg-gradient-to-l from-blue-400 to-transparent" />
                <div className="absolute bottom-0 right-0 h-full w-0.5 bg-gradient-to-t from-blue-400 to-transparent" />
              </div>
            </div>
          </div>
          
          {/* Panel de información inferior AR */}
          <div className="absolute bottom-0 left-0 right-0 ar-transparent backdrop-blur-md p-4">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isCapturing ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span className="text-gray-300">{isCapturing ? 'Cámara Activa' : 'Cámara Inactiva'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <span>FPS: {frameCount}</span>
                <span>•</span>
                <span>{videoContainer.width}x{videoContainer.height}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};