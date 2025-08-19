import React, { useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  SwitchCamera, 
  Zap,
  Grid3X3,
  Focus,
  Target
} from 'lucide-react';

interface SimpleCameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: any;
  onRealTimeObjects: (objects: any[]) => void;
}

export const SimpleCameraView: React.FC<SimpleCameraViewProps> = ({
  onImageCapture,
  isActive,
  calibrationData,
  onRealTimeObjects
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const [showGrid, setShowGrid] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Función simple para solicitar permisos de cámara
  const requestCameraPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: currentCamera === 'back' ? 'environment' : 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermissions(true);
      }
      
      return true;
    } catch (error) {
      console.error('Error al solicitar permisos de cámara:', error);
      setHasPermissions(false);
      return false;
    }
  }, [currentCamera]);

  // Función simple para cambiar cámara
  const handleCameraSwitch = useCallback(async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    setCurrentCamera(newDirection);
    
    // Reiniciar cámara con nueva dirección
    if (hasPermissions) {
      await requestCameraPermissions();
    }
  }, [currentCamera, hasPermissions, requestCameraPermissions]);

  // Función simple para capturar imagen
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      setIsProcessing(true);
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageCapture?.(imageData);
      
      // Simular detección de objeto simple
      const mockObject = {
        id: 'simple_obj',
        type: 'detected',
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        width: canvas.width * 0.8,
        height: canvas.height * 0.8,
        area: canvas.width * canvas.height * 0.64,
        confidence: 0.8,
        boundingBox: {
          x: canvas.width * 0.1,
          y: canvas.height * 0.1,
          width: canvas.width * 0.8,
          height: canvas.height * 0.8
        },
        dimensions: {
          width: canvas.width * 0.8,
          height: canvas.height * 0.8,
          area: canvas.width * canvas.height * 0.64,
          unit: 'px'
        }
      };
      
      onRealTimeObjects([mockObject]);
      
    } catch (error) {
      console.error('Error al capturar imagen:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onImageCapture, onRealTimeObjects]);

  // Función simple para manejar enfoque
  const handleFocus = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setFocusPoint({ x, y });
  }, []);

  // Inicializar cámara al montar
  React.useEffect(() => {
    if (isActive) {
      requestCameraPermissions();
    }
  }, [isActive, requestCameraPermissions]);

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
        <Button onClick={requestCameraPermissions} className="bg-gradient-primary">
          <Camera className="w-4 h-4 mr-2" />
          Conceder Permisos
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles de cámara */}
      <div className="flex items-center justify-between bg-card/50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary text-primary text-xs">
            <Camera className="w-3 h-3 mr-1" />
            {currentCamera === 'back' ? 'Principal' : 'Frontal'}
          </Badge>
          
          <Badge variant="secondary" className="text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            En Vivo
          </Badge>

          {isProcessing && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-xs animate-pulse">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
              Procesando
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
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
            className={`h-8 w-8 p-0 ${flashEnabled ? "bg-yellow-500 text-background" : ""}`}
          >
            <Zap className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCameraSwitch}
            className="h-8 w-8 p-0"
          >
            <SwitchCamera className="w-3 h-3" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFocusPoint(null)}
            className="h-8 w-8 p-0"
          >
            <Focus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Contenedor de video */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay
          playsInline
          muted
          onClick={handleFocus}
        />
        
        {/* Canvas para captura */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Grid overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/20"></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Punto de enfoque */}
        {focusPoint && (
          <div
            className="absolute w-4 h-4 bg-red-500 rounded-full pointer-events-none animate-ping"
            style={{
              left: focusPoint.x - 8,
              top: focusPoint.y - 8
            }}
          />
        )}
        
        {/* Efecto flash */}
        {flashEnabled && (
          <div className="absolute inset-0 bg-white/50 pointer-events-none animate-pulse" />
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2">
        <Button 
          onClick={handleCapture}
          className="flex-1 bg-gradient-primary"
          disabled={isProcessing}
        >
          <Camera className="w-4 h-4 mr-2" />
          {isProcessing ? 'Procesando...' : 'Capturar Imagen'}
        </Button>
        
        <Button
          onClick={() => {
            // Simular medición simple
            const mockObject = {
              id: 'manual_obj',
              type: 'manual',
              x: 100,
              y: 100,
              width: 200,
              height: 150,
              area: 30000,
              confidence: 0.9,
              boundingBox: { x: 100, y: 100, width: 200, height: 150 },
              dimensions: { width: 200, height: 150, area: 30000, unit: 'px' }
            };
            onRealTimeObjects([mockObject]);
          }}
          variant="outline"
          className="flex-1"
        >
          <Target className="w-4 h-4 mr-2" />
          Medir Manualmente
        </Button>
      </div>

      {/* Información de estado */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Cámara: {currentCamera === 'back' ? 'Principal' : 'Frontal'}</p>
        <p>Grid: {showGrid ? 'Activado' : 'Desactivado'}</p>
        <p>Flash: {flashEnabled ? 'Activado' : 'Desactivado'}</p>
      </div>
    </div>
  );
};
