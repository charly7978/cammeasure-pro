import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, CheckCircle, AlertCircle } from 'lucide-react';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
}

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
    focalLength: 4.0, // Default focal length in mm
    sensorSize: 6.17, // Default sensor diagonal in mm
    pixelsPerMm: 157, // Default pixels per mm (approximate)
    referenceObjectSize: 25.4, // 1 inch in mm
    isCalibrated: false
  });

  const [referencePixelLength, setReferencePixelLength] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    // Auto-detect device specs if possible
    if (deviceInfo) {
      updateDeviceSpecs(deviceInfo);
    }
  }, [deviceInfo]);

  const updateDeviceSpecs = (device: { model: string; platform: string }) => {
    // Common device specifications database
    const deviceSpecs: Record<string, { focalLength: number; sensorSize: number }> = {
      'iPhone': { focalLength: 4.25, sensorSize: 6.17 },
      'Samsung': { focalLength: 4.3, sensorSize: 5.76 },
      'Pixel': { focalLength: 4.38, sensorSize: 6.17 },
      'OnePlus': { focalLength: 4.5, sensorSize: 6.17 }
    };

    for (const [brand, specs] of Object.entries(deviceSpecs)) {
      if (device.model.includes(brand)) {
        setCalibrationData(prev => ({
          ...prev,
          focalLength: specs.focalLength,
          sensorSize: specs.sensorSize
        }));
        break;
      }
    }
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    // Reset calibration state
    setReferencePixelLength(0);
    setCalibrationData(prev => ({ ...prev, isCalibrated: false }));
  };

  const completeCalibration = () => {
    if (referencePixelLength > 0) {
      const pixelsPerMm = referencePixelLength / calibrationData.referenceObjectSize;
      
      const updatedData = {
        ...calibrationData,
        pixelsPerMm,
        isCalibrated: true
      };
      
      setCalibrationData(updatedData);
      onCalibrationChange(updatedData);
      setIsCalibrating(false);
    }
  };

  const handleInputChange = (field: keyof CalibrationData, value: number) => {
    const updatedData = {
      ...calibrationData,
      [field]: value,
      isCalibrated: false // Reset calibration when parameters change
    };
    
    setCalibrationData(updatedData);
    onCalibrationChange(updatedData);
  };

  return (
    <Card className="p-6 space-y-6 bg-gradient-to-br from-card to-card/80 border-primary/20">
      <div className="flex items-center justify-between">
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
              Calibrado
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 mr-1" />
              Sin Calibrar
            </>
          )}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="focal-length">Distancia Focal (mm)</Label>
          <Input
            id="focal-length"
            type="number"
            step="0.1"
            value={calibrationData.focalLength}
            onChange={(e) => handleInputChange('focalLength', parseFloat(e.target.value))}
            className="bg-input/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sensor-size">Tamaño Sensor (mm)</Label>
          <Input
            id="sensor-size"
            type="number"
            step="0.1"
            value={calibrationData.sensorSize}
            onChange={(e) => handleInputChange('sensorSize', parseFloat(e.target.value))}
            className="bg-input/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference-size">Objeto Referencia (mm)</Label>
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
          <Label htmlFor="pixels-per-mm">Píxeles/mm</Label>
          <Input
            id="pixels-per-mm"
            type="number"
            step="0.1"
            value={calibrationData.pixelsPerMm.toFixed(2)}
            readOnly
            className="bg-muted/50 cursor-not-allowed"
          />
        </div>
      </div>

      {isCalibrating && (
        <div className="p-4 bg-calibration/10 border border-calibration rounded-lg animate-calibration-glow">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="w-4 h-4 text-calibration" />
            <span className="text-sm font-medium text-calibration">
              Modo Calibración Activo
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Coloca un objeto de referencia de {calibrationData.referenceObjectSize}mm y marca sus extremos en la imagen
          </p>
          
          {referencePixelLength > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs">
                Longitud medida: {referencePixelLength.toFixed(1)} píxeles
              </span>
              <Button
                size="sm"
                onClick={completeCalibration}
                className="bg-calibration text-background hover:bg-calibration/90"
              >
                Confirmar Calibración
              </Button>
            </div>
          )}
        </div>
      )}

      {!isCalibrating && (
        <Button
          onClick={startCalibration}
          className="w-full bg-gradient-primary hover:bg-primary/90 shadow-measurement"
          size="lg"
        >
          <Target className="w-4 h-4 mr-2" />
          Iniciar Calibración
        </Button>
      )}

      {deviceInfo && (
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>Dispositivo: {deviceInfo.model}</p>
          <p>Plataforma: {deviceInfo.platform}</p>
        </div>
      )}
    </Card>
  );
};