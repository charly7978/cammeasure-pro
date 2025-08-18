import { useState, useRef, useCallback } from 'react';

export interface CameraConfig {
  direction: 'front' | 'back';
  source: 'camera';
  quality: number;
  allowEditing: boolean;
  resultType: 'uri';
}

export const useCamera = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestCameraPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices no disponible');
        return false;
      }

      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        } 
      });
      
      // Detener stream de prueba inmediatamente
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Error solicitando permisos de cámara:', error);
      return false;
    }
  }, []);

  const startCamera = useCallback(async (constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 }
    }
  }) => {
    try {
      // Detener stream anterior si existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Iniciar nuevo stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      return stream;
    } catch (error) {
      console.error('Error iniciando cámara:', error);
      throw error;
    }
  }, []);

  const stopCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('Error deteniendo cámara:', error);
    }
  }, [cameraStream]);

  const switchCamera = useCallback(async (direction: 'front' | 'back') => {
    try {
      const newConstraints: MediaStreamConstraints = {
        video: {
          facingMode: direction === 'front' ? 'user' : 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      };
      
      await startCamera(newConstraints);
    } catch (error) {
      console.error('Error cambiando cámara:', error);
      throw error;
    }
  }, [startCamera]);

  const captureImage = useCallback(async (config: Partial<CameraConfig> = {}) => {
    setIsCapturing(true);
    
    try {
      if (!videoRef.current || !cameraStream) {
        throw new Error('Cámara no disponible');
      }

      // Crear canvas para capturar frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo obtener contexto del canvas');

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Dibujar frame actual
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Obtener ImageData
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      return imageData;
    } catch (error) {
      console.error('Error capturando imagen:', error);
      throw error;
    } finally {
      setIsCapturing(false);
    }
  }, [cameraStream]);

  return {
    videoRef,
    cameraStream,
    isCapturing,
    startCamera,
    stopCamera,
    switchCamera,
    captureImage,
    requestCameraPermissions
  };
};