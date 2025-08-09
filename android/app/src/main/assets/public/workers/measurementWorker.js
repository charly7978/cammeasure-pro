// measurementWorker.js
/* eslint-disable */
let OPENCV_LOADED = false;
let CAMERA_MATRIX = null;
let DIST_COEFFS = null;
let DEFAULT_PIXELS_PER_MM = 8;
let CONFIG = {
  multiScaleCanny: true,
  cannyLevels: [ [30,100], [50,150], [80,200] ],
  minAreaPx: 2000,
  morphologicalKernelSize: 3,
};

const post = (m) => postMessage(m);

const loadOpenCV = async (cdns = []) => {
  if (OPENCV_LOADED) { post({ type: 'ready' }); return; }
  for (const url of cdns) {
    try {
      importScripts(url);
      await new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), 8000);
        if (typeof self.cv !== 'undefined') {
          if (self.cv.onRuntimeInitialized) {
            self.cv.onRuntimeInitialized = () => { clearTimeout(t); resolve(true); };
          } else {
            clearTimeout(t); resolve(true);
          }
        } else {
          const check = () => {
            if (typeof self.cv !== 'undefined') {
              if (self.cv.onRuntimeInitialized) {
                self.cv.onRuntimeInitialized = () => { clearTimeout(t); resolve(true); };
              } else { clearTimeout(t); resolve(true); }
            } else setTimeout(check, 200);
          };
          check();
        }
      });
      OPENCV_LOADED = true; break;
    } catch (e) { /* try next */ }
  }
  if (!OPENCV_LOADED) post({ type: 'error', message: 'OpenCV no cargó' });
  else post({ type: 'ready' });
};

const matFromImageData = (imageData) => {
  const { width, height, data } = imageData;
  const mat = new cv.Mat(height, width, cv.CV_8UC4);
  mat.data.set(new Uint8Array(data.buffer));
  return mat;
};

const multiScaleCanny = (gray, levels) => {
  const accum = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8U);
  const tmp = new cv.Mat();
  const gauss = new cv.Mat();
  for (const [t1, t2] of levels) {
    cv.GaussianBlur(gray, gauss, new cv.Size(5,5), 0);
    cv.Canny(gauss, tmp, t1, t2);
    cv.bitwise_or(accum, tmp, accum);
  }
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3,3));
  cv.morphologyEx(accum, accum, cv.MORPH_CLOSE, kernel);
  tmp.delete(); gauss.delete();
  return accum;
};

const computeMetrics = (cnt) => {
  const area = cv.contourArea(cnt,false);
  const peri = cv.arcLength(cnt,true);
  const rect = cv.boundingRect(cnt);
  const circularity = peri>0 ? (4*Math.PI*area)/(peri*peri) : 0;
  return { area, perimeter: peri, circularity, bbox: rect };
};

const processSingleFrame = (imageData, params) => {
  const pxPerMm = params?.pixelsPerMm || DEFAULT_PIXELS_PER_MM;
  const useUndistort = params?.useUndistort || false;
  const maxWidth = params?.desiredOutputMaxWidth || null;
  const src = matFromImageData(imageData);
  try {
    let rgb = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    if (useUndistort && CAMERA_MATRIX && DIST_COEFFS) {
      const dst = new cv.Mat(); cv.undistort(rgb, dst, CAMERA_MATRIX, DIST_COEFFS); rgb.delete(); rgb = dst;
    }
    if (maxWidth && rgb.cols > maxWidth) {
      const scale = maxWidth / rgb.cols; const d = new cv.Mat();
      cv.resize(rgb, d, new cv.Size(Math.round(rgb.cols*scale), Math.round(rgb.rows*scale)));
      rgb.delete(); rgb = d;
    }
    const gray = new cv.Mat(); cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
    const clahe = new cv.CLAHE(2.0, new cv.Size(8,8)); const cl = new cv.Mat(); clahe.apply(gray, cl); gray.delete(); clahe.delete();
    const edges = multiScaleCanny(cl, CONFIG.cannyLevels); cl.delete();
    const contours = new cv.MatVector(); const hier = new cv.Mat();
    cv.findContours(edges, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const detected = [];
    for (let i=0;i<contours.size();i++) {
      const cnt = contours.get(i); const m = computeMetrics(cnt);
      if (m.area < CONFIG.minAreaPx) { cnt.delete(); continue; }
      const hull = new cv.Mat(); cv.convexHull(cnt, hull, false, true);
      const solidity = cv.contourArea(hull,false) > 0 ? m.area/cv.contourArea(hull,false) : 0; hull.delete();
      const imageArea = edges.rows*edges.cols; const sizeRatio = Math.min(1, m.area/imageArea);
      const confidence = Math.min(1.0, 0.4*solidity + 0.3*m.circularity + 0.3*sizeRatio);
      const factor = pxPerMm; // aprox
      const widthMm = m.bbox.width / factor; const heightMm = m.bbox.height / factor; const areaMm2 = m.area / (factor*factor);
      detected.push({ id:`c_${Date.now()}_${i}`, bbox:m.bbox, widthMm, heightMm, areaMm2, confidence });
      cnt.delete();
    }
    detected.sort((a,b)=>b.confidence-a.confidence);
    post({ type:'detections', objects: detected.slice(0,5) });
    contours.delete(); hier.delete(); edges.delete(); rgb.delete(); src.delete();
  } catch (e) {
    try { src.delete(); } catch(_){ }
    post({ type:'error', message:`Processing error: ${e}` });
  }
};

const calibrateWithCheckerboard = (imageData, patternSize, squareSizeMm) => {
  try {
    const src = matFromImageData(imageData); const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const ps = new cv.Size(patternSize.w, patternSize.h); const corners = new cv.Mat();
    const found = cv.findChessboardCorners(gray, ps, corners, cv.CALIB_CB_ADAPTIVE_THRESH + cv.CALIB_CB_NORMALIZE_IMAGE);
    if (!found) { gray.delete(); corners.delete(); src.delete(); post({type:'calibrationResult', success:false}); return; }
    const criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 30, 0.01);
    cv.cornerSubPix(gray, corners, new cv.Size(5,5), new cv.Size(-1,-1), criteria);
    const objPoints = new cv.MatVector(); const imgPoints = new cv.MatVector();
    const obj = new cv.Mat(); const total = patternSize.w*patternSize.h; obj.create(total,1,cv.CV_32FC3);
    for (let y=0;y<patternSize.h;y++) for (let x=0;x<patternSize.w;x++) { const idx=y*patternSize.w+x; obj.data32F[idx*3]=x*squareSizeMm; obj.data32F[idx*3+1]=y*squareSizeMm; obj.data32F[idx*3+2]=0; }
    objPoints.push_back(obj); imgPoints.push_back(corners);
    const cameraMatrix = new cv.Mat(); const distCoeffs = new cv.Mat();
    const rvecs = new cv.MatVector(); const tvecs = new cv.MatVector();
    const imgSize = new cv.Size(src.cols, src.rows);
    cv.calibrateCamera(objPoints, imgPoints, imgSize, cameraMatrix, distCoeffs, rvecs, tvecs, 0);
    CAMERA_MATRIX = cameraMatrix; DIST_COEFFS = distCoeffs;
    let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    if (corners.rows >= 2) {
      const x0=corners.data32F[0], y0=corners.data32F[1], x1=corners.data32F[2], y1=corners.data32F[3];
      const dx=x1-x0, dy=y1-y0; const distPx=Math.sqrt(dx*dx+dy*dy); pixelsPerMm=distPx/squareSizeMm;
    }
    DEFAULT_PIXELS_PER_MM = pixelsPerMm;
    obj.delete(); objPoints.delete(); imgPoints.delete(); corners.delete(); gray.delete(); src.delete();
    post({ type:'calibrationResult', success:true, cameraMatrix:Array.from(cameraMatrix.data64F||cameraMatrix.data32F), distCoeffs:Array.from(distCoeffs.data64F||distCoeffs.data32F), pixelsPerMm });
  } catch(e){ post({ type:'error', message:`Calibration failure: ${e}` }); }
};

const processStereoAdvanced = (left, right, stereoConfig={}) => {
  if (!OPENCV_LOADED) { post({type:'error', message:'OpenCV not loaded'}); return; }
  try {
    const l = matFromImageData(left); const r = matFromImageData(right);
    const lg = new cv.Mat(); const rg = new cv.Mat(); cv.cvtColor(l, lg, cv.COLOR_RGBA2GRAY); cv.cvtColor(r, rg, cv.COLOR_RGBA2GRAY);
    let stereo = null;
    if (cv.StereoSGBM_create) stereo = cv.StereoSGBM_create(0, 16*5, 7);
    else if (cv.StereoBM_create) stereo = cv.StereoBM_create(16*5, 7);
    else { l.delete(); r.delete(); lg.delete(); rg.delete(); post({type:'error', message:'Stereo not available'}); return; }
    const disparity = new cv.Mat(); stereo.compute(lg, rg, disparity);
    l.delete(); r.delete(); lg.delete(); rg.delete(); disparity.delete();
    post({ type:'stereoResult', disparity:{ rows:disparity.rows, cols:disparity.cols } });
  } catch(e){ post({ type:'error', message:`Stereo error: ${e}` }); }
};

onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch(msg.type) {
      case 'init': if (msg.config) Object.assign(CONFIG, msg.config); await loadOpenCV(msg.opencvCDNs||[]); break;
      case 'processFrame': if (!OPENCV_LOADED) { post({type:'error', message:'OpenCV not loaded'}); break; } processSingleFrame(msg.imageData, msg.params||{}); break;
      case 'calibrateWithCheckerboard': if (!OPENCV_LOADED) { post({type:'error', message:'OpenCV not loaded'}); break; } calibrateWithCheckerboard(msg.imageData, msg.patternSize, msg.squareSizeMm); break;
      case 'processStereoAdvanced': processStereoAdvanced(msg.left, msg.right, msg.stereoConfig||{}); break;
      case 'setCalibrationParams': if (msg.params?.cameraMatrix) CAMERA_MATRIX = msg.params.cameraMatrix; if (msg.params?.distCoeffs) DIST_COEFFS = msg.params.distCoeffs; if (msg.params?.pixelsPerMm) DEFAULT_PIXELS_PER_MM = msg.params.pixelsPerMm; post({type:'log', message:'Calibration params set'}); break;
      case 'shutdown': post({type:'log', message:'Worker shutdown'}); close(); break;
      default: post({ type:'log', message:`Unknown ${msg.type}` });
    }
  } catch(e){ post({ type:'error', message:`Worker exception: ${e}` }); }
};
