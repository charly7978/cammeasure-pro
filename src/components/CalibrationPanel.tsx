import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, CheckCircle, AlertCircle, Camera, Info, X, Plus } from 'lucide-react';
import { CalibrationData } from '@/lib/types';

interface CalibrationPanelProps {
  onCalibrationChange: (data: CalibrationData) => void;
  deviceInfo?: {
    model: string;
    platform: string;
  };
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  onCalibrationChange,
  deviceInfo
}) => {
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({
    focalLength: 4.0,
    sensorSize: 6.17,
    pixelsPerMm: 0, // Empezar en 0 para forzar calibración real
    referenceObjectSize: 25.4, // 1 pulgada en mm
    isCalibrated: false, // Empezar sin calibrar para forzar calibración real
    calibrationMethod: 'manual',
    cameraMatrix: [[1000, 0, 320], [0, 1000, 240], [0, 0, 1]],
    distortionCoefficients: [0, 0, 0, 0, 0],
    imageSize: { width: 640, height: 480 },
    realWorldScale: 1.0
  });

  const [referencePixelLength, setReferencePixelLength] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<{x: number, y: number}[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [calibrationStep, setCalibrationStep] = useState<'setup' | 'measure' | 'calculate' | 'complete'>('setup');
  const [measuredPixels, setMeasuredPixels] = useState<number>(0);
  const [measuredMm, setMeasuredMm] = useState<number>(0);
  const [calibrationHistory, setCalibrationHistory] = useState<Array<{pixels: number, mm: number, ratio: number, date: string}>>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Solo enviar calibración si está realmente calibrada
    if (calibrationData.isCalibrated && calibrationData.pixelsPerMm > 0) {
      onCalibrationChange(calibrationData);
    }
  }, [calibrationData.isCalibrated, calibrationData.pixelsPerMm]);

  useEffect(() => {
    // Auto-detect device specs if possible
    if (deviceInfo) {
      updateDeviceSpecs(deviceInfo);
    }
  }, [deviceInfo]);

  const updateDeviceSpecs = (device: { model: string; platform: string }) => {
    // Base de datos de especificaciones reales de dispositivos
    const deviceSpecs: Record<string, { focalLength: number; sensorSize: number; pixelsPerMm: number }> = {
      'iPhone 13': { focalLength: 5.1, sensorSize: 7.5, pixelsPerMm: 4.2 },
      'iPhone 12': { focalLength: 4.2, sensorSize: 7.0, pixelsPerMm: 4.0 },
      'iPhone 11': { focalLength: 4.25, sensorSize: 6.9, pixelsPerMm: 3.9 },
      'Samsung Galaxy S21': { focalLength: 5.4, sensorSize: 7.2, pixelsPerMm: 4.1 },
      'Samsung Galaxy S20': { focalLength: 4.3, sensorSize: 6.8, pixelsPerMm: 3.8 },
      'Google Pixel 6': { focalLength: 4.38, sensorSize: 7.4, pixelsPerMm: 4.3 },
      'Google Pixel 5': { focalLength: 4.38, sensorSize: 6.17, pixelsPerMm: 3.7 },
      'OnePlus 9': { focalLength: 4.5, sensorSize: 7.1, pixelsPerMm: 4.0 }
    };

    // Buscar coincidencia exacta primero
    let specs = deviceSpecs[device.model];
    
    // Si no hay coincidencia exacta, buscar por marca
    if (!specs) {
      for (const [deviceName, deviceSpec] of Object.entries(deviceSpecs)) {
        if (device.model.toLowerCase().includes(deviceName.toLowerCase().split(' ')[0])) {
          specs = deviceSpec;
          break;
        }
      }
    }

    if (specs) {
      // Solo usar como estimación inicial, NO como calibración completa
      const updatedData = {
        ...calibrationData,
        focalLength: specs.focalLength,
        sensorSize: specs.sensorSize,
        // NO establecer pixelsPerMm ni isCalibrated como true
        // Esto solo sirve como referencia para el usuario
        calibrationMethod: 'auto' as const
      };
      setCalibrationData(updatedData);
      // NO llamar a onCalibrationChange aquí
    }
  };

  const startCameraCalibration = async () => {
    try {
      setIsCalibrating(true);
      setCalibrationStep('setup');
      
      // Solicitar acceso a la cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setCalibrationStep('measure');
      
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
      setIsCalibrating(false);
    }
  };

  const addCalibrationPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (calibrationStep !== 'measure') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setCalibrationPoints(prev => [...prev, { x, y }]);
    
    // Si tenemos 2 puntos, calcular la distancia
    if (calibrationPoints.length === 1) {
      const point1 = calibrationPoints[0];
      const point2 = { x, y };
      
      const pixelDistance = Math.sqrt(
        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
      );
      
      setMeasuredPixels(pixelDistance);
      setCalibrationStep('calculate');
    }
  };

  const calculateCalibration = () => {
    if (measuredPixels <= 0 || measuredMm <= 0) return;
    
    const pixelsPerMm = measuredPixels / measuredMm;
    
    // Agregar a historial
    const newCalibration = {
      pixels: measuredPixels,
      mm: measuredMm,
      ratio: pixelsPerMm,
      date: new Date().toISOString()
    };
    
    setCalibrationHistory(prev => [...prev, newCalibration]);
    
    // Calcular promedio ponderado de todas las calibraciones
    const totalWeight = calibrationHistory.length + 1;
    const weightedSum = calibrationHistory.reduce((sum, cal) => sum + cal.ratio, 0) + pixelsPerMm;
    const averagePixelsPerMm = weightedSum / totalWeight;
    
    // Actualizar datos de calibración
    const updatedCalibration: CalibrationData = {
      ...calibrationData,
      pixelsPerMm: averagePixelsPerMm,
      isCalibrated: true,
      calibrationMethod: 'manual',
      lastCalibrationDate: new Date().toISOString()
    };
    
    setCalibrationData(updatedCalibration);
    onCalibrationChange(updatedCalibration);
    setCalibrationStep('complete');
    setIsCalibrating(false);
  };

  const resetCalibration = () => {
    setCalibrationData(prev => ({
      ...prev,
      pixelsPerMm: 0,
      isCalibrated: false,
      calibrationMethod: 'manual'
    }));
    setCalibrationPoints([]);
    setMeasuredPixels(0);
    setMeasuredMm(0);
    setCalibrationStep('setup');
    setCalibrationHistory([]);
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const clearCalibrationPoint = (index: number) => {
    setCalibrationPoints(prev => prev.filter((_, i) => i !== index));
  };

  const getCalibrationQuality = () => {
    if (calibrationHistory.length === 0) return 'none';
    if (calibrationHistory.length >= 3) return 'excellent';
    if (calibrationHistory.length >= 2) return 'good';
    return 'basic';
  };

  const getCalibrationQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'basic': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Función auxiliar para calcular incertidumbre
  const calculateCalibrationUncertainty = (): number => {
    if (calibrationHistory.length === 0) return 0;
    
    const ratios = calibrationHistory.map(cal => cal.ratio);
    const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
    return Math.sqrt(variance);
  };

  return (
    <div className="space-y-6">
      {/* Header de Calibración */}
      <Card className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-blue-500 rounded-full">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-blue-400">Calibración Real de Cámara</h2>
              <p className="text-blue-300">Mediciones precisas basadas en objetos físicos reales</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <Badge 
              variant="outline" 
              className={`border-blue-400 text-blue-400 ${getCalibrationQualityColor(getCalibrationQuality())}`}
            >
              {getCalibrationQuality() === 'none' ? 'Sin Calibrar' :
               getCalibrationQuality() === 'excellent' ? 'Excelente' :
               getCalibrationQuality() === 'good' ? 'Buena' : 'Básica'}
            </Badge>
            
            {calibrationData.isCalibrated && (
              <Badge variant="default" className="bg-green-500 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Calibrado
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Estado Actual de Calibración */}
      {calibrationData.isCalibrated && (
        <Card className="p-4 bg-green-900/20 border-green-500/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-green-400">Factor de Calibración</Label>
              <p className="text-2xl font-bold text-green-300">
                {calibrationData.pixelsPerMm.toFixed(2)} px/mm
              </p>
            </div>
            <div>
              <Label className="text-green-400">Precisión</Label>
              <p className="text-2xl font-bold text-green-300">
                {calibrationHistory.length > 0 ? 
                  `±${(calculateCalibrationUncertainty() * 100).toFixed(1)}%` : 
                  'N/A'
                }
              </p>
            </div>
            <div>
              <Label className="text-green-400">Método</Label>
              <p className="text-green-300 capitalize">
                {calibrationData.calibrationMethod}
              </p>
            </div>
            <div>
              <Label className="text-green-400">Puntos de Calibración</Label>
              <p className="text-green-300">
                {calibrationHistory.length}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Instrucciones de Calibración */}
      {showInstructions && (
        <Card className="p-4 bg-amber-900/20 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 mt-1 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-400">Instrucciones para Calibración Real</h3>
              <ol className="text-sm text-amber-300 space-y-1 list-decimal list-inside">
                <li>Coloca un objeto de referencia de tamaño conocido (ej: regla, moneda)</li>
                <li>Mide la distancia física real en milímetros</li>
                <li>Captura la imagen y marca dos puntos en los extremos del objeto</li>
                <li>Ingresa la medida real y calcula la calibración</li>
                <li>Repite el proceso para mayor precisión</li>
              </ol>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowInstructions(false)}
                className="mt-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black"
              >
                Entendido
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Proceso de Calibración */}
      {!calibrationData.isCalibrated && (
        <Card className="p-6">
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Calibración Manual Real</h3>
              <p className="text-muted-foreground">
                Mide un objeto físico real para establecer la escala de píxeles a milímetros
              </p>
            </div>

            {/* Paso 1: Configuración */}
            {calibrationStep === 'setup' && (
              <div className="text-center space-y-4">
                <div className="p-4 bg-blue-900/20 rounded-lg">
                  <Camera className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                  <p className="text-blue-300">Preparar cámara para calibración</p>
                </div>
                <Button onClick={startCameraCalibration} className="bg-blue-500 hover:bg-blue-600">
                  <Camera className="w-4 h-4 mr-2" />
                  Iniciar Calibración
                </Button>
              </div>
            )}

            {/* Paso 2: Medición */}
            {calibrationStep === 'measure' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="font-semibold mb-2">Paso 2: Medir Objeto de Referencia</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Haz clic en dos puntos del objeto de referencia para medir la distancia en píxeles
                  </p>
                </div>

                {/* Canvas para captura */}
                <div className="relative border-2 border-dashed border-blue-400 rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="w-full h-64 bg-black cursor-crosshair"
                    onClick={addCalibrationPoint}
                  />
                  
                  {/* Puntos de calibración */}
                  {calibrationPoints.map((point, index) => (
                    <div
                      key={index}
                      className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: point.x, top: point.y }}
                    >
                      <button
                        onClick={() => clearCalibrationPoint(index)}
                        className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Video de cámara */}
                  {cameraStream && (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover opacity-0"
                      autoPlay
                      muted
                      playsInline
                    />
                  )}
                </div>

                {/* Información de puntos */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Puntos marcados: {calibrationPoints.length}/2</Label>
                    <div className="text-sm text-muted-foreground">
                      {calibrationPoints.length === 0 && "Haz clic en el primer punto"}
                      {calibrationPoints.length === 1 && "Haz clic en el segundo punto"}
                      {calibrationPoints.length === 2 && "Puntos completados ✓"}
                    </div>
                  </div>
                  
                  {calibrationPoints.length === 2 && (
                    <div>
                      <Label>Distancia en píxeles: {measuredPixels.toFixed(1)} px</Label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paso 3: Cálculo */}
            {calibrationStep === 'calculate' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="font-semibold mb-2">Paso 3: Ingresar Medida Real</h4>
                  <p className="text-sm text-muted-foreground">
                    Ingresa la medida física real del objeto de referencia
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="measuredPixels">Distancia en píxeles</Label>
                    <Input
                      id="measuredPixels"
                      type="number"
                      value={measuredPixels}
                      onChange={(e) => setMeasuredPixels(Number(e.target.value))}
                      placeholder="0"
                      readOnly
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="measuredMm">Distancia real (mm)</Label>
                    <Input
                      id="measuredMm"
                      type="number"
                      value={measuredMm}
                      onChange={(e) => setMeasuredMm(Number(e.target.value))}
                      placeholder="Ingresa en mm"
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  {measuredMm > 0 && (
                    <div className="p-3 bg-blue-900/20 rounded-lg">
                      <p className="text-blue-300">
                        Factor de calibración calculado: <strong>{(measuredPixels / measuredMm).toFixed(2)} px/mm</strong>
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={calculateCalibration}
                    disabled={measuredMm <= 0}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Calibración
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 4: Completado */}
            {calibrationStep === 'complete' && (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-green-400">¡Calibración Completada!</h4>
                  <p className="text-green-300">
                    Factor: {calibrationData.pixelsPerMm.toFixed(2)} px/mm
                  </p>
                </div>
                
                <Button onClick={resetCalibration} variant="outline">
                  Nueva Calibración
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Historial de Calibraciones */}
      {calibrationHistory.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Historial de Calibraciones</h3>
          <div className="space-y-2">
            {calibrationHistory.map((cal, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-900/20 rounded">
                <div className="text-sm">
                  <span className="text-muted-foreground">Medida {index + 1}:</span>
                  <span className="ml-2 font-mono">
                    {cal.pixels.toFixed(1)} px / {cal.mm.toFixed(1)} mm = {cal.ratio.toFixed(2)} px/mm
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(cal.date).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 p-2 bg-blue-900/20 rounded">
            <p className="text-sm text-blue-300">
              <strong>Promedio ponderado:</strong> {calibrationData.pixelsPerMm.toFixed(2)} px/mm
              {calibrationHistory.length > 0 && 
                ` ±${(calculateCalibrationUncertainty() * 100).toFixed(1)}%`
              }
            </p>
          </div>
        </Card>
      )}

      {/* Información del Dispositivo */}
      {deviceInfo && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Información del Dispositivo</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Modelo</Label>
              <p>{deviceInfo.model}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Plataforma</Label>
              <p>{deviceInfo.platform}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Distancia Focal</Label>
              <p>{calibrationData.focalLength} mm</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Tamaño del Sensor</Label>
              <p>{calibrationData.sensorSize} mm</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
