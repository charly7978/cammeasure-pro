import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Ruler, 
  Box, 
  Layers,
  Move3D,
  Camera,
  RotateCcw,
  Save,
  Download,
  Target
} from 'lucide-react';
import type { MeasurementResult } from './MeasurementEngine';

export type MeasurementMode = '2d' | '3d' | 'depth' | 'area' | 'volume';

interface MeasurementControlsProps {
  measurementMode: MeasurementMode;
  onModeChange: (mode: MeasurementMode) => void;
  measurementResult: MeasurementResult | null;
  isCalibrated: boolean;
  onCapture: () => void;
  onReset: () => void;
  onSave: () => void;
  onExport: () => void;
}

export const MeasurementControls: React.FC<MeasurementControlsProps> = ({
  measurementMode,
  onModeChange,
  measurementResult,
  isCalibrated,
  onCapture,
  onReset,
  onSave,
  onExport
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      await onCapture();
    } finally {
      setIsCapturing(false);
    }
  };

  const measurementModes = [
    { id: '2d' as const, label: '2D', icon: Ruler, description: 'Medición lineal' },
    { id: '3d' as const, label: '3D', icon: Move3D, description: 'Medición espacial' },
    { id: 'area' as const, label: 'Área', icon: Box, description: 'Medición de superficie' },
    { id: 'volume' as const, label: 'Volumen', icon: Layers, description: 'Medición volumétrica' },
    { id: 'depth' as const, label: 'Profundidad', icon: Target, description: 'Análisis de profundidad' }
  ];

  const formatMeasurement = (value: number, unit: string): string => {
    if (value < 10) {
      return `${value.toFixed(2)} ${unit}`;
    } else if (value < 1000) {
      return `${value.toFixed(1)} ${unit}`;
    } else {
      return `${(value / 1000).toFixed(2)} ${unit === 'mm' ? 'm' : unit}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Measurement Results Display */}
      {measurementResult && (
        <Card className="p-4 bg-gradient-measurement border-measurement-active/30 shadow-active">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-measurement-active">Resultado de Medición</h4>
              <Badge 
                variant="outline" 
                className="border-measurement-active text-measurement-active animate-measurement-pulse"
              >
                Confianza: {(measurementResult.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Distancia 2D</p>
                <p className="text-lg font-mono text-measurement-active">
                  {formatMeasurement(measurementResult.distance2D, measurementResult.unit)}
                </p>
              </div>
              
              {measurementResult.distance3D && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Distancia 3D</p>
                  <p className="text-lg font-mono text-accent">
                    {formatMeasurement(measurementResult.distance3D, measurementResult.unit)}
                  </p>
                </div>
              )}
              
              {measurementResult.area && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Área</p>
                  <p className="text-lg font-mono text-primary">
                    {formatMeasurement(measurementResult.area, `${measurementResult.unit}²`)}
                  </p>
                </div>
              )}
              
              {measurementResult.volume && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Volumen</p>
                  <p className="text-lg font-mono text-depth-far">
                    {formatMeasurement(measurementResult.volume, `${measurementResult.unit}³`)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Measurement Mode Selection */}
      <Card className="p-4">
        <Tabs value={measurementMode} onValueChange={(value) => onModeChange(value as MeasurementMode)}>
          <TabsList className="grid w-full grid-cols-5 bg-secondary/50">
            {measurementModes.map((mode) => (
              <TabsTrigger 
                key={mode.id} 
                value={mode.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                disabled={!isCalibrated && mode.id !== '2d'}
              >
                <mode.icon className="w-4 h-4" />
              </TabsTrigger>
            ))}
          </TabsList>
          
          {measurementModes.map((mode) => (
            <TabsContent key={mode.id} value={mode.id} className="mt-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <mode.icon className="w-5 h-5 text-primary" />
                  <h3 className="font-medium">{mode.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                
                {!isCalibrated && mode.id !== '2d' && (
                  <Badge variant="destructive" className="text-xs">
                    Requiere calibración
                  </Badge>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* Action Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleCapture}
            disabled={isCapturing}
            className="bg-gradient-primary hover:bg-primary/90 shadow-measurement"
            size="lg"
          >
            <Camera className="w-4 h-4 mr-2" />
            {isCapturing ? 'Capturando...' : 'Capturar'}
          </Button>
          
          <Button
            onClick={onReset}
            variant="outline"
            size="lg"
            className="border-border/50"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetear
          </Button>
          
          {measurementResult && (
            <>
              <Button
                onClick={onSave}
                variant="secondary"
                size="lg"
                className="bg-secondary/70"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
              
              <Button
                onClick={onExport}
                variant="secondary"
                size="lg"
                className="bg-secondary/70"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Status Indicator */}
      <div className="text-center">
        <Badge 
          variant={isCalibrated ? "default" : "secondary"}
          className={isCalibrated ? "bg-measurement-active text-background animate-measurement-pulse" : ""}
        >
          {isCalibrated ? "Sistema Calibrado - Listo para medir" : "Calibración requerida para mediciones precisas"}
        </Badge>
      </div>
    </div>
  );
};