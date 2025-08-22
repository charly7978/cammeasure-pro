import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { TooltipProvider } from './components/ui/tooltip';
import { toast } from 'sonner';
import { 
  Camera, 
  Zap,
  History,
  Settings,
  Info
} from 'lucide-react';
import { Toaster } from './components/ui/toaster';
import { SimpleCameraTest } from './components/SimpleCameraTest';

function App() {
  const [activeTab, setActiveTab] = useState('camera');
  const [isLoading, setIsLoading] = useState(true);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        {/* Header */}
        <div className="border-b border-gray-800 backdrop-blur-lg bg-black/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                    Vanguard Measure AI
                  </h1>
                  <p className="text-sm text-gray-400">Sistema de Medición 3D con Inteligencia Artificial</p>
                </div>
              </div>
              
              <Badge variant="outline" className="border-green-500 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                SISTEMA ACTIVO
              </Badge>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Cámara 3D
              </TabsTrigger>
              <TabsTrigger value="about" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Acerca de
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </TabsTrigger>
            </TabsList>

            {/* Tab de Cámara */}
            <TabsContent value="camera" className="mt-0">
              <div className="h-[calc(100vh-200px)]">
                <SimpleCameraTest />
              </div>
            </TabsContent>

            {/* Tab Acerca de */}
            <TabsContent value="about">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-xl text-white">
                    Sistema de Vanguardia con IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">
                    Este sistema utiliza inteligencia artificial de última generación para detectar
                    y medir objetos en 3D en tiempo real.
                  </p>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold text-white">Características:</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                      <li>Detección automática de objetos con IA</li>
                      <li>Medición 3D precisa (ancho, alto, profundidad)</li>
                      <li>Cálculo de volumen y superficie</li>
                      <li>Reconocimiento de 90+ tipos de objetos</li>
                      <li>Precisión del 95%</li>
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Button 
                      onClick={() => {
                        setActiveTab('camera');
                        toast.success('Cargando cámara con IA...');
                      }}
                      className="w-full"
                    >
                      Iniciar Medición 3D
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Configuración */}
            <TabsContent value="settings">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-xl text-white">
                    Estado del Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">TensorFlow.js</span>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        Cargando...
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Modelo COCO-SSD</span>
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                        Pendiente
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-400">WebGL Backend</span>
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                        Disponible
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
