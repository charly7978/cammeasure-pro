
/**
 * Vista de Cámara Avanzada - Interfaz reorganizada y optimizada
 * Conecta TODOS los algoritmos nativos con flujo de datos correcto
 * Overlay no intrusivo con máxima efectividad visual
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Text, Alert, Dimensions } from 'react-native';
import { Camera, CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { 
  Play, Pause, RotateCcw, Zap, ZapOff, Settings, 
  Target, Grid3X3, Focus, Layers, Box 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OptimizedAROverlay } from './OptimizedAROverlay';
import { NativeDataPipeline } from '@/lib/NativeDataPipeline';
import { useCalibration } from '@/hooks/useCalibration';

interface AdvancedCameraViewProps {
  onMeasurementComplete?: (measurements: any) => void;
  onCalibrationUpdate?: (calibration: any) => void;
  measurementMode?: 'auto' | 'manual' | 'precision';
}

type OverlayMode = 'minimal' | 'detailed' | 'professional';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AdvancedCameraView: React.FC<AdvancedCameraViewProps> = ({
  onMeasurementComplete,
  onCalibrationUpdate,
  measurementMode = 'auto'
}) => {
  // Estados principales
  const [permission, requestPermission] = useCameraPermissions();
  const [isActive, setIsActive] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('professional');
  const [selectedObjectId, setSelectedObjectId] = useState<string>();
  
  // Estados del sistema
  const [systemStatus, setSystemStatus] = useState({
    isCalibrated: false,
    isProcessing: false,
    confidence: 0,
    frameRate: 0,
    objectCount: 0
  });

  // Referencias
  const cameraRef = useRef<any>(null);
  const pipeline = useRef(NativeDataPipeline.getInstance());
  const { calibration } = useCalibration();

  // Configuración de modos de medición
  const measurementModeConfig = useMemo(() => {
    switch (measurementMode) {
      case 'auto':
        return {
          autoDetection: true,
          continuousProcessing: true,
          maxObjects: 5,
          confidenceThreshold: 0.7
        };
      case 'manual':
        return {
          autoDetection: false,
          continuousProcessing: false,
          maxObjects: 1,
          confidenceThreshold: 0.5
        };
      case 'precision':
        return {
          autoDetection: true,
          continuousProcessing: true,
          maxObjects: 3,
          confidenceThreshold: 0.9
        };
    }
  }, [measurementMode]);

  // Inicialización del sistema
  useEffect(() => {
    if (!permission?.granted) return;

    const initializeSystem = async () => {
      console.log('[AdvancedCamera] Inicializando sistema completo...');
      
      try {
        // Inicializar pipeline nativo
        const initialized = await pipeline.current.initialize();
        if (!initialized) {
          throw new Error('Falló inicialización del pipeline nativo');
        }

        // Registrar callbacks para actualizaciones del sistema
        pipeline.current.registerCallback('processingComplete', handleProcessingComplete);
        pipeline.current.registerCallback('calibrationUpdate', handleCalibrationUpdate);
        pipeline.current.registerCallback('systemStatusUpdate', handleSystemStatusUpdate);

        console.log('[AdvancedCamera] ✅ Sistema inicializado correctamente');
        
      } catch (error) {
        console.error('[AdvancedCamera] ❌ Error en inicialización:', error);
        Alert.alert(
          'Error de Sistema',
          'No se pudo inicializar el sistema de medición. Verifique los permisos y hardware.',
          [{ text: 'OK' }]
        );
      }
    };

    initializeSystem();

    return () => {
      pipeline.current.unregisterCallback('processingComplete');
      pipeline.current.unregisterCallback('calibrationUpdate');
      pipeline.current.unregisterCallback('systemStatusUpdate');
    };
  }, [permission?.granted]);

  // Manejo de resultados de procesamiento
  const handleProcessingComplete = useCallback((result: any) => {
    setSystemStatus(prev => ({
      ...prev,
      confidence: result.confidence,
      objectCount: result.detectedObjects.length,
      isProcessing: true
    }));

    if (onMeasurementComplete) {
      onMeasurementComplete(result);
    }
  }, [onMeasurementComplete]);

  // Manejo de actualizaciones de calibración
  const handleCalibrationUpdate = useCallback((calibrationData: any) => {
    setSystemStatus(prev => ({
      ...prev,
      isCalibrated: calibrationData.isCalibrated
    }));

    if (onCalibrationUpdate) {
      onCalibrationUpdate(calibrationData);
    }
  }, [onCalibrationUpdate]);

  // Manejo de estado del sistema
  const handleSystemStatusUpdate = useCallback((status: any) => {
    setSystemStatus(prev => ({ ...prev, ...status }));
  }, []);

  // Control de procesamiento
  const toggleProcessing = useCallback(async () => {
    if (isActive) {
      await pipeline.current.stopProcessing();
      setIsActive(false);
    } else {
      await pipeline.current.startProcessing();
      setIsActive(true);
    }
  }, [isActive]);

  // Cambio de cámara
  const toggleCameraType = useCallback(() => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  }, []);

  // Cambio de modo de overlay
  const cycleOverlayMode = useCallback(() => {
    setOverlayMode(current => {
      switch (current) {
        case 'minimal': return 'detailed';
        case 'detailed': return 'professional';
        case 'professional': return 'minimal';
      }
    });
  }, []);

  // Reset del sistema
  const resetSystem = useCallback(async () => {
    await pipeline.current.stopProcessing();
    setSelectedObjectId(undefined);
    setSystemStatus(prev => ({
      ...prev,
      confidence: 0,
      objectCount: 0,
      isProcessing: false
    }));
    if (isActive) {
      await pipeline.current.startProcessing();
    }
  }, [isActive]);

  // Verificación de permisos
  if (!permission) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <Card className="m-4 p-6">
        <View className="items-center space-y-4">
          <Target className="w-16 h-16 text-muted-foreground" />
          <Text className="text-xl font-semibold text-center">
            Permisos de Cámara Requeridos
          </Text>
          <Text className="text-muted-foreground text-center">
            Se necesita acceso a la cámara para el sistema de medición avanzado
          </Text>
          <Button onPress={requestPermission} className="w-full">
            Conceder Permisos
          </Button>
        </View>
      </Card>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Panel de Estado Superior */}
      <View className="absolute top-12 left-4 right-4 z-20">
        <Card className="bg-background/90 backdrop-blur-sm">
          <View className="p-3 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <Badge 
                variant={systemStatus.isCalibrated ? "default" : "destructive"}
                className="animate-pulse"
              >
                {systemStatus.isCalibrated ? '✓ Calibrado' : '⚠ Requiere Calibración'}
              </Badge>
              
              <Badge variant="outline" className="bg-background/80">
                {systemStatus.objectCount} objetos
              </Badge>
              
              <Badge variant="outline" className="bg-background/80">
                {Math.round(systemStatus.confidence * 100)}% confianza
              </Badge>
            </View>
            
            <View className="flex-row items-center space-x-2">
              <Text className="text-xs text-muted-foreground">
                {measurementMode.toUpperCase()}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Vista de Cámara Principal */}
      <View className="flex-1">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={cameraType}
          flash={flashMode ? 'on' : 'off'}
          onCameraReady={() => {
            console.log('[AdvancedCamera] Cámara lista');
          }}
        />

        {/* Overlay AR Optimizado */}
        <OptimizedAROverlay
          screenWidth={SCREEN_WIDTH}
          screenHeight={SCREEN_HEIGHT}
          isVisible={isActive}
          selectedObjectId={selectedObjectId}
          onObjectSelect={setSelectedObjectId}
          overlayMode={overlayMode}
        />

        {/* Crosshair Central */}
        <View className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <View className="w-8 h-8 border-2 border-measurement-active/60 rounded-full items-center justify-center">
            <View className="w-2 h-2 bg-measurement-active rounded-full" />
          </View>
        </View>
      </View>

      {/* Panel de Controles Inferior */}
      <Card className="m-4 mb-8 bg-background/90 backdrop-blur-sm">
        <View className="p-4">
          {/* Controles Principales */}
          <View className="flex-row items-center justify-center space-x-4 mb-4">
            <Button
              variant={isActive ? "destructive" : "default"}
              size="lg"
              onPress={toggleProcessing}
              className="flex-1"
            >
              {isActive ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onPress={resetSystem}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </View>

          {/* Controles Secundarios */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onPress={toggleCameraType}
                className="p-2"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setFlashMode(!flashMode)}
                className="p-2"
              >
                {flashMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onPress={cycleOverlayMode}
                className="p-2"
              >
                <Layers className="w-4 h-4" />
              </Button>
            </View>
            
            <Text className="text-xs text-muted-foreground">
              Modo: {overlayMode}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
};
