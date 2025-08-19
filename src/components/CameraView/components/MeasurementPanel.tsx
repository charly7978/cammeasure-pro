import { Card } from '@/components/ui/card';

interface MeasurementPanelProps {
  currentMeasurement: any;
}

export const MeasurementPanel: React.FC<MeasurementPanelProps> = ({
  currentMeasurement
}) => {
  return (
    <Card className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/30">
      <h4 className="font-medium mb-3 text-green-400">🎯 Objeto Central Prominente Detectado</h4>
     
     {/* MEDICIONES PRINCIPALES EN MM */}
     <div className="grid grid-cols-2 gap-4 mb-4">
       <div className="space-y-2">
         <div>
           <p className="text-gray-300 text-sm">📏 Ancho Real</p>
           <p className="font-mono text-green-400 font-bold text-xl">
             {currentMeasurement.measurements.realWidth?.toFixed(1) || 'N/A'} mm
           </p>
         </div>
         <div>
           <p className="text-gray-300 text-sm">📐 Área Real</p>
           <p className="font-mono text-blue-400 font-bold">
             {currentMeasurement.measurements.realArea?.toFixed(1) || 'N/A'} mm²
           </p>
         </div>
       </div>
       <div className="space-y-2">
         <div>
           <p className="text-gray-300 text-sm">📏 Alto Real</p>
           <p className="font-mono text-cyan-400 font-bold text-xl">
             {currentMeasurement.measurements.realHeight?.toFixed(1) || 'N/A'} mm
           </p>
         </div>
         <div>
           <p className="text-gray-300 text-sm">🔍 Profundidad</p>
           <p className="font-mono text-yellow-400 font-bold">
             {currentMeasurement.measurements.depth?.toFixed(1) || 'N/A'} mm
           </p>
         </div>
       </div>
     </div>
     
     {/* MEDICIONES 3D */}
     {currentMeasurement.measurements.volume && (
       <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-blue-900/20 rounded-lg">
         <div>
           <p className="text-gray-300 text-sm">📦 Volumen</p>
           <p className="font-mono text-blue-400 font-bold">
             {currentMeasurement.measurements.volume.toFixed(1)} mm³
           </p>
         </div>
         <div>
           <p className="text-gray-300 text-sm">🌐 Superficie</p>
           <p className="font-mono text-cyan-400 font-bold">
             {currentMeasurement.measurements.surfaceArea.toFixed(1)} mm²
           </p>
         </div>
       </div>
     )}
     
     {/* ANÁLISIS DE FORMA */}
     <div className="grid grid-cols-3 gap-2 text-xs">
       <div className="text-center p-2 bg-gray-800/30 rounded">
         <p className="text-gray-400">Circularidad</p>
         <p className="text-yellow-400 font-bold">
           {currentMeasurement.measurements.circularity?.toFixed(3) || 'N/A'}
         </p>
       </div>
       <div className="text-center p-2 bg-gray-800/30 rounded">
         <p className="text-gray-400">Solidez</p>
         <p className="text-green-400 font-bold">
           {currentMeasurement.measurements.solidity?.toFixed(3) || 'N/A'}
         </p>
       </div>
       <div className="text-center p-2 bg-gray-800/30 rounded">
         <p className="text-gray-400">Compacidad</p>
         <p className="text-blue-400 font-bold">
           {currentMeasurement.measurements.compactness?.toFixed(6) || 'N/A'}
         </p>
       </div>
     </div>
     
     {/* INFORMACIÓN DE CALIBRACIÓN */}
     <div className="mt-3 pt-3 border-t border-white/10">
       <p className="text-xs text-gray-400">
         Unidad: {currentMeasurement.measurements.unit} | 
         Confianza: {(currentMeasurement.measurements.confidence * 100).toFixed(0)}%
       </p>
     </div>
   </Card>
  );
};
