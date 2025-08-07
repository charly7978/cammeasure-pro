import { useEffect, useState } from 'react';

declare global {
  interface Window {
    cv: any;
  }
}

export const useOpenCV = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if OpenCV is already loaded
    if (window.cv && window.cv.Mat) {
      setIsLoaded(true);
      return;
    }

    setIsLoading(true);
    
    // Try multiple CDN sources for OpenCV
    const opencvSources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    let currentSourceIndex = 0;
    let loadTimeout: NodeJS.Timeout;

    const loadOpenCV = (source: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Remove any existing OpenCV script
        const existingScript = document.querySelector('script[src*="opencv.js"]');
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.src = source;
        script.async = true;
        script.crossOrigin = 'anonymous';
        
        // Set timeout for loading
        loadTimeout = setTimeout(() => {
          reject(new Error(`OpenCV loading timeout for ${source}`));
        }, 30000); // 30 seconds timeout

        script.onload = () => {
          clearTimeout(loadTimeout);
          const checkCV = () => {
            if (window.cv && window.cv.Mat) {
              setIsLoaded(true);
              setError(null);
              console.log('OpenCV loaded successfully from:', source);
              resolve();
            } else {
              setTimeout(checkCV, 100);
            }
          };
          checkCV();
        };

        script.onerror = () => {
          clearTimeout(loadTimeout);
          reject(new Error(`Failed to load OpenCV from ${source}`));
        };

        document.head.appendChild(script);
      });
    };

    const tryLoadOpenCV = async () => {
      for (let i = 0; i < opencvSources.length; i++) {
        try {
          await loadOpenCV(opencvSources[i]);
          return; // Success, exit the loop
        } catch (err) {
          console.warn(`Failed to load OpenCV from ${opencvSources[i]}:`, err);
          if (i === opencvSources.length - 1) {
            // Last source failed
            setError('Failed to load OpenCV from all sources. Please check your internet connection.');
            setIsLoading(false);
          }
        }
      }
    };

    tryLoadOpenCV();

    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      const script = document.querySelector('script[src*="opencv.js"]');
      if (script) {
        script.remove();
      }
    };
  }, []);

  return { isLoaded, isLoading, error, cv: window.cv };
};
