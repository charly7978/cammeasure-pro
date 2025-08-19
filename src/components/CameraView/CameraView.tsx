// COMPONENTE PRINCIPAL DE VISTA DE CÁMARA REFACTORIZADO
// Responsabilidades separadas para mejor rendimiento y mantenibilidad
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
  Play,
  Eye,
  Ruler,
  Smartphone
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { DetectedObject } from '@/lib/types';
import { TouchObjectSelector } from '../TouchObjectSelector';
import { useCameraControls } from './hooks/useCameraControls';
import { useAutoDetection } from './hooks/useAutoDetection';
import { useManualSelection } from './hooks/useManualSelection';
import { useMeasurementDisplay } from './hooks/useMeasurementDisplay';
import { CameraControls } from './components/CameraControls';
import { MeasurementPanel } from './components/MeasurementPanel';
import { VideoContainer } from './components/VideoContainer';

interface CameraViewProps {
  onImageCapture?: (imageData: ImageData) => void;
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
    focalLength?: number;
    sensorWidth?: number;
    sensorHeight?: number;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [videoContainer, setVideoContainer] = useState({ width: 0, height: 0 });

  // HOOKS ESPECIALIZADOS PARA CADA RESPONSABILIDAD
  const {
    currentCamera,
    showGrid,
    flashEnabled,
    focusPoint,
    handleCameraSwitch,
    handleGridToggle,
    handleFlashToggle,
    handleFocusReset,
    handleFocus
  } = useCameraControls(videoRef);

  const {
    isAutoMode,
    isProcessing,
    detectedObjects,
    currentMeasurement,
    frameCount,
    toggleAutoMode,
    processFrameAutomatically,
    forceMeasurement
  } = useAutoDetection(videoRef, overlayCanvasRef, isActive, calibrationData, onRealTimeObjects);

  const {
    isManualMode,
    selectedObject,
    manualMeasurements,
    toggleManualMode,
    handleManualObjectSelection,
    handleManualSelectionError
  } = useManualSelection(onRealTimeObjects, processFrameAutomatically);

  const {
    handleCapture
  } = useMeasurementDisplay(videoRef, overlayCanvasRef, onImageCapture);

  // INICIALIZACIÓN INMEDIATA DE CÁMARA - SIN DEPENDER DE isActive
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let resizeHandler: (() => void) | null = null;
    
    const initialize = async () => {
      try {
        console.log('🚀 INICIANDO INICIALIZACIÓN DE CÁMARA');
        
        // 1. SOLICITAR PERMISOS INMEDIATAMENTE
        const granted = await requestCameraPermissions();
        if (!isMounted) return;
        
        console.log('📱 Permisos de cámara:', granted ? 'CONCEDIDOS' : 'DENEGADOS');
        setHasPermissions(granted);
        
        if (granted) {
          // 2. INICIAR CÁMARA INMEDIATAMENTE
          console.log('📹 INICIANDO CÁMARA...');
          await startCamera();
          console.log('✅ CÁMARA INICIADA EXITOSAMENTE');
          
          // 3. ACTUALIZAR DIMENSIONES
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setVideoContainer({ width: rect.width, height: rect.height });
          }
          
          // 4. INICIAR MEDICIÓN AUTOMÁTICA CON RETRASO
          setTimeout(() => {
            if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current) return;
            
            console.log('🎯 INICIANDO MEDICIÓN AUTOMÁTICA ESTABLE');
            
            // Procesar cada 2000ms para máxima estabilidad
            intervalId = setInterval(() => {
              if (!isMounted || !videoRef?.current || !overlayCanvasRef?.current || isProcessing) return;
              
              try {
                processFrameAutomatically();
              } catch (error) {
                console.error('Error en procesamiento automático:', error);
              }
            }, 2000); // MUY LENTO PARA ESTABILIDAD
          }, 3000);
        } else {
          console.error('❌ PERMISOS DE CÁMARA DENEGADOS');
        }
      } catch (error) {
        console.error('❌ Error en inicialización de cámara:', error);
      }
    };
    
    // MANEJADOR DE RESIZE
    resizeHandler = () => {
      if (containerRef.current && isMounted) {
        const rect = containerRef.current.getBoundingClientRect();
        setVideoContainer({ width: rect.width, height: rect.height });
      }
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // INICIAR TODO INMEDIATAMENTE
    console.log('🎬 EJECUTANDO INICIALIZACIÓN INMEDIATA');
    initialize();
    
    // LIMPIEZA COMPLETA
    return () => {
      console.log('🧹 LIMPIANDO RECURSOS DE CÁMARA');
      isMounted = false;
      
      // Detener cámara
      stopCamera();
      
      // Limpiar intervalos
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      // Limpiar event listeners
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
    };
  }, []); // SIN DEPENDENCIAS - SOLO UNA VEZ AL MONTAR

  // MANEJAR CAMBIOS DE isActive SEPARADAMENTE
  useEffect(() => {
    if (isActive && hasPermissions && cameraStream) {
      console.log('🎯 TAB ACTIVO - CÁMARA YA INICIADA');
    } else if (!isActive && cameraStream) {
      console.log('⏸️ TAB INACTIVO - MANTENIENDO CÁMARA');
    }
  }, [isActive, hasPermissions, cameraStream]);

  // RENDERIZAR INTERFAZ
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
            onClick={async () => {
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
            }} 
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
      {/* Camera Controls - Refactorizado */}
      <CameraControls
        currentCamera={currentCamera}
        cameraStream={cameraStream}
        isAutoMode={isAutoMode}
        detectedObjects={detectedObjects}
        isProcessing={isProcessing}
        isManualMode={isManualMode}
        showGrid={showGrid}
        flashEnabled={flashEnabled}
        onCameraSwitch={handleCameraSwitch}
        onGridToggle={handleGridToggle}
        onFlashToggle={handleFlashToggle}
        onFocusReset={handleFocusReset}
        onManualModeToggle={toggleManualMode}
        onAutoModeToggle={toggleAutoMode}
        onForceMeasurement={forceMeasurement}
      />

      {/* Video Container - Refactorizado */}
      <VideoContainer
        ref={containerRef}
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        showGrid={showGrid}
        focusPoint={focusPoint}
        flashEnabled={flashEnabled}
        isManualMode={isManualMode}
        onFocus={handleFocus}
        onManualObjectSelection={handleManualObjectSelection}
        onManualSelectionError={handleManualSelectionError}
      />

      {/* Measurement Panel - Refactorizado */}
      {detectedObjects.length > 0 && currentMeasurement && (
        <MeasurementPanel
          currentMeasurement={currentMeasurement}
        />
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

      {/* Status Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Frame: {frameCount} | Procesando: {isProcessing ? 'Sí' : 'No'}</p>
        {currentMeasurement && (
          <p>Tiempo: {currentMeasurement.processingTime}ms</p>
        )}
      </div>
    </div>
  );
};
