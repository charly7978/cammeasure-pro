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
      console.log('🔐 SOLICITANDO PERMISOS DE CÁMARA...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ MediaDevices no disponible');
        return false;
      }

      console.log('✅ MediaDevices disponible, solicitando permisos...');
      
      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        } 
      });
      
      console.log('✅ Stream de prueba obtenido, deteniendo...');
      
      // Detener stream de prueba inmediatamente
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Permisos de cámara concedidos');
      return true;
    } catch (error) {
      console.error('❌ Error solicitando permisos de cámara:', error);
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
      console.log('📹 INICIANDO CÁMARA CON RESTRICCIONES:', constraints);
      
      // Detener stream anterior si existe
      if (streamRef.current) {
        console.log('🔄 Deteniendo stream anterior...');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      console.log('🎬 Solicitando stream de cámara...');
      
      // Iniciar nuevo stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream de cámara obtenido:', stream);
      
      streamRef.current = stream;
      setCameraStream(stream);
      
      if (videoRef.current) {
        console.log('🎥 Asignando stream al video...');
        videoRef.current.srcObject = stream;
        console.log('▶️ Reproduciendo video...');
        await videoRef.current.play();
        console.log('✅ Video reproduciéndose correctamente');
      } else {
        console.warn('⚠️ videoRef no disponible');
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
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