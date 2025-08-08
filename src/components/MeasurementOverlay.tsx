
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';

interface MeasurementOverlayProps {
  objects: any[];
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  objects,
  isActive,
  calibrationData,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight
}) => {
  if (!isActive || !videoWidth || !videoHeight || !containerWidth || !containerHeight) return null;

  const formatDimension = (value: number): string => {
    if (value < 10) return `${value.toFixed(1)}mm`;
    if (value < 100) return `${value.toFixed(0)}mm`;
    if (value < 1000) return `${(value / 10).toFixed(1)}cm`;
    return `${(value / 1000).toFixed(2)}m`;
  };

  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;

  const hasObjects = Array.isArray(objects) && objects.length > 0;
  const best = hasObjects ? objects[0] : null;
  const bbox = best?.bbox || { x: 0, y: 0, width: 0, height: 0 };
  const left = bbox.x * scaleX;
  const top = bbox.y * scaleY;
  const width = bbox.width * scaleX;
  const height = bbox.height * scaleY;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Panel superior */}
      <div className="absolute top-4 left-4 right-4">
        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium text-sm">Medición en Tiempo Real</span>
            </div>
            <Badge variant="outline" className="bg-green-500/20 border-green-400 text-green-400 text-xs">
              {hasObjects ? `${objects.length} objetos` : 'Sin detecciones'}
            </Badge>
          </div>
          {hasObjects ? (
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-white/70">↔️ Ancho</p>
                <p className="text-green-400 font-bold">{formatDimension(best?.dimensions?.width || best?.widthMm || 0)}</p>
              </div>
              <div>
                <p className="text-white/70">↕️ Alto</p>
                <p className="text-blue-400 font-bold">{formatDimension(best?.dimensions?.height || best?.heightMm || 0)}</p>
              </div>
              <div>
                <p className="text-white/70">{best?.dimensions?.depth ? '📏 Profundidad' : '📐 Área'}</p>
                <p className="text-yellow-400 font-bold">
                  {best?.dimensions?.depth ? formatDimension(best.dimensions.depth) : `${Math.round(best?.areaMm2 || 0)}mm²`}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-white/80">Apunta a un objeto con bordes claros y buena iluminación.</div>
          )}
        </div>
      </div>

      {/* Cruz de enfoque siempre visible */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-green-400 rounded-full" />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-6 h-0.5 bg-green-400" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-6 h-0.5 bg-green-400" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-6 bg-green-400" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-0.5 h-6 bg-green-400" />
        </div>
      </div>

      {/* Bounding box si hay detecciones */}
      {hasObjects && (
        <>
          <div className="absolute border-2 border-green-400 rounded-md" style={{ left, top, width, height }} />
          <div className="absolute h-0.5 bg-green-400" style={{ left, top: top + height + 12, width }}>
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-green-400" />
            <div className="absolute -right-1 -top-1 w-2 h-2 bg-green-400" />
          </div>
          <div className="absolute w-0.5 bg-blue-400" style={{ left: left + width + 12, top, height }}>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-400" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400" />
          </div>
        </>
      )}
    </div>
  );
};
