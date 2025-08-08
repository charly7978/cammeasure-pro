import React, { useEffect, useRef, useState } from 'react';

// Tipos mínimos
type Detected = { id:string; bbox:{x:number;y:number;width:number;height:number}; widthMm:number; heightMm:number; areaMm2:number; confidence:number };

const WorkerPath = '/workers/measurementWorker.js';

const MeasureScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objects, setObjects] = useState<Detected[]>([]);
  const [pixelsPerMm, setPixelsPerMm] = useState<number>(8);
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Worker
    const w = new Worker(WorkerPath);
    workerRef.current = w as Worker;
    (window as any).__camMeasureWorker = w;

    w.onmessage = (ev: MessageEvent) => {
      const msg:any = ev.data;
      if (!msg) return;
      if (msg.type === 'ready') setWorkerReady(true);
      if (msg.type === 'detections') setObjects(msg.objects || []);
      if (msg.type === 'error') console.warn('[Worker]', msg.message);
    };

    w.postMessage({ type:'init', opencvCDNs:[
      'https://docs.opencv.org/4.x/opencv.js',
      'https://cdnjs.cloudflare.com/ajax/libs/opencv/4.5.5/opencv.js',
      'https://unpkg.com/opencv-js@4.5.5/opencv.js'
    ], config:{ minAreaPx: 1200 } });

    return () => { w.postMessage({type:'shutdown'}); w.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    // Cámara
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch(e) { console.warn('cam error', e); }
    })();
  }, []);

  useEffect(() => {
    // Loop
    const loop = () => {
      if (videoRef.current && workerRef.current && workerReady) {
        const v = videoRef.current;
        if (v.videoWidth > 0 && v.videoHeight > 0) {
          const c = canvasRef.current || document.createElement('canvas');
          if (!canvasRef.current) { c.style.display='none'; document.body.appendChild(c); canvasRef.current = c; }
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext('2d'); if (ctx) {
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const imageData = ctx.getImageData(0,0,c.width,c.height);
            workerRef.current.postMessage({ type:'processFrame', imageData, params: { pixelsPerMm } }, [imageData.data.buffer]);
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [workerReady, pixelsPerMm]);

  const best = objects[0];
  const fmtDim = (v:number) => v<1000 ? `${v.toFixed(1)} mm` : `${(v/10).toFixed(1)} cm`;

  return (
    <div style={{ padding:'12px', display:'grid', gap:'12px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ padding:'10px', background:'linear-gradient(135deg,#0ea5e9,#22d3ee)', borderRadius:8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12h12M12 6v12" stroke="#001" strokeWidth="2"/></svg>
          </div>
          <div>
            <div style={{ fontWeight:700 }}>CamMeasure Pro</div>
            <div style={{ fontSize:12, opacity:.7 }}>Medición en vivo</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ fontSize:12, background:'#0f172a', border:'1px solid #1e293b', padding:'4px 8px', borderRadius:6 }}>px/mm
            <input type="number" value={pixelsPerMm} onChange={(e)=>setPixelsPerMm(Math.max(0.5, Math.min(100, Number(e.target.value)||8)))} style={{ marginLeft:6, width:60, background:'transparent', color:'white', border:'1px solid #334155', borderRadius:4, padding:'2px 6px' }} />
          </div>
        </div>
      </div>

      <div style={{ position:'relative', background:'#000', borderRadius:10, overflow:'hidden', height:'60dvh' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'contain' }} />
        {/* Overlay simple */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          {/* Cruz central */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}>
            <div style={{ width:60, height:60, border:'2px solid #22d3ee', borderRadius:9999 }} />
          </div>
          {/* Panel superior */}
          <div style={{ position:'absolute', top:10, left:10, right:10, background:'rgba(0,0,0,.7)', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, padding:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:12, opacity:.9 }}>{objects.length>0? 'Medición en tiempo real':'Sin detecciones'}</div>
            {best && (
              <div style={{ display:'flex', gap:12, fontSize:12 }}>
                <div>↔️ {fmtDim(best.widthMm||0)}</div>
                <div>↕️ {fmtDim(best.heightMm||0)}</div>
                <div>📐 {(best.areaMm2||0).toFixed(0)} mm²</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasureScreen;
