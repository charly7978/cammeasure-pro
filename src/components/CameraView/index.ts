// EXPORTAR COMPONENTES REFACTORIZADOS DE CAMERA VIEW
export { CameraView } from './CameraView';
export { CameraControls } from './components/CameraControls';
export { VideoContainer } from './components/VideoContainer';
export { MeasurementPanel } from './components/MeasurementPanel';

// EXPORTAR HOOKS ESPECIALIZADOS
export { useCameraControls } from './hooks/useCameraControls';
export { useAutoDetection } from './hooks/useAutoDetection';
export { useManualSelection } from './hooks/useManualSelection';
export { useMeasurementDisplay } from './hooks/useMeasurementDisplay';

// EXPORTAR UTILIDADES DE DETECCIÓN
export { 
  detectBasicObjects, 
  calculateRealMeasurements, 
  drawObjectOverlay 
} from './utils/objectDetection';
