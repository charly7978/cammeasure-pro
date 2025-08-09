import React, { useMemo } from 'react';
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

  const formatVolume = (value: number): string => {
    if (value < 1000) {
      return `${Math.round(value)}mm³`;
    } else if (value < 1000000) {
      return `${(value / 1000).toFixed(1)}cm³`;
    } else {
      return `${(value / 1000000).toFixed(3)}m³`;
    }
  };

  // Solo mostrar el mejor objeto (el primero)
  const bestObject = objects[0];
  if (!bestObject) return null;

  const isReal3D = bestObject.isReal3D && bestObject.measurements3D;

  // Calcular ubicación inteligente del panel
  const panelPosition = useMemo(() => {
    const objectCenterX = (bestObject.bounds.x + bestObject.bounds.width / 2) * scaleX;
    const objectCenterY = (bestObject.bounds.y + bestObject.bounds.height / 2) * scaleY;
    const objectRight = (bestObject.bounds.x + bestObject.bounds.width) * scaleX;
    const objectBottom = (bestObject.bounds.y + bestObject.bounds.height) * scaleY;
    
    // Determinar cuadrante del objeto
    const isObjectInLeftHalf = objectCenterX < containerWidth / 2;
    const isObjectInTopHalf = objectCenterY < containerHeight / 2;
    
    // Calcular posición óptima para no obstruir
    let left, top;
    const panelWidth = 280;
    const panelHeight = isReal3D ? 400 : 320;
    const margin = 20;
    
    if (isObjectInLeftHalf) {
      // Objeto en izquierda - poner panel a la derecha
      left = Math.min(objectRight + margin, containerWidth - panelWidth - margin);
    } else {
      // Objeto en derecha - poner panel a la izquierda
      left = Math.max(margin, bestObject.bounds.x * scaleX - panelWidth - margin);
    }
    
    if (isObjectInTopHalf) {
      // Objeto en arriba - poner panel abajo
      top = Math.min(objectBottom + margin, containerHeight - panelHeight - margin);
    } else {
      // Objeto en abajo - poner panel arriba
      top = Math.max(margin, bestObject.bounds.y * scaleY - panelHeight - margin);
    }
    
    // Asegurar que el panel no se salga de la pantalla
    left = Math.max(margin, Math.min(left, containerWidth - panelWidth - margin));
    top = Math.max(margin, Math.min(top, containerHeight - panelHeight - margin));
    
    return { left, top, width: panelWidth, height: panelHeight };
  }, [bestObject, scaleX, scaleY, containerWidth, containerHeight, isReal3D]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Contornos reales detectados por OpenCV */}
      {bestObject.contourPoints && bestObject.contourPoints > 0 && (
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{ width: containerWidth, height: containerHeight }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Contorno principal basado en detección real */}
          <rect
            x={bestObject.bounds.x * scaleX}
            y={bestObject.bounds.y * scaleY}
            width={bestObject.bounds.width * scaleX}
            height={bestObject.bounds.height * scaleY}
            fill="none"
            stroke={isReal3D ? "rgba(168, 85, 247, 0.8)" : "rgba(132, 204, 22, 0.8)"}
            strokeWidth="2"
            strokeDasharray="5,5"
            filter="url(#glow)"
            rx="4"
            ry="4"
          />
        </svg>
      )}

      {/* Bounding Box con efecto de brillo */}
      <div
        className={`absolute border-2 rounded-lg transition-all duration-200 ${
          isReal3D 
            ? 'border-purple-400/80 shadow-purple-400/50 shadow-lg animate-pulse' 
            : 'border-measurement-active/60 shadow-measurement-active/40'
        }`}
        style={{
          left: `${bestObject.bounds.x * scaleX}px`,
          top: `${bestObject.bounds.y * scaleY}px`,
          width: `${bestObject.bounds.width * scaleX}px`,
          height: `${bestObject.bounds.height * scaleY}px`,
          boxShadow: isReal3D 
            ? '0 0 20px rgba(168, 85, 247, 0.6), inset 0 0 20px rgba(168, 85, 247, 0.2)'
            : '0 0 15px rgba(132, 204, 22, 0.4), inset 0 0 15px rgba(132, 204, 22, 0.1)'
        }}
      >
        {/* Center Point con animación */}
        <div 
          className={`absolute w-4 h-4 rounded-full border-2 border-white animate-ping ${
            isReal3D ? 'bg-purple-400' : 'bg-measurement-active'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            animationDuration: '2s'
          }}
        />
        <div 
          className={`absolute w-3 h-3 rounded-full border border-white/80 ${
            isReal3D ? 'bg-purple-400/90' : 'bg-measurement-active/90'
          }`}
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>

      {/* Panel de información INTELIGENTE - Posición dinámica */}
      <div
        className="absolute z-20 font-mono text-sm px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-lg transition-all duration-300"
        style={{
          left: `${panelPosition.left}px`,
          top: `${panelPosition.top}px`,
          width: `${panelPosition.width}px`,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', // Más transparente
          borderColor: isReal3D ? 'rgba(168, 85, 247, 0.8)' : 'rgba(132, 204, 22, 0.8)',
          color: isReal3D ? 'rgb(168, 85, 247)' : 'rgb(132, 204, 22)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="space-y-2">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/20 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1">
              {isReal3D ? '🎯 MEDICIÓN 3D REAL' : '🎯 MEDICIÓN 2D'}
              {isReal3D && <span className="text-purple-300 text-xs">(REAL)</span>}
            </span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded text-white">
              {(bestObject.confidence * 100).toFixed(0)}%
            </span>
          </div>
          
          {/* Medidas 2D básicas */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">↔️ Ancho:</span>
              <span className={`font-bold ${isReal3D ? 'text-purple-300' : 'text-measurement-active'}`}>
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

          {/* Medidas 3D REALES */}
          {isReal3D && bestObject.measurements3D && (
            <>
              <div className="border-t border-purple-400/30 pt-2">
                <div className="text-xs font-bold text-purple-300 mb-1">📊 DIMENSIONES 3D REALES</div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">📏 Ancho 3D:</span>
                    <span className="font-bold text-purple-300">
                      {formatDimension(bestObject.measurements3D.width3D)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">📐 Alto 3D:</span>
                    <span className="font-bold text-purple-300">
                      {formatDimension(bestObject.measurements3D.height3D)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">🔍 Profundidad:</span>
                    <span className="font-bold text-orange-400">
                      {formatDimension(bestObject.measurements3D.depth3D)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">📦 Volumen:</span>
                    <span className="font-bold text-yellow-400">
                      {formatVolume(bestObject.measurements3D.volume3D)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/70">📍 Distancia:</span>
                    <span className="font-bold text-green-400">
                      {formatDimension(bestObject.measurements3D.distance)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Información técnica 3D */}
              <div className="border-t border-white/10 pt-2">
                <div className="text-xs text-white/60">
                  <div className="flex justify-between">
                    <span>Confianza 3D:</span>
                    <span>{(bestObject.measurements3D.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Método:</span>
                    <span>Structure from Motion</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Información adicional para objetos no 3D */}
          {!isReal3D && (
            <div className="border-t border-white/10 pt-2">
              <div className="text-xs text-white/60">
                <div className="flex justify-between">
                  <span>Diagonal:</span>
                  <span>{formatDimension(Math.sqrt(bestObject.dimensions.width ** 2 + bestObject.dimensions.height ** 2))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Perímetro:</span>
                  <span>{formatDimension(2 * (bestObject.dimensions.width + bestObject.dimensions.height))}</span>
                </div>
                <div className="text-xs text-yellow-400 mt-1">
                  💡 Calibra para mediciones 3D reales
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Líneas de dimensión - Color diferente para 3D */}
      <>
        {/* Width line */}
        <div
          className={`absolute border-t-2 ${
            isReal3D ? 'border-purple-400/60' : 'border-measurement-active/50'
          }`}
          style={{
            left: `${bestObject.bounds.x * scaleX}px`,
            top: `${(bestObject.bounds.y + bestObject.bounds.height + 10) * scaleY}px`,
            width: `${bestObject.bounds.width * scaleX}px`,
          }}
        >
          <div className={`absolute left-0 top-0 w-0.5 h-4 -translate-y-2 ${
            isReal3D ? 'bg-purple-400/60' : 'bg-measurement-active/50'
          }`}></div>
          <div className={`absolute right-0 top-0 w-0.5 h-4 -translate-y-2 ${
            isReal3D ? 'bg-purple-400/60' : 'bg-measurement-active/50'
          }`}></div>
          <div className={`absolute left-1/2 top-1 transform -translate-x-1/2 text-xs font-bold bg-black/80 px-2 py-1 rounded ${
            isReal3D ? 'text-purple-400' : 'text-measurement-active'
          }`}>
            {isReal3D && bestObject.measurements3D ? 
              formatDimension(bestObject.measurements3D.width3D) : 
              formatDimension(bestObject.dimensions.width)
            }
            {isReal3D && <span className="text-xs ml-1">(3D)</span>}
          </div>
        </div>

        {/* Height line */}
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
            {isReal3D && bestObject.measurements3D ? 
              formatDimension(bestObject.measurements3D.height3D) : 
              formatDimension(bestObject.dimensions.height)
            }
            {isReal3D && <span className="text-xs">(3D)</span>}
          </div>
        </div>

        {/* Depth line - Solo para objetos 3D reales */}
        {isReal3D && bestObject.measurements3D && (
          <div
            className="absolute border-dashed border-2 border-orange-400/60"
            style={{
              left: `${(bestObject.bounds.x + bestObject.bounds.width / 2) * scaleX - 20}px`,
              top: `${(bestObject.bounds.y + bestObject.bounds.height / 2) * scaleY - 20}px`,
              width: '40px',
              height: '40px',
              borderRadius: '50%'
            }}
          >
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-orange-400 font-bold bg-black/80 px-2 py-1 rounded whitespace-nowrap">
              ⬇️ {formatDimension(bestObject.measurements3D.depth3D)}
            </div>
          </div>
        )}
      </>
    </div>
  );
};
