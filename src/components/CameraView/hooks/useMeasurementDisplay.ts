import { useCallback, RefObject } from 'react';
import { HTMLVideoElement, HTMLCanvasElement } from 'react';

export const useMeasurementDisplay = (
  videoRef: RefObject<HTMLVideoElement>,
  overlayCanvasRef: RefObject<HTMLCanvasElement>,
  onImageCapture?: (imageData: ImageData) => void
) => {
  const handleCapture = useCallback(async () => {
    try {
      if (!videoRef?.current || !overlayCanvasRef?.current) {
        console.warn('⚠️ Cámara no disponible para captura');
        return;
      }

      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onImageCapture?.(imageData);
      
      console.log('📸 Imagen capturada exitosamente');
    } catch (error) {
      console.error('❌ Error al capturar imagen:', error);
    }
  }, [videoRef, overlayCanvasRef, onImageCapture]);

  return {
    handleCapture
  };
};
