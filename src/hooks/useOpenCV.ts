import { useEffect, useState } from 'react';
import OpenCVManager, { OpenCVStatus, DetectionResult, OpenCVConfig } from '../lib/opencvManager';

export const useOpenCV = () => {
  const [status, setStatus] = useState<OpenCVStatus>({
    isLoaded: false,
    isLoading: false,
    error: null,
    version: null,
    capabilities: []
  });

  const opencvManager = OpenCVManager.getInstance();

  useEffect(() => {
    const loadOpenCV = async () => {
      try {
        const newStatus = await opencvManager.loadOpenCV();
        setStatus(newStatus);
      } catch (error) {
        console.error('Error cargando OpenCV:', error);
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Error desconocido',
          isLoading: false
        }));
      }
    };

    loadOpenCV();
  }, []);

  const detectObjects = async (imageData: ImageData, config: OpenCVConfig = {}): Promise<DetectionResult> => {
    return await opencvManager.detectObjects(imageData, config);
  };

  const getStatus = (): OpenCVStatus => {
    return opencvManager.getStatus();
  };

  const reset = (): void => {
    opencvManager.reset();
    setStatus({
      isLoaded: false,
      isLoading: false,
      error: null,
      version: null,
      capabilities: []
    });
  };

  return {
    isLoaded: status.isLoaded,
    isLoading: status.isLoading,
    error: status.error,
    version: status.version,
    capabilities: status.capabilities,
    cv: window.cv,
    detectObjects,
    getStatus,
    reset
  };
};