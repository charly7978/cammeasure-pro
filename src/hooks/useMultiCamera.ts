import { useState, useEffect, useRef, useCallback } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode: 'environment' | 'user' | 'unknown';
  groupId: string;
  capabilities?: MediaTrackCapabilities;
  settings?: MediaTrackSettings;
  isActive: boolean;
  stream?: MediaStream;
}

export interface StereoCameraPair {
  left: CameraDevice;
  right: CameraDevice;
  baseline: number; // mm
  isCalibrated: boolean;
  calibrationData?: {
    leftMatrix: number[];
    rightMatrix: number[];
    rotationMatrix: number[];
    translationVector: number[];
    essentialMatrix: number[];
    fundamentalMatrix: number[];
  };
}

export interface MultiCameraState {
  devices: CameraDevice[];
  stereoPairs: StereoCameraPair[];
  activeStereoPair: StereoCameraPair | null;
  isScanning: boolean;
  error: string | null;
}

export const useMultiCamera = () => {
  const [state, setState] = useState<MultiCameraState>({
    devices: [],
    stereoPairs: [],
    activeStereoPair: null,
    isScanning: false,
    error: null
  });

  const streamsRef = useRef<MediaStream[]>([]);

  // Detectar todas las cámaras disponibles
  const scanCameras = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true, error: null }));

    try {
      // Obtener permisos primero
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Enumerar todos los dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Dispositivos de video encontrados:', videoDevices);
      
      const cameraDevices: CameraDevice[] = [];
      
      // Probar cada dispositivo para obtener información detallada
      for (const device of videoDevices) {
        try {
          console.log(`Probando dispositivo: ${device.label}`);
          
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: device.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          });
          
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities();
          const settings = track.getSettings();
          
          // Determinar facingMode basado en el label o capabilities
          let facingMode: 'environment' | 'user' | 'unknown' = 'unknown';
          const label = device.label.toLowerCase();
          
          if (label.includes('back') || label.includes('rear') || label.includes('environment') || 
              label.includes('trás') || label.includes('trasera') || label.includes('posterior')) {
            facingMode = 'environment';
          } else if (label.includes('front') || label.includes('user') || 
                     label.includes('frontal') || label.includes('delantera')) {
            facingMode = 'user';
          }
          
          // Intentar obtener facingMode de capabilities si está disponible
          if (capabilities.facingMode) {
            const facingModes = capabilities.facingMode as string[];
            if (facingModes.includes('environment')) {
              facingMode = 'environment';
            } else if (facingModes.includes('user')) {
              facingMode = 'user';
            }
          }
          
          // Si no se puede determinar, asumir que es trasera si no es frontal
          if (facingMode === 'unknown' && !label.includes('front') && !label.includes('user')) {
            facingMode = 'environment';
          }
          
          console.log(`Dispositivo ${device.label}: facingMode = ${facingMode}`);
          
          cameraDevices.push({
            deviceId: device.deviceId,
            label: device.label || `Camera ${cameraDevices.length + 1}`,
            facingMode,
            groupId: device.groupId,
            capabilities,
            settings,
            isActive: false
          });
          
          // Detener el stream temporal
          stream.getTracks().forEach(track => track.stop());
          
        } catch (err) {
          console.warn(`No se pudo acceder a la cámara ${device.label}:`, err);
        }
      }
      
      console.log('Cámaras detectadas:', cameraDevices);
      
      // Filtrar solo cámaras traseras
      const rearCameras = cameraDevices.filter(cam => cam.facingMode === 'environment');
      console.log('Cámaras traseras:', rearCameras);
      
      // Crear pares estéreo automáticamente
      const stereoPairs: StereoCameraPair[] = [];
      
      if (rearCameras.length >= 2) {
        // Crear pares de cámaras adyacentes
        for (let i = 0; i < rearCameras.length - 1; i++) {
          const left = rearCameras[i];
          const right = rearCameras[i + 1];
          
          stereoPairs.push({
            left,
            right,
            baseline: 50, // Valor por defecto, se calibrará
            isCalibrated: false
          });
        }
        
        // Si hay más de 2 cámaras, crear pares adicionales
        if (rearCameras.length >= 3) {
          stereoPairs.push({
            left: rearCameras[0],
            right: rearCameras[2],
            baseline: 100, // Mayor separación
            isCalibrated: false
          });
        }
      }
      
      // Si no hay cámaras traseras, crear pares con todas las cámaras disponibles
      if (rearCameras.length < 2 && cameraDevices.length >= 2) {
        console.log('No hay suficientes cámaras traseras, usando todas las cámaras disponibles');
        for (let i = 0; i < cameraDevices.length - 1; i++) {
          const left = cameraDevices[i];
          const right = cameraDevices[i + 1];
          
          stereoPairs.push({
            left,
            right,
            baseline: 50,
            isCalibrated: false
          });
        }
      }
      
      console.log('Pares estéreo creados:', stereoPairs);
      
      setState(prev => ({
        ...prev,
        devices: cameraDevices,
        stereoPairs,
        isScanning: false
      }));
      
    } catch (err) {
      console.error('Error al escanear cámaras:', err);
      setState(prev => ({
        ...prev,
        error: `Error al escanear cámaras: ${err}`,
        isScanning: false
      }));
    }
  }, []);

  // Activar un par estéreo específico
  const activateStereoPair = useCallback(async (pairIndex: number) => {
    const pair = state.stereoPairs[pairIndex];
    if (!pair) return;
    
    try {
      console.log('Activando par estéreo:', pair);
      
      // Detener streams activos
      streamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streamsRef.current = [];
      
      // Activar cámaras del par
      const leftStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: pair.left.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      const rightStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: pair.right.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      streamsRef.current = [leftStream, rightStream];
      
      console.log('Streams activados:', streamsRef.current);
      
      // Actualizar estado con streams activos
      setState(prev => ({
        ...prev,
        activeStereoPair: {
          ...pair,
          left: { ...pair.left, isActive: true, stream: leftStream },
          right: { ...pair.right, isActive: true, stream: rightStream }
        }
      }));
      
    } catch (err) {
      console.error('Error al activar par estéreo:', err);
      setState(prev => ({
        ...prev,
        error: `Error al activar par estéreo: ${err}`
      }));
    }
  }, [state.stereoPairs]);

  // Desactivar todas las cámaras
  const deactivateAll = useCallback(() => {
    streamsRef.current.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    streamsRef.current = [];
    
    setState(prev => ({
      ...prev,
      activeStereoPair: null
    }));
  }, []);

  // Calibrar par estéreo
  const calibrateStereoPair = useCallback(async (pairIndex: number, calibrationData: any) => {
    setState(prev => ({
      ...prev,
      stereoPairs: prev.stereoPairs.map((pair, index) => 
        index === pairIndex 
          ? { ...pair, isCalibrated: true, calibrationData }
          : pair
      )
    }));
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      streamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, []);

  return {
    ...state,
    scanCameras,
    activateStereoPair,
    deactivateAll,
    calibrateStereoPair
  };
};
