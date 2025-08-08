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
    // Siempre asumir que el valor viene en mm
    if (value < 10) {
      return `${value.toFixed(1)}mm`;
    } else if (value < 100) {
      return `${value.toFixed(0)}mm`;
    } else if (value < 1000) {
      return `${(value / 10).toFixed(1)}cm`;
    } else {
      return `${(value / 1000).toFixed(2)}m`;
    }
  };

  const formatArea = (value: number, unit: string): string => {
    // ��rea en mm²
    if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(3)}m²`;
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-measurement-active bg-measurement-active/20 text-measurement-active';
    if (confidence > 0.6) return 'border-calibration bg-calibration/20 text-calibration';
    return 'border-measurement-inactive bg-measurement-inactive/20 text-measurement-inactive';
  };

  // Función para evitar superposición de etiquetas
  const calculateLabelPosition = (obj: any, index: number) => {
    const baseTop = (obj.bounds.y * scaleY) - 80;
    const offset = index * 60; // Más separación para acomodar más información
    return Math.max(10, baseTop - offset);
  };

  // Solo mostrar el mejor objeto (el primero)
  const bestObject = objects[0];
  if (!bestObject) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div key={bestObject.id}>
        {/* Bounding Box */}
        <div
          className={`absolute border-3 rounded-lg ${getConfidenceColor(bestObject.confidence)} transition-all duration-200 shadow-lg`}
          style={{
            left: `${bestObject.bounds.x * scaleX}px`,
            top: `${bestObject.bounds.y * scaleY}px`,
            width: `${bestObject.bounds.width * scaleX}px`,
            height: `${bestObject.bounds.height * scaleY}px`,
          }}
        >
          {/* Center Point */}
          <div 
            className="absolute w-4 h-4 bg-measurement-active rounded-full animate-measurement-pulse border-2 border-white shadow-lg"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
          
          {/* Target Icon */}
          <div 
            className="absolute -top-8 -left-3 w-8 h-8 bg-measurement-active text-black rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
          >
            🎯
          </div>
        </div>

        {/* Measurement Labels - Posicionadas para evitar superposición */}
        <div
          className="absolute z-20 font-mono text-base px-4 py-3 rounded-xl shadow-2xl border-2"
          style={{
            left: `${Math.min(bestObject.bounds.x * scaleX, containerWidth - 250)}px`,
            top: `${calculateLabelPosition(bestObject, 0)}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            borderColor: 'hsl(var(--measurement-active))',
            color: 'hsl(var(--measurement-active))',
            minWidth: '240px'
          }}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-white/20 pb-2">
              <span className="text-sm font-bold">🎯 ANÁLISIS PROFESIONAL</span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-measurement-active/20 px-2 py-1 rounded">
                  {(bestObject.confidence * 100).toFixed(0)}% confianza
                </span>
                {bestObject.precision && (
                  <span className="text-xs bg-primary/20 px-2 py-1 rounded">
                    Q: {bestObject.precision.qualityScore}/100
                  </span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">↔️ Ancho:</span>
                  <span className="font-bold text-measurement-active">
                    {formatDimension(bestObject.dimensions.width, bestObject.dimensions.unit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">↕️ Alto:</span>
                  <span className="font-bold text-accent">
                    {formatDimension(bestObject.dimensions.height, bestObject.dimensions.unit)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">📐 Área:</span>
                  <span className="font-bold text-primary">
                    {formatArea(bestObject.dimensions.area, bestObject.dimensions.unit + '²')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">📏 Diagonal:</span>
                  <span className="font-bold text-calibration">
                    {formatDimension(
                      Math.sqrt(bestObject.dimensions.width ** 2 + bestObject.dimensions.height ** 2), 
                      bestObject.dimensions.unit
                    )}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Información adicional profesional */}
            <div className="text-xs opacity-80 border-t border-white/10 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Perímetro:</span>
                <span>{formatDimension(2 * (bestObject.dimensions.width + bestObject.dimensions.height), bestObject.dimensions.unit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Relación aspecto:</span>
                <span>{(bestObject.dimensions.width / bestObject.dimensions.height).toFixed(2)}:1</span>
              </div>
              {bestObject.depth && (
                <div className="flex justify-between">
                  <span>🔍 Profundidad est.:</span>
                  <span>{formatDimension(bestObject.depth, bestObject.dimensions.unit)}</span>
                </div>
              )}
              {bestObject.volume && (
                <div className="flex justify-between">
                  <span>📦 Volumen est.:</span>
                  <span>{formatArea(bestObject.volume, bestObject.dimensions.unit + '³')}</span>
                </div>
              )}
              {bestObject.precision && (
                <div className="flex justify-between">
                  <span>⚡ Error estimado:</span>
                  <span>±{bestObject.precision.errorEstimate.toFixed(1)}mm</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Líneas de dimensión mejoradas */}
        <>
          {/* Width line */}
          <div
            className="absolute border-t-3 border-measurement-active opacity-90 shadow-lg"
            style={{
              left: `${bestObject.bounds.x * scaleX}px`,
              top: `${(bestObject.bounds.y + bestObject.bounds.height + 20) * scaleY}px`,
              width: `${bestObject.bounds.width * scaleX}px`,
            }}
          >
            <div className="absolute left-0 top-0 w-1 h-6 bg-measurement-active -translate-y-3 shadow-lg"></div>
            <div className="absolute right-0 top-0 w-1 h-6 bg-measurement-active -translate-y-3 shadow-lg"></div>
            <div className="absolute left-1/2 top-2 transform -translate-x-1/2 text-sm text-measurement-active font-bold bg-black/90 px-2 py-1 rounded shadow-lg">
              {formatDimension(bestObject.dimensions.width, bestObject.dimensions.unit)}
            </div>
          </div>

          {/* Height line */}
          <div
            className="absolute border-l-3 border-accent opacity-90 shadow-lg"
            style={{
              left: `${(bestObject.bounds.x + bestObject.bounds.width + 20) * scaleX}px`,
              top: `${bestObject.bounds.y * scaleY}px`,
              height: `${bestObject.bounds.height * scaleY}px`,
            }}
          >
            <div className="absolute top-0 left-0 h-1 w-6 bg-accent -translate-x-3 shadow-lg"></div>
            <div className="absolute bottom-0 left-0 h-1 w-6 bg-accent -translate-x-3 shadow-lg"></div>
            <div 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-accent font-bold bg-black/90 px-2 py-1 rounded shadow-lg"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {formatDimension(bestObject.dimensions.height, bestObject.dimensions.unit)}
            </div>
          </div>
        </>
      </div>
    </div>
  );
};