import { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

export interface CameraConfig {
  direction: CameraDirection;
  source: CameraSource;
  quality: number;
  allowEditing: boolean;
  resultType: CameraResultType;
}

export const useCamera = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const requestCameraPermissions = async () => {
    try {
      // Always try web API first since we're in a web environment
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Test camera access
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop the test stream immediately
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (webError) {
          console.error('Web camera access failed:', webError);
          
          // If web fails, try Capacitor as fallback (for mobile builds)
          try {
            const permissions = await Camera.requestPermissions();
            return permissions.camera === 'granted';
          } catch (capacitorError) {
            console.error('Capacitor camera permissions failed:', capacitorError);
            return false;
          }
        }
      } else {
        // Fallback to Capacitor if mediaDevices is not available
        const permissions = await Camera.requestPermissions();
        return permissions.camera === 'granted';
      }
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  };

  const startCamera = async (constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      return stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      throw error;
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const captureImage = async (config: Partial<CameraConfig> = {}) => {
    setIsCapturing(true);
    
    try {
      const image = await Camera.getPhoto({
        quality: config.quality || 90,
        allowEditing: config.allowEditing || false,
        resultType: config.resultType || CameraResultType.Uri,
        source: config.source || CameraSource.Camera,
        direction: config.direction || CameraDirection.Rear
      });
      
      return image;
    } catch (error) {
      console.error('Error capturing image:', error);
      throw error;
    } finally {
      setIsCapturing(false);
    }
  };

  const switchCamera = async (direction: CameraDirection = CameraDirection.Rear) => {
    stopCamera();
    
    const constraints = {
      video: {
        facingMode: direction === CameraDirection.Rear ? 'environment' : 'user',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
    
    return startCamera(constraints);
  };

  return {
    videoRef,
    cameraStream,
    isCapturing,
    requestCameraPermissions,
    startCamera,
    stopCamera,
    captureImage,
    switchCamera
  };
};