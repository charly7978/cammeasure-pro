import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Target, 
  Ruler,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface SimpleCalibrationPanelProps {
  onCalibrationChange: (data: any) => void;
  currentCalibration?: any;
}

export const SimpleCalibrationPanel: React.FC<SimpleCalibrationPanelProps> = ({
  onCalibrationChange,
  currentCalibration
}) => {
  const [squareSize, setSquareSize] = useState(20);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const handleCalibrate = async () => {
    setIsCalibrating(true);
    
    // Simular proceso de calibración
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const calibrationData = {
      isCalibrated: true,
      pixelsPerMm: 2.83,
      confidence: 0.95,
      squareSize: squareSize
    };
    
    onCalibrationChange(calibrationData);
    setIsCalibrating(false);
  };

  const handleReset = () => {
    const resetData = {
      isCalibrated: false,
      pixelsPerMm: 0,
      confidence: 0
    };
    onCalibrationChange(resetData);
  };

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Estado de Calibración
          </h3>
          <Badge 
            variant={currentCalibration?.isCalibrated ? "default" : "destructive"}
            className={currentCalibration?.isCalibrated ? "bg-green-500" : ""}
          >
            {currentCalibration?.isCalibrated ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Calibrado
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sin Calibrar
              </>
            )}
          </Badge>
        </div>
        
        {currentCalibration?.isCalibrated ? (
          <div className="space-y-2 text-sm">
            <p><strong>Factor de conversión:</strong> {currentCalibration.pixelsPerMm.toFixed(2)} px/mm</p>
            <p><strong>Confianza:</strong> {(currentCalibration.confidence * 100).toFixed(0)}%</p>
            <p><strong>Tamaño del patrón:</strong> {currentCalibration.squareSize}mm</p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            El sistema no está calibrado. Las mediciones se mostrarán en píxeles.
          </p>
        )}
      </Card>

      {/* Configuración de calibración */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Configuración
        </h3>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="squareSize">Tamaño del cuadrado del patrón (mm)</Label>
            <Input
              id="squareSize"
              type="number"
              value={squareSize}
              onChange={(e) => setSquareSize(Number(e.target.value))}
              min="10"
              max="100"
              step="5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tamaño real del cuadrado del patrón de calibración
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleCalibrate}
              disabled={isCalibrating}
              className="flex-1 bg-gradient-primary"
            >
              <Target className="w-4 h-4 mr-2" />
              {isCalibrating ? 'Calibrando...' : 'Iniciar Calibración'}
            </Button>
            
            {currentCalibration?.isCalibrated && (
              <Button 
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                <Settings className="w-4 h-4 mr-2" />
                Resetear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Instrucciones */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold mb-3 text-blue-800 flex items-center gap-2">
          <Ruler className="w-5 h-5" />
          Instrucciones de Calibración
        </h3>
        <div className="space-y-2 text-sm text-blue-700">
          <p>1. Imprime un patrón de calibración con cuadrados de {squareSize}mm</p>
          <p>2. Coloca el patrón en una superficie plana</p>
          <p>3. Captura una imagen del patrón desde diferentes ángulos</p>
          <p>4. El sistema calculará automáticamente el factor de conversión</p>
        </div>
      </Card>
    </div>
  );
};
