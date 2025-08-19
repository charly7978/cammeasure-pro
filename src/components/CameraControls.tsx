// COMPONENTE DE CONTROLES DE CÁMARA
// Interfaz limpia para controlar modos de detección y cámara

import React from 'react';

export interface CameraControlsProps {
  isActive: boolean;
  isAutoMode: boolean;
  isManualMode: boolean;
  onToggleMode: () => void;
  onClearSelection: () => void;
  detectionConfidence: number;
  isDetecting: boolean;
  isCalculating: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  isActive,
  isAutoMode,
  isManualMode,
  onToggleMode,
  onClearSelection,
  detectionConfidence,
  isDetecting,
  isCalculating
}) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  return (
    <div className="camera-controls bg-gray-800 p-4 rounded-lg mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* ESTADO DE LA CÁMARA */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-white text-sm">
            {isActive ? 'Cámara Activa' : 'Cámara Inactiva'}
          </span>
        </div>

        {/* MODO DE DETECCIÓN */}
        <div className="flex items-center gap-2">
          <span className="text-white text-sm">Modo:</span>
          <button
            onClick={onToggleMode}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isAutoMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {isAutoMode ? '🔄 Automático' : '👆 Manual'}
          </button>
        </div>

        {/* CONFIANZA DE DETECCIÓN */}
        <div className="flex items-center gap-2">
          <span className="text-white text-sm">Confianza:</span>
          <span className={`text-sm font-bold ${getConfidenceColor(detectionConfidence)}`}>
            {getConfidenceText(detectionConfidence)}
          </span>
        </div>

        {/* BOTÓN DE LIMPIAR */}
        <button
          onClick={onClearSelection}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          🗑️ Limpiar
        </button>
      </div>

      {/* INDICADORES DE ESTADO */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700">
        {isDetecting && (
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Detectando objetos...
          </div>
        )}
        
        {isCalculating && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Calculando mediciones...
          </div>
        )}
        
        {isManualMode && (
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            Modo manual activo - Toca un objeto
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraControls;
