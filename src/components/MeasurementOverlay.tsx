
import React from 'react';
import { DetectedObject } from '@/lib/types';

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

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {objects.map((obj) => {
          const x = obj.boundingBox.x * scaleX;
          const y = obj.boundingBox.y * scaleY;
          const width = obj.boundingBox.width * scaleX;
          const height = obj.boundingBox.height * scaleY;

          return (
            <g key={obj.id}>
              {/* Bounding box */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="none"
                stroke={obj.confidence > 0.8 ? "#10B981" : "#F59E0B"}
                strokeWidth="2"
                strokeDasharray="4,4"
                opacity="0.8"
              />
              
              {/* Center point */}
              <circle
                cx={x + width / 2}
                cy={y + height / 2}
                r="4"
                fill={obj.confidence > 0.8 ? "#10B981" : "#F59E0B"}
                opacity="0.9"
              />

              {/* Measurement label */}
              <rect
                x={x}
                y={y - 30}
                width={120}
                height={25}
                fill="rgba(0,0,0,0.8)"
                rx="4"
              />
              <text
                x={x + 5}
                y={y - 12}
                fill="white"
                fontSize="12"
                fontFamily="monospace"
              >
                {obj.dimensions.width.toFixed(1)} × {obj.dimensions.height.toFixed(1)} {obj.dimensions.unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
