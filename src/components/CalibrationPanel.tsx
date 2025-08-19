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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCalibrating(true);
      setCalibrationPoints([]);
      setReferencePixelLength(0);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara. Usa calibración manual.');
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
    if (!isCalibrating || calibrationPoints.length >= 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPoints = [...calibrationPoints, { x, y }];
    setCalibrationPoints(newPoints);

    // Dibujar punto en el canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(`${newPoints.length}`, x + 8, y - 8);

      // Si tenemos 2 puntos, dibujar línea
      if (newPoints.length === 2) {
        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(newPoints[0].x, newPoints[0].y);
        ctx.lineTo(newPoints[1].x, newPoints[1].y);
        ctx.stroke();

        // Calcular distancia en píxeles
        const pixelDistance = Math.sqrt(
          Math.pow(newPoints[1].x - newPoints[0].x, 2) + 
          Math.pow(newPoints[1].y - newPoints[0].y, 2)
        );
        setReferencePixelLength(pixelDistance);
      }
    }
  };

  const completeCalibration = () => {
    if (referencePixelLength > 0 && calibrationData.referenceObjectSize > 0) {
      const pixelsPerMm = referencePixelLength / calibrationData.referenceObjectSize;
      
      const updatedData = {
        ...calibrationData,
        pixelsPerMm,
        isCalibrated: true,
        calibrationMethod: 'reference' as const,
        lastCalibrationDate: new Date().toISOString()
      };
      
      setCalibrationData(updatedData);
      onCalibrationChange(updatedData);
      stopCameraCalibration();
      
      alert(`¡Calibración completada!\nFactor: ${pixelsPerMm.toFixed(2)} píxeles/mm`);
    }
  };

  const useQuickCalibration = (objectType: string) => {
    const quickCalibrations = {
      'coin_1euro': { size: 23.25, description: 'Moneda de 1 euro (diámetro)' },
      'coin_quarter': { size: 24.26, description: 'Moneda de 25 centavos US (diámetro)' },
      'card_credit': { size: 85.6, description: 'Tarjeta de crédito (ancho)' },
      'card_height': { size: 53.98, description: 'Tarjeta de crédito (alto)' },
      'phone_iphone': { size: 146.7, description: 'iPhone estándar (alto)' },
      'ruler_10cm': { size: 100, description: '10 cm de regla' },
      'paper_a4_width': { size: 210, description: 'Papel A4 (ancho)' },
      'paper_a4_height': { size: 297, description: 'Papel A4 (alto)' }
    };

    const calibration = quickCalibrations[objectType as keyof typeof quickCalibrations];
    if (calibration) {
      const updatedData = {
        ...calibrationData,
        referenceObjectSize: calibration.size,
        calibrationMethod: 'reference' as const
      };
      
      setCalibrationData(updatedData);
      alert(`Objeto de referencia seleccionado: ${calibration.description}\nAhora mide este objeto con la cámara.`);
    }
  };

  const handleInputChange = (field: keyof CalibrationData, value: number) => {
    const updatedData = {
      ...calibrationData,
      [field]: value,
      isCalibrated: field === 'pixelsPerMm' ? true : false,
      calibrationMethod: 'manual' as const,
      lastCalibrationDate: field === 'pixelsPerMm' ? new Date().toISOString() : calibrationData.lastCalibrationDate
    };
    
    setCalibrationData(updatedData);
    if (updatedData.isCalibrated) {
      onCalibrationChange(updatedData);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Sistema de Calibración</h3>
          </div>
          
          <Badge 
            variant={calibrationData.isCalibrated ? "default" : "destructive"}
            className={calibrationData.isCalibrated ? "bg-measurement-active text-background" : ""}
          >
            {calibrationData.isCalibrated ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Calibrado ({calibrationData.calibrationMethod})
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Requiere Calibración
              </>
            )}
          </Badge>
        </div>

        {/* Instrucciones */}
        {showInstructions && (
          <Card className="p-4 bg-blue-500/10 border-blue-500/20 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-400">¿Por qué calibrar?</h4>
                <p className="text-sm text-blue-300">
                  La calibración convierte píxeles a unidades reales (mm/cm). Sin calibración, 
                  las medidas serán aproximadas. Para mediciones precisas:
                </p>
                <ol className="text-sm text-blue-300 list-decimal list-inside space-y-1">
                  <li>Selecciona un objeto de referencia conocido</li>
                  <li>Usa la cámara para medir ese objeto</li>
                  <li>El sistema calculará el factor de conversión</li>
                </ol>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowInstructions(false)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Calibración rápida con objetos comunes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">1. Selecciona un Objeto de Referencia</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => useQuickCalibration('coin_1euro')}
              className="text-xs justify-start"
            >
              🪙 Moneda 1€ (23.3mm)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => useQuickCalibration('card_credit')}
              className="text-xs justify-start"
            >
              💳 Tarjeta (85.6mm)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => useQuickCalibration('phone_iphone')}
              className="text-xs justify-start"
            >
              📱 iPhone (146.7mm)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => useQuickCalibration('ruler_10cm')}
              className="text-xs justify-start"
            >
              📏 Regla 10cm
            </Button>
          </div>
        </div>

        {/* Parámetros de calibración */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reference-size">Tamaño Referencia (mm)</Label>
            <Input
              id="reference-size"
              type="number"
              step="0.1"
              value={calibrationData.referenceObjectSize}
              onChange={(e) => handleInputChange('referenceObjectSize', parseFloat(e.target.value))}
              className="bg-input/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pixels-per-mm">Factor Conversión (px/mm)</Label>
            <Input
              id="pixels-per-mm"
              type="number"
              step="0.01"
              value={calibrationData.pixelsPerMm.toFixed(2)}
              onChange={(e) => handleInputChange('pixelsPerMm', parseFloat(e.target.value))}
              className="bg-input/50"
              placeholder="Calculado automáticamente"
            />
          </div>
        </div>

        {/* Calibración con cámara */}
        {!isCalibrating && (
          <Button
            onClick={startCameraCalibration}
            className="w-full bg-gradient-primary hover:bg-primary/90 shadow-measurement"
            size="lg"
            disabled={calibrationData.referenceObjectSize <= 0}
          >
            <Camera className="w-4 h-4 mr-2" />
            2. Medir con Cámara
          </Button>
        )}

        {/* Vista de calibración con cámara */}
        {isCalibrating && (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 object-cover rounded-lg bg-black"
              />
              <canvas
                ref={canvasRef}
                width={320}
                height={240}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onClick={handleCanvasClick}
              />
              
              {/* Instrucciones superpuestas */}
              <div className="absolute top-2 left-2 bg-black/80 text-white p-2 rounded text-sm">
                {calibrationPoints.length === 0 && "1. Haz clic en un extremo del objeto"}
                {calibrationPoints.length === 1 && "2. Haz clic en el otro extremo"}
                {calibrationPoints.length === 2 && `Distancia: ${referencePixelLength.toFixed(1)} píxeles`}
              </div>
            </div>

            <div className="flex gap-2">
              {referencePixelLength > 0 && (
                <Button
                  onClick={completeCalibration}
                  className="flex-1 bg-calibration text-background hover:bg-calibration/90"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Calibración
                </Button>
              )}
              
              <Button
                onClick={stopCameraCalibration}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Estado de calibración */}
        {calibrationData.isCalibrated && (
          <div className="p-3 bg-measurement-active/10 border border-measurement-active/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-measurement-active" />
              <span className="text-sm font-medium text-measurement-active">Sistema Calibrado</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Factor: {calibrationData.pixelsPerMm.toFixed(2)} píxeles = 1mm</p>
              <p>Método: {calibrationData.calibrationMethod}</p>
              {calibrationData.lastCalibrationDate && (
                <p>Fecha: {new Date(calibrationData.lastCalibrationDate).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        )}

        {deviceInfo && (
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p>Dispositivo: {deviceInfo.model}</p>
            <p>Plataforma: {deviceInfo.platform}</p>
          </div>
        )}
      </Card>
    </div>
  );
};
