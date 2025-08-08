import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, Zap } from 'lucide-react';

interface MeasurementOverlayProps {
  objects: any[];
  isActive: boolean;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
}

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  objects,
  isActive,
  calibrationData
}) => {
  if (!isActive || objects.length === 0) return null;

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

  const formatArea = (value: number): string => {
    if (value < 1000) {
      return `${Math.round(value)}mm²`;
    } else if (value < 100000) {
      return `${(value / 100).toFixed(1)}cm²`;
    } else {
      return `${(value / 1000000).toFixed(3)}m²`;
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

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Overlay de mediciones en tiempo real */}
      <div className="absolute top-4 left-4 right-4">
        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium text-sm">
                📐 Medición en Tiempo Real
              </span>
            </div>
            <Badge 
              variant="outline" 
              className="bg-green-500/20 border-green-400 text-green-400 text-xs"
            >
              {objects.length} objeto{objects.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          {objects.slice(0, 2).map((obj, index) => (
            <div key={obj.id} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/90 text-xs font-medium">
                  Objeto {index + 1}
                </span>
                <span className="text-green-400 text-xs">
                  {((obj.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/70">↔️ Ancho</div>
                  <div className="text-green-400 font-bold">
                    {formatDimension(obj.dimensions?.width || obj.widthMm || 0)}
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/70">↕️ Alto</div>
                  <div className="text-blue-400 font-bold">
                    {formatDimension(obj.dimensions?.height || obj.heightMm || 0)}
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/70">
                    {obj.dimensions?.depth ? '📏 Profundidad' : '📐 Área'}
                  </div>
                  <div className="text-yellow-400 font-bold">
                    {obj.dimensions?.depth 
                      ? formatDimension(obj.dimensions.depth)
                      : formatArea(obj.areaMm2 || 0)
                    }
                  </div>
                </div>
                
                <div className="bg-white/10 rounded p-2">
                  <div className="text-white/70">
                    {obj.dimensions?.volume ? '📦 Volumen' : '📏 Diagonal'}
                  </div>
                  <div className="text-purple-400 font-bold">
                    {obj.dimensions?.volume 
                      ? formatVolume(obj.dimensions.volume)
                      : formatDimension(Math.sqrt((obj.widthMm || 0) ** 2 + (obj.heightMm || 0) ** 2))
                    }
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {calibrationData && (
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="text-white/60 text-xs">
                Factor: {calibrationData.pixelsPerMm.toFixed(1)} px/mm
              </span>
              <span className="text-white/60 text-xs">
                {calibrationData.isCalibrated ? '✅ Calibrado' : '⚠️ Sin Calibrar'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Indicador de enfoque en el centro */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-16 h-16 border-2 border-green-400 rounded-full flex items-center justify-center">
          <div className="w-8 h-8 border border-green-400 rounded-full"></div>
        </div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Target className="w-4 h-4 text-green-400" />
        </div>
      </div>

      {/* Grid de medición */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 h-px bg-white/20"></div>
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20"></div>
        <div className="absolute top-3/4 left-0 right-0 h-px bg-white/20"></div>
        <div className="absolute top-0 bottom-0 left-1/4 w-px bg-white/20"></div>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20"></div>
        <div className="absolute top-0 bottom-0 left-3/4 w-px bg-white/20"></div>
      </div>
    </div>
  );
};