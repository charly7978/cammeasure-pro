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

import { SimpleCameraView } from '@/components/SimpleCameraView';
import { SimpleCalibrationPanel } from '@/components/SimpleCalibrationPanel';
import { SimpleMeasurementEngine } from '@/components/SimpleMeasurementEngine';
import { SimpleMeasurementControls } from '@/components/SimpleMeasurementControls';
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
  const calibrationContext = useCalibration();
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<ImageData | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<MeasurementPoint[]>([]);
  const [realTimeObjects, setRealTimeObjects] = useState<DetectedObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  const lastToastRef = useRef<string>('');
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(true);
  
  const { sensorData, isListening, startListening, stopListening } = useDeviceSensors();
  const { isReady: isOpenCVLoaded, error: openCVError } = useOpenCV();

  // Obtener datos de calibración del contexto
  const calibration = {
    isCalibrated: calibrationContext.isCalibrated(),
    pixelsPerMm: calibrationContext.getPixelsPerMm(),
    confidence: calibrationContext.getCalibrationQuality()
  };

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
    // Actualizar calibración usando el contexto
    if (data.isCalibrated) {
      calibrationContext.loadCalibration(data as any);
      setShowCalibrationWarning(false);
      const toastMessage = "Sistema calibrado";
      if (lastToastRef.current !== toastMessage) {
        lastToastRef.current = toastMessage;
        toast({
          title: toastMessage,
          description: "Medidas precisas habilitadas"
        });
      }
    }
  };

  const handleRealTimeObjects = (objects: DetectedObject[]) => {
    setRealTimeObjects(objects);
    setObjectCount(objects.length);
    
    if (objects.length > 0 && lastToastRef.current !== `Objetos detectados: ${objects.length}`) {
      const toastMessage = `Objetos detectados: ${objects.length}`;
      lastToastRef.current = toastMessage;
      toast({
        title: toastMessage,
        description: "Analizando en tiempo real"
      });
    }
  };

  const handleMeasurementResult = (result: MeasurementResult) => {
    setMeasurementResult(result);
    
    const toastMessage = `Medición completada: ${result.measurements.width.toFixed(1)}x${result.measurements.height.toFixed(1)}mm`;
    if (lastToastRef.current !== toastMessage) {
      lastToastRef.current = toastMessage;
      toast({
        title: toastMessage,
        description: `Confianza: ${(result.confidence * 100).toFixed(0)}%`
      });
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'camera' | 'calibration' | 'measurements');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            📱 CamMeasure Pro
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Sistema Avanzado de Medición por Cámara
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Badge variant="outline" className="border-green-500 text-green-400">
              <Smartphone className="w-4 h-4 mr-2" />
              Sensores Móviles
            </Badge>
            <Badge variant="outline" className="border-blue-500 text-blue-400">
              <Cpu className="w-4 h-4 mr-2" />
              IA Avanzada
            </Badge>
            <Badge variant="outline" className="border-purple-500 text-purple-400">
              <Ruler className="w-4 h-4 mr-2" />
              Precisión MM/CM
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Cámara
            </TabsTrigger>
            <TabsTrigger value="calibration" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Calibración
            </TabsTrigger>
            <TabsTrigger value="measurements" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Mediciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="space-y-6">
            <Card className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  📹 Cámara en Tiempo Real
                </h2>
                <p className="text-gray-300">
                  Detección automática de objetos y mediciones instantáneas
                </p>
              </div>
              
              <SimpleCameraView
                onImageCapture={handleImageCapture}
                isActive={activeTab === 'camera'}
                calibrationData={calibration}
                onRealTimeObjects={handleRealTimeObjects}
              />
            </Card>
          </TabsContent>

          <TabsContent value="calibration" className="space-y-6">
            <Card className="p-6 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  ⚙️ Calibración del Sistema
                </h2>
                <p className="text-gray-300">
                  Configuración precisa para mediciones en unidades reales
                </p>
              </div>
              
              <SimpleCalibrationPanel
                onCalibrationChange={handleCalibrationChange}
                currentCalibration={calibration}
              />
            </Card>
          </TabsContent>

          <TabsContent value="measurements" className="space-y-6">
            <Card className="p-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  📏 Análisis de Mediciones
                </h2>
                <p className="text-gray-300">
                  Procesamiento avanzado de imágenes y análisis detallado
                </p>
              </div>
              
              {capturedImage ? (
                <div className="space-y-6">
                  <SimpleMeasurementEngine
                    imageData={capturedImage}
                    calibrationData={calibration}
                    onResult={handleMeasurementResult}
                  />
                  
                  {measurementResult && (
                    <SimpleMeasurementControls
                      result={measurementResult}
                      mode={measurementMode}
                      onModeChange={(mode: string) => setMeasurementMode(mode as MeasurementMode)}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    Captura una imagen desde la cámara para comenzar el análisis
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center text-gray-400">
          <p className="text-sm">
            Sistema de medición avanzado con IA y sensores móviles
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
