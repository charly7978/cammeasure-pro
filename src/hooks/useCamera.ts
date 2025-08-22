import { useState, useRef, useCallback, useEffect } from 'react';

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

export interface CameraStream {
  stream: MediaStream;
  track: MediaStreamTrack;
  settings: MediaTrackSettings;
}

export interface CameraError {
  code: string;
  message: string;
  details?: any;
}

export function useCamera() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<CameraError | null>(null);
  const [config, setConfig] = useState<CameraConfig>({
    width: 1280,
    height: 720,
    facingMode: 'environment',
    frameRate: 30
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Inicializar cámara
  const initialize = useCallback(async () => {
    try {
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API no soportada');
      }

      // Enumerar dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);

      setIsInitialized(true);
    } catch (err) {
      const cameraError: CameraError = {
        code: 'INIT_ERROR',
        message: err instanceof Error ? err.message : 'Error desconocido'
      };
      setError(cameraError);
    }
  }, []);

  // Iniciar stream
  const startStream = useCallback(async () => {
    try {
      setError(null);
      
      if (!isInitialized) {
        await initialize();
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          facingMode: config.facingMode,
          frameRate: { ideal: config.frameRate }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
    } catch (err) {
      const cameraError: CameraError = {
        code: 'STREAM_ERROR',
        message: err instanceof Error ? err.message : 'Error iniciando stream'
      };
      setError(cameraError);
    }
  }, [isInitialized, initialize, config]);

  // Detener stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
  }, []);

  // Cambiar dispositivo
  const switchDevice = useCallback(async (deviceId: string) => {
    if (isStreaming) {
      stopStream();
    }
    
    setCurrentDevice(deviceId);
    
    if (isStreaming) {
      await startStream();
    }
  }, [isStreaming, stopStream, startStream]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    isInitialized,
    isStreaming,
    currentDevice,
    availableDevices,
    error,
    config,
    videoRef,
    initialize,
    startStream,
    stopStream,
    switchDevice,
    setConfig
  };
}