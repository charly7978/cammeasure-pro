import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { useObjectDetection } from '@/hooks/useObjectDetection';
import { useMeasurementCalculations } from '@/hooks/useMeasurementCalculations';
import { useCameraOptimization } from '@/hooks/useCameraOptimization';
import { DetectedObject } from '@/lib/types';
import { TouchObjectSelector } from './TouchObjectSelector';

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
  // Hooks optimizados
  const { 
    videoRef, 
    cameraStream, 
    isCapturing,
    startCamera, 
    stopCamera, 
    switchCamera,
    requestCameraPermissions 
  } = useCamera();

  const { detectBasicObjects } = useObjectDetection();
  const { calculateRealTimeMeasurements } = useMeasurementCalculations();
  const {
    isProcessing,
    frameCount,
    currentMeasurement,
    detectedObjects,
    isRealTimeMeasurement,
    processFrameWithDebounce,
    updateMeasurements,
    toggleRealTimeMeasurement,
    getPerformanceMetrics,
    getCameraStatus
  } = useCameraOptimization();

  // Referencias optimizadas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);
  const resizeHandler = useRef<(() => void) | null>(null);

  // Estados locales optimizados
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const [showGrid, setShowGrid] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [videoContainer, setVideoContainer] = useState({ width: 0, height: 0 });
  const [isManualSelectionMode, setIsManualSelectionMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [manualMeasurements, setManualMeasurements] = useState<any>(null);

  // Memoizar funciones de callback para evitar re-renderizados
  const handleManualObjectSelection = useCallback((object: DetectedObject, measurements: any) => {
    console.log('🎯 OBJETO SELECCIONADO MANUALMENTE:', object);
    setSelectedObject(object);
    setManualMeasurements(measurements);
    
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    onRealTimeObjects([object]);
  }, [onRealTimeObjects]);

  const handleManualSelectionError = useCallback((error: string) => {
    console.error('❌ Error en selección manual:', error);
  }, []);

  // Función optimizada de procesamiento de frame
  const processFrameAutomatically = useCallback(async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current || !isActive) {
        return;
      }

      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = videoRef.current;
      
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const basicDetection = await detectBasicObjects(imageData, canvas.width, canvas.height);
      
      if (basicDetection.length > 0) {
        const selectedObject = basicDetection[0];
        const completeMeasurements = await calculateRealTimeMeasurements(selectedObject, imageData, calibrationData);
        
        const measurement = {
          id: `frame_${frameCount}`,
          timestamp: Date.now(),
          object: selectedObject,
          measurements: completeMeasurements,
          processingTime: performance.now() - performance.now()
        };

        updateMeasurements(measurement, [selectedObject]);
        onRealTimeObjects([selectedObject]);
        drawBasicOverlay(ctx, selectedObject, completeMeasurements);
      }
    } catch (error) {
      console.error('❌ Error en procesamiento automático:', error);
    }
  }, [videoRef, overlayCanvasRef, isActive, detectBasicObjects, calculateRealTimeMeasurements, calibrationData, frameCount, updateMeasurements, onRealTimeObjects]);

  // Función optimizada de overlay
  const drawBasicOverlay = useCallback((ctx: CanvasRenderingContext2D, object: any, measurements: any) => {
    try {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(object.x, object.y, object.width, object.height);
      
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(object.x + object.width / 2, object.y + object.height / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`Ancho: ${measurements.width?.toFixed(1) || 'N/A'}px`, object.x, object.y - 60);
      ctx.fillText(`Alto: ${measurements.height?.toFixed(1) || 'N/A'}px`, object.x, object.y - 40);
      ctx.fillText(`Área: ${measurements.area?.toFixed(0) || 'N/A'}px²`, object.x, object.y - 20);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`📏 ${measurements.realWidth?.toFixed(1) || 'N/A'}mm`, object.x, object.y + object.height + 20);
      ctx.fillText(`📐 ${measurements.realHeight?.toFixed(1) || 'N/A'}mm`, object.x, object.y + object.height + 40);
      ctx.fillText(`📊 ${measurements.realArea?.toFixed(1) || 'N/A'}mm²`, object.x, object.y + object.height + 60);
      
      if (measurements.depth && measurements.volume) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`🔍 Prof: ${measurements.depth.toFixed(1)}mm`, object.x, object.y + object.height + 80);
        ctx.fillText(`📦 Vol: ${measurements.volume.toFixed(1)}mm³`, object.x, object.y + object.height + 100);
      }
      
      ctx.fillStyle = '#00ffff';
      ctx.font = '14px Arial';
      ctx.fillText(`Confianza: ${(object.confidence * 100).toFixed(0)}%`, object.x, object.y + object.height + 120);
      ctx.fillText(`Unidad: ${measurements.unit}`, object.x, object.y + object.height + 140);
    } catch (error) {
      console.error('❌ Error dibujando overlay:', error);
    }
  }, []);

  // Función optimizada de cambio de cámara
  const handleCameraSwitch = useCallback(async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    
    // Corregido: mapeo de 'front'/'back' a 'user'/'environment'
    const directionMap: Record<string, "user" | "environment"> = {
      front: "user",
      back: "environment"
    };
    try {
      await switchCamera(directionMap[newDirection]);
      setCurrentCamera(newDirection);
    } catch (error) {
      console.error('❌ Error al cambiar de cámara:', error);
    }
  }, [currentCamera, switchCamera]);

  // Función optimizada de captura
  const handleCapture = useCallback(async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current) {
        return;
      }

      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageCapture?.(imageData);
    } catch (error) {
      console.error('❌ Error al capturar imagen:', error);
    }
  }, [videoRef, overlayCanvasRef, onImageCapture]);

  // Función optimizada de enfoque
  const handleFocus = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setFocusPoint({ x, y });
    } catch (error) {
      console.error('❌ Error al establecer punto de enfoque:', error);
    }
  }, []);

  // Función optimizada de reinicialización de cámara
  const forceCameraReinitialization = useCallback(async () => {
    try {
      console.log('🔄 FORZANDO REINICIALIZACIÓN DE CÁMARA...');
      const granted = await requestCameraPermissions();
      if (granted) {
        await startCamera();
        console.log('✅ CÁMARA REINICIADA MANUALMENTE');
      }
    } catch (error) {
      console.error('❌ Error al reinicializar cámara:', error);
    }
  }, [requestCameraPermissions, startCamera]);

  // Función optimizada de medición manual
  const forceMeasurement = useCallback(() => {
    try {
      if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
        processFrameWithDebounce(processFrameAutomatically, true);
      }
    } catch (error) {
      console.error('❌ Error al forzar medición:', error);
    }
  }, [videoRef, overlayCanvasRef, isProcessing, processFrameWithDebounce, processFrameAutomatically]);

  // Función optimizada de cambio de medición en tiempo real
  const handleRealTimeMeasurementToggle = useCallback(() => {
    try {
      const newState = !isRealTimeMeasurement;
      toggleRealTimeMeasurement(newState);
      
      if (newState) {
        console.log('🎯 ACTIVANDO MEDICIÓN - FORZANDO EJECUCIÓN INMEDIATA');
        setTimeout(() => {
          forceMeasurement();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error al cambiar estado de medición:', error);
    }
  }, [isRealTimeMeasurement, toggleRealTimeMeasurement, forceMeasurement]);

  // Memoizar métricas de rendimiento
  const performanceMetrics = useMemo(() => getPerformanceMetrics(), [getPerformanceMetrics]);
  const cameraStatus = useMemo(() => getCameraStatus(), [getCameraStatus]);

  // Inicialización optimizada de cámara
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        console.log('🚀 INICIANDO INICIALIZACIÓN DE CÁMARA');
        
        const granted = await requestCameraPermissions();
        if (!isMounted) return;
        
        console.log('📱 Permisos de cámara:', granted ? 'CONCEDIDOS' : 'DENEGADOS');
        setHasPermissions(granted);
        
        if (granted) {
          console.log('📹 INICIANDO CÁMARA...');
          await startCamera();
          console.log('✅ CÁMARA INICIADA EXITOSAMENTE');
          
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setVideoContainer({ width: rect.width, height: rect.height });
          }
          
          setTimeout(() => {
            if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current) return;
            
            console.log('🎯 INICIANDO MEDICIÓN AUTOMÁTICA ESTABLE');
            
            processingInterval.current = setInterval(() => {
              if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current || isProcessing) return;
              
              try {
                processFrameWithDebounce(processFrameAutomatically);
              } catch (error) {
                console.error('Error en procesamiento automático:', error);
              }
            }, 2000);
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Error en inicialización de cámara:', error);
      }
    };
    
    resizeHandler.current = () => {
      if (containerRef.current && isMounted) {
        const rect = containerRef.current.getBoundingClientRect();
        setVideoContainer({ width: rect.width, height: rect.height });
      }
    };
    
    window.addEventListener('resize', resizeHandler.current);
    initialize();
    
    return () => {
      console.log('🧹 LIMPIANDO RECURSOS DE CÁMARA');
      isMounted = false;
      
      stopCamera();
      
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
      
      if (resizeHandler.current) {
        window.removeEventListener('resize', resizeHandler.current);
      }
    };
  }, [requestCameraPermissions, startCamera, stopCamera, videoRef, overlayCanvasRef, isProcessing, processFrameWithDebounce, processFrameAutomatically]);

  // Manejar cambios de isActive
  useEffect(() => {
    if (isActive && hasPermissions && cameraStream) {
      console.log('🎯 TAB ACTIVO - CÁMARA YA INICIADA');
    } else if (!isActive && cameraStream) {
      console.log('⏸️ TAB INACTIVO - MANTENIENDO CÁMARA');
    }
  }, [isActive, hasPermissions, cameraStream]);

  // Renderizar interfaz de permisos
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
        <div className="space-y-2">
          <Button onClick={() => requestCameraPermissions()} className="bg-gradient-primary">
            <Camera className="w-4 h-4 mr-2" />
            Conceder Permisos
          </Button>
          
          <Button 
            onClick={forceCameraReinitialization} 
            variant="outline"
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Forzar Reinicialización
          </Button>
        </div>
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
            {currentCamera === 'back' ? 'Principal' : 'Frontal'}
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

          {isProcessing && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-xs animate-pulse">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
              Procesando
            </Badge>
          )}
          
          {isManualSelectionMode && (
            <Badge variant="outline" className="border-green-500 text-green-500 text-xs animate-pulse">
              <Target className="w-3 h-3 mr-1" />
              👆 Selección Manual
            </Badge>
          )}

          {/* Indicador de rendimiento */}
          <Badge 
            variant="outline" 
            className={`text-xs ${
              cameraStatus.status === 'optimal' ? 'border-green-500 text-green-500' :
              cameraStatus.status === 'stable' ? 'border-yellow-500 text-yellow-500' :
              'border-red-500 text-red-500'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mr-1 ${
              cameraStatus.status === 'optimal' ? 'bg-green-500' :
              cameraStatus.status === 'stable' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            {cameraStatus.status === 'optimal' ? 'Óptimo' :
             cameraStatus.status === 'stable' ? 'Estable' : 'Degradado'}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRealTimeMeasurementToggle}
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualSelectionMode(!isManualSelectionMode)}
            className={`h-8 w-8 p-0 ${isManualSelectionMode ? "bg-green-500 text-background" : ""}`}
            title="Modo Selección Manual"
          >
            <Target className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Video Container */}
      <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay
          playsInline
          muted
          onClick={handleFocus}
        />
        
        {/* Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        
        {/* Touch Object Selector */}
        <TouchObjectSelector
          videoRef={videoRef}
          overlayCanvasRef={overlayCanvasRef}
          onObjectSelected={handleManualObjectSelection}
          onError={handleManualSelectionError}
          isActive={isManualSelectionMode}
        />
        
        {/* Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/20"></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Focus Point */}
        {focusPoint && (
          <div
            className="absolute w-4 h-4 bg-red-500 rounded-full pointer-events-none animate-ping"
            style={{
              left: focusPoint.x - 8,
              top: focusPoint.y - 8
            }}
          />
        )}
        
        {/* Flash Effect */}
        {flashEnabled && (
          <div className="absolute inset-0 bg-white/50 pointer-events-none animate-pulse" />
        )}
      </div>

      {/* Panel de mediciones reales */}
      {detectedObjects.length > 0 && currentMeasurement && (
        <Card className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <h4 className="font-medium mb-3 text-green-400">🎯 Objeto Central Prominente Detectado</h4>
         
         {/* Mediciones principales en MM */}
         <div className="grid grid-cols-2 gap-4 mb-4">
           <div className="space-y-2">
             <div>
               <p className="text-gray-300 text-sm">📏 Ancho Real</p>
               <p className="font-mono text-green-400 font-bold text-xl">
                 {currentMeasurement.measurements.realWidth?.toFixed(1) || 'N/A'} mm
               </p>
             </div>
             <div>
               <p className="text-gray-300 text-sm">📐 Área Real</p>
               <p className="font-mono text-blue-400 font-bold">
                 {currentMeasurement.measurements.realArea?.toFixed(1) || 'N/A'} mm²
               </p>
             </div>
           </div>
           <div className="space-y-2">
             <div>
               <p className="text-gray-300 text-sm">📏 Alto Real</p>
               <p className="font-mono text-cyan-400 font-bold text-xl">
                 {currentMeasurement.measurements.realHeight?.toFixed(1) || 'N/A'} mm
               </p>
             </div>
             <div>
               <p className="text-gray-300 text-sm">🔍 Profundidad</p>
               <p className="font-mono text-yellow-400 font-bold">
                 {currentMeasurement.measurements.depth?.toFixed(1) || 'N/A'} mm
               </p>
             </div>
           </div>
         </div>
         
         {/* Mediciones 3D */}
         {currentMeasurement.measurements.volume && (
           <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-blue-900/20 rounded-lg">
             <div>
               <p className="text-gray-300 text-sm">📦 Volumen</p>
               <p className="font-mono text-blue-400 font-bold">
                 {currentMeasurement.measurements.volume.toFixed(1)} mm³
               </p>
             </div>
             <div>
               <p className="text-gray-300 text-sm">🌐 Superficie</p>
               <p className="font-mono text-cyan-400 font-bold">
                 {currentMeasurement.measurements.surfaceArea.toFixed(1)} mm²
               </p>
             </div>
           </div>
         )}
         
         {/* Análisis de forma */}
         <div className="grid grid-cols-3 gap-2 text-xs">
           <div className="text-center p-2 bg-gray-800/30 rounded">
             <p className="text-gray-400">Circularidad</p>
             <p className="text-yellow-400 font-bold">
               {currentMeasurement.measurements.circularity?.toFixed(3) || 'N/A'}
             </p>
           </div>
           <div className="text-center p-2 bg-gray-800/30 rounded">
             <p className="text-gray-400">Solidez</p>
             <p className="text-green-400 font-bold">
               {currentMeasurement.measurements.solidity?.toFixed(3) || 'N/A'}
             </p>
           </div>
           <div className="text-center p-2 bg-gray-800/30 rounded">
             <p className="text-gray-400">Compacidad</p>
             <p className="text-blue-400 font-bold">
               {currentMeasurement.measurements.compactness?.toFixed(6) || 'N/A'}
             </p>
           </div>
         </div>
         
         {/* Información de calibración */}
         <div className="mt-3 pt-3 border-t border-white/10">
           <p className="text-xs text-gray-400">
             Unidad: {currentMeasurement.measurements.unit} | 
             Confianza: {(currentMeasurement.measurements.confidence * 100).toFixed(0)}%
           </p>
         </div>
       </Card>
     )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={handleCapture}
          className="flex-1 bg-gradient-primary"
          disabled={!cameraStream}
        >
          <Camera className="w-4 h-4 mr-2" />
          Capturar Imagen
        </Button>
        
        <Button
          onClick={forceMeasurement}
          variant="outline"
          className="flex-1"
          disabled={!cameraStream || isProcessing}
        >
          <Target className="w-4 h-4 mr-2" />
          Medir Ahora
        </Button>
      </div>

      {/* Status Info con métricas de rendimiento */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>Frame: {frameCount} | Procesando: {isProcessing ? 'Sí' : 'No'}</p>
        {currentMeasurement && (
          <p>Tiempo: {currentMeasurement.processingTime}ms</p>
        )}
        <p className="text-xs">
          FPS: {performanceMetrics.frameRate} | 
          Tiempo Promedio: {performanceMetrics.averageProcessingTime}ms |
          Estado: {cameraStatus.status}
        </p>
      </div>
    </div>
  );
};
