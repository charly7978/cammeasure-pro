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
import { PrecisionAnalysisPanel } from '@/components/PrecisionAnalysisPanel';
import { useDeviceSensors } from '@/hooks/useDeviceSensors';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';
import { AdvancedExportSystem } from '@/lib/advancedExport';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'calibration' | 'measurements' | 'analysis'>('camera');
  const { calibration, setCalibration, autoCalibrate, getRecommendations } = useCalibration();
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<DetectedObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  const [showPrecisionAnalysis, setShowPrecisionAnalysis] = useState(false);
  const [exportSystem] = useState(() => new AdvancedExportSystem());
  
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
      description: "Imagen lista para análisis y medición"
    });
  };

  const handleCalibrationChange = (data: CalibrationData) => {
    setCalibration(data);
    
    if (data.isCalibrated) {
      toast({
        title: "Sistema calibrado",
        description: "Las mediciones ahora serán más precisas"
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
        description: "Los datos han sido guardados localmente"
      });
    }
  };

  const handleExport = async () => {
    if (measurementResult || realTimeObjects.length > 0) {
      try {
        // Crear reporte profesional
        const report = exportSystem.createMeasurementReport(
          measurementResult || {
            distance2D: realTimeObjects[0]?.dimensions.width || 0,
            unit: realTimeObjects[0]?.dimensions.unit || 'mm',
            mode: measurementMode,
            confidence: realTimeObjects[0]?.confidence || 0.8
          },
          realTimeObjects[0]?.precision || {
            accuracy: 0.8,
            precision: 0.8,
            stability: 0.8,
            errorEstimate: 1.0,
            qualityScore: 80
          },
          calibration,
          {
            lightingCondition: 'medium',
            stabilityScore: 0.8,
            distanceToObject: 30,
            cameraAngle: 0,
            deviceInfo: sensorData?.deviceInfo
          },
          capturedImage,
          `Medición ${measurementMode.toUpperCase()} - ${new Date().toLocaleString()}`,
          [measurementMode, 'professional']
        );

        // Exportar en formato JSON profesional
        const exportOptions = {
          format: 'json' as const,
          includeImages: true,
          includeMetadata: true,
          includePrecisionAnalysis: true,
          compression: false
        };

        const blob = await exportSystem.exportReports(exportOptions);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `professional-measurement-${measurementMode}-${Date.now()}.json`;
        a.click();
        
        toast({
          title: "Reporte Profesional Exportado",
          description: "Archivo con análisis completo descargado"
        });
      } catch (error) {
        console.error('Export error:', error);
        toast({
          title: "Error en Exportación",
          description: "No se pudo generar el reporte profesional",
          variant: "destructive"
        });
      }
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

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="grid lg:grid-cols-5 gap-6 xl:gap-8 h-full">
        
        {/* Columna Principal (Izquierda) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-primary rounded-lg shadow-measurement">
                <Ruler className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  CamMeasure Pro
                </h1>
                <p className="text-muted-foreground hidden sm:block">
                  Medición en tiempo real con visión computacional
                </p>
              </div>
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
              <Badge 
                variant={isOpenCVLoaded ? "default" : "secondary"}
                className={isOpenCVLoaded ? "bg-measurement-active text-background" : ""}
              >
                <Cpu className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">OpenCV</span> {isOpenCVLoaded ? 'On' : 'Off'}
              </Badge>
              
              <Badge 
                variant={calibration?.isCalibrated ? "default" : "secondary"}
                className={calibration?.isCalibrated ? "bg-calibration text-background" : ""}
              >
                <Target className="w-3 h-3 mr-1" />
                {calibration?.isCalibrated ? 'Calibrado' : 'Sin Calibrar'}
              </Badge>
            </div>
          </div>

          {/* Real-time Measurement Info */}
          {realTimeObjects.length > 0 && (
            <Card className="p-4 bg-gradient-measurement border-measurement-active/30 shadow-active">
              <h3 className="font-semibold text-measurement-active mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Medición en Tiempo Real
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {realTimeObjects.slice(0, 1).map((obj) => (
                  <div key={obj.id} className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">↔️ Ancho</p>
                        <p className="font-mono text-measurement-active font-bold text-lg">
                          {formatDimension(obj.dimensions.width)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">↕️ Alto</p>
                        <p className="font-mono text-accent font-bold text-lg">
                          {formatDimension(obj.dimensions.height)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">📐 Área</p>
                        <p className="font-mono text-primary font-bold">
                          {formatArea(obj.dimensions.area)}
                        </p>
                      </div>
                       <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">📏 Diagonal</p>
                        <p className="font-mono text-calibration font-bold">
                          {formatDimension(Math.sqrt(obj.dimensions.width ** 2 + obj.dimensions.height ** 2))}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/20">
                      <span className="text-xs text-muted-foreground">
                        Confianza: {(obj.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Factor: {calibration?.pixelsPerMm.toFixed(1)} px/mm
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Vista de Cámara y Medición */}
          <Card className="p-4 h-[80vh] flex flex-col">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-grow flex flex-col">
              <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
                <TabsTrigger value="camera" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Camera className="w-4 h-4 mr-2" />Cámara
                </TabsTrigger>
                <TabsTrigger value="measurements" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                  <Ruler className="w-4 h-4 mr-2" />Análisis
                </TabsTrigger>
                <TabsTrigger value="calibration" className="data-[state=active]:bg-calibration data-[state=active]:text-background">
                  <Target className="w-4 h-4 mr-2" />Calibración
                </TabsTrigger>
                <TabsTrigger value="analysis" className="data-[state=active]:bg-measurement-active data-[state=active]:text-background">
                  <Settings className="w-4 h-4 mr-2" />Precisión
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 flex-grow">
                <TabsContent value="camera" className="h-full">
                  <CameraView
                    onImageCapture={handleImageCapture}
                    isActive={activeTab === 'camera'}
                    calibrationData={calibration}
                    onRealTimeObjects={handleRealTimeObjects}
                  />
                </TabsContent>
                <TabsContent value="measurements" className="h-full space-y-4">
                  {capturedImage ? (
                    <MeasurementEngine
                      imageData={capturedImage}
                      calibrationData={calibration}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                      measurementMode={measurementMode}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                      <Camera className="w-12 h-12 mb-4" />
                      <h3 className="text-lg font-semibold">Sin imagen para analizar</h3>
                      <p>Captura una imagen desde la pestaña "Cámara".</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="calibration" className="h-full">
                   <CalibrationPanel
                      onCalibrationChange={handleCalibrationChange}
                      deviceInfo={sensorData?.deviceInfo}
                    />
                </TabsContent>
                <TabsContent value="analysis" className="h-full">
                  <PrecisionAnalysisPanel
                    isVisible={activeTab === 'analysis'}
                    currentMeasurement={
                      measurementResult ? {
                        value: measurementResult.distance2D,
                        confidence: measurementResult.confidence
                      } : realTimeObjects.length > 0 ? {
                        value: Math.max(realTimeObjects[0].dimensions.width, realTimeObjects[0].dimensions.height),
                        confidence: realTimeObjects[0].confidence
                      } : undefined
                    }
                    imageData={capturedImage}
                    detectedObjects={realTimeObjects}
                    calibrationData={calibration}
                    onRecommendationClick={(recommendation) => {
                      toast({
                        title: "Recomendación",
                        description: recommendation
                      });
                    }}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>

        {/* Columna Lateral (Derecha) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Controles de Medición */}
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

          {/* Auto-Calibración Profesional */}
          <Card className="p-4">
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-calibration" />
                Calibración Profesional
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={autoCalibrate}
                  variant="outline"
                  size="sm"
                  className="border-calibration text-calibration hover:bg-calibration hover:text-background"
                >
                  🤖 Auto-Calibrar Dispositivo
                </Button>
                <Button
                  onClick={() => setActiveTab('analysis')}
                  variant="outline"
                  size="sm"
                  className="border-measurement-active text-measurement-active hover:bg-measurement-active hover:text-background"
                >
                  📊 Ver Análisis de Precisión
                </Button>
              </div>
              
              {/* Recomendaciones */}
              {getRecommendations().length > 0 && (
                <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                  <p className="text-xs font-medium text-amber-600 mb-1">💡 Recomendaciones:</p>
                  <ul className="text-xs text-amber-600 space-y-1">
                    {getRecommendations().slice(0, 2).map((rec, i) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {/* Sensor Data */}
          {sensorData && (
            <Card className="p-4 bg-secondary/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Datos del Sensor
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Aceleración (m/s²)</p>
                  <p className="font-mono">X: {sensorData.acceleration.x?.toFixed(2)}</p>
                  <p className="font-mono">Y: {sensorData.acceleration.y?.toFixed(2)}</p>
                  <p className="font-mono">Z: {sensorData.acceleration.z?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Orientación (°)</p>
                  <p className="font-mono">α: {sensorData.rotation.alpha?.toFixed(1)}</p>
                  <p className="font-mono">β: {sensorData.rotation.beta?.toFixed(1)}</p>
                  <p className="font-mono">γ: {sensorData.rotation.gamma?.toFixed(1)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Instrucciones */}
          {realTimeObjects.length === 0 && (
             <Card className="p-4">
                <h4 className="font-medium mb-2 text-primary">🎯 Instrucciones</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Apunta la cámara al objeto a medir.</li>
                  <li>• La app detectará el objeto principal.</li>
                  <li>• Las medidas aparecerán en tiempo real.</li>
                  <li>• Para mayor precisión, usa la pestaña "Calibración".</li>
                </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
