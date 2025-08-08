import { useState, useEffect } from 'react';
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
  Layers,
  Move3D
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { CalibrationPanel, type CalibrationData } from '@/components/CalibrationPanel';
import { MeasurementControls, type MeasurementMode } from '@/components/MeasurementControls';
import { MeasurementEngine, type MeasurementResult, type MeasurementPoint } from '@/components/MeasurementEngine';
import { type AdvancedDetectedObject } from '@/components/AdvancedMeasurementSystem';
import { useDeviceSensors } from '@/hooks/useDeviceSensors';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'calibration' | 'measurements'>('camera');
  const { calibration, setCalibration } = useCalibration();
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<AdvancedDetectedObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  
  const { sensorData, isListening, startListening, stopListening } = useDeviceSensors();
  const { isLoaded: isOpenCVLoaded, error: openCVError } = useOpenCV();

  useEffect(() => {
    // Start sensor monitoring
    startListening();
    
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    // Solo log del error, no mostrar toast molesto
    if (openCVError) {
      console.warn('OpenCV status:', openCVError);
    }
  }, [openCVError]);

  const handleImageCapture = (imageData: ImageData) => {
    setCapturedImage(imageData);
    setActiveTab('measurements');
    
    toast({
      title: "Imagen capturada",
      description: "Imagen lista para análisis y medición avanzada"
    });
  };

  const handleCalibrationChange = (data: CalibrationData) => {
    setCalibration(data);
    
    if (data.isCalibrated) {
      toast({
        title: "Sistema calibrado",
        description: "Las mediciones 3D ahora serán más precisas"
      });
    }
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
    
    const modeText = result.mode ? ` (${result.mode.toUpperCase()})` : '';
    toast({
      title: `Medición completada${modeText}`,
      description: `Distancia: ${formatDimension(result.distance2D)}`
    });
  };

  const handleDetectedEdges = (edges: MeasurementPoint[]) => {
    setDetectedEdges(edges);
  };

  const handleRealTimeObjects = (objects: AdvancedDetectedObject[]) => {
    setRealTimeObjects(objects);
    setObjectCount(objects.length);
    
    // Auto-generate measurement result from the best object
    if (objects.length > 0) {
      const bestObject = objects[0]; // Ya viene ordenado por calidad
      
      const result: MeasurementResult = {
        distance2D: Math.max(bestObject.dimensions.width, bestObject.dimensions.height),
        area: bestObject.dimensions.area,
        unit: bestObject.dimensions.unit,
        confidence: bestObject.confidence,
        mode: measurementMode
      };
      
      setMeasurementResult(result);
    }
  };

  const handleCapture = async () => {
    // Manually capture an image for detailed analysis
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
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('cammeasure_data', JSON.stringify(dataToSave));
      
      toast({
        title: "Medición guardada",
        description: "Los datos 3D han sido guardados localmente"
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
      a.download = `measurement-3d-${measurementMode}-${Date.now()}.json`;
      a.click();
      
      toast({
        title: "Datos exportados",
        description: "Archivo de medición 3D descargado"
      });
    }
  };

  // Función para formatear dimensiones con unidades inteligentes
  const formatDimension = (value: number): string => {
    // Siempre asumir que el valor viene en mm
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

  const formatArea = (value: number): string => {
    // Área en mm²
    if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(3)}m²`;
    }
  };

  const formatVolume = (value: number): string => {
    // Volumen en mm³
    if (value < 1000) {
      return `${Math.round(value)}mm³`;
    } else if (value < 1000000) {
      return `${(value / 1000).toFixed(1)}cm³`;
    } else {
      return `${(value / 1000000000).toFixed(3)}m³`;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-lg shadow-measurement">
            <Move3D className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              CamMeasure Pro 3D
            </h1>
            <p className="text-muted-foreground">
              Medición 3D avanzada con algoritmos matemáticos complejos
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Badge 
            variant={isOpenCVLoaded ? "default" : "secondary"}
            className={isOpenCVLoaded ? "bg-measurement-active text-background" : ""}
          >
            <Cpu className="w-3 h-3 mr-1" />
            Motor Matemático {isOpenCVLoaded ? 'Activo' : 'Nativo'}
          </Badge>
          
          <Badge 
            variant={isListening ? "default" : "secondary"}
            className={isListening ? "bg-primary text-primary-foreground" : ""}
          >
            <Smartphone className="w-3 h-3 mr-1" />
            Sensores {isListening ? 'Activos' : 'Inactivos'}
          </Badge>
          
          <Badge 
            variant={calibration?.isCalibrated ? "default" : "secondary"}
            className={calibration?.isCalibrated ? "bg-calibration text-background" : ""}
          >
            <Target className="w-3 h-3 mr-1" />
            {calibration?.isCalibrated ? 'Calibrado 3D' : 'Sin Calibrar'}
          </Badge>

          {objectCount > 0 && (
            <Badge 
              variant="outline"
              className="border-measurement-active text-measurement-active animate-measurement-pulse"
            >
              <Layers className="w-3 h-3 mr-1" />
              🎯 Objeto 3D detectado
            </Badge>
          )}

          {/* Measurement Mode Indicator */}
          <Badge 
            variant="outline"
            className="border-accent text-accent"
          >
            <Move3D className="w-3 h-3 mr-1" />
            Modo: {measurementMode.toUpperCase()} 3D
          </Badge>
        </div>
      </div>

      {/* Real-time 3D Measurement Info */}
      {realTimeObjects.length > 0 && (
        <Card className="p-4 bg-gradient-measurement border-measurement-active/30 shadow-active">
          <h3 className="font-semibold text-measurement-active mb-3 flex items-center gap-2">
            <Move3D className="w-4 h-4" />
            🎯 Medición 3D en Tiempo Real ({measurementMode.toUpperCase()})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {realTimeObjects.slice(0, 1).map((obj, index) => (
              <div key={obj.id} className="space-y-2">
                <p className="text-sm font-bold text-measurement-active">🎯 Mejor Objeto 3D Detectado</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">↔️ Ancho</p>
                    <p className="font-mono text-measurement-active font-bold">
                      {formatDimension(obj.dimensions.width)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">↕️ Alto</p>
                    <p className="font-mono text-accent font-bold">
                      {formatDimension(obj.dimensions.height)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">🔄 Profundidad</p>
                    <p className="font-mono text-calibration font-bold">
                      {formatDimension(obj.dimensions.depth)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">📦 Volumen</p>
                    <p className="font-mono text-primary font-bold">
                      {formatVolume(obj.dimensions.volume)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-white/20">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">📐 Área</p>
                    <p className="font-mono text-primary font-bold">
                      {formatArea(obj.dimensions.area)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">📏 Distancia</p>
                    <p className="font-mono text-depth-far font-bold">
                      {formatDimension(obj.position3D.distanceFromCamera)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">�� Método</p>
                    <p className="font-mono text-accent font-bold uppercase">
                      {obj.method}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/20">
                  <span className="text-xs text-muted-foreground">
                    Confianza: {(obj.confidence * 100).toFixed(0)}% | Error: {obj.accuracy.reprojectionError.toFixed(1)}px
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Incertidumbre: ±{obj.accuracy.measurementUncertainty.toFixed(1)}mm
                  </span>
                </div>
              </div>
            ))}
          </div>
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
            Cámara 3D
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
            <Move3D className="w-4 h-4 mr-2" />
            Mediciones 3D
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="camera" className="space-y-4">
            <CameraView
              onImageCapture={handleImageCapture}
              isActive={activeTab === 'camera'}
              calibrationData={calibration}
              onRealTimeObjects={handleRealTimeObjects}
            />
            
            {/* Quick Instructions */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h4 className="font-medium mb-2 text-primary flex items-center gap-2">
                <Move3D className="w-4 h-4" />
                🎯 Instrucciones de Medición 3D Avanzada
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• El sistema usa algoritmos matemáticos complejos para medición 3D real</li>
                <li>• Apunta la cámara hacia el objeto manteniendo 20-40cm de distancia</li>
                <li>• Las dimensiones 3D (ancho, alto, profundidad, volumen) aparecen en tiempo real</li>
                <li>• El sistema calcula automáticamente la distancia al objeto</li>
                <li>• Usa geometría proyectiva y triangulación para mediciones precisas</li>
                <li>• Para máxima precisión, calibra el sistema en la pestaña "Calibración"</li>
                <li>• Los algoritmos incluyen corrección de perspectiva y análisis de incertidumbre</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="calibration" className="space-y-4">
            <CalibrationPanel
              onCalibrationChange={handleCalibrationChange}
              deviceInfo={sensorData?.deviceInfo}
            />
            
            {sensorData && sensorData.acceleration && sensorData.rotation && (
              <Card className="p-4 bg-secondary/30">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Datos del Sensor para Calibración 3D
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Aceleración</p>
                    <p className="font-mono">
                      X: {sensorData.acceleration.x?.toFixed(2) || '0.00'}m/s²
                    </p>
                    <p className="font-mono">
                      Y: {sensorData.acceleration.y?.toFixed(2) || '0.00'}m/s²
                    </p>
                    <p className="font-mono">
                      Z: {sensorData.acceleration.z?.toFixed(2) || '0.00'}m/s²
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Orientación</p>
                    <p className="font-mono">
                      α: {sensorData.rotation.alpha?.toFixed(1) || '0.0'}°
                    </p>
                    <p className="font-mono">
                      β: {sensorData.rotation.beta?.toFixed(1) || '0.0'}°
                    </p>
                    <p className="font-mono">
                      γ: {sensorData.rotation.gamma?.toFixed(1) || '0.0'}°
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {capturedImage && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Move3D className="w-4 h-4" />
                      Análisis 3D Detallado - Modo {measurementMode.toUpperCase()}
                    </h4>
                    <MeasurementEngine
                      imageData={capturedImage}
                      calibrationData={calibration}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                      measurementMode={measurementMode}
                    />
                  </Card>
                )}
                
                {!capturedImage && realTimeObjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <Move3D className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin datos de medición 3D</h3>
                    <p className="text-muted-foreground">
                      Vaya a la pestaña de cámara para ver mediciones 3D en tiempo real
                    </p>
                  </Card>
                )}

                {realTimeObjects.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Move3D className="w-4 h-4" />
                      🎯 Objeto 3D Detectado en Tiempo Real
                    </h4>
                    <div className="space-y-3">
                      {realTimeObjects.slice(0, 1).map((obj, index) => (
                        <div key={obj.id} className="p-4 bg-measurement-active/10 border border-measurement-active/30 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <h5 className="text-lg font-bold text-measurement-active flex items-center gap-2">
                              <Move3D className="w-5 h-5" />
                              🎯 Mejor Objeto 3D
                            </h5>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-sm border-measurement-active text-measurement-active">
                                {(obj.confidence * 100).toFixed(0)}% confianza
                              </Badge>
                              <Badge variant="outline" className="text-sm border-accent text-accent uppercase">
                                {obj.method}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div>
                                <p className="text-muted-foreground">↔️ Ancho</p>
                                <p className="font-mono text-measurement-active font-bold text-lg">
                                  {formatDimension(obj.dimensions.width)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">🔄 Profundidad</p>
                                <p className="font-mono text-calibration font-bold text-lg">
                                  {formatDimension(obj.dimensions.depth)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">📐 Área</p>
                                <p className="font-mono text-primary font-bold">
                                  {formatArea(obj.dimensions.area)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-muted-foreground">↕️ Alto</p>
                                <p className="font-mono text-accent font-bold text-lg">
                                  {formatDimension(obj.dimensions.height)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">📦 Volumen</p>
                                <p className="font-mono text-primary font-bold text-lg">
                                  {formatVolume(obj.dimensions.volume)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">📏 Distancia</p>
                                <p className="font-mono text-depth-far font-bold">
                                  {formatDimension(obj.position3D.distanceFromCamera)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-muted-foreground">Error Reproyección</p>
                                <p className="font-mono text-yellow-500">{obj.accuracy.reprojectionError.toFixed(2)}px</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Incertidumbre</p>
                                <p className="font-mono text-orange-500">±{obj.accuracy.measurementUncertainty.toFixed(1)}mm</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Coordenadas 3D</p>
                                <p className="font-mono text-blue-500">
                                  ({obj.position3D.worldCoordinates.x.toFixed(0)}, {obj.position3D.worldCoordinates.y.toFixed(0)}, {obj.position3D.worldCoordinates.z.toFixed(0)})
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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