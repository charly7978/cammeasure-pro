import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Save, 
  Share2,
  Ruler,
  Target,
  Zap
} from 'lucide-react';

interface SimpleMeasurementControlsProps {
  result?: any;
  mode?: string;
  onModeChange?: (mode: string) => void;
}

export const SimpleMeasurementControls: React.FC<SimpleMeasurementControlsProps> = ({
  result,
  mode = '2d',
  onModeChange
}) => {
  const handleSave = () => {
    if (result) {
      const dataToSave = {
        result,
        mode,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('cammeasure_data', JSON.stringify(dataToSave));
      
      // Mostrar notificación
      alert('Datos guardados localmente');
    }
  };

  const handleExport = () => {
    if (result) {
      const data = {
        result,
        mode,
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `measurement-${mode}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleShare = () => {
    if (navigator.share && result) {
      const shareData = {
        title: 'Medición CamMeasure Pro',
        text: `Medición ${mode.toUpperCase()}: ${result.measurements.width.toFixed(1)}x${result.measurements.height.toFixed(1)}${result.measurements.unit}`,
        url: window.location.href
      };
      
      navigator.share(shareData).catch(console.error);
    } else {
      // Fallback para navegadores que no soportan Web Share API
      navigator.clipboard.writeText(
        `Medición ${mode.toUpperCase()}: ${result.measurements.width.toFixed(1)}x${result.measurements.height.toFixed(1)}${result.measurements.unit}`
      );
      alert('Medición copiada al portapapeles');
    }
  };

  if (!result) {
    return (
      <Card className="p-8 text-center">
        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay mediciones para mostrar</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen de medición */}
      <Card className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
            <Ruler className="w-5 h-5" />
            Resumen de Medición
          </h3>
          <Badge variant="outline" className="border-green-500 text-green-600">
            {mode.toUpperCase()}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-green-700">Dimensiones</p>
            <p className="font-mono font-bold text-green-800 text-lg">
              {result.measurements.width.toFixed(1)} × {result.measurements.height.toFixed(1)} {result.measurements.unit}
            </p>
          </div>
          <div>
            <p className="text-green-700">Área</p>
            <p className="font-mono font-bold text-green-800 text-lg">
              {result.measurements.area.toFixed(1)} {result.measurements.unit}²
            </p>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700">
              Confianza: {(result.confidence * 100).toFixed(0)}%
            </span>
            <span className="text-green-700">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Controles de modo */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Modo de Medición
        </h3>
        
        <div className="flex gap-2">
          <Button
            variant={mode === '2d' ? "default" : "outline"}
            onClick={() => onModeChange?.('2d')}
            className="flex-1"
          >
            <Ruler className="w-4 h-4 mr-2" />
            2D
          </Button>
          <Button
            variant={mode === '3d' ? "default" : "outline"}
            onClick={() => onModeChange?.('3d')}
            className="flex-1"
          >
            <Target className="w-4 h-4 mr-2" />
            3D
          </Button>
          <Button
            variant={mode === 'advanced' ? "default" : "outline"}
            onClick={() => onModeChange?.('advanced')}
            className="flex-1"
          >
            <Zap className="w-4 h-4 mr-2" />
            Avanzado
          </Button>
        </div>
      </Card>

      {/* Acciones */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Acciones</h3>
        
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={handleSave}
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Save className="w-4 h-4" />
            <span className="text-xs">Guardar</span>
          </Button>
          
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs">Exportar</span>
          </Button>
          
          <Button
            onClick={handleShare}
            variant="outline"
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">Compartir</span>
          </Button>
        </div>
      </Card>

      {/* Información adicional */}
      <Card className="p-3 bg-gray-50 border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Unidad:</strong> {result.measurements.unit}</p>
          <p><strong>Modo:</strong> {mode.toUpperCase()}</p>
          <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
          <p><strong>ID:</strong> {result.id || 'N/A'}</p>
        </div>
      </Card>
    </div>
  );
};
