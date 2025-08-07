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
  Cpu
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { CalibrationPanel, type CalibrationData } from '@/components/CalibrationPanel';
import { MeasurementControls, type MeasurementMode } from '@/components/MeasurementControls';
import { MeasurementEngine, type MeasurementResult, type MeasurementPoint } from '@/components/MeasurementEngine';
import { type DetectedObject } from '@/components/RealTimeMeasurement';
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
  const [realTimeObjects, setRealTimeObjects] = useState<DetectedObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  const lastToastRef = useRef<string>('');
  
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
    
    // Prevenir toast duplicado
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
      const toastMessage = "Sistema calibrado";
      if (lastToastRef.current !== toastMessage) {
        lastToastRef.current = toastMessage;
        toast({
          title: toastMessage,
          description: "Mediciones precisas activadas"
        });
      }
    }
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
    
    // No mostrar toast para cada medición en tiempo real
    // Solo para mediciones manuales
    if (capturedImage) {
      const modeText = result.mode ? ` (${result.mode.toUpperCase()})` : '';
      toast({
        title: `Medición completada${modeText}`,
        description: `${formatDimension(result.distance2D)}`
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
  const formatDimension = (value: number): string => {
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
    if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(3)}m²`;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      {/* Header - MÁS COMPACTO */}
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
              Medición en tiempo real
            </p>
          </div>
        </div>

        {/* Status Indicators - MÁS COMPACTOS */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge 
            variant={isOpenCVLoaded ? "default" : "secondary"}
            className={`text-xs ${isOpenCVLoaded ? "bg-measurement-active text-background" : ""}`}
          >
            <Cpu className="w-3 h-3 mr-1" />
            {isOpenCVLoaded ? 'OpenCV' : 'Básico'}
          </Badge>
          
          <Badge 
            variant={calibration?.isCalibrated ? "default" : "secondary"}
            className={`text-xs ${calibration?.isCalibrated ? "bg-calibration text-background" : ""}`}
          >
            <Target className="w-3 h-3 mr-1" />
            {calibration?.isCalibrated ? 'Calibrado' : 'Sin Calibrar'}
          </Badge>

          {objectCount > 0 && (
            <Badge 
              variant="outline"
              className="border-measurement-active text-measurement-active text-xs"
            >
              <Target className="w-3 h-3 mr-1" />
              🎯 Detectado
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

      {/* Panel de información en tiempo real - COLORES MEJORADOS */}
      {realTimeObjects.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
          <h3 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            🎯 Objeto Detectado
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {realTimeObjects.slice(0, 1).map((obj, index) => (
              <div key={obj.id} className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-300">↔️ Ancho</p>
                  <p className="font-mono text-green-400 font-bold text-lg">
                    {formatDimension(obj.dimensions.width)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-300">↕️ Alto</p>
                  <p className="font-mono text-cyan-400 font-bold text-lg">
                    {formatDimension(obj.dimensions.height)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-300">📐 Área</p>
                  <p className="font-mono text-blue-400 font-bold">
                    {formatArea(obj.dimensions.area)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-white/10 mt-3">
            <span className="text-xs text-gray-400">
              Confianza: {realTimeObjects[0] ? (realTimeObjects[0].confidence * 100).toFixed(0) : 0}%
            </span>
            <span className="text-xs text-gray-400">
              Factor: {calibration?.pixelsPerMm.toFixed(1)} px/mm
            </span>
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

        <div className="mt-4">
          <TabsContent value="camera" className="space-y-4">
            {/* CÁMARA AMPLIADA - Ocupa la mayor parte del espacio */}
            <CameraView
              onImageCapture={handleImageCapture}
              isActive={activeTab === 'camera'}
              calibrationData={calibration}
              onRealTimeObjects={handleRealTimeObjects}
            />
            
            {/* Instrucciones compactas */}
            <Card className="p-3 bg-primary/5 border-primary/20">
              <h4 className="font-medium mb-2 text-primary text-sm">🎯 Instrucciones</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Apunta hacia el objeto y mantén centrado</li>
                <li>• Las medidas aparecen automáticamente en mm/cm/m</li>
                <li>• Sistema pre-calibrado para uso inmediato</li>
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
                      calibrationData={calibration}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                      measurementMode={measurementMode}
                    />
                  </Card>
                )}
                
                {!capturedImage && realTimeObjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin datos</h3>
                    <p className="text-muted-foreground">
                      Ve a la cámara para mediciones en tiempo real
                    </p>
                  </Card>
                )}

                {realTimeObjects.length > 0 && (
                  <Card className="p-4 bg-gradient-to-r from-green-900/10 to-blue-900/10 border-green-500/20">
                    <h4 className="font-medium mb-3 text-green-400">🎯 Objeto en Tiempo Real</h4>
                    <div className="space-y-3">
                      {realTimeObjects.slice(0, 1).map((obj, index) => (
                        <div key={obj.id} className="p-4 bg-black/20 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div>
                                <p className="text-gray-300 text-sm">↔️ Ancho</p>
                                <p className="font-mono text-green-400 font-bold text-xl">
                                  {formatDimension(obj.dimensions.width)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-300 text-sm">📐 Área</p>
                                <p className="font-mono text-blue-400 font-bold">
                                  {formatArea(obj.dimensions.area)}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-gray-300 text-sm">↕️ Alto</p>
                                <p className="font-mono text-cyan-400 font-bold text-xl">
                                  {formatDimension(obj.dimensions.height)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-300 text-sm">📏 Diagonal</p>
                                <p className="font-mono text-yellow-400 font-bold">
                                  {formatDimension(Math.sqrt(obj.dimensions.width ** 2 + obj.dimensions.height ** 2))}
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