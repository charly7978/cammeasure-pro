import React, { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Camera, AlertCircle } from 'lucide-react';

export const SimpleCameraTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      setError('No se pudo acceder a la cámara. Por favor, verifique los permisos.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsStreaming(false);
    }
  };

  return (
    <Card className="relative w-full h-full overflow-hidden bg-black">
      {error ? (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h3 className="text-xl text-white mb-2">Error de Cámara</h3>
          <p className="text-gray-400 text-center mb-4">{error}</p>
          <Button onClick={startCamera} variant="default">
            <Camera className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Overlay simple */}
          <div className="absolute top-4 left-4">
            <Badge 
              variant={isStreaming ? "default" : "secondary"}
              className="bg-black/50 backdrop-blur-sm"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${isStreaming ? 'bg-green-500' : 'bg-gray-500'}`} />
              {isStreaming ? 'Cámara Activa' : 'Iniciando...'}
            </Badge>
          </div>

          {/* Mensaje de información */}
          <div className="absolute bottom-4 left-4 right-4">
            <Card className="bg-black/80 backdrop-blur-sm border-gray-700 p-4">
              <p className="text-white text-center">
                Vista de cámara básica funcionando. 
                El sistema de IA se cargará próximamente.
              </p>
            </Card>
          </div>
        </>
      )}
    </Card>
  );
};
