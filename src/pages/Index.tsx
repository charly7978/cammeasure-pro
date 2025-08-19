import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Camera, 
  Target, 
  Settings,
  Ruler,
  Smartphone,
  Cpu,
  AlertTriangle,
  Box,
  Zap
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { CalibrationPanel } from '@/components/CalibrationPanel';
import { MeasurementControls } from '@/components/MeasurementControls';
import { MeasurementEngine } from '@/components/MeasurementEngine';
import { useDeviceSensors } from '@/hooks/useDeviceSensors';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';
import { ImmersiveMode } from '@/components/ImmersiveMode';
import { 
  CalibrationData, 
  MeasurementMode, 
  MeasurementResult, 
  MeasurementPoint,
  DetectedObject 
} from '@/lib/types';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'calibration' | 'measurements'>('camera');
  const { calibration, setCalibration } = useCalibration();
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<DetectedObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  const lastToastRef = useRef<string>('');
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(true);
  
  const { sensorData, isListening, startListening, stopListening } = useDeviceSensors();
  const { isLoaded: isOpenCVLoaded, error: openCVError } = useOpenCV();

  useEffect(() => {
    startListening();
    
    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  useEffect(() => {
    if (openCVError) {
      console.warn('OpenCV status:', openCVError);
    }
  }, [openCVError]);

  // Mostrar advertencia de calibración si no está calibrado
  useEffect(() => {
    if (!calibration?.isCalibrated && showCalibrationWarning) {
      const timer = setTimeout(() => {
        toast({
          title: "⚠️ Calibración Requerida",
          description: "Ve a Calibración para medidas precisas en mm/cm"
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [calibration?.isCalibrated, showCalibrationWarning]);

  const handleImageCapture = (imageData: ImageData) => {
    setCapturedImage(imageData);
    setActiveTab('measurements');
    
    const toastMessage = "Imagen capturada";
    if (lastToastRef.current !== toastMessage) {
      lastToastRef.current = toastMessage;
      toast({
        title: toastMessage,
        description: "Lista para análisis"
      });
    }
  };

  const handleCalibrationChange = (data: CalibrationData) => {
    setCalibration(data);
    
    if (data.isCalibrated) {
      setShowCalibrationWarning(false);
      const toastMessage = "Sistema calibrado";
      if (lastToastRef.current !== toastMessage) {
        lastToastRef.current = toastMessage;
        toast({
          title: toastMessage,
          description: `Factor: ${data.pixelsPerMm.toFixed(2)} px/mm`
        });
      }
    }
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
    
    // Solo mostrar toast para mediciones manuales
    if (capturedImage) {
      const modeText = result.mode ? ` (${result.mode.toUpperCase()})` : '';
      toast({
        title: `Medición completada${modeText}`,
        description: `${formatDimension(result.distance2D, result.unit)}`
      });
    }
  };

  const handleDetectedEdges = (edges: MeasurementPoint[]) => {
    setDetectedEdges(edges);
  };

  const handleRealTimeObjects = (objects: DetectedObject[]) => {
    setRealTimeObjects(objects);
    setObjectCount(objects.length);
    
    // Auto-generate measurement result from the best object
    if (objects.length > 0) {
      const bestObject = objects[0];
      
      const result: MeasurementResult = {
        distance2D: Math.max(bestObject.dimensions.width, bestObject.dimensions.height),
        measurements: {
          width: bestObject.dimensions.width,
          height: bestObject.dimensions.height,
          area: bestObject.dimensions.area
        },
        unit: bestObject.dimensions.unit,
        confidence: bestObject.confidence,
        mode: measurementMode,
        points: [],
        timestamp: Date.now()
      };
      
      setMeasurementResult(result);
    }
  };

  const handleCapture = async () => {
    setActiveTab('camera');
  };

  const handleReset = () => {
    setCapturedImage(null);
    setMeasurementResult(null);
    setDetectedEdges([]);
    setRealTimeObjects([]);
    setObjectCount(0);
  };

  const handleSave = () => {
    if (measurementResult || realTimeObjects.length > 0) {
      const dataToSave = {
        realTimeObjects,
        measurementResult,
        measurementMode,
        calibration,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('cammeasure_data', JSON.stringify(dataToSave));
      
      toast({
        title: "Guardado",
        description: "Datos guardados localmente"
      });
    }
  };

  const handleExport = () => {
    if (measurementResult || realTimeObjects.length > 0) {
      const data = {
        realTimeObjects,
        result: measurementResult,
        calibration: calibration,
        measurementMode,
        timestamp: new Date().toISOString(),
        deviceInfo: sensorData?.deviceInfo
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurement-${measurementMode}-${Date.now()}.json`;
      a.click();
      
      toast({
        title: "Exportado",
        description: "Archivo descargado"
      });
    }
  };

  // Función para formatear dimensiones con unidades inteligentes
  const formatDimension = (value: number, unit: string): string => {
    if (unit === 'px') {
      return `${Math.round(value)}px`;
    }
    
    // Para unidades métricas (mm)
    if (value < 10) {
      return `${value.toFixed(1)}mm`;
    } else if (value < 100) {
      return `${value.toFixed(0)}mm`;
    } else if (value < 1000) {
      return `${(value / 10).toFixed(1)}cm`;
    } else {
      return `${(value / 1000).toFixed(2)}m`;
    }
  };

  const formatArea = (value: number, unit: string): string => {
    if (unit === 'px') {
      return `${Math.round(value)}px²`;
    }
    
    // Para áreas métricas
    if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(3)}m²`;
    }
  };

  const formatVolume = (value: number): string => {
    if (value < 1000) {
      return `${Math.round(value)}mm³`;
    } else if (value < 1000000) {
      return `${(value / 1000).toFixed(1)}cm³`;
    } else {
      return `${(value / 1000000).toFixed(3)}m³`;
    }
  };

  // Verificar si un objeto tiene mediciones 3D estimadas
  const hasEstimated3D = (obj: DetectedObject): boolean => {
    return !!(obj.isReal3D && obj.measurements3D);
  };

  // Obtener mediciones 3D de un objeto
  const get3DMeasurements = (obj: DetectedObject) => {
    return obj.measurements3D || null;
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg shadow-measurement">
            <Ruler className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              CamMeasure Pro
            </h1>
            <p className="text-sm text-muted-foreground">
              Medición optimizada en tiempo real
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge 
            variant="default"
            className="text-xs bg-green-500 text-white"
          >
            <Zap className="w-3 h-3 mr-1" />
            OPTIMIZADO
          </Badge>
          
          <Badge 
            variant={calibration?.isCalibrated ? "default" : "destructive"}
            className={`text-xs ${calibration?.isCalibrated ? "bg-calibration text-background" : ""}`}
          >
            <Target className="w-3 h-3 mr-1" />
            {calibration?.isCalibrated ? 'Calibrado' : 'Sin Calibrar'}
          </Badge>

          {objectCount > 0 && (
            <Badge 
              variant="outline"
              className={`text-xs ${
                realTimeObjects[0] && hasEstimated3D(realTimeObjects[0])
                  ? 'border-purple-400 text-purple-400' 
                  : 'border-measurement-active text-measurement-active'
              }`}
            >
              <Target className="w-3 h-3 mr-1" />
              {realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? '🎯 3D ESTIMADO' : '🎯 Detectado'}
            </Badge>
          )}

          <Badge 
            variant="outline"
            className="border-accent text-accent text-xs"
          >
            <Ruler className="w-3 h-3 mr-1" />
            {measurementMode.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Advertencia de calibración */}
      {!calibration?.isCalibrated && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-500">Calibración Requerida para Mediciones Precisas</h3>
              <p className="text-sm text-amber-600">
                Las medidas se muestran en píxeles. Calibra para obtener mediciones precisas en mm/cm/m.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('calibration')}
              className="px-3 py-1 bg-amber-500 text-black rounded text-sm font-medium hover:bg-amber-400"
            >
              Calibrar
            </button>
          </div>
        </Card>
      )}

      {/* Panel de información en tiempo real - OPTIMIZADO */}
      {realTimeObjects.length > 0 && (
        <Card className={`p-4 border ${
          realTimeObjects[0] && hasEstimated3D(realTimeObjects[0])
            ? 'bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30' 
            : 'bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30'
        }`}>
          <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
            realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? 'text-purple-400' : 'text-green-400'
          }`}>
            {realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? <Box className="w-4 h-4" /> : <Target className="w-4 h-4" />}
            {realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? '🎯 OBJETO 3D ESTIMADO' : '🎯 Objeto Detectado'} 
            {!calibration?.isCalibrated && '(en píxeles)'}
          </h3>
          
          {realTimeObjects.slice(0, 1).map((obj, index) => {
            const measurements3D = get3DMeasurements(obj);
            const hasEst3D = hasEstimated3D(obj);
            
            return (
              <div key={obj.id} className="space-y-4">
                {/* Mediciones 2D básicas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300">↔️ Ancho {hasEst3D ? '(2D)' : ''}</p>
                    <p className="font-mono text-green-400 font-bold text-lg">
                      {formatDimension(obj.dimensions.width, obj.dimensions.unit)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300">↕️ Alto {hasEst3D ? '(2D)' : ''}</p>
                    <p className="font-mono text-cyan-400 font-bold text-lg">
                      {formatDimension(obj.dimensions.height, obj.dimensions.unit)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300">📐 Área {hasEst3D ? '(2D)' : ''}</p>
                    <p className="font-mono text-blue-400 font-bold">
                      {formatArea(obj.dimensions.area, obj.dimensions.unit)}
                    </p>
                  </div>
                </div>

                {/* Mediciones 3D ESTIMADAS */}
                {hasEst3D && measurements3D && (
                  <div className="border-t border-purple-400/30 pt-4">
                    <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                      📊 ESTIMACIONES 3D RÁPIDAS
                      <span className="text-xs bg-purple-500/20 px-2 py-1 rounded">ESTIMADO</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">📏 Ancho 3D</p>
                          <p className="font-mono text-purple-300 font-bold text-lg">
                            {formatDimension(measurements3D.width3D, 'mm')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">📐 Alto 3D</p>
                          <p className="font-mono text-purple-300 font-bold text-lg">
                            {formatDimension(measurements3D.height3D, 'mm')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">🔍 Profundidad Est.</p>
                          <p className="font-mono text-orange-400 font-bold text-lg">
                            {formatDimension(measurements3D.depth3D, 'mm')}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">📦 Volumen Est.</p>
                          <p className="font-mono text-yellow-400 font-bold">
                            {formatVolume(measurements3D.volume3D)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">📍 Distancia Est.</p>
                          <p className="font-mono text-green-400 font-bold">
                            {formatDimension(measurements3D.distance, 'mm')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-300">🎯 Confianza</p>
                          <p className="font-mono text-white font-bold">
                            {(measurements3D.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Información del sistema */}
                <div className="flex justify-between items-center pt-3 border-t border-white/10 text-xs text-gray-400">
                  <div className="space-y-1">
                    <div>Confianza: {(obj.confidence * 100).toFixed(0)}%</div>
                    <div>
                      {calibration?.isCalibrated ? 
                        `Factor: ${calibration.pixelsPerMm.toFixed(2)} px/mm` : 
                        'Sin calibrar - medidas en píxeles'
                      }
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={hasEst3D ? 'text-purple-300 font-bold' : ''}>
                      {hasEst3D ? 'Modo: 3D ESTIMADO' : 'Modo: 2D'}
                    </div>
                    <div>{hasEst3D ? 'Estimación rápida' : 'Detección básica'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
          <TabsTrigger 
            value="camera" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Camera className="w-4 h-4 mr-2" />
            Cámara
          </TabsTrigger>
          <TabsTrigger 
            value="calibration"
            className="data-[state=active]:bg-calibration data-[state=active]:text-background"
          >
            <Target className="w-4 h-4 mr-2" />
            Calibración
          </TabsTrigger>
          <TabsTrigger 
            value="measurements"
            className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
          >
            <Ruler className="w-4 h-4 mr-2" />
            Mediciones
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="camera" className="space-y-4">
            <CameraView
              onImageCapture={handleImageCapture}
              isActive={activeTab === 'camera'}
              calibrationData={calibration}
              onRealTimeObjects={handleRealTimeObjects}
            />
            
            {/* Instrucciones */}
            <Card className="p-3 bg-primary/5 border-primary/20">
              <h4 className="font-medium mb-2 text-primary text-sm">🎯 Instrucciones Optimizadas</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Apunta hacia el objeto y mantén centrado</li>
                <li>• {calibration?.isCalibrated ? 
                  'Sistema calibrado: mediciones precisas disponibles' : 
                  'Calibra primero para mediciones precisas (actualmente en píxeles)'
                }</li>
                <li>• Sistema optimizado para rendimiento sin congelación</li>
                <li>• Las estimaciones 3D aparecen automáticamente</li>
                <li>• Procesamiento rápido para mejor experiencia</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="calibration" className="space-y-4">
            <CalibrationPanel
              onCalibrationChange={handleCalibrationChange}
              deviceInfo={sensorData?.deviceInfo}
            />
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {capturedImage && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Análisis - {measurementMode.toUpperCase()}</h4>
                    <MeasurementEngine
                      imageData={capturedImage}
                      isActive={true}
                      measurementMode={measurementMode}
                      calibrationData={calibration}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                      onMeasurementComplete={(measurement) => {
                        console.log('Medición completada:', measurement);
                      }}
                      onError={(error) => {
                        console.error('Error en medición:', error);
                        toast({
                          title: "Error",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />
                  </Card>
                )}
                
                {!capturedImage && realTimeObjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin datos</h3>
                    <p className="text-muted-foreground">
                      Ve a la cámara para mediciones optimizadas en tiempo real
                    </p>
                  </Card>
                )}

                {realTimeObjects.length > 0 && (
                  <Card className={`p-4 ${
                    realTimeObjects[0] && hasEstimated3D(realTimeObjects[0])
                      ? 'bg-gradient-to-r from-purple-900/10 to-blue-900/10 border-purple-500/20' 
                      : 'bg-gradient-to-r from-green-900/10 to-blue-900/10 border-green-500/20'
                  }`}>
                    <h4 className={`font-medium mb-3 ${
                      realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? 'text-purple-400' : 'text-green-400'
                    }`}>
                      {realTimeObjects[0] && hasEstimated3D(realTimeObjects[0]) ? '🎯 Objeto 3D Estimado' : '🎯 Objeto en Tiempo Real'} 
                      {!calibration?.isCalibrated && '(píxeles)'}
                    </h4>
                    <div className="space-y-3">
                      {realTimeObjects.slice(0, 1).map((obj, index) => {
                        const measurements3D = get3DMeasurements(obj);
                        const hasEst3D = hasEstimated3D(obj);
                        
                        return (
                          <div key={obj.id} className="p-4 bg-black/20 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-gray-300 text-sm">↔️ Ancho {hasEst3D ? '(2D)' : ''}</p>
                                  <p className="font-mono text-green-400 font-bold text-xl">
                                    {formatDimension(obj.dimensions.width, obj.dimensions.unit)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-300 text-sm">📐 Área {hasEst3D ? '(2D)' : ''}</p>
                                  <p className="font-mono text-blue-400 font-bold">
                                    {formatArea(obj.dimensions.area, obj.dimensions.unit)}
                                  </p>
                                </div>
                                {hasEst3D && measurements3D && (
                                  <div>
                                    <p className="text-gray-300 text-sm">🔍 Profundidad Est.</p>
                                    <p className="font-mono text-orange-400 font-bold text-xl">
                                      {formatDimension(measurements3D.depth3D, 'mm')}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-gray-300 text-sm">↕️ Alto {hasEst3D ? '(2D)' : ''}</p>
                                  <p className="font-mono text-cyan-400 font-bold text-xl">
                                    {formatDimension(obj.dimensions.height, obj.dimensions.unit)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-300 text-sm">📏 Diagonal</p>
                                  <p className="font-mono text-yellow-400 font-bold">
                                    {formatDimension(
                                      Math.sqrt(obj.dimensions.width ** 2 + obj.dimensions.height ** 2), 
                                      obj.dimensions.unit
                                    )}
                                  </p>
                                </div>
                                {hasEst3D && measurements3D && (
                                  <div>
                                    <p className="text-gray-300 text-sm">📦 Volumen Est.</p>
                                    <p className="font-mono text-yellow-400 font-bold text-xl">
                                      {formatVolume(measurements3D.volume3D)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>

              <div>
                <MeasurementControls
                  measurementMode={measurementMode}
                  onModeChange={setMeasurementMode}
                  measurementResult={measurementResult}
                  isCalibrated={calibration?.isCalibrated || false}
                  onCapture={handleCapture}
                  onReset={handleReset}
                  onSave={handleSave}
                  onExport={handleExport}
                />
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Index;
