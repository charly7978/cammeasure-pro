import React from 'react';

// COMPONENTE DESHABILITADO TEMPORALMENTE PARA EVITAR SOBRECARGA
// El procesamiento 3D real es demasiado intensivo y causa congelación

export interface Real3DObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  measurements3D: any;
  depthMap: any;
  confidence: number;
  timestamp: number;
}

interface Real3DMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjects3DDetected: (objects: Real3DObject[]) => void;
  isActive: boolean;
  detectedObjects: any[];
}

export const Real3DMeasurement: React.FC<Real3DMeasurementProps> = ({
  videoRef,
  onObjects3DDetected,
  isActive,
  detectedObjects
}) => {
  // COMPONENTE DESHABILITADO - NO PROCESA NADA
  // Esto evita la sobrecarga computacional que causaba congelación
  
  React.useEffect(() => {
    // No hacer nada - componente deshabilitado
    if (isActive) {
      console.log('🚫 Procesamiento 3D real deshabilitado para evitar sobrecarga');
    }
  }, [isActive]);

  return (
    <>
      {/* Indicador de que el 3D real está deshabilitado */}
      {isActive && (
        <div className="fixed top-20 right-4 z-50">
          <div className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>3D ESTIMADO (RÁPIDO)</span>
            </div>
            <div className="text-xs opacity-70 mt-1">
              Optimizado para rendimiento
            </div>
          </div>
        </div>
      )}
    </>
  );
};