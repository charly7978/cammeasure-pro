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

  const formatDimension = (value: number): string => {
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

  // Solo mostrar el mejor objeto (el primero)
  const bestObject = objects[0];
  if (!bestObject) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Bounding Box - MÁS TRANSPARENTE */}
      <div
        className="absolute border-2 border-measurement-active/40 rounded-lg transition-all duration-200"
        style={{
          left: `${bestObject.bounds.x * scaleX}px`,
          top: `${bestObject.bounds.y * scaleY}px`,
          width: `${bestObject.bounds.width * scaleX}px`,
          height: `${bestObject.bounds.height * scaleY}px`,
        }}
      >
        {/* Center Point - Más sutil */}
        <div 
          className="absolute w-3 h-3 bg-measurement-active/80 rounded-full border border-white/50"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>

      {/* Panel de información FIJO en la esquina superior izquierda */}
      <div
        className="absolute top-4 left-4 z-20 font-mono text-sm px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          borderColor: 'rgba(132, 204, 22, 0.6)', // measurement-active con transparencia
          color: 'rgb(132, 204, 22)',
          minWidth: '200px',
          maxWidth: '280px'
        }}
      >
        <div className="space-y-2">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/20 pb-2">
            <span className="text-xs font-bold text-white">🎯 MEDICIÓN</span>
            <span className="text-xs bg-measurement-active/20 px-2 py-1 rounded text-white">
              {(bestObject.confidence * 100).toFixed(0)}%
            </span>
          </div>
          
          {/* Medidas principales */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">↔️ Ancho:</span>
              <span className="font-bold text-measurement-active">
                {formatDimension(bestObject.dimensions.width)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">↕️ Alto:</span>
              <span className="font-bold text-cyan-400">
                {formatDimension(bestObject.dimensions.height)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">📐 Área:</span>
              <span className="font-bold text-blue-400">
                {bestObject.dimensions.area < 1000 ? 
                  `${Math.round(bestObject.dimensions.area)}mm²` : 
                  bestObject.dimensions.area < 100000 ?
                  `${(bestObject.dimensions.area/100).toFixed(1)}cm²` :
                  `${(bestObject.dimensions.area/1000000).toFixed(3)}m²`
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Líneas de dimensión SUTILES - Solo en los bordes */}
      <>
        {/* Width line - Parte inferior */}
        <div
          className="absolute border-t-2 border-measurement-active/50"
          style={{
            left: `${bestObject.bounds.x * scaleX}px`,
            top: `${(bestObject.bounds.y + bestObject.bounds.height + 10) * scaleY}px`,
            width: `${bestObject.bounds.width * scaleX}px`,
          }}
        >
          <div className="absolute left-0 top-0 w-0.5 h-4 bg-measurement-active/50 -translate-y-2"></div>
          <div className="absolute right-0 top-0 w-0.5 h-4 bg-measurement-active/50 -translate-y-2"></div>
          <div className="absolute left-1/2 top-1 transform -translate-x-1/2 text-xs text-measurement-active font-bold bg-black/80 px-2 py-1 rounded">
            {formatDimension(bestObject.dimensions.width)}
          </div>
        </div>

        {/* Height line - Lado derecho */}
        <div
          className="absolute border-l-2 border-cyan-400/50"
          style={{
            left: `${(bestObject.bounds.x + bestObject.bounds.width + 10) * scaleX}px`,
            top: `${bestObject.bounds.y * scaleY}px`,
            height: `${bestObject.bounds.height * scaleY}px`,
          }}
        >
          <div className="absolute top-0 left-0 h-0.5 w-4 bg-cyan-400/50 -translate-x-2"></div>
          <div className="absolute bottom-0 left-0 h-0.5 w-4 bg-cyan-400/50 -translate-x-2"></div>
          <div 
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-cyan-400 font-bold bg-black/80 px-2 py-1 rounded"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {formatDimension(bestObject.dimensions.height)}
          </div>
        </div>
      </>
    </div>
  );
};