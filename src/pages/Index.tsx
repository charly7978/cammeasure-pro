import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Target, Cpu, Ruler, Scan } from 'lucide-react';
import { CameraView } from '@/components/CameraView';
import RealTimeMeasurement from '@/components/RealTimeMeasurement';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useCalibration } from '@/hooks/useCalibration';

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [objects, setObjects] = useState<any[]>([]);
  const { isLoaded: isOpenCVLoaded, error: openCVError } = useOpenCV();
  const { calibration, setCalibration } = useCalibration();

  // Detecciones en vivo desde el worker
  const handleObjects = (list: any[]) => {
    setObjects(list || []);
  };

  // Calibración rápida con tablero (9x6, 25.4mm)
  const handleCalibrate = async () => {
    try {
      if (!videoRef.current) return;
      const v = videoRef.current;
      if (v.videoWidth === 0 || v.videoHeight === 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // @ts-ignore
      const wk: Worker | null = (window as any).__camMeasureWorker || null;
      if (!wk) return;
      wk.postMessage({ type:'calibrateWithCheckerboard', imageData, patternSize:{ w:9, h:6 }, squareSizeMm:25.4 });
    } catch (e) { console.warn('Calibrate error', e); }
  };

  useEffect(() => {
    if (openCVError) console.warn('OpenCV', openCVError);
  }, [openCVError]);

  // Formateo simple
  const fmtDim = (v: number) => v < 1000 ? `${v.toFixed(1)} mm` : `${(v/10).toFixed(1)} cm`;
  const best = objects?.[0];

  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-lg">
            <Ruler className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">CamMeasure Pro</h1>
            <p className="text-sm text-muted-foreground">Medición en vivo con OpenCV</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOpenCVLoaded ? 'default' : 'secondary'} className={isOpenCVLoaded ? 'bg-measurement-active text-background' : ''}>
            <Cpu className="w-3 h-3 mr-1" /> OpenCV {isOpenCVLoaded ? 'OK' : 'Básico'}
          </Badge>
          <Badge variant={calibration?.isCalibrated ? 'default' : 'secondary'}>
            <Target className="w-3 h-3 mr-1" /> {calibration?.isCalibrated ? 'Calibrado' : 'Sin calibrar'}
          </Badge>
        </div>
      </div>

      {/* Cámara + Overlay */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <span className="font-medium">Cámara</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCalibrate} className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">
              <Scan className="w-4 h-4 mr-1" /> Calibrar (tablero)
            </button>
          </div>
        </div>

        <div className="relative">
          <CameraView
            isActive={true}
            calibrationData={calibration}
            objects={objects}
            externalVideoRef={videoRef}
          />
          <RealTimeMeasurement
            videoRef={videoRef}
            isActive={true}
            onObjectsDetected={handleObjects}
          />
        </div>
      </Card>

      {/* Resumen simple del mejor objeto */}
      <Card className="p-3">
        <h3 className="font-medium mb-2">Resultado en vivo</h3>
        {best ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">↔️ Ancho</p>
              <p className="font-mono font-bold">{fmtDim(best.widthMm || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">↕️ Alto</p>
              <p className="font-mono font-bold">{fmtDim(best.heightMm || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">📐 Área</p>
              <p className="font-mono font-bold">{(best.areaMm2 || 0).toFixed(0)} mm²</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Apunta a un objeto con bordes claros para medir en vivo.</p>
        )}
      </Card>
    </div>
  );
};

export default Index;