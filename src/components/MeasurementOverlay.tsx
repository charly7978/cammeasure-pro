import React from 'react';
import { DetectedObject } from './RealTimeMeasurement';

interface MeasurementOverlayProps {
  objects: DetectedObject[];
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  objects,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight
}) => {
  if (!objects.length || !videoWidth || !videoHeight) return null;

  // Calculate scaling factors
  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;

  const formatDimension = (value: number, unit: string): string => {
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

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-measurement-active bg-measurement-active/20 text-measurement-active';
    if (confidence > 0.6) return 'border-calibration bg-calibration/20 text-calibration';
    return 'border-measurement-inactive bg-measurement-inactive/20 text-measurement-inactive';
  };

  // Función para evitar superposición de etiquetas
  const calculateLabelPosition = (obj: any, index: number) => {
    const baseTop = (obj.bounds.y * scaleY) - 60;
    const offset = index * 50; // Más separación para acomodar más información
    return Math.max(10, baseTop - offset); // No ir más arriba del borde superior
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {objects.map((obj, index) => (
        <div key={obj.id}>
          {/* Bounding Box */}
          <div
            className={`absolute border-2 rounded-lg ${getConfidenceColor(obj.confidence)} transition-all duration-200`}
            style={{
              left: `${obj.bounds.x * scaleX}px`,
              top: `${obj.bounds.y * scaleY}px`,
              width: `${obj.bounds.width * scaleX}px`,
              height: `${obj.bounds.height * scaleY}px`,
            }}
          >
            {/* Center Point */}
            <div 
              className="absolute w-3 h-3 bg-measurement-active rounded-full animate-measurement-pulse border-2 border-white"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
            
            {/* Object Number */}
            <div 
              className="absolute -top-6 -left-2 w-6 h-6 bg-measurement-active text-black rounded-full flex items-center justify-center text-xs font-bold"
            >
              {index + 1}
            </div>
          </div>

          {/* Measurement Labels - Posicionadas para evitar superposición */}
          <div
            className="absolute z-10 font-mono text-sm px-3 py-2 rounded-lg shadow-lg border"
            style={{
              left: `${Math.min(obj.bounds.x * scaleX, containerWidth - 220)}px`,
              top: `${calculateLabelPosition(obj, index)}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              borderColor: obj.confidence > 0.8 ? 'hsl(var(--measurement-active))' : 'hsl(var(--calibration))',
              color: obj.confidence > 0.8 ? 'hsl(var(--measurement-active))' : 'hsl(var(--calibration))',
              minWidth: '200px'
            }}
          >
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs opacity-80">Objeto {index + 1}</span>
                <span className="text-xs bg-white/20 px-1 rounded">
                  {(obj.confidence * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-70">Ancho:</span>
                  <span className="ml-1 font-bold">
                    {formatDimension(obj.dimensions.width, obj.dimensions.unit)}
                  </span>
                </div>
                <div>
                  <span className="opacity-70">Alto:</span>
                  <span className="ml-1 font-bold">
                    {formatDimension(obj.dimensions.height, obj.dimensions.unit)}
                  </span>
                </div>
              </div>
              
              {obj.dimensions.unit !== 'px' && (
                <div className="text-xs opacity-80 border-t border-white/20 pt-1">
                  <span className="opacity-70">Área:</span>
                  <span className="ml-1">
                    {formatArea(obj.dimensions.area, obj.dimensions.unit + '²')}
                  </span>
                </div>
              )}

              {/* Información adicional para objetos calibrados */}
              {obj.dimensions.unit === 'mm' && (
                <div className="text-xs opacity-70 border-t border-white/10 pt-1">
                  <div className="flex justify-between">
                    <span>Diagonal:</span>
                    <span>{formatDimension(Math.sqrt(obj.dimensions.width ** 2 + obj.dimensions.height ** 2), 'mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Perímetro:</span>
                    <span>{formatDimension(2 * (obj.dimensions.width + obj.dimensions.height), 'mm')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Líneas de dimensión simplificadas - solo para el objeto principal */}
          {index === 0 && (
            <>
              {/* Width line */}
              <div
                className="absolute border-t-2 border-measurement-active opacity-80"
                style={{
                  left: `${obj.bounds.x * scaleX}px`,
                  top: `${(obj.bounds.y + obj.bounds.height + 15) * scaleY}px`,
                  width: `${obj.bounds.width * scaleX}px`,
                }}
              >
                <div className="absolute left-0 top-0 w-0.5 h-4 bg-measurement-active -translate-y-2"></div>
                <div className="absolute right-0 top-0 w-0.5 h-4 bg-measurement-active -translate-y-2"></div>
              </div>

              {/* Height line */}
              <div
                className="absolute border-l-2 border-accent opacity-80"
                style={{
                  left: `${(obj.bounds.x + obj.bounds.width + 15) * scaleX}px`,
                  top: `${obj.bounds.y * scaleY}px`,
                  height: `${obj.bounds.height * scaleY}px`,
                }}
              >
                <div className="absolute top-0 left-0 h-0.5 w-4 bg-accent -translate-x-2"></div>
                <div className="absolute bottom-0 left-0 h-0.5 w-4 bg-accent -translate-x-2"></div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};