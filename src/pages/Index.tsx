
import React, { useState } from 'react';
import { View } from 'react-native';
import { AdvancedCameraView } from '@/components/AdvancedCameraView';
import { MeasurementControls } from '@/components/MeasurementControls';
import { CalibrationProvider } from '@/lib/calibrationContext';
import { Card } from '@/components/ui/card';
import type { MeasurementMode } from '@/components/MeasurementControls';

export default function Index() {
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('2d');
  const [measurementResult, setMeasurementResult] = useState(null);

  const handleMeasurementComplete = (measurements: any) => {
    console.log('[Index] Medición completada:', measurements);
    setMeasurementResult(measurements);
  };

  const handleCalibrationUpdate = (calibration: any) => {
    console.log('[Index] Calibración actualizada:', calibration);
  };

  return (
    <CalibrationProvider>
      <View className="flex-1 bg-background">
        {/* Vista Principal de Cámara */}
        <View className="flex-1">
          <AdvancedCameraView
            onMeasurementComplete={handleMeasurementComplete}
            onCalibrationUpdate={handleCalibrationUpdate}
            measurementMode="auto"
          />
        </View>

        {/* Panel de Controles Deslizable */}
        <View className="absolute bottom-0 left-0 right-0">
          <Card className="m-2 bg-background/95 backdrop-blur-sm">
            <MeasurementControls
              measurementMode={measurementMode}
              onModeChange={setMeasurementMode}
              measurementResult={measurementResult}
              isCalibrated={true}
              onCapture={() => {
                console.log('Captura solicitada');
              }}
              onReset={() => {
                setMeasurementResult(null);
              }}
              onSave={() => {
                console.log('Guardado solicitado');
              }}
              onExport={() => {
                console.log('Exportación solicitada');
              }}
            />
          </Card>
        </View>
      </View>
    </CalibrationProvider>
  );
}
