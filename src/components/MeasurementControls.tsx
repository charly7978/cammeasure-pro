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
import type { MeasurementResult, MeasurementMode } from '@/lib/types';

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
    { 
      id: '2d' as const, 
      label: '2D', 
      icon: Ruler, 
      description: 'Medición lineal básica (ancho, alto, diagonal)',
      features: ['Ancho y alto', 'Diagonal', 'Perímetro', 'Relación de aspecto']
    },
    { 
      id: '3d' as const, 
      label: '3D', 
      icon: Move3D, 
      description: 'Medición espacial con estimación de profundidad',
      features: ['Dimensiones 3D', 'Volumen estimado', 'Orientación espacial', 'Distancia real']
    },
    { 
      id: 'area' as const, 
      label: 'Área', 
      icon: Box, 
      description: 'Cálculo preciso de superficies y áreas',
      features: ['Área total', 'Área útil', 'Densidad de píxeles', 'Comparación de tamaños']
    },
    { 
      id: 'volume' as const, 
      label: 'Volumen', 
      icon: Layers, 
      description: 'Estimación volumétrica basada en forma',
      features: ['Volumen aproximado', 'Densidad estimada', 'Capacidad', 'Análisis de forma']
    },
    { 
      id: 'depth' as const, 
      label: 'Profundidad', 
      icon: Target, 
      description: 'Análisis de profundidad y distancia a la cámara',
      features: ['Distancia a cámara', 'Mapa de profundidad', 'Perspectiva', 'Corrección angular']
    }
  ];

  const formatMeasurement = (value: number, unit: string): string => {
    if (unit === 'mm') {
      // Para objetos pequeños (menos de 100mm = 10cm)
      if (value < 100) {
        return `${value.toFixed(1)}mm`;
      }
      // Para objetos medianos (100mm a 1000mm = 10cm a 100cm)
      else if (value < 1000) {
        return `${(value / 10).toFixed(1)}cm`;
      }
      // Para objetos grandes (más de 1000mm = 1m)
      else {
        return `${(value / 1000).toFixed(2)}m`;
      }
    }
    return `${Math.round(value)}px`;
  };

  const formatArea = (value: number, unit: string): string => {
    if (unit === 'mm²') {
      // Área pequeña (menos de 10,000 mm² = 100 cm²)
      if (value < 10000) {
        return `${Math.round(value)}mm²`;
      }
      // Área mediana (10,000 mm² a 1,000,000 mm² = 100 cm² a 1 m²)
      else if (value < 1000000) {
        return `${(value / 100).toFixed(1)}cm²`;
      }
      // Área grande (más de 1,000,000 mm² = 1 m²)
      else {
        return `${(value / 1000000).toFixed(2)}m²`;
      }
    }
    return `${Math.round(value)}px²`;
  };

  const formatVolume = (value: number, unit: string): string => {
    if (unit === 'mm³') {
      // Volumen pequeño (menos de 1,000,000 mm³ = 1000 cm³)
      if (value < 1000000) {
        return `${Math.round(value)}mm³`;
      }
      // Volumen mediano (1,000,000 mm³ a 1,000,000,000 mm³ = 1000 cm³ a 1 m³)
      else if (value < 1000000000) {
        return `${(value / 1000).toFixed(1)}cm³`;
      }
      // Volumen grande (más de 1,000,000,000 mm³ = 1 m³)
      else {
        return `${(value / 1000000000).toFixed(3)}m³`;
      }
    }
    return `${Math.round(value)}px³`;
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
                    {formatArea(measurementResult.area, `${measurementResult.unit}²`)}
                  </p>
                </div>
              )}
              
              {measurementResult.volume && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Volumen</p>
                  <p className="text-lg font-mono text-depth-far">
                    {formatVolume(measurementResult.volume, `${measurementResult.unit}³`)}
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
                disabled={false} // Todas las opciones están habilitadas
              >
                <mode.icon className="w-4 h-4" />
              </TabsTrigger>
            ))}
          </TabsList>
          
          {measurementModes.map((mode) => (
            <TabsContent key={mode.id} value={mode.id} className="mt-4">
              <div className="space-y-3">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <mode.icon className="w-5 h-5 text-primary" />
                    <h3 className="font-medium">{mode.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </div>
                
                {/* Características del modo */}
                <div className="bg-secondary/30 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Características:</h4>
                  <ul className="text-xs space-y-1">
                    {mode.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-primary rounded-full"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Advertencia para modos avanzados sin calibración */}
                {!isCalibrated && mode.id !== '2d' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-medium text-amber-500">Recomendación</span>
                    </div>
                    <p className="text-xs text-amber-600">
                      Para mayor precisión en mediciones {mode.label.toLowerCase()}, 
                      se recomienda calibrar el sistema primero.
                    </p>
                  </div>
                )}

                {/* Información adicional para modo calibrado */}
                {isCalibrated && (
                  <div className="bg-measurement-active/10 border border-measurement-active/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-measurement-active" />
                      <span className="text-xs font-medium text-measurement-active">Sistema Calibrado</span>
                    </div>
                    <p className="text-xs text-measurement-active/80">
                      Mediciones {mode.label.toLowerCase()} con alta precisión disponibles.
                    </p>
                  </div>
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
          {isCalibrated ? "Sistema Calibrado - Todas las mediciones disponibles" : "Modo básico - Calibra para mayor precisión"}
        </Badge>
      </div>
    </div>
  );
};