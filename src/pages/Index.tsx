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
  AlertTriangle,
  Box,
  Zap
} from 'lucide-react';

import { CameraView } from '@/components/CameraView';
import { CalibrationPanel } from '@/components/CalibrationPanel';
import { useCalibration } from '@/hooks/useCalibration';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'camera' | 'calibration'>('camera');
  const { calibration, setCalibration } = useCalibration();
  const [showCalibrationWarning, setShowCalibrationWarning] = useState(true);

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

  const handleCalibrationChange = (data: any) => {
    setCalibration(data);
    
    if (data.isCalibrated) {
      setShowCalibrationWarning(false);
      toast({
        title: "Sistema calibrado",
        description: "Medidas precisas habilitadas"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* HEADER PRINCIPAL */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Ruler className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  CamMeasure Pro
                </h1>
                <p className="text-sm text-gray-600">
                  Sistema avanzado de medición por cámara
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* ESTADO DE CALIBRACIÓN */}
              <div className="flex items-center space-x-2">
                {calibration?.isCalibrated ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <Target className="h-3 w-3 mr-1" />
                    Calibrado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Sin Calibrar
                  </Badge>
                )}
              </div>
              
              {/* ESTADO DEL SISTEMA */}
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Cpu className="h-3 w-3 mr-1" />
                Sistema Activo
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="camera" className="flex items-center space-x-2">
              <Camera className="h-4 w-4" />
              <span>Cámara</span>
            </TabsTrigger>
            <TabsTrigger value="calibration" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Calibración</span>
            </TabsTrigger>
          </TabsList>

          {/* PESTAÑA DE CÁMARA */}
          <TabsContent value="camera" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* VISTA PRINCIPAL DE CÁMARA */}
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                      <Camera className="h-5 w-5 text-blue-600" />
                      <span>Vista de Cámara</span>
                    </h2>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Zap className="h-3 w-3 mr-1" />
                      Tiempo Real
                    </Badge>
                  </div>
                  
                  <CameraView />
                </Card>
              </div>

              {/* PANEL DE INFORMACIÓN */}
              <div className="space-y-6">
                {/* ESTADO DEL SISTEMA */}
                <Card className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <Box className="h-5 w-5 text-blue-600" />
                    <span>Estado del Sistema</span>
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Cámara:</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Activa
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Detección:</span>
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        Automática
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Mediciones:</span>
                      <Badge variant="default" className="bg-purple-100 text-purple-800">
                        Avanzadas
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* INSTRUCCIONES */}
                <Card className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <span>Instrucciones</span>
                  </h3>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• <strong>Modo Automático:</strong> Detección continua de objetos</p>
                    <p>• <strong>Modo Manual:</strong> Toca un objeto para medirlo</p>
                    <p>• <strong>Calibración:</strong> Necesaria para medidas precisas</p>
                    <p>• <strong>Resultados:</strong> Se muestran en tiempo real</p>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* PESTAÑA DE CALIBRACIÓN */}
          <TabsContent value="calibration" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-orange-600" />
                  <span>Calibración del Sistema</span>
                </h2>
                
                {calibration?.isCalibrated && (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <Target className="h-3 w-3 mr-1" />
                    Sistema Calibrado
                  </Badge>
                )}
              </div>
              
                             <CalibrationPanel 
                 onCalibrationChange={handleCalibrationChange}
               />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* FOOTER */}
      <div className="bg-gray-50 border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>CamMeasure Pro - Sistema Avanzado de Medición por Cámara</p>
            <p className="mt-1">Algoritmos reales • Mediciones precisas • Arquitectura profesional</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
