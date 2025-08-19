// COMPONENTE DE DISPLAY DE MEDICIONES
// Muestra resultados de mediciones 2D, 3D y propiedades de forma

import React from 'react';

export interface MeasurementDisplayProps {
  measurements: any;
  selectedObject: any;
  isCalculating: boolean;
  error: string | null;
  className?: string;
}

export const MeasurementDisplay: React.FC<MeasurementDisplayProps> = ({
  measurements,
  selectedObject,
  isCalculating,
  error,
  className = ''
}) => {
  if (error) {
    return (
      <div className={`measurement-display error ${className}`}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error de Medición:</strong> {error}
        </div>
      </div>
    );
  }

  if (!measurements && !isCalculating) {
    return (
      <div className={`measurement-display empty ${className}`}>
        <div className="bg-gray-100 border border-gray-300 text-gray-600 px-4 py-3 rounded text-center">
          No hay mediciones disponibles
        </div>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className={`measurement-display loading ${className}`}>
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Calculando mediciones...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`measurement-display ${className}`}>
      {/* INFORMACIÓN DEL OBJETO SELECCIONADO */}
      {selectedObject && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            📍 Objeto Seleccionado
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">ID:</span> {selectedObject.id}
            </div>
            <div>
              <span className="font-medium">Tipo:</span> {selectedObject.type}
            </div>
            <div>
              <span className="font-medium">Confianza:</span> {(selectedObject.confidence * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Área:</span> {Math.round(selectedObject.area)} px²
            </div>
          </div>
        </div>
      )}

      {/* MEDICIONES 2D */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          📏 Medidas 2D
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MeasurementCard
            title="Ancho"
            value={measurements?.width}
            unit={measurements?.unit}
            icon="↔️"
          />
          <MeasurementCard
            title="Alto"
            value={measurements?.height}
            unit={measurements?.unit}
            icon="↕️"
          />
          <MeasurementCard
            title="Área"
            value={measurements?.area}
            unit={`${measurements?.unit}²`}
            icon="⬜"
          />
          <MeasurementCard
            title="Perímetro"
            value={measurements?.perimeter}
            unit={measurements?.unit}
            icon="🔲"
          />
        </div>
      </div>

      {/* MEDICIONES 3D */}
      {measurements?.depth && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📦 Medidas 3D
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MeasurementCard
              title="Profundidad"
              value={measurements.depth}
              unit={measurements.unit}
              icon="🔍"
            />
            <MeasurementCard
              title="Volumen"
              value={measurements.volume}
              unit={`${measurements.unit}³`}
              icon="📦"
            />
            <MeasurementCard
              title="Área Superficie"
              value={measurements.surfaceArea}
              unit={`${measurements.unit}²`}
              icon="🌐"
            />
          </div>
        </div>
      )}

      {/* PROPIEDADES DE FORMA */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          🔷 Propiedades de Forma
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MeasurementCard
            title="Aspect Ratio"
            value={measurements?.aspectRatio}
            unit=""
            icon="📐"
            precision={3}
          />
          <MeasurementCard
            title="Circularidad"
            value={measurements?.circularity}
            unit=""
            icon="⭕"
            precision={3}
          />
          <MeasurementCard
            title="Compactness"
            value={measurements?.compactness}
            unit=""
            icon="🔶"
            precision={3}
          />
          <MeasurementCard
            title="Solidity"
            value={measurements?.solidity}
            unit=""
            icon="💎"
            precision={3}
          />
          <MeasurementCard
            title="Extent"
            value={measurements?.extent}
            unit=""
            icon="📊"
            precision={3}
          />
        </div>
      </div>

      {/* PROPIEDADES AVANZADAS */}
      {measurements?.curvature && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🔬 Propiedades Avanzadas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MeasurementCard
              title="Curvatura"
              value={measurements.curvature}
              unit=""
              icon="🌊"
              precision={4}
            />
            <MeasurementCard
              title="Suavidad"
              value={measurements.smoothness}
              unit=""
              icon="✨"
              precision={3}
            />
            <MeasurementCard
              title="Simetría"
              value={measurements.symmetry}
              unit=""
              icon="🔄"
              precision={3}
            />
            <MeasurementCard
              title="Orientación"
              value={measurements.orientation}
              unit="°"
              icon="🧭"
              precision={1}
            />
          </div>
        </div>
      )}

      {/* METADATOS */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          ℹ️ Metadatos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium">Unidad:</span> {measurements?.unit || 'mm'}
          </div>
          <div>
            <span className="font-medium">Confianza:</span> {(measurements?.confidence * 100 || 0).toFixed(1)}%
          </div>
          <div>
            <span className="font-medium">Píxeles/mm:</span> {measurements?.pixelsPerMm || 'N/A'}
          </div>
          <div>
            <span className="font-medium">Tiempo:</span> {(measurements?.processingTime || 0).toFixed(1)}ms
          </div>
        </div>
      </div>
    </div>
  );
};

// COMPONENTE DE TARJETA DE MEDICIÓN
interface MeasurementCardProps {
  title: string;
  value: number | undefined;
  unit: string;
  icon: string;
  precision?: number;
}

const MeasurementCard: React.FC<MeasurementCardProps> = ({
  title,
  value,
  unit,
  icon,
  precision = 2
}) => {
  const formatValue = (val: number | undefined): string => {
    if (val === undefined || val === null) return 'N/A';
    if (isNaN(val)) return 'N/A';
    return val.toFixed(precision);
  };

  const getValueColor = (val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val)) return 'text-gray-500';
    if (val === 0) return 'text-gray-500';
    return 'text-gray-900';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <h4 className="font-medium text-gray-700 text-sm">{title}</h4>
      </div>
      <div className={`text-xl font-bold ${getValueColor(value)}`}>
        {formatValue(value)}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
};

export default MeasurementDisplay;
