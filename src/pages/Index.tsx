import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
// import { toast } from '@/hooks/use-toast';
import { 
  Camera, 
  Target, 
  Ruler,
  Smartphone,
  Cpu,
  Triangle
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { MultiCameraView } from '@/components/MultiCameraView';
import { CalibrationPanel, type CalibrationData } from '@/components/CalibrationPanel';
import { MeasurementControls, type MeasurementMode } from '@/components/MeasurementControls';
import { MeasurementEngine, type MeasurementResult, type MeasurementPoint } from '@/components/MeasurementEngine';
import RealTimeMeasurement from '@/components/RealTimeMeasurement';
import { useDeviceSensors } from '@/hooks/useDeviceSensors';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'multicamera' | 'calibration' | 'measurements'>('camera');
  const { calibration, setCalibration } = useCalibration();
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('3d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<any[]>([]);
  const [lastObjectsTs, setLastObjectsTs] = useState<number>(0);
  const [objectCount, setObjectCount] = useState(0);
  const [stereoObjects, setStereoObjects] = useState<any[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { sensorData, isListening, startListening, stopListening } = useDeviceSensors();
  const { isLoaded: isOpenCVLoaded, error: openCVError } = useOpenCV();

  useEffect(() => {
    startListening();
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (openCVError) {
      console.warn('OpenCV status:', openCVError);
    }
  }, [openCVError]);

  const handleImageCapture = (imageData: ImageData) => {
    setCapturedImage(imageData);
    setActiveTab('measurements');
  };

  const handleStereoCapture = (leftImageData: ImageData, rightImageData: ImageData) => {
    // Enviar al worker si se requiere
    console.log('Stereo capture:', { left: leftImageData, right: rightImageData });
  };

  const handleSingleCapture = (imageData: ImageData, cameraIndex: number) => {
    setCapturedImage(imageData);
    setActiveTab('measurements');
  };

  const handleCalibrationChange = (data: CalibrationData) => {
    setCalibration(data);
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
  };

  const handleDetectedEdges = (edges: MeasurementPoint[]) => {
    setDetectedEdges(edges);
  };

  const handleRealTimeObjects = (objects: any[]) => {
    setRealTimeObjects(objects);
    setLastObjectsTs(Date.now());
    setObjectCount(objects.length);

    if (objects.length > 0) {
      const bestObject = objects[0];
      const result: MeasurementResult = {
        distance2D: Math.max(bestObject.widthMm || 0, bestObject.heightMm || 0),
        area: bestObject.areaMm2 || 0,
        unit: 'mm',
        confidence: bestObject.confidence || 0,
        mode: measurementMode
      };
      setMeasurementResult(result);
    }
  };

  // Suavizar overlay: mantener última detección hasta 1.5s si se corta momentáneamente
  const stableObjects = (() => {
    const AGE_MS = 1500;
    if (realTimeObjects.length > 0) return realTimeObjects;
    if (Date.now() - lastObjectsTs < AGE_MS) return realTimeObjects; // mantenerse vacío si justo se vació
    return [];
  })();

  const handleStereoObjects = (objects: any[]) => {
    setStereoObjects(objects);
    if (objects.length > 0) {
      const best3DObject = objects[0];
      const result: MeasurementResult = {
        distance2D: Math.max(best3DObject.dimensions?.width || 0, best3DObject.dimensions?.height || 0),
        distance3D: best3DObject.dimensions?.depth || 0,
        area: best3DObject.dimensions?.width * best3DObject.dimensions?.height || 0,
        volume: best3DObject.dimensions?.volume || 0,
        unit: 'mm',
        confidence: best3DObject.confidence || 0,
        mode: '3d'
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
    setStereoObjects([]);
    setObjectCount(0);
  };

  const handleSave = () => {
    const dataToSave = {
      realTimeObjects,
      stereoObjects,
      measurementResult,
      measurementMode,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cammeasure_data', JSON.stringify(dataToSave));
  };

  const handleExport = () => {
    const data = {
      realTimeObjects,
      stereoObjects,
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
  };

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

  const formatVolume = (value: number): string => {
    if (value < 1000) {
      return `${Math.round(value)}mm³`;
    } else if (value < 1000000) {
      return `${(value / 1000).toFixed(1)}cm³`;
    } else {
      return `${(value / 1000000).toFixed(3)}m³`;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-lg shadow-measurement">
            <Triangle className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              CamMeasure Pro - SISTEMA MULTI-CÁMARA 3D
            </h1>
            <p className="text-muted-foreground">
              Medición 3D avanzada con todas las cámaras traseras disponibles
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
            OpenCV {isOpenCVLoaded ? 'Activo' : 'Básico'}
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
            {calibration?.isCalibrated ? 'Calibrado' : 'Sin Calibrar'}
          </Badge>

          {objectCount > 0 && (
            <Badge 
              variant="outline"
              className="border-measurement-active text-measurement-active"
            >
              <Target className="w-3 h-3 mr-1" />
              🎯 {objectCount} objeto{objectCount !== 1 ? 's' : ''}
            </Badge>
          )}

          {stereoObjects.length > 0 && (
            <Badge 
              variant="outline"
              className="border-accent text-accent"
            >
              <Triangle className="w-3 h-3 mr-1" />
              📐 {stereoObjects.length} objeto{stereoObjects.length !== 1 ? 's' : ''} 3D
            </Badge>
          )}

          <Badge 
            variant="outline"
            className="border-accent text-accent"
          >
            <Ruler className="w-3 h-3 mr-1" />
            Modo: {measurementMode.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Real-time Measurement Info (sin toasts, compacta) */}
      {(realTimeObjects.length > 0 || stereoObjects.length > 0) && (
        <Card className="p-4 bg-gradient-measurement border-measurement-active/30">
          <h3 className="font-semibold text-measurement-active mb-3 flex items-center gap-2">
            <Triangle className="w-4 h-4" />
            Medición 3D en Tiempo Real ({measurementMode.toUpperCase()})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {(stereoObjects.length > 0 ? stereoObjects : realTimeObjects).slice(0, 1).map((obj) => (
              <div key={obj.id} className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">↔️ Ancho</p>
                  <p className="font-mono text-measurement-active font-bold">
                    {formatDimension(obj.dimensions?.width || obj.widthMm || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">↕️ Alto</p>
                  <p className="font-mono text-accent font-bold">
                    {formatDimension(obj.dimensions?.height || obj.heightMm || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {stereoObjects.length > 0 ? '📏 Profundidad' : '📐 Área'}
                  </p>
                  <p className="font-mono text-primary font-bold">
                    {stereoObjects.length > 0 
                      ? formatDimension(obj.dimensions?.depth || 0)
                      : formatArea(obj.areaMm2 || 0)
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4 bg-card border border-border">
          <TabsTrigger value="camera" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Camera className="w-4 h-4 mr-2" />
            Cámara
          </TabsTrigger>
          <TabsTrigger value="multicamera" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            <Triangle className="w-4 h-4 mr-2" />
            Multi-Cámara
          </TabsTrigger>
          <TabsTrigger value="calibration" className="data-[state=active]:bg-calibration data-[state=active]:text-background">
            <Target className="w-4 h-4 mr-2" />
            Calibración
          </TabsTrigger>
          <TabsTrigger value="measurements" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            <Ruler className="w-4 h-4 mr-2" />
            Mediciones
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="camera" className="space-y-4">
            <CameraView
              onImageCapture={handleImageCapture}
              isActive={activeTab === 'camera'}
              calibrationData={calibration}
              objects={stableObjects}
              externalVideoRef={videoRef}
            />
            <RealTimeMeasurement
              videoRef={videoRef}
              isActive={activeTab === 'camera'}
              onObjectsDetected={handleRealTimeObjects}
            />
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h4 className="font-medium mb-2 text-primary">🎯 Instrucciones Cámara Única</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Apunta la cámara hacia el objeto que quieres medir</li>
                <li>• Las dimensiones aparecerán en tiempo real en mm/cm/m</li>
                <li>• Para mediciones 3D, usa el modo Multi-Cámara</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="multicamera" className="space-y-4">
            <MultiCameraView
              onStereoCapture={handleStereoCapture}
              onSingleCapture={handleSingleCapture}
              isActive={activeTab === 'multicamera'}
              calibrationData={calibration}
            />
            <Card className="p-4 bg-accent/5 border-accent/20">
              <h4 className="font-medium mb-2 text-accent">📐 Instrucciones Multi-Cámara 3D</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• El sistema detecta automáticamente todas las cámaras disponibles</li>
                <li>• Se crean pares estéreo automáticamente para medición 3D</li>
                <li>• Calibra los pares estéreo para mediciones 3D precisas</li>
                <li>• Usa "Capturar Estéreo" para obtener datos 3D completos</li>
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
                    <h4 className="font-medium mb-3">Análisis Detallado - Modo {measurementMode.toUpperCase()}</h4>
                    <MeasurementEngine
                      imageData={capturedImage}
                      calibrationData={calibration}
                      onMeasurementResult={handleMeasurementResult}
                      onDetectedEdges={handleDetectedEdges}
                      measurementMode={measurementMode}
                    />
                  </Card>
                )}

                {!capturedImage && realTimeObjects.length === 0 && stereoObjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sin datos de medición</h3>
                    <p className="text-muted-foreground">Vaya a la pestaña de Multi-Cámara para ver mediciones 3D en tiempo real</p>
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
