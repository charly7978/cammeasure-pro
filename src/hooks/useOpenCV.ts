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
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // Try multiple CDN sources for OpenCV
    const opencvSources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    let loadTimeout: NodeJS.Timeout;
    let currentScript: HTMLScriptElement | null = null;

    const loadOpenCV = (source: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Remove any existing OpenCV script
        const existingScript = document.querySelector('script[src*="opencv.js"]');
        if (existingScript) {
          existingScript.remove();
        }

        currentScript = document.createElement('script');
        currentScript.src = source;
        currentScript.async = true;
        currentScript.crossOrigin = 'anonymous';
        
        // Set timeout for loading
        loadTimeout = setTimeout(() => {
          if (currentScript) {
            currentScript.remove();
          }
          reject(new Error(`OpenCV loading timeout for ${source}`));
        }, 45000); // 45 seconds timeout

        currentScript.onload = () => {
          clearTimeout(loadTimeout);
          
          // Wait for OpenCV to initialize
          const checkCV = (attempts = 0) => {
            if (window.cv && window.cv.Mat) {
              setIsLoaded(true);
              setIsLoading(false);
              setError(null);
              console.log('OpenCV loaded successfully from:', source);
              resolve();
            } else if (attempts < 100) { // Max 10 seconds wait
              setTimeout(() => checkCV(attempts + 1), 100);
            } else {
              reject(new Error('OpenCV failed to initialize after loading'));
            }
          };
          
          // Start checking immediately
          checkCV();
        };

        currentScript.onerror = () => {
          clearTimeout(loadTimeout);
          if (currentScript) {
            currentScript.remove();
          }
          reject(new Error(`Failed to load OpenCV from ${source}`));
        };

        document.head.appendChild(currentScript);
      });
    };

    const tryLoadOpenCV = async () => {
      for (let i = 0; i < opencvSources.length; i++) {
        try {
          console.log(`Attempting to load OpenCV from: ${opencvSources[i]}`);
          await loadOpenCV(opencvSources[i]);
          return; // Success, exit the loop
        } catch (err) {
          console.warn(`Failed to load OpenCV from ${opencvSources[i]}:`, err);
          if (i === opencvSources.length - 1) {
            // Last source failed - continue without OpenCV
            console.warn('OpenCV could not be loaded from any source. Continuing with fallback detection.');
            setError('OpenCV no disponible. Usando detección básica.');
            setIsLoading(false);
            setIsLoaded(false); // Set to false but don't block the app
          }
        }
      }
    };

    tryLoadOpenCV();

    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      if (currentScript) {
        currentScript.remove();
      }
    };
  }, []);

  return { isLoaded, isLoading, error, cv: window.cv };
};
