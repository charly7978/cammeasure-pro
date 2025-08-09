import { useEffect, useState } from 'react';

declare global {
  interface Window {
    cv: any;
  }
}

export const useOpenCV = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.cv && window.cv.Mat) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    
    script.onload = () => {
      const checkCV = () => {
        if (window.cv && window.cv.Mat) {
          setIsLoaded(true);
          console.log('OpenCV loaded successfully');
        } else {
          setTimeout(checkCV, 100);
        }
      };
      checkCV();
    };

    script.onerror = () => {
      setError('Failed to load OpenCV');
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return { isLoaded, error, cv: window.cv };
};