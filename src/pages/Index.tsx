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
  Cpu
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { CalibrationPanel, type CalibrationData } from '@/components/CalibrationPanel';
import { MeasurementControls, type MeasurementMode } from '@/components/MeasurementControls';
import { MeasurementEngine, type MeasurementResult, type MeasurementPoint } from '@/components/MeasurementEngine';
import { type DetectedObject } from '@/components/RealTimeMeasurement';
import { useDeviceSensors } from '@/hooks/useDeviceSensors';
import { useOpenCV } from '@/hooks/useOpenCV';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'calibration' | 'measurements'>('camera');
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<DetectedObject[]>([]);
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
    if (openCVError) {
      toast({
        title: "Error cargando OpenCV",
        description: "Las funciones avanzadas de medición pueden no estar disponibles",
        variant: "destructive"
      });
    }
  }, [openCVError]);

  const handleImageCapture = (imageData: ImageData) => {
    setCapturedImage(imageData);
    setActiveTab('measurements');
    
    toast({
      title: "Imagen capturada",
      description: "Imagen lista para análisis y medición"
    });
  };

  const handleCalibrationChange = (data: CalibrationData) => {
    setCalibrationData(data);
    
    if (data.isCalibrated) {
      toast({
        title: "Sistema calibrado",
        description: "Las mediciones ahora serán más precisas"
      });
    }
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
    
    toast({
      title: "Medición completada",
      description: `Distancia: ${result.distance2D.toFixed(2)} ${result.unit}`
    });
  };

  const handleDetectedEdges = (edges: MeasurementPoint[]) => {
    setDetectedEdges(edges);
  };

  const handleRealTimeObjects = (objects: DetectedObject[]) => {
    setRealTimeObjects(objects);
    setObjectCount(objects.length);
    
    // Auto-generate measurement result from the best object
    if (objects.length > 0 && calibrationData?.isCalibrated) {
      const bestObject = objects.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      const result: MeasurementResult = {
        distance2D: Math.max(bestObject.dimensions.width, bestObject.dimensions.height),
        area: bestObject.dimensions.area,
        unit: bestObject.dimensions.unit,
        confidence: bestObject.confidence
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
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('cammeasure_data', JSON.stringify(dataToSave));
      
      toast({
        title: "Medición guardada",
        description: "Los datos han sido guardados localmente"
      });
    }
  };

  const handleExport = () => {
    if (measurementResult || realTimeObjects.length > 0) {
      const data = {
        realTimeObjects,
        result: measurementResult,
        calibration: calibrationData,
        timestamp: new Date().toISOString(),
        deviceInfo: sensorData?.deviceInfo
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurement-${Date.now()}.json`;
      a.click();
      
      toast({
        title: "Datos exportados",
        description: "Archivo de medición descargado"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-lg shadow-measurement">
            <Ruler className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              CamMeasure Pro
            </h1>
            <p className="text-muted-foreground">
              Medición en tiempo real con visión computacional
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Badge 
            variant={isOpenCVLoaded ? "default" : "destructive"}
            className={isOpenCVLoaded ? "bg-measurement-active text-background" : ""}
          >
            <Cpu className="w-3 h-3 mr-1" />
            OpenCV {isOpenCVLoaded ? 'Cargado' : 'Cargando...'}
          </Badge>
          
          <Badge 
            variant={isListening ? "default" : "secondary"}
            className={isListening ? "bg-primary text-primary-foreground" : ""}
          >
            <Smartphone className="w-3 h-3 mr-1" />
            Sensores {isListening ? 'Activos' : 'Inactivos'}
          </Badge>
          
          <Badge 
            variant={calibrationData?.isCalibrated ? "default" : "secondary"}
            className={calibrationData?.isCalibrated ? "bg-calibration text-background" : ""}
          >
            <Target className="w-3 h-3 mr-1" />
            {calibrationData?.isCalibrated ? 'Calibrado' : 'Sin Calibrar'}
          </Badge>

          {objectCount > 0 && (
            <Badge 
              variant="outline"
              className="border-measurement-active text-measurement-active animate-measurement-pulse"
            >
              <Target className="w-3 h-3 mr-1" />
              {objectCount} objeto{objectCount !== 1 ? 's' : ''} detectado{objectCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Real-time Measurement Info */}
      {realTimeObjects.length > 0 && calibrationData?.isCalibrated && (
        <Card className="p-4 bg-gradient-measurement border-measurement-active/30 shadow-active">
          <h3 className="font-semibold text-measurement-active mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Medición en Tiempo Real
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {realTimeObjects.slice(0, 2).map((obj, index) => (
              <div key={obj.id} className="space-y-2">
                <p className="text-xs text-muted-foreground">Objeto {index + 1}</p>
                <div className="space-y-1 text-sm">
                  <p className="font-mono text-measurement-active">
                    W: {obj.dimensions.width < 1000 ? 
                      `${obj.dimensions.width.toFixed(1)}${obj.dimensions.unit}` : 
                      `${(obj.dimensions.width/1000).toFixed(2)}m`
                    }
                  </p>
                  <p className="font-mono text-accent">
                    H: {obj.dimensions.height < 1000 ? 
                      `${obj.dimensions.height.toFixed(1)}${obj.dimensions.unit}` : 
                      `${(obj.dimensions.height/1000).toFixed(2)}m`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Conf: {(obj.confidence * 100).toFixed(0)}%
                  </p>
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

        <div className="mt-6">
          <TabsContent value="camera" className="space-y-4">
            <CameraView
              onImageCapture={handleImageCapture}
              isActive={activeTab === 'camera'}
              calibrationData={calibrationData}
              onRealTimeObjects={handleRealTimeObjects}
            />
            
            {/* Quick Instructions */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h4 className="font-medium mb-2 text-primary">🎯 Instrucciones de Uso</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Apunta la cámara hacia el objeto que quieres medir</li>
                <li>• La aplicación detectará automáticamente los objetos</li>
                <li>• Las dimensiones aparecerán en tiempo real sobre la imagen</li>
                <li>• Para mayor precisión, calibra primero en la pestaña "Calibración"</li>
                <li>• El botón ⏸️/▶️ pausa/reanuda la detección automática</li>
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
                  Datos del Sensor
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
                    <h4 className="font-medium mb-3">Análisis Detallado</h4>
                    <MeasurementEngine
                      imageData={capturedImage}
                      calibrationData={calibrationData}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                    />
                  </Card>
                )}
                
                {!capturedImage && realTimeObjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin datos de medición</h3>
                    <p className="text-muted-foreground">
                      Vaya a la pestaña de cámara para ver mediciones en tiempo real
                    </p>
                  </Card>
                )}

                {realTimeObjects.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Objetos Detectados en Tiempo Real</h4>
                    <div className="space-y-3">
                      {realTimeObjects.map((obj, index) => (
                        <div key={obj.id} className="p-3 bg-secondary/30 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="text-sm font-medium">Objeto {index + 1}</h5>
                            <Badge variant="outline" className="text-xs">
                              {(obj.confidence * 100).toFixed(0)}% conf.
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Ancho</p>
                              <p className="font-mono text-measurement-active">
                                {obj.dimensions.width < 1000 ? 
                                  `${obj.dimensions.width.toFixed(1)}${obj.dimensions.unit}` : 
                                  `${(obj.dimensions.width/1000).toFixed(2)}m`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Alto</p>
                              <p className="font-mono text-accent">
                                {obj.dimensions.height < 1000 ? 
                                  `${obj.dimensions.height.toFixed(1)}${obj.dimensions.unit}` : 
                                  `${(obj.dimensions.height/1000).toFixed(2)}m`
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Área</p>
                              <p className="font-mono text-primary">
                                {obj.dimensions.area < 1000000 ? 
                                  `${obj.dimensions.area.toFixed(0)}${obj.dimensions.unit}²` : 
                                  `${(obj.dimensions.area/1000000).toFixed(2)}m²`
                                }
                              </p>
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
                  isCalibrated={calibrationData?.isCalibrated || false}
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