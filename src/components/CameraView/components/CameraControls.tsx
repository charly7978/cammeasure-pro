import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  SwitchCamera, 
  Zap,
  Grid3X3,
  Focus,
  Target,
  Pause,
  Play
} from 'lucide-react';
import { DetectedObject } from '@/lib/types';

interface CameraControlsProps {
  currentCamera: 'front' | 'back';
  cameraStream: MediaStream | null;
  isAutoMode: boolean;
  detectedObjects: DetectedObject[];
  isProcessing: boolean;
  isManualMode: boolean;
  showGrid: boolean;
  flashEnabled: boolean;
  onCameraSwitch: () => void;
  onGridToggle: () => void;
  onFlashToggle: () => void;
  onFocusReset: () => void;
  onManualModeToggle: () => void;
  onAutoModeToggle: () => void;
  onForceMeasurement: () => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  currentCamera,
  cameraStream,
  isAutoMode,
  detectedObjects,
  isProcessing,
  isManualMode,
  showGrid,
  flashEnabled,
  onCameraSwitch,
  onGridToggle,
  onFlashToggle,
  onFocusReset,
  onManualModeToggle,
  onAutoModeToggle,
  onForceMeasurement
}) => {
  return (
    <div className="flex items-center justify-between bg-card/50 p-3 rounded-lg">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-primary text-primary text-xs">
          <Camera className="w-3 h-3 mr-1" />
          {currentCamera === 'back' ? 'Principal' : 'Frontal'}
        </Badge>
        
        {cameraStream && (
          <Badge variant="secondary" className="animate-measurement-pulse text-xs">
            <div className="w-2 h-2 bg-measurement-active rounded-full mr-1"></div>
            En Vivo
          </Badge>
        )}

        {isAutoMode && detectedObjects.length > 0 && (
          <Badge variant="outline" className="border-measurement-active text-measurement-active text-xs">
            <Target className="w-3 h-3 mr-1" />
            🎯 Detectado
          </Badge>
        )}

        {isProcessing && (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-xs animate-pulse">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
            Procesando
          </Badge>
        )}
        
        {isManualMode && (
          <Badge variant="outline" className="border-green-500 text-green-500 text-xs animate-pulse">
            <Target className="w-3 h-3 mr-1" />
            👆 Selección Manual
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoModeToggle}
          className={`h-8 w-8 p-0 ${isAutoMode ? "bg-measurement-active text-background" : ""}`}
        >
          {isAutoMode ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onGridToggle}
          className={`h-8 w-8 p-0 ${showGrid ? "bg-primary text-primary-foreground" : ""}`}
        >
          <Grid3X3 className="w-3 h-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onFlashToggle}
          className={`h-8 w-8 p-0 ${flashEnabled ? "bg-calibration text-background" : ""}`}
        >
          <Zap className="w-3 h-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onCameraSwitch}
          className="h-8 w-8 p-0"
        >
          <SwitchCamera className="w-3 h-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onFocusReset}
          className="h-8 w-8 p-0"
        >
          <Focus className="w-3 h-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onManualModeToggle}
          className={`h-8 w-8 p-0 ${isManualMode ? "bg-green-500 text-background" : ""}`}
          title="Modo Selección Manual"
        >
          <Target className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
