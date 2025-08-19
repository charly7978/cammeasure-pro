// PANEL DE CALIBRACIÓN AVANZADO CON MÚLTIPLES MÉTODOS
// Implementa calibración por cámara, calibración rápida y detección automática de dispositivos
import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, CheckCircle, AlertCircle, Camera, Info } from 'lucide-react';
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
    pixelsPerMm: 3.78, // Valor inicial más realista
    referenceObjectSize: 25.4, // 1 pulgada en mm
    isCalibrated: false, // Empezar sin calibrar para forzar calibración real
    calibrationMethod: 'manual',
    // Valores iniciales para los nuevos parámetros
    cameraMatrix: [[1000, 0, 320], [0, 1000, 240], [0, 0, 1]], // Matriz de cámara inicial
    distortionCoefficients: [0, 0, 0, 0, 0], // Sin distorsión inicial
    imageSize: { width: 640, height: 480 }, // Tamaño de imagen estándar
    realWorldScale: 1.0 // Escala 1:1 inicial
  });

  const [referencePixelLength, setReferencePixelLength] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<{x: number, y: number}[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Solo enviar calibración inicial si está realmente calibrada
    if (calibrationData.isCalibrated) {
      onCalibrationChange(calibrationData);
    }
  }, []);

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
      const updatedData = {
        ...calibrationData,
        focalLength: specs.focalLength,
        sensorSize: specs.sensorSize,
        pixelsPerMm: specs.pixelsPerMm,
        isCalibrated: true,
        calibrationMethod: 'auto' as const,
        lastCalibrationDate: new Date().toISOString()
      };
      setCalibrationData(updatedData);
      onCalibrationChange(updatedData);
    }
  };

  const startCameraCalibration = async () => {
    try {
      setIsCalibrating(true);
      setShowInstructions(false);
      
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
      
      // Configurar canvas para calibración
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        // Dibujar instrucciones en el canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = 'white';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Coloca un objeto de referencia conocido', canvas.width / 2, canvas.height / 2 - 20);
          ctx.fillText('(ej: moneda de 1€, tarjeta de crédito)', canvas.width / 2, canvas.height / 2 + 10);
          ctx.fillText('Haz clic en dos puntos para medir', canvas.width / 2, canvas.height / 2 + 40);
        }
      }
      
    } catch (error) {
      console.error('Error iniciando calibración por cámara:', error);
      setIsCalibrating(false);
    }
  };

  const stopCameraCalibration = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCalibrating(false);
    setCalibrationPoints([]);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCalibrating || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newPoint = { x, y };
    setCalibrationPoints(prev => [...prev, newPoint]);
    
    // Dibujar punto en el canvas
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Conectar puntos si hay más de uno
      if (calibrationPoints.length > 0) {
        const prevPoint = calibrationPoints[calibrationPoints.length - 1];
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
    
    // Si tenemos dos puntos, calcular distancia
    if (calibrationPoints.length === 1) {
      const point1 = calibrationPoints[0];
      const point2 = newPoint;
      const pixelDistance = Math.sqrt(
        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
      );
      setReferencePixelLength(pixelDistance);
    }
  };

  const completeCalibration = () => {
    if (referencePixelLength <= 0) {
      alert('Por favor, mide primero la distancia de referencia');
      return;
    }
    
    // Calcular pixelsPerMm basado en la distancia medida
    const referenceSizeMm = 25.4; // 1 pulgada en mm
    const pixelsPerMm = referencePixelLength / referenceSizeMm;
    
    const updatedData = {
      ...calibrationData,
      pixelsPerMm,
      isCalibrated: true,
              calibrationMethod: 'reference' as const,
      lastCalibrationDate: new Date().toISOString(),
      referenceObjectSize: referenceSizeMm
    };
    
    setCalibrationData(updatedData);
    onCalibrationChange(updatedData);
    
    // Limpiar calibración
    stopCameraCalibration();
    setReferencePixelLength(0);
  };

  const useQuickCalibration = (objectType: string) => {
    const quickCalibrations: Record<string, { pixelsPerMm: number; focalLength: number }> = {
      '1euro': { pixelsPerMm: 23.25 / 23.25, focalLength: 4.2 }, // Moneda 1€ = 23.25mm
      'creditcard': { pixelsPerMm: 85.6 / 85.6, focalLength: 4.2 }, // Tarjeta = 85.6mm
      'iphone': { pixelsPerMm: 146.7 / 146.7, focalLength: 4.2 }, // iPhone = 146.7mm
      'pencil': { pixelsPerMm: 175 / 175, focalLength: 4.2 } // Lápiz = 175mm
    };
    
    const cal = quickCalibrations[objectType];
    if (cal) {
      const updatedData = {
        ...calibrationData,
        pixelsPerMm: cal.pixelsPerMm,
        focalLength: cal.focalLength,
        isCalibrated: true,
        calibrationMethod: 'reference' as const,
        lastCalibrationDate: new Date().toISOString(),
        referenceObjectSize: objectType === '1euro' ? 23.25 : 
                           objectType === 'creditcard' ? 85.6 :
                           objectType === 'iphone' ? 146.7 : 175
      };
      
      setCalibrationData(updatedData);
      onCalibrationChange(updatedData);
    }
  };

  const handleInputChange = (field: keyof CalibrationData, value: number) => {
    const updatedData = {
      ...calibrationData,
      [field]: value
    };
    setCalibrationData(updatedData);
    
    // Si todos los campos requeridos están llenos, marcar como calibrado
    if (updatedData.pixelsPerMm > 0 && updatedData.focalLength > 0) {
      updatedData.isCalibrated = true;
      onCalibrationChange(updatedData);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Ruler className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Calibración de Cámara</h3>
        </div>
        
        <Badge 
          variant={calibrationData.isCalibrated ? "default" : "destructive"}
          className={calibrationData.isCalibrated ? "bg-green-600" : "bg-red-600"}
        >
          {calibrationData.isCalibrated ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Calibrada
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 mr-1" />
              Sin Calibrar
            </>
          )}
        </Badge>
      </div>

      {/* INSTRUCCIONES INICIALES */}
      {showInstructions && (
        <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-300 mb-2">¿Por qué calibrar?</h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                La calibración es esencial para obtener mediciones precisas. Determina la relación 
                entre píxeles en la imagen y unidades reales (milímetros). Sin calibración, 
                las mediciones serán inexactas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MÉTODO 1: CALIBRACIÓN RÁPIDA */}
      <div className="mb-6">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-green-400" />
          Calibración Rápida
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => useQuickCalibration('1euro')}
            className="text-xs"
          >
            Moneda 1€ (23.25mm)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => useQuickCalibration('creditcard')}
            className="text-xs"
          >
            Tarjeta (85.6mm)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => useQuickCalibration('iphone')}
            className="text-xs"
          >
            iPhone (146.7mm)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => useQuickCalibration('pencil')}
            className="text-xs"
          >
            Lápiz (175mm)
          </Button>
        </div>
      </div>

      {/* MÉTODO 2: CALIBRACIÓN POR CÁMARA */}
      <div className="mb-6">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4 text-blue-400" />
          Calibración por Cámara
        </h4>
        
        {!isCalibrating ? (
          <Button
            onClick={startCameraCalibration}
            variant="outline"
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Iniciar Calibración por Cámara
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-auto"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onClick={handleCanvasClick}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={completeCalibration}
                disabled={calibrationPoints.length < 2}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Completar Calibración
              </Button>
              <Button
                onClick={stopCameraCalibration}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
            
            {calibrationPoints.length > 0 && (
              <div className="text-sm text-gray-300">
                <p>Puntos marcados: {calibrationPoints.length}/2</p>
                {referencePixelLength > 0 && (
                  <p>Distancia medida: {referencePixelLength.toFixed(1)} píxeles</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MÉTODO 3: CALIBRACIÓN MANUAL */}
      <div className="mb-6">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-yellow-400" />
          Calibración Manual
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pixelsPerMm" className="text-sm text-gray-300">
              Píxeles por mm
            </Label>
            <Input
              id="pixelsPerMm"
              type="number"
              step="0.01"
              value={calibrationData.pixelsPerMm}
              onChange={(e) => handleInputChange('pixelsPerMm', parseFloat(e.target.value) || 0)}
              className="mt-1"
              placeholder="3.78"
            />
          </div>
          
          <div>
            <Label htmlFor="focalLength" className="text-sm text-gray-300">
              Distancia focal (mm)
            </Label>
            <Input
              id="focalLength"
              type="number"
              step="0.1"
              value={calibrationData.focalLength}
              onChange={(e) => handleInputChange('focalLength', parseFloat(e.target.value) || 0)}
              className="mt-1"
              placeholder="4.2"
            />
          </div>
          
          <div>
            <Label htmlFor="sensorSize" className="text-sm text-gray-300">
              Tamaño del sensor (mm)
            </Label>
            <Input
              id="sensorSize"
              type="number"
              step="0.01"
              value={calibrationData.sensorSize}
              onChange={(e) => handleInputChange('sensorSize', parseFloat(e.target.value) || 0)}
              className="mt-1"
              placeholder="6.17"
            />
          </div>
          
          <div>
            <Label htmlFor="referenceObjectSize" className="text-sm text-gray-300">
              Tamaño objeto referencia (mm)
            </Label>
            <Input
              id="referenceObjectSize"
              type="number"
              step="0.1"
              value={calibrationData.referenceObjectSize}
              onChange={(e) => handleInputChange('referenceObjectSize', parseFloat(e.target.value) || 0)}
              className="mt-1"
              placeholder="25.4"
            />
          </div>
        </div>
      </div>

      {/* INFORMACIÓN DE CALIBRACIÓN ACTUAL */}
      {calibrationData.isCalibrated && (
        <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/30">
          <h4 className="font-semibold text-green-300 mb-2">Calibración Actual</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Método:</p>
              <p className="text-white font-mono">{calibrationData.calibrationMethod}</p>
            </div>
            <div>
              <p className="text-gray-400">Píxeles/mm:</p>
              <p className="text-white font-mono">{calibrationData.pixelsPerMm.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400">Distancia focal:</p>
              <p className="text-white font-mono">{calibrationData.focalLength} mm</p>
            </div>
            <div>
              <p className="text-gray-400">Tamaño sensor:</p>
              <p className="text-white font-mono">{calibrationData.sensorSize} mm</p>
            </div>
            {calibrationData.lastCalibrationDate && (
              <div className="col-span-2">
                <p className="text-gray-400">Última calibración:</p>
                <p className="text-white font-mono">
                  {new Date(calibrationData.lastCalibrationDate).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTÓN DE RESET */}
      <div className="mt-6">
        <Button
          onClick={() => {
            const resetData = {
              ...calibrationData,
              isCalibrated: false,
              pixelsPerMm: 0,
              calibrationMethod: 'manual' as const
            };
            setCalibrationData(resetData);
            onCalibrationChange(resetData);
          }}
          variant="outline"
          className="w-full text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
        >
          Resetear Calibración
        </Button>
      </div>
    </Card>
  );
};
