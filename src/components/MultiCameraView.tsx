import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Camera, 
  CameraOff, 
  Settings, 
  Target, 
  Zap,
  RotateCcw,
  Play,
  Pause,
  Square,
  Triangle,
  AlertCircle
} from 'lucide-react';
import { useMultiCamera, type StereoCameraPair } from '@/hooks/useMultiCamera';

interface MultiCameraViewProps {
  onStereoCapture?: (leftImageData: ImageData, rightImageData: ImageData) => void;
  onSingleCapture?: (imageData: ImageData, cameraIndex: number) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
}

export const MultiCameraView: React.FC<MultiCameraViewProps> = ({
  onStereoCapture,
  onSingleCapture,
  isActive,
  calibrationData
}) => {
  const {
    devices,
    stereoPairs,
    activeStereoPair,
    isScanning,
    error,
    scanCameras,
    activateStereoPair,
    deactivateAll,
    calibrateStereoPair
  } = useMultiCamera();

  const [captureMode, setCaptureMode] = useState<'single' | 'stereo'>('stereo');
  const [isCapturing, setIsCapturing] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Escanear cámaras al montar
  useEffect(() => {
    if (isActive) {
      scanCameras();
    }
  }, [isActive]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      deactivateAll();
    };
  }, []);

  // Conectar streams de video cuando se activa un par estéreo
  useEffect(() => {
    if (activeStereoPair && activeStereoPair.left.stream && activeStereoPair.right.stream) {
      const leftVideo = videoRefs.current[0];
      const rightVideo = videoRefs.current[1];
      
      if (leftVideo && rightVideo) {
        leftVideo.srcObject = activeStereoPair.left.stream;
        rightVideo.srcObject = activeStereoPair.right.stream;
        
        // Asegurar que los videos se reproduzcan
        leftVideo.play().catch(console.error);
        rightVideo.play().catch(console.error);
      }
    }
  }, [activeStereoPair]);

  // Capturar desde una cámara individual
  const captureFromCamera = (cameraIndex: number) => {
    const video = videoRefs.current[cameraIndex];
    const canvas = canvasRefs.current[cameraIndex];
    
    if (!video || !canvas || !onSingleCapture) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    onSingleCapture(imageData, cameraIndex);
  };

  // Capturar par estéreo
  const captureStereo = () => {
    if (!activeStereoPair || !onStereoCapture) return;
    
    const leftVideo = videoRefs.current[0];
    const rightVideo = videoRefs.current[1];
    const leftCanvas = canvasRefs.current[0];
    const rightCanvas = canvasRefs.current[1];
    
    if (!leftVideo || !rightVideo || !leftCanvas || !rightCanvas) return;
    
    // Capturar frame izquierdo
    leftCanvas.width = leftVideo.videoWidth;
    leftCanvas.height = leftVideo.videoHeight;
    const leftCtx = leftCanvas.getContext('2d');
    if (leftCtx) {
      leftCtx.drawImage(leftVideo, 0, 0, leftCanvas.width, leftCanvas.height);
      const leftImageData = leftCtx.getImageData(0, 0, leftCanvas.width, leftCanvas.height);
      
      // Capturar frame derecho
      rightCanvas.width = rightVideo.videoWidth;
      rightCanvas.height = rightVideo.videoHeight;
      const rightCtx = rightCanvas.getContext('2d');
      if (rightCtx) {
        rightCtx.drawImage(rightVideo, 0, 0, rightCanvas.width, rightCanvas.height);
        const rightImageData = rightCtx.getImageData(0, 0, rightCanvas.width, rightCanvas.height);
        
        onStereoCapture(leftImageData, rightImageData);
      }
    }
  };

  // Activar modo de captura
  const startCaptureMode = () => {
    setIsCapturing(true);
  };

  const stopCaptureMode = () => {
    setIsCapturing(false);
  };

  // Calibrar par estéreo
  const handleStereoCalibration = async (pairIndex: number) => {
    // Aquí se implementaría la calibración estéreo
    // Por ahora simulamos datos de calibración
    const mockCalibrationData = {
      leftMatrix: [1000, 0, 320, 0, 1000, 240, 0, 0, 1],
      rightMatrix: [1000, 0, 320, 0, 1000, 240, 0, 0, 1],
      rotationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      translationVector: [50, 0, 0], // 50mm baseline
      essentialMatrix: [0, 0, 0, 0, 0, -50, 0, 50, 0],
      fundamentalMatrix: [0, 0, 0, 0, 0, -0.001, 0, 0.001, 0]
    };
    
    await calibrateStereoPair(pairIndex, mockCalibrationData);
  };

  if (error) {
    return (
      <Card className="p-6 text-center">
        <CameraOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error de Cámaras</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={scanCameras} disabled={isScanning}>
          {isScanning ? 'Escaneando...' : 'Reintentar'}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles principales */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <span className="font-medium">
            Sistema Multi-Cámara ({devices.length} cámaras, {stereoPairs.length} pares estéreo)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {activeStereoPair ? '🟢 Estéreo Activo' : '🔴 Sin Activar'}
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={scanCameras}
            disabled={isScanning}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            {isScanning ? 'Escaneando...' : 'Escanear'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={isCapturing ? stopCaptureMode : startCaptureMode}
            className={isCapturing ? "bg-red-500 text-white" : ""}
          >
            {isCapturing ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {isCapturing ? 'Detener' : 'Capturar'}
          </Button>
        </div>
      </div>

      {/* Información de cámaras */}
      <Card className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Cámaras Detectadas ({devices.filter(d => d.facingMode === 'environment').length} traseras)
        </h4>
        
        {devices.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No se detectaron cámaras</p>
            <Button onClick={scanCameras} disabled={isScanning}>
              {isScanning ? 'Escaneando...' : 'Escanear Cámaras'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map((device, index) => (
              <div key={device.deviceId} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{device.label}</span>
                  <Badge variant={device.facingMode === 'environment' ? 'default' : 'secondary'} className="text-xs">
                    {device.facingMode === 'environment' ? '🔄 Trasera' : '👤 Frontal'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ID: {device.deviceId.slice(0, 8)}...
                </p>
                {device.capabilities && (
                  <p className="text-xs text-muted-foreground">
                    Res: {device.capabilities.width?.max || 'N/A'}x{device.capabilities.height?.max || 'N/A'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Grupo: {device.groupId.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pares estéreo */}
      {stereoPairs.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Pares Estéreo Disponibles ({stereoPairs.length})
          </h4>
          
          <div className="space-y-3">
            {stereoPairs.map((pair, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Par {index + 1}</span>
                    <Badge variant={pair.isCalibrated ? 'default' : 'secondary'} className="text-xs">
                      {pair.isCalibrated ? '✅ Calibrado' : '⚠️ Sin Calibrar'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activateStereoPair(index)}
                      disabled={activeStereoPair === pair}
                    >
                      {activeStereoPair === pair ? '🟢 Activo' : 'Activar'}
                    </Button>
                    
                    {!pair.isCalibrated && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStereoCalibration(index)}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Calibrar
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cámara Izquierda</p>
                    <p className="font-medium">{pair.left.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {pair.left.facingMode === 'environment' ? '🔄 Trasera' : '👤 Frontal'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cámara Derecha</p>
                    <p className="font-medium">{pair.right.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {pair.right.facingMode === 'environment' ? '🔄 Trasera' : '👤 Frontal'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  Baseline: {pair.baseline}mm | Calibrado: {pair.isCalibrated ? 'Sí' : 'No'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Vista estéreo activa */}
      {activeStereoPair && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Triangle className="w-4 h-4" />
            Vista Estéreo Activa
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Cámara izquierda */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cámara Izquierda</span>
                <Badge variant="outline" className="text-xs">🟢 Activa</Badge>
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={(el) => videoRefs.current[0] = el}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={(el) => canvasRefs.current[0] = el}
                  style={{ display: 'none' }}
                />
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="bg-black/50 text-white text-xs">
                    L
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Cámara derecha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cámara Derecha</span>
                <Badge variant="outline" className="text-xs">🟢 Activa</Badge>
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={(el) => videoRefs.current[1] = el}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={(el) => canvasRefs.current[1] = el}
                  style={{ display: 'none' }}
                />
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="bg-black/50 text-white text-xs">
                    R
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {/* Controles de captura estéreo */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button
              onClick={captureStereo}
              disabled={!isCapturing}
              className="bg-gradient-primary"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capturar Estéreo
            </Button>
            
            <div className="text-xs text-muted-foreground">
              Baseline: {activeStereoPair.baseline}mm | 
              Calibrado: {activeStereoPair.isCalibrated ? 'Sí' : 'No'}
            </div>
          </div>
        </Card>
      )}

      {/* Instrucciones */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <h4 className="font-medium mb-2 text-primary">🎯 Instrucciones Multi-Cámara</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• El sistema detecta automáticamente todas las cámaras disponibles</li>
          <li>• Se crean pares estéreo automáticamente para medición 3D</li>
          <li>• Calibra los pares estéreo para mediciones 3D precisas</li>
          <li>• Usa "Capturar Estéreo" para obtener datos 3D</li>
          <li>• El baseline se ajusta automáticamente según la separación de cámaras</li>
        </ul>
      </Card>
    </div>
  );
};
