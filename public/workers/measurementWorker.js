/* eslint-disable */
let OPENCV_LOADED = false;
let DEFAULT_PIXELS_PER_MM = 8;
let CONFIG = { cannyLevels: [[30,100],[50,150],[80,200]], minAreaPx: 1200 };

const post = (m) => postMessage(m);

const loadOpenCV = async (cdns = []) => {
  if (OPENCV_LOADED) { post({ type:'ready' }); return; }
  for (const url of cdns) {
    try {
      importScripts(url);
      await new Promise((resolve)=>{
        const t = setTimeout(()=>resolve(false), 8000);
        if (typeof self.cv !== 'undefined') {
          if (self.cv.onRuntimeInitialized) self.cv.onRuntimeInitialized = ()=>{ clearTimeout(t); resolve(true); };
          else { clearTimeout(t); resolve(true); }
        } else {
          const check=()=>{ if (typeof self.cv !== 'undefined') { clearTimeout(t); resolve(true);} else setTimeout(check,200) }; check();
        }
      });
      OPENCV_LOADED = true; break;
    } catch(e){}
  }
  post({ type: OPENCV_LOADED ? 'ready':'error', message: OPENCV_LOADED?undefined:'OpenCV no cargó' });
};

const matFromImageData = (imageData) => { const { width, height, data } = imageData; const mat = new cv.Mat(height, width, cv.CV_8UC4); mat.data.set(new Uint8Array(data.buffer)); return mat; };

const multiScaleCanny = (gray, levels) => {
  const accum = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8U);
  const tmp = new cv.Mat(); const gauss = new cv.Mat();
  for (const [t1,t2] of levels) { const k=3; cv.GaussianBlur(gray, gauss, new cv.Size(k,k), 0); cv.Canny(gauss, tmp, t1, t2); cv.bitwise_or(accum, tmp, accum); }
  const k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3)); cv.morphologyEx(accum, accum, cv.MORPH_OPEN, k2); cv.morphologyEx(accum, accum, cv.MORPH_CLOSE, k2); k2.delete(); tmp.delete(); gauss.delete();
  return accum;
};

const processSingleFrame = (imageData, params) => {
  const pxPerMm = params?.pixelsPerMm || DEFAULT_PIXELS_PER_MM;
  const src = matFromImageData(imageData);
  try {
    let rgb = new cv.Mat(); cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    let gray = new cv.Mat(); cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    const edges = multiScaleCanny(gray, CONFIG.cannyLevels);
    const contours = new cv.MatVector(); const hier = new cv.Mat();
    cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const detected=[]; const imgArea = edges.rows*edges.cols;
    for (let i=0;i<contours.size();i++) {
      const cnt = contours.get(i); const area = cv.contourArea(cnt,false); if (area < Math.max(CONFIG.minAreaPx, imgArea*0.001)) { cnt.delete(); continue; }
      const rect = cv.boundingRect(cnt); const widthMm = rect.width/pxPerMm; const heightMm = rect.height/pxPerMm; const areaMm2 = area/(pxPerMm*pxPerMm);
      detected.push({ id:`o_${Date.now()}_${i}`, bbox:rect, widthMm, heightMm, areaMm2, confidence:0.8 }); cnt.delete();
    }
    detected.sort((a,b)=>b.areaMm2-a.areaMm2);
    post({ type:'detections', objects: detected.slice(0,3) });
    contours.delete(); hier.delete(); edges.delete(); gray.delete(); rgb.delete(); src.delete();
  } catch(e) { try{src.delete();}catch(_){ } post({ type:'error', message:`proc error: ${e}`}); }
};

onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch(msg.type){
      case 'init': if (msg.config) Object.assign(CONFIG, msg.config); await loadOpenCV(msg.opencvCDNs||[]); break;
      case 'processFrame': if (!OPENCV_LOADED){ post({type:'error', message:'OpenCV not loaded'}); break;} processSingleFrame(msg.imageData, msg.params||{}); break;
      case 'shutdown': close(); break;
      default: post({type:'log', message:`Unknown ${msg.type}`});
    }
  } catch(e){ post({ type:'error', message:`worker ex: ${e}`}); }
};
