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
      if (value < 10) return `${value.toFixed(1)}mm`;
      if (value < 1000) return `${Math.round(value)}mm`;
      return `${(value / 1000).toFixed(2)}m`;
    }
    return `${Math.round(value)}px`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'border-measurement-active bg-measurement-active/20 text-measurement-active';
    if (confidence > 0.6) return 'border-calibration bg-calibration/20 text-calibration';
    return 'border-measurement-inactive bg-measurement-inactive/20 text-measurement-inactive';
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {objects.map((obj) => (
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
              className="absolute w-2 h-2 bg-measurement-active rounded-full animate-measurement-pulse"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            />
          </div>

          {/* Measurement Labels */}
          <div
            className={`absolute ${getConfidenceColor(obj.confidence).split(' ')[2]} font-mono text-xs px-2 py-1 rounded backdrop-blur-sm`}
            style={{
              left: `${obj.bounds.x * scaleX}px`,
              top: `${(obj.bounds.y * scaleY) - 30}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }}
          >
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <span>W: {formatDimension(obj.dimensions.width, obj.dimensions.unit)}</span>
                <span>H: {formatDimension(obj.dimensions.height, obj.dimensions.unit)}</span>
              </div>
              {obj.dimensions.unit !== 'px' && (
                <div className="text-xs opacity-80">
                  Area: {formatDimension(obj.dimensions.area, obj.dimensions.unit + '²')}
                </div>
              )}
              <div className="text-xs opacity-60">
                Conf: {(obj.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Dimension Lines */}
          {/* Width line */}
          <div
            className="absolute border-t-2 border-measurement-active"
            style={{
              left: `${obj.bounds.x * scaleX}px`,
              top: `${(obj.bounds.y + obj.bounds.height + 10) * scaleY}px`,
              width: `${obj.bounds.width * scaleX}px`,
            }}
          >
            <div className="absolute left-0 top-0 w-0.5 h-3 bg-measurement-active -translate-y-1"></div>
            <div className="absolute right-0 top-0 w-0.5 h-3 bg-measurement-active -translate-y-1"></div>
            <div className="absolute left-1/2 top-1 transform -translate-x-1/2 text-xs text-measurement-active font-mono bg-black/80 px-1 rounded">
              {formatDimension(obj.dimensions.width, obj.dimensions.unit)}
            </div>
          </div>

          {/* Height line */}
          <div
            className="absolute border-l-2 border-accent"
            style={{
              left: `${(obj.bounds.x + obj.bounds.width + 10) * scaleX}px`,
              top: `${obj.bounds.y * scaleY}px`,
              height: `${obj.bounds.height * scaleY}px`,
            }}
          >
            <div className="absolute top-0 left-0 h-0.5 w-3 bg-accent -translate-x-1"></div>
            <div className="absolute bottom-0 left-0 h-0.5 w-3 bg-accent -translate-x-1"></div>
            <div 
              className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-accent font-mono bg-black/80 px-1 rounded"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {formatDimension(obj.dimensions.height, obj.dimensions.unit)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};