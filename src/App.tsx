import React, { useState } from 'react';
import { VanguardCamera } from './components/VanguardCamera';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import { toast } from 'sonner';
import { 
  Camera, 
  Zap,
  History,
  Settings,
  Trash2,
  Download,
  Share2,
  Maximize,
  Info
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('camera');
  const [measurements, setMeasurements] = useState<Record<string, unknown>[]>([]);

  // Manejar nueva medición
  const handleMeasurement = (measurement: Record<string, unknown>) => {
    setMeasurements(prev => [measurement, ...prev]);
  };

  // Limpiar historial
  const clearHistory = () => {
    setMeasurements([]);
    toast.success('Historial limpiado');
  };

  // Exportar mediciones
  const exportMeasurements = () => {
    const data = measurements.map(m => ({
      objeto: m.object.label,
      ancho: `${m.object.dimensions.width.toFixed(1)} ${m.object.dimensions.unit}`,
      alto: `${m.object.dimensions.height.toFixed(1)} ${m.object.dimensions.unit}`,
      profundidad: `${m.object.dimensions.depth.toFixed(1)} ${m.object.dimensions.unit}`,
      volumen: `${m.object.dimensions.volume.toFixed(1)} ${m.object.dimensions.unit}³`,
      superficie: `${m.object.dimensions.surfaceArea.toFixed(1)} ${m.object.dimensions.unit}²`,
      confianza: `${(m.object.confidence * 100).toFixed(0)}%`,
      precision: `${(m.object.dimensions.accuracy * 100).toFixed(0)}%`,
      fecha: new Date(m.timestamp).toLocaleString()
    }));
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediciones_3d_${Date.now()}.json`;
    a.click();
    
    toast.success('Mediciones exportadas');
  };

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
              
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="border-green-500 text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  IA ACTIVA
                </Badge>
                <Badge variant="secondary">
                  {measurements.length} mediciones
                </Badge>
              </div>
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
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </TabsTrigger>
            </TabsList>

            {/* Tab de Cámara */}
            <TabsContent value="camera" className="mt-0">
              <div className="h-[calc(100vh-200px)]">
                <VanguardCamera 
                  isActive={activeTab === 'camera'}
                  onMeasurement={handleMeasurement}
                />
              </div>
            </TabsContent>

            {/* Tab de Historial */}
            <TabsContent value="history">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl text-white">
                    Historial de Mediciones 3D
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportMeasurements}
                      disabled={measurements.length === 0}
                      className="border-gray-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={clearHistory}
                      disabled={measurements.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpiar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {measurements.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Maximize className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay mediciones guardadas</p>
                      <p className="text-sm mt-2">Las mediciones aparecerán aquí</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {measurements.map((m, index) => (
                        <Card key={index} className="bg-gray-800/50 border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                  🤖 {m.object.label}
                                  <Badge className="bg-green-500/20 text-green-400">
                                    {(m.object.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </h3>
                                <p className="text-sm text-gray-400">
                                  {new Date(m.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-blue-500 text-blue-400">
                                Precisión {(m.object.dimensions.accuracy * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Dimensiones</p>
                                <p className="text-sm font-mono font-bold text-white">
                                  {m.object.dimensions.width.toFixed(1)} × {m.object.dimensions.height.toFixed(1)} × {m.object.dimensions.depth.toFixed(1)} {m.object.dimensions.unit}
                                </p>
                              </div>
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Volumen</p>
                                <p className="text-sm font-mono font-bold text-blue-400">
                                  {m.object.dimensions.volume.toFixed(1)} {m.object.dimensions.unit}³
                                </p>
                              </div>
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-400">Superficie</p>
                                <p className="text-sm font-mono font-bold text-green-400">
                                  {m.object.dimensions.surfaceArea.toFixed(1)} {m.object.dimensions.unit}²
                                </p>
                              </div>
                            </div>
                            
                            {m.screenshot && (
                              <img 
                                src={m.screenshot} 
                                alt="Captura" 
                                className="mt-3 rounded-lg w-full h-32 object-cover"
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab de Configuración */}
            <TabsContent value="settings">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-xl text-white">
                    Configuración del Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Acerca del Sistema
                    </h3>
                    
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Modelo de IA</span>
                        <span className="text-white font-mono">COCO-SSD v2</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Backend</span>
                        <span className="text-white font-mono">WebGL (GPU)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Objetos detectables</span>
                        <span className="text-white font-mono">90+ categorías</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Precisión máxima</span>
                        <span className="text-white font-mono">95%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Características</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Detección con Inteligencia Artificial</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Medición 3D (ancho, alto, profundidad)</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Cálculo de volumen y superficie</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Calibración automática por IA</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Realidad Aumentada profesional</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Base de datos de objetos conocidos</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <p className="text-sm text-gray-400 text-center">
                      Sistema de vanguardia con tecnología de última generación
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}

export default App;
