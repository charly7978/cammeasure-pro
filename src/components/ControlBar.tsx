import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Ruler, Maximize2, Lock } from 'lucide-react';

interface ControlBarProps {
  edgeScale: number;
  onEdgeScale: (v: number) => void;
  minAreaScale: number;
  onMinAreaScale: (v: number) => void;
  pixelsPerMm: number;
  onPixelsPerMm: (v: number) => void;
  onFullscreen: () => void;
  onLockOrientation: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  edgeScale, onEdgeScale,
  minAreaScale, onMinAreaScale,
  pixelsPerMm, onPixelsPerMm,
  onFullscreen, onLockOrientation
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-md border-t border-white/10 p-3 space-y-3 md:relative md:bg-transparent md:backdrop-blur-0 md:border-0">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-white/70 mb-1">Sensibilidad bordes</div>
          <Slider value={[edgeScale]} min={0.5} max={2} step={0.1} onValueChange={(v)=>onEdgeScale(v[0])} />
        </div>
        <div>
          <div className="text-xs text-white/70 mb-1">Área mínima</div>
          <Slider value={[minAreaScale]} min={0.5} max={2} step={0.1} onValueChange={(v)=>onMinAreaScale(v[0])} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white/80">
          <Ruler className="w-4 h-4" />
          <span className="text-xs">px/mm</span>
          <input
            type="number"
            className="w-20 bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20"
            value={Number.isFinite(pixelsPerMm) ? pixelsPerMm : 8}
            onChange={(e)=> onPixelsPerMm(Math.max(0.5, Math.min(100, Number(e.target.value) || 8)))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onFullscreen}>
            <Maximize2 className="w-4 h-4 mr-1" /> Pantalla completa
          </Button>
          <Button size="sm" variant="outline" onClick={onLockOrientation}>
            <Lock className="w-4 h-4 mr-1" /> Bloquear vertical
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
