import React, { forwardRef } from 'react';
import { TouchObjectSelector } from '../../TouchObjectSelector';
import { DetectedObject } from '@/lib/types';

interface VideoContainerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  showGrid: boolean;
  focusPoint: { x: number; y: number } | null;
  flashEnabled: boolean;
  isManualMode: boolean;
  onFocus: (event: React.MouseEvent<HTMLVideoElement>) => void;
  onManualObjectSelection: (object: DetectedObject, measurements: any) => void;
  onManualSelectionError: (error: string) => void;
}

export const VideoContainer = forwardRef<HTMLDivElement, VideoContainerProps>(({
  videoRef,
  overlayCanvasRef,
  showGrid,
  focusPoint,
  flashEnabled,
  isManualMode,
  onFocus,
  onManualObjectSelection,
  onManualSelectionError
}, ref) => {
  return (
    <div ref={ref} className="relative bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-auto"
        autoPlay
        playsInline
        muted
        onClick={onFocus}
      />
      
      {/* Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      
      {/* Touch Object Selector - Selección Manual por Toque */}
      <TouchObjectSelector
        videoRef={videoRef}
        overlayCanvasRef={overlayCanvasRef}
        onObjectSelected={onManualObjectSelection}
        onError={onManualSelectionError}
        isActive={isManualMode}
      />
      
      {/* Grid Overlay */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/20"></div>
            ))}
          </div>
        </div>
      )}
      
      {/* Focus Point */}
      {focusPoint && (
        <div
          className="absolute w-4 h-4 bg-red-500 rounded-full pointer-events-none animate-ping"
          style={{
            left: focusPoint.x - 8,
            top: focusPoint.y - 8
          }}
        />
      )}
      
      {/* Flash Effect */}
      {flashEnabled && (
        <div className="absolute inset-0 bg-white/50 pointer-events-none animate-pulse" />
      )}
    </div>
  );
});

VideoContainer.displayName = 'VideoContainer';
