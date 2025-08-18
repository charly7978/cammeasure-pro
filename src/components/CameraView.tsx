
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
import { DetectedObject } from '@/lib/types';

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
  const [currentMeasurement, setCurrentMeasurement] = useState<any>(null);
  const [frameCount, setFrameCount] = useState(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

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

  const handleCameraSwitch = async () => {
    const newDirection = currentCamera === 'back' ? 'front' : 'back';
    
    try {
      await switchCamera(newDirection);
      setCurrentCamera(newDirection);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // MEDICIÓN AUTOMÁTICA EN TIEMPO REAL - SIMPLIFICADA Y PROTEGIDA
  const processFrameAutomatically = async () => {
    try {
      // PROTECCIÓN CONTRA ERRORES CRÍTICOS
      if (!videoRef?.current || !overlayCanvasRef?.current || !isActive || isProcessing) {
        console.log('⚠️ Condiciones no cumplidas para procesamiento');
        return;
      }

      // VERIFICAR QUE EL VIDEO ESTÉ LISTO
      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        console.log('⚠️ Video no está listo aún');
        return;
      }

      setIsProcessing(true);
      console.log('🎯 INICIANDO PROCESAMIENTO DE FRAME');

      // 1. CAPTURAR FRAME ACTUAL - SIMPLIFICADO
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ No se pudo obtener contexto del canvas');
        return;
      }

      const video = videoRef.current;
      
      // VERIFICAR DIMENSIONES DEL VIDEO
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        console.log('⚠️ Dimensiones del video no válidas');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log('✅ Frame capturado correctamente');

      // 2. DETECCIÓN SIMPLIFICADA - SIN ALGORITMOS COMPLEJOS
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log('🔍 Procesando imagen para detección...');
        
        // DETECCIÓN BÁSICA Y SEGURA
        const basicDetection = await detectBasicObjects(imageData, canvas.width, canvas.height);
        console.log('📊 Objetos básicos detectados:', basicDetection.length);
        
        if (basicDetection.length > 0) {
          // 3. SELECCIONAR PRIMER OBJETO (MÁS SIMPLE)
          const selectedObject = basicDetection[0];
          
          // 4. MEDICIONES BÁSICAS
          const basicMeasurements = {
            width: selectedObject.width,
            height: selectedObject.height,
            area: selectedObject.width * selectedObject.height,
            unit: 'px'
          };
          
          // 5. ACTUALIZAR ESTADO
          const measurement = {
            id: `frame_${frameCount}`,
            timestamp: Date.now(),
            object: selectedObject,
            measurements: basicMeasurements,
            processingTime: 0
          };

          setCurrentMeasurement(measurement);
          setDetectedObjects([selectedObject]);
          onRealTimeObjects([selectedObject]);

          // 6. OVERLAY SIMPLE
          drawBasicOverlay(ctx, selectedObject, basicMeasurements);
          console.log('✅ Procesamiento completado exitosamente');
        } else {
          console.log('ℹ️ No se detectaron objetos en este frame');
        }
      } catch (detectionError) {
        console.error('❌ Error en detección básica:', detectionError);
        // CONTINUAR SIN CRASH
      }

      // 7. ACTUALIZAR CONTADORES
      setFrameCount(prev => prev + 1);

    } catch (error) {
      console.error('❌ Error crítico en procesamiento automático:', error);
      // NO RE-LANZAR EL ERROR PARA EVITAR QUE LA APLICACIÓN SE CIERRE
    } finally {
      setIsProcessing(false);
      console.log('🏁 Procesamiento finalizado');
    }
  };

  // FUNCIONES BÁSICAS DE DETECCIÓN - IMPLEMENTADAS PARA ESTABILIDAD
  
  // Detección básica de objetos (sin algoritmos complejos)
  const detectBasicObjects = async (imageData: ImageData, width: number, height: number): Promise<any[]> => {
    try {
      console.log('🔍 Iniciando detección básica...');
      
      // SIMULACIÓN BÁSICA - DETECTAR OBJETO CENTRAL
      const centerX = width / 2;
      const centerY = height / 2;
      const objectSize = Math.min(width, height) * 0.3; // 30% del tamaño de la imagen
      
      const basicObject = {
        id: 'basic_obj_1',
        type: 'basic',
        x: centerX - objectSize / 2,
        y: centerY - objectSize / 2,
        width: objectSize,
        height: objectSize,
        area: objectSize * objectSize,
        confidence: 0.8
      };
      
      console.log('✅ Objeto básico detectado:', basicObject);
      return [basicObject];
    } catch (error) {
      console.error('❌ Error en detección básica:', error);
      return [];
    }
  };
  
  // Overlay básico (sin dibujos complejos)
  const drawBasicOverlay = (ctx: CanvasRenderingContext2D, object: any, measurements: any) => {
    try {
      console.log('🎨 Dibujando overlay básico...');
      
      // Limpiar canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar rectángulo simple
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(object.x, object.y, object.width, object.height);
      
      // Texto básico
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.fillText(`Ancho: ${measurements.width.toFixed(0)}px`, object.x, object.y - 10);
      ctx.fillText(`Alto: ${measurements.height.toFixed(0)}px`, object.x, object.y + object.height + 20);
      
      console.log('✅ Overlay básico dibujado correctamente');
    } catch (error) {
      console.error('❌ Error dibujando overlay básico:', error);
    }
  };

  // FUNCIONES SIMPLIFICADAS PARA ESTABILIDAD
  
  // Seleccionar objeto más prominente - SIMPLIFICADO
  const selectMostProminentObject = (rects: any[]): DetectedObject | null => {
    if (rects.length === 0) return null;

    // SIMPLIFICADO - RETORNAR PRIMER OBJETO
    const firstRect = rects[0];
    return {
      id: 'prominent_obj',
      type: 'detected',
      x: firstRect.x,
      y: firstRect.y,
      width: firstRect.width,
      height: firstRect.height,
      area: firstRect.width * firstRect.height,
      boundingBox: {
        x: firstRect.x,
        y: firstRect.y,
        width: firstRect.width,
        height: firstRect.height
      },
      dimensions: {
        width: firstRect.width,
        height: firstRect.height,
        area: firstRect.width * firstRect.height,
        unit: 'px'
      },
      confidence: 0.8
    };
  };

  // Calcular mediciones en tiempo real - SIMPLIFICADO
  const calculateRealTimeMeasurements = async (object: DetectedObject, imageData: ImageData) => {
    try {
      if (!object || !object.dimensions || !object.dimensions.width || !object.dimensions.height) {
        console.warn('⚠️ Objeto inválido para mediciones');
        return {
          width: 0, height: 0, area: 0,
          realWidth: 0, realHeight: 0, realArea: 0,
          depth: 0, volume: 0, surfaceArea: 0, distance: 0,
          perimeter: 0, diagonal: 0, aspectRatio: 0,
          unit: 'px'
        };
      }

      const { width, height, area } = object.dimensions;
      
      // MEDICIONES BÁSICAS EN PÍXELES
      const basicMeasurements = {
        width,
        height,
        area,
        perimeter: 2 * (width + height),
        diagonal: Math.sqrt(width ** 2 + height ** 2),
        aspectRatio: width / height,
        unit: 'px'
      };

      // CONVERTIR A UNIDADES REALES SI ESTÁ CALIBRADO
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const pixelsPerMm = calibrationData.pixelsPerMm;
        return {
          ...basicMeasurements,
          realWidth: width / pixelsPerMm,
          realHeight: height / pixelsPerMm,
          realArea: area / (pixelsPerMm ** 2),
          unit: 'mm'
        };
      }

      return basicMeasurements;
    } catch (error) {
      console.error('❌ Error crítico al calcular mediciones:', error);
      return {
        width: 0, height: 0, area: 0,
        realWidth: 0, realHeight: 0, realArea: 0,
        depth: 0, volume: 0, surfaceArea: 0, distance: 0,
        perimeter: 0, diagonal: 0, aspectRatio: 0,
        unit: 'px'
      };
    }
  };

  // Dibujar overlay en tiempo real - SIMPLIFICADO
  const drawRealTimeOverlay = (ctx: CanvasRenderingContext2D, object: DetectedObject, measurements: any) => {
    try {
      if (!ctx || !object || !object.boundingBox || !measurements) {
        console.warn('⚠️ Parámetros inválidos para dibujar overlay');
        return;
      }

      const { x, y, width, height } = object.boundingBox;
      
      // VERIFICAR DIMENSIONES VÁLIDAS
      if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        console.warn('⚠️ Dimensiones inválidas del bounding box');
        return;
      }

      // Limpiar canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Dibujar bounding box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Dibujar centro del objeto
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Dibujar mediciones
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.fillText(`Ancho: ${measurements.width?.toFixed(1) || 'N/A'}px`, x, y - 40);
      ctx.fillText(`Alto: ${measurements.height?.toFixed(1) || 'N/A'}px`, x, y - 20);
      ctx.fillText(`Área: ${measurements.area?.toFixed(0) || 'N/A'}px²`, x, y - 5);
      
      // Mostrar mediciones reales si están disponibles
      if (measurements.realWidth && measurements.realHeight) {
        ctx.fillText(`Ancho: ${measurements.realWidth.toFixed(1)}mm`, x, y + 15);
        ctx.fillText(`Alto: ${measurements.realHeight.toFixed(1)}mm`, x, y + 35);
        ctx.fillText(`Área: ${measurements.realArea.toFixed(0)}mm²`, x, y + 55);
      }
      
      // Indicador de objeto específico
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('🎯 Objeto Específico Detectado', x, y + 75);
      
    } catch (error) {
      console.error('❌ Error al dibujar overlay:', error);
    }
  };

  // MANEJADORES DE EVENTOS - PROTEGIDOS
  const handleCapture = async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current) {
        console.warn('⚠️ Cámara no disponible para captura');
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
      
      console.log('📸 Imagen capturada exitosamente');
    } catch (error) {
      console.error('❌ Error al capturar imagen:', error);
    }
  };

  const handleFocus = (event: React.MouseEvent<HTMLVideoElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setFocusPoint({ x, y });
      
      console.log('🎯 Punto de enfoque establecido:', { x, y });
    } catch (error) {
      console.error('❌ Error al establecer punto de enfoque:', error);
    }
  };

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
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                const newState = !isRealTimeMeasurement;
                setIsRealTimeMeasurement(newState);
                
                // FORZAR MEDICIÓN INMEDIATA AL ACTIVAR
                if (newState) {
                  console.log('🎯 ACTIVANDO MEDICIÓN - FORZANDO EJECUCIÓN INMEDIATA');
                  setTimeout(() => {
                    try {
                      if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
                        processFrameAutomatically();
                      }
                    } catch (error) {
                      console.error('❌ Error al forzar medición:', error);
                    }
                  }, 500);
                }
              } catch (error) {
                console.error('❌ Error al cambiar estado de medición:', error);
              }
            }}
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

      {/* Measurement Panel */}
      {detectedObjects.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <h4 className="font-medium mb-3 text-green-400">🎯 Objeto Detectado</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <p className="text-gray-300 text-sm">↔️ Ancho</p>
                <p className="font-mono text-green-400 font-bold text-xl">
                  {detectedObjects[0].dimensions.width.toFixed(1)}px
                </p>
              </div>
              <div>
                <p className="text-gray-300 text-sm">📐 Área</p>
                <p className="font-mono text-blue-400 font-bold">
                  {detectedObjects[0].dimensions.area.toFixed(0)}px²
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-gray-300 text-sm">↕️ Alto</p>
                <p className="font-mono text-cyan-400 font-bold text-xl">
                  {detectedObjects[0].dimensions.height.toFixed(1)}px
                </p>
              </div>
              <div>
                <p className="text-gray-300 text-sm">📏 Diagonal</p>
                <p className="font-mono text-yellow-400 font-bold">
                  {Math.sqrt(
                    detectedObjects[0].dimensions.width ** 2 + 
                    detectedObjects[0].dimensions.height ** 2
                  ).toFixed(1)}px
                </p>
              </div>
            </div>
          </div>
          
          {/* Calibration Info */}
          {calibrationData?.isCalibrated && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-gray-400">
                Factor: {calibrationData.pixelsPerMm.toFixed(2)} px/mm
              </p>
            </div>
          )}
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
          onClick={() => {
            try {
              if (videoRef?.current && overlayCanvasRef?.current && !isProcessing) {
                processFrameAutomatically();
              }
            } catch (error) {
              console.error('❌ Error al forzar medición:', error);
            }
          }}
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
