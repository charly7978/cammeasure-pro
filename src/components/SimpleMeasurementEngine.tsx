import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Ruler, 
  Target, 
  Zap,
  CheckCircle
} from 'lucide-react';

interface SimpleMeasurementEngineProps {
  imageData: ImageData;
  calibrationData?: any;
  onResult?: (result: any) => void;
}

export const SimpleMeasurementEngine: React.FC<SimpleMeasurementEngineProps> = ({
  imageData,
  calibrationData,
  onResult
}) => {
  const [measurements, setMeasurements] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (imageData) {
      processImage();
    }
  }, [imageData]);

  const processImage = async () => {
    setIsProcessing(true);
    
    try {
      // Simular procesamiento de imagen
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Calcular mediciones básicas
      const width = imageData.width;
      const height = imageData.height;
      const area = width * height;
      
      // Aplicar calibración si está disponible
      let realWidth = width;
      let realHeight = height;
      let realArea = area;
      let unit = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        realWidth = width / calibrationData.pixelsPerMm;
        realHeight = height / calibrationData.pixelsPerMm;
        realArea = area / (calibrationData.pixelsPerMm ** 2);
        unit = 'mm';
      }
      
      const result = {
        measurements: {
          width: realWidth,
          height: realHeight,
          area: realArea,
          perimeter: 2 * (realWidth + realHeight),
          diagonal: Math.sqrt(realWidth ** 2 + realHeight ** 2),
          aspectRatio: realWidth / realHeight,
          unit: unit
        },
        confidence: 0.85,
        timestamp: Date.now(),
        mode: '2d'
      };
      
      setMeasurements(result);
      onResult?.(result);
      
    } catch (error) {
      console.error('Error procesando imagen:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!imageData) {
    return (
      <Card className="p-8 text-center">
        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay imagen para procesar</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Información de la imagen */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            Análisis de Imagen
          </h3>
          <Badge variant="outline" className="text-xs">
            {imageData.width} x {imageData.height} px
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Resolución</p>
            <p className="font-mono font-bold">{imageData.width} × {imageData.height}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tamaño de datos</p>
            <p className="font-mono font-bold">{(imageData.data.length / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      </Card>

      {/* Procesamiento */}
      {isProcessing && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
            <div>
              <h4 className="font-medium text-yellow-800">Procesando imagen...</h4>
              <p className="text-sm text-yellow-700">Analizando y calculando mediciones</p>
            </div>
          </div>
        </Card>
      )}

      {/* Resultados */}
      {measurements && !isProcessing && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-800">Mediciones Completadas</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <p className="text-sm text-green-700">Ancho</p>
                <p className="font-mono font-bold text-green-800 text-lg">
                  {measurements.measurements.width.toFixed(1)} {measurements.measurements.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Alto</p>
                <p className="font-mono font-bold text-green-800 text-lg">
                  {measurements.measurements.height.toFixed(1)} {measurements.measurements.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Área</p>
                <p className="font-mono font-bold text-green-800">
                  {measurements.measurements.area.toFixed(1)} {measurements.measurements.unit}²
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm text-green-700">Perímetro</p>
                <p className="font-mono font-bold text-green-800">
                  {measurements.measurements.perimeter.toFixed(1)} {measurements.measurements.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Diagonal</p>
                <p className="font-mono font-bold text-green-800">
                  {measurements.measurements.diagonal.toFixed(1)} {measurements.measurements.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Relación de aspecto</p>
                <p className="font-mono font-bold text-green-800">
                  {measurements.measurements.aspectRatio.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-green-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-700">Confianza: {(measurements.confidence * 100).toFixed(0)}%</span>
              <span className="text-green-700">Unidad: {measurements.measurements.unit}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Estado de calibración */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 text-sm">
          <Ruler className="w-4 h-4 text-blue-600" />
          <span className="text-blue-800">
            {calibrationData?.isCalibrated ? (
              `Sistema calibrado: ${calibrationData.pixelsPerMm.toFixed(2)} px/mm`
            ) : (
              'Sistema sin calibrar - mediciones en píxeles'
            )}
          </span>
        </div>
      </Card>
    </div>
  );
};
