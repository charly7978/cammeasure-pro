import { useState } from 'react';

export const useOpenCV = () => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return { 
    isLoaded, 
    error, 
    cv: null 
  };
};
