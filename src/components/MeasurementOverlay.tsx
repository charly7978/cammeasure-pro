
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

  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;

  const formatDimension = (value: number, unit: string): string => {
    if (value < 1) {
      return `${(value * 1000).toFixed(1)}μm`;
    } else if (value < 10) {
      return `${value.toFixed(2)}mm`;
    } else if (value < 100) {
      return `${value.toFixed(1)}mm`;
    } else if (value < 1000) {
      return `${(value / 10).toFixed(1)}cm`;
    } else {
      return `${(value / 1000).toFixed(3)}m`;
    }
  };

  const formatArea = (value: number, unit: string): string => {
    if (value < 1) {
      return `${(value * 1000000).toFixed(0)}μm²`;
    } else if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(4)}m²`;
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.9) return 'border-green-400 bg-green-400/10 text-green-400';
    if (confidence > 0.8) return 'border-measurement-active bg-measurement-active/10 text-measurement-active';
    if (confidence > 0.6) return 'border-yellow-400 bg-yellow-400/10 text-yellow-400';
    return 'border-red-400 bg-red-400/10 text-red-400';
  };

  // Solo el mejor objeto para medición precisa
  const bestObject = objects[0];
  if (!bestObject) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div key={bestObject.id}>
        {/* Bounding Box Mejorado con Alta Precisión */}
        <div
          className={`absolute border-2 rounded-lg ${getConfidenceColor(bestObject.confidence)} transition-all duration-150 shadow-xl`}
          style={{
            left: `${bestObject.bounds.x * scaleX}px`,
            top: `${bestObject.bounds.y * scaleY}px`,
            width: `${bestObject.bounds.width * scaleX}px`,
            height: `${bestObject.bounds.height * scaleY}px`,
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
          }}
        >
          {/* Puntos de esquina para mejor visualización */}
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-measurement-active rounded-full border-2 border-white"></div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-measurement-active rounded-full border-2 border-white"></div>
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-measurement-active rounded-full border-2 border-white"></div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-measurement-active rounded-full border-2 border-white"></div>
          
          {/* Centro del objeto */}
          <div 
            className="absolute w-4 h-4 bg-measurement-active rounded-full animate-ping border-2 border-white shadow-lg"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>

        {/* Panel de Información Transparente y Fijo - Esquina Superior Derecha */}
        <div
          className="absolute z-30 font-mono text-sm rounded-xl shadow-2xl border-2 backdrop-blur-md"
          style={{
            right: '20px',
            top: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: getConfidenceColor(bestObject.confidence).split(' ')[0].replace('border-', ''),
            minWidth: '280px',
            maxWidth: '320px'
          }}
        >
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-white/20 pb-2">
              <span className="text-xs font-bold text-measurement-active">🎯 MEDICIÓN PRECISA</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getConfidenceColor(bestObject.confidence).split(' ')[2]}`}></div>
                <span className="text-xs">
                  {(bestObject.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-2">
                <div className="bg-black/40 rounded p-2">
                  <div className="text-gray-300 text-xs mb-1">↔️ Ancho</div>
                  <div className="font-bold text-measurement-active">
                    {formatDimension(bestObject.dimensions.width, bestObject.dimensions.unit)}
                  </div>
                </div>
                <div className="bg-black/40 rounded p-2">
                  <div className="text-gray-300 text-xs mb-1">↕️ Alto</div>
                  <div className="font-bold text-accent">
                    {formatDimension(bestObject.dimensions.height, bestObject.dimensions.unit)}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="bg-black/40 rounded p-2">
                  <div className="text-gray-300 text-xs mb-1">📐 Área</div>
                  <div className="font-bold text-primary">
                    {formatArea(bestObject.dimensions.area, bestObject.dimensions.unit + '²')}
                  </div>
                </div>
                <div className="bg-black/40 rounded p-2">
                  <div className="text-gray-300 text-xs mb-1">📏 Diagonal</div>
                  <div className="font-bold text-calibration">
                    {formatDimension(
                      Math.sqrt(bestObject.dimensions.width ** 2 + bestObject.dimensions.height ** 2), 
                      bestObject.dimensions.unit
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Información adicional compacta */}
            <div className="text-xs text-gray-300 border-t border-white/10 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Perímetro:</span>
                <span className="text-white font-mono">
                  {formatDimension(2 * (bestObject.dimensions.width + bestObject.dimensions.height), bestObject.dimensions.unit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Aspecto:</span>
                <span className="text-white font-mono">
                  {(bestObject.dimensions.width / bestObject.dimensions.height).toFixed(3)}:1
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pixeles:</span>
                <span className="text-white font-mono">
                  {bestObject.bounds.width}×{bestObject.bounds.height}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Líneas de Dimensión Mejoradas con Mayor Precisión */}
        <>
          {/* Línea de ancho */}
          <div
            className="absolute border-t-2 border-measurement-active opacity-80 shadow-lg"
            style={{
              left: `${bestObject.bounds.x * scaleX}px`,
              top: `${(bestObject.bounds.y + bestObject.bounds.height + 25) * scaleY}px`,
              width: `${bestObject.bounds.width * scaleX}px`,
            }}
          >
            <div className="absolute left-0 top-0 w-0.5 h-8 bg-measurement-active -translate-y-4 shadow-lg"></div>
            <div className="absolute right-0 top-0 w-0.5 h-8 bg-measurement-active -translate-y-4 shadow-lg"></div>
            <div className="absolute left-1/2 top-3 transform -translate-x-1/2 text-xs text-measurement-active font-bold bg-black/90 px-2 py-1 rounded shadow-xl border border-measurement-active/30">
              {formatDimension(bestObject.dimensions.width, bestObject.dimensions.unit)}
            </div>
          </div>

          {/* Línea de altura */}
          <div
            className="absolute border-l-2 border-accent opacity-80 shadow-lg"
            style={{
              left: `${(bestObject.bounds.x + bestObject.bounds.width + 25) * scaleX}px`,
              top: `${bestObject.bounds.y * scaleY}px`,
              height: `${bestObject.bounds.height * scaleY}px`,
            }}
          >
            <div className="absolute top-0 left-0 h-0.5 w-8 bg-accent -translate-x-4 shadow-lg"></div>
            <div className="absolute bottom-0 left-0 h-0.5 w-8 bg-accent -translate-x-4 shadow-lg"></div>
            <div 
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xs text-accent font-bold bg-black/90 px-2 py-1 rounded shadow-xl border border-accent/30"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {formatDimension(bestObject.dimensions.height, bestObject.dimensions.unit)}
            </div>
          </div>
        </>
      </div>

      {/* Indicador de Estado del Sistema - Esquina Inferior Izquierda */}
      <div className="absolute bottom-4 left-4 z-30">
        <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-measurement-active/30">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-measurement-active font-mono">OpenCV Avanzado Activo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
