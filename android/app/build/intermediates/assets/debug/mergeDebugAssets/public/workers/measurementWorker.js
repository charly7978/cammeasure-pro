// measurementWorker.js
// Web Worker script - pipeline OpenCV avanzado con soporte multi-cámara
// Asegurate de compilar/transpilar a JS si tu bundler no soporta TS Web Workers nativamente.

// Tip: colocá este archivo en /public/workers/measurementWorker.js
// y desde el main thread: new Worker('/workers/measurementWorker.js', { type: 'module' });

/* eslint-disable @typescript-eslint/no-explicit-any */
let OPENCV_LOADED = false;
let CAMERA_MATRIX = null;
let DIST_COEFFS = null;
let STEREO_CALIB = null;
let DEFAULT_PIXELS_PER_MM = 8;
let CONFIG = {
  multiScaleCanny: true,
  cannyLevels: [ [30, 100], [50, 150], [80, 200] ],
  minAreaPx: 2000,
  morphologicalKernelSize: 3,
  stereoConfig: {
    numDisparities: 16 * 5,
    blockSize: 7,
    minDisparity: 0,
    uniquenessRatio: 15,
    speckleWindowSize: 100,
    speckleRange: 32,
    disp12MaxDiff: 1
  }
};

const post = (m) => {
  postMessage(m);
};

// Cargar OpenCV desde múltiples CDNs por fallback
const loadOpenCV = async (cdns = []) => {
  if (OPENCV_LOADED) {
    post({ type: 'log', message: 'OpenCV already loaded' });
    post({ type: 'ready' });
    return;
  }

  // try each CDN with importScripts
  for (const url of cdns) {
    try {
      importScripts(url);
      // wait for cv to be ready
      const waited = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 8000);
        const check = () => {
          if (typeof self.cv !== 'undefined' && self.cv?.onRuntimeInitialized === undefined) {
            clearTimeout(timeout);
            resolve(true);
          } else if (typeof self.cv !== 'undefined') {
            // if onRuntimeInitialized exists, attach
            self.cv['onRuntimeInitialized'] = () => {
              clearTimeout(timeout);
              resolve(true);
            };
          } else {
            setTimeout(check, 200);
          }
        };
        check();
      });

      if (!waited) {
        post({ type: 'log', message: `OpenCV at ${url} didn't initialize in time.` });
        continue;
      }

      post({ type: 'log', message: `OpenCV loaded from ${url}` });
      OPENCV_LOADED = true;
      break;
    } catch (err) {
      post({ type: 'log', message: `Failed to import ${url}: ${err}` });
    }
  }

  if (!OPENCV_LOADED) {
    post({ type: 'error', message: 'Failed to load OpenCV.js from provided CDNs' });
  } else {
    post({ type: 'ready' });
  }
};

// Helper: create cv.Mat from ImageData
const matFromImageData = (imageData) => {
  const { width, height, data } = imageData;
  const mat = new cv.Mat(height, width, cv.CV_8UC4);
  mat.data.set(new Uint8Array(data.buffer));
  return mat;
};

// Multi-scale Canny: combinar los edges y degradar ruido
const multiScaleCanny = (srcGray, levels) => {
  const accum = new cv.Mat.zeros(srcGray.rows, srcGray.cols, cv.CV_8U);
  const tmp = new cv.Mat();
  const gauss = new cv.Mat();
  try {
    for (const [t1, t2] of levels) {
      cv.GaussianBlur(srcGray, gauss, new cv.Size(5, 5), 0);
      cv.Canny(gauss, tmp, t1, t2);
      cv.bitwise_or(accum, tmp, accum);
    }
    // Morfologia para cerrar huecos
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(CONFIG.morphologicalKernelSize, CONFIG.morphologicalKernelSize));
    cv.morphologyEx(accum, accum, cv.MORPH_CLOSE, kernel);
    return accum;
  } finally {
    tmp.delete(); gauss.delete();
  }
};

// Calcular métricas geométricas a partir de un contorno
const computeGeometryMetrics = (contour) => {
  const area = cv.contourArea(contour, false);
  const perimeter = cv.arcLength(contour, true);
  // convex hull area
  const hull = new cv.Mat();
  cv.convexHull(contour, hull, false, true);
  const hullArea = cv.contourArea(hull, false);
  const rect = cv.boundingRect(contour);
  // circularity: 4πA / P^2
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const solidity = hullArea > 0 ? area / hullArea : 0; // A / A_convex
  const extension = rect.width * rect.height > 0 ? area / (rect.width * rect.height) : 0; // A / bbox area
  const compactness = perimeter > 0 ? (perimeter * perimeter) / area : Infinity;
  hull.delete();
  return {
    area,
    perimeter,
    circularity,
    solidity,
    extension,
    compactness,
    bbox: rect
  };
};

// Hu moments (7 invariants)
const huMoments = (contour) => {
  const moments = cv.moments(contour, false);
  const hu = new cv.Mat();
  cv.HuMoments(moments, hu);
  const out = [];
  for (let i = 0; i < hu.rows; i++) {
    out.push(hu.data64F[i]);
  }
  hu.delete();
  return out;
};

// Subpixel refinement of corners
const refineCornersSubpix = (gray, corners, winSize = new cv.Size(5, 5)) => {
  try {
    if (!corners || corners.rows === 0) return corners;
    const criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 30, 0.01);
    cv.cornerSubPix(gray, corners, winSize, new cv.Size(-1, -1), criteria);
    return corners;
  } catch (err) {
    return corners;
  }
};

// Procesamiento estéreo avanzado con múltiples cámaras
const processStereoAdvanced = (leftImageData, rightImageData, stereoConfig = {}) => {
  const config = { ...CONFIG.stereoConfig, ...stereoConfig };
  
  const leftMat = matFromImageData(leftImageData);
  const rightMat = matFromImageData(rightImageData);
  
  try {
    // Convert to gray
    const leftGray = new cv.Mat();
    const rightGray = new cv.Mat();
    cv.cvtColor(leftMat, leftGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(rightMat, rightGray, cv.COLOR_RGBA2GRAY);

    // Rectificar imágenes si tenemos calibración estéreo
    let leftRect = leftGray;
    let rightRect = rightGray;
    
    if (STEREO_CALIB && STEREO_CALIB.leftMatrix && STEREO_CALIB.rightMatrix) {
      const leftRectified = new cv.Mat();
      const rightRectified = new cv.Mat();
      
      // Rectificar usando matrices de calibración
      cv.undistort(leftGray, leftRectified, STEREO_CALIB.leftMatrix, STEREO_CALIB.distCoeffs);
      cv.undistort(rightGray, rightRectified, STEREO_CALIB.rightMatrix, STEREO_CALIB.distCoeffs);
      
      leftRect = leftRectified;
      rightRect = rightRectified;
    }

    // Crear stereo matcher
    let stereo;
    if (cv.StereoSGBM_create) {
      stereo = cv.StereoSGBM_create(
        config.minDisparity,
        config.numDisparities,
        config.blockSize,
        8 * config.blockSize * config.blockSize,
        32 * config.blockSize * config.blockSize,
        config.disp12MaxDiff,
        config.uniquenessRatio,
        config.speckleWindowSize,
        config.speckleRange,
        cv.STEREO_SGBM_MODE_SGBM
      );
    } else if (cv.StereoBM_create) {
      stereo = cv.StereoBM_create(config.numDisparities, config.blockSize);
    } else {
      post({ type: 'error', message: 'No StereoBM/SGBM available in OpenCV.js build' });
      leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete();
      return;
    }

    // Calcular disparidad
    const disparity = new cv.Mat();
    stereo.compute(leftRect, rightRect, disparity);

    // Convertir disparidad a profundidad
    const disparityFloat = new cv.Mat();
    disparity.convertTo(disparityFloat, cv.CV_32F, 1.0 / 16.0);

    // Calcular mapa de profundidad
    const depthMap = new cv.Mat();
    const baseline = STEREO_CALIB?.baseline || 50; // mm
    const focalLength = STEREO_CALIB?.leftMatrix?.[0] || 1000; // píxeles
    
    // Z = (f * B) / disparity
    cv.divide(focalLength * baseline, disparityFloat, depthMap);

    // Análisis de objetos 3D
    const objects3D = analyze3DObjects(leftRect, rightRect, depthMap, disparityFloat);

    // Limpiar matrices
    leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete();
    disparity.delete(); disparityFloat.delete(); depthMap.delete();
    
    if (leftRect !== leftGray) leftRect.delete();
    if (rightRect !== rightGray) rightRect.delete();

    post({
      type: 'stereoResult',
      objects3D,
      depthMap: {
        width: depthMap.cols,
        height: depthMap.rows,
        minDepth: depthMap.data32F ? Math.min(...depthMap.data32F.filter(x => isFinite(x) && x > 0)) : 0,
        maxDepth: depthMap.data32F ? Math.max(...depthMap.data32F.filter(x => isFinite(x) && x > 0)) : 0
      },
      disparity: {
        width: disparity.cols,
        height: disparity.rows
      }
    });

  } catch (err) {
    leftMat.delete(); rightMat.delete();
    post({ type: 'error', message: `Stereo processing error: ${err}` });
  }
};

// Analizar objetos 3D desde mapa de profundidad
const analyze3DObjects = (leftImage, rightImage, depthMap, disparityMap) => {
  const objects = [];
  const rows = depthMap.rows;
  const cols = depthMap.cols;
  
  // Detectar objetos en imagen izquierda
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(leftImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour, false);
    
    if (area < CONFIG.minAreaPx) {
      contour.delete();
      continue;
    }
    
    // Calcular métricas 3D
    const bbox = cv.boundingRect(contour);
    const moments = cv.moments(contour, false);
    
    // Calcular centro del objeto
    const centerX = moments.m10 / moments.m00;
    const centerY = moments.m01 / moments.m00;
    
    // Obtener profundidad en el centro del objeto
    const depth = depthMap.data32F ? 
      depthMap.data32F[Math.floor(centerY) * cols + Math.floor(centerX)] : 0;
    
    // Calcular dimensiones 3D
    const pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    const widthMm = bbox.width / pixelsPerMm;
    const heightMm = bbox.height / pixelsPerMm;
    const depthMm = depth || 0;
    
    // Calcular volumen aproximado (asumiendo forma rectangular)
    const volumeMm3 = widthMm * heightMm * depthMm;
    
    objects.push({
      id: `obj3d_${Date.now()}_${i}`,
      center: { x: centerX, y: centerY },
      dimensions: {
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        volume: volumeMm3
      },
      bbox: bbox,
      area: area,
      confidence: 0.8, // Basado en área y forma
      depthConfidence: depth > 0 ? 0.9 : 0.3
    });
    
    contour.delete();
  }
  
  contours.delete();
  hierarchy.delete();
  
  return objects;
};

// Calibración estéreo avanzada
const calibrateStereoAdvanced = (leftImageData, rightImageData, patternSize, squareSizeMm) => {
  const leftMat = matFromImageData(leftImageData);
  const rightMat = matFromImageData(rightImageData);
  
  try {
    const leftGray = new cv.Mat();
    const rightGray = new cv.Mat();
    cv.cvtColor(leftMat, leftGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(rightMat, rightGray, cv.COLOR_RGBA2GRAY);

    const patternSizeCV = new cv.Size(patternSize.w, patternSize.h);
    
    // Detectar esquinas en ambas imágenes
    const leftCorners = new cv.Mat();
    const rightCorners = new cv.Mat();
    
    const leftFound = cv.findChessboardCorners(leftGray, patternSizeCV, leftCorners, 
      cv.CALIB_CB_ADAPTIVE_THRESH + cv.CALIB_CB_NORMALIZE_IMAGE);
    const rightFound = cv.findChessboardCorners(rightGray, patternSizeCV, rightCorners, 
      cv.CALIB_CB_ADAPTIVE_THRESH + cv.CALIB_CB_NORMALIZE_IMAGE);
    
    if (!leftFound || !rightFound) {
      leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete();
      leftCorners.delete(); rightCorners.delete();
      post({ type: 'stereoCalibrationResult', success: false });
      return;
    }
    
    // Refinar esquinas
    refineCornersSubpix(leftGray, leftCorners);
    refineCornersSubpix(rightGray, rightCorners);
    
    // Preparar puntos 3D del patrón
    const objPoints = new cv.MatVector();
    const obj = new cv.Mat();
    const total = patternSize.w * patternSize.h;
    obj.create(total, 1, cv.CV_32FC3);
    
    for (let y = 0; y < patternSize.h; y++) {
      for (let x = 0; x < patternSize.w; x++) {
        const idx = y * patternSize.w + x;
        obj.data32F[idx * 3] = x * squareSizeMm;
        obj.data32F[idx * 3 + 1] = y * squareSizeMm;
        obj.data32F[idx * 3 + 2] = 0;
      }
    }
    objPoints.push_back(obj);
    
    // Preparar puntos imagen
    const leftImgPoints = new cv.MatVector();
    const rightImgPoints = new cv.MatVector();
    leftImgPoints.push_back(leftCorners);
    rightImgPoints.push_back(rightCorners);
    
    // Calibrar estéreo
    const leftMatrix = new cv.Mat();
    const rightMatrix = new cv.Mat();
    const leftDistCoeffs = new cv.Mat();
    const rightDistCoeffs = new cv.Mat();
    const rotationMatrix = new cv.Mat();
    const translationVector = new cv.Mat();
    const essentialMatrix = new cv.Mat();
    const fundamentalMatrix = new cv.Mat();
    
    const imgSize = new cv.Size(leftMat.cols, leftMat.rows);
    
    const rms = cv.stereoCalibrate(
      objPoints, leftImgPoints, rightImgPoints,
      leftMatrix, leftDistCoeffs,
      rightMatrix, rightDistCoeffs,
      imgSize, rotationMatrix, translationVector,
      essentialMatrix, fundamentalMatrix,
      cv.CALIB_FIX_INTRINSIC
    );
    
    // Calcular baseline
    const baseline = Math.sqrt(
      translationVector.data64F[0] ** 2 + 
      translationVector.data64F[1] ** 2 + 
      translationVector.data64F[2] ** 2
    );
    
    // Guardar calibración estéreo
    STEREO_CALIB = {
      leftMatrix: Array.from(leftMatrix.data64F || leftMatrix.data32F),
      rightMatrix: Array.from(rightMatrix.data64F || rightMatrix.data32F),
      leftDistCoeffs: Array.from(leftDistCoeffs.data64F || leftDistCoeffs.data32F),
      rightDistCoeffs: Array.from(rightDistCoeffs.data64F || rightDistCoeffs.data32F),
      rotationMatrix: Array.from(rotationMatrix.data64F || rotationMatrix.data32F),
      translationVector: Array.from(translationVector.data64F || translationVector.data32F),
      essentialMatrix: Array.from(essentialMatrix.data64F || essentialMatrix.data32F),
      fundamentalMatrix: Array.from(fundamentalMatrix.data64F || fundamentalMatrix.data32F),
      baseline: baseline
    };
    
    // Limpiar matrices
    leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete();
    leftCorners.delete(); rightCorners.delete();
    obj.delete(); objPoints.delete(); leftImgPoints.delete(); rightImgPoints.delete();
    leftMatrix.delete(); rightMatrix.delete(); leftDistCoeffs.delete(); rightDistCoeffs.delete();
    rotationMatrix.delete(); translationVector.delete(); essentialMatrix.delete(); fundamentalMatrix.delete();
    imgSize.delete();
    
    post({
      type: 'stereoCalibrationResult',
      success: true,
      calibrationData: STEREO_CALIB,
      rms: rms
    });
    
  } catch (err) {
    leftMat.delete(); rightMat.delete();
    post({ type: 'error', message: `Stereo calibration error: ${err}` });
  }
};

const processSingleFrame = (imageData, params) => {
  // Devuelve objetos detectados con métricas físicas usando pixelsPerMm cuando esté disponible
  const pixelsPerMm = params?.pixelsPerMm || DEFAULT_PIXELS_PER_MM;
  const useUndistort = params?.useUndistort || false;
  const maxWidth = params?.desiredOutputMaxWidth || null;

  const src = matFromImageData(imageData);
  try {
    let rgba = new cv.Mat();
    cv.cvtColor(src, rgba, cv.COLOR_RGBA2RGB);
    // Undistort si se tiene calibración
    if (useUndistort && CAMERA_MATRIX && DIST_COEFFS) {
      const dst = new cv.Mat();
      cv.undistort(rgba, dst, CAMERA_MATRIX, DIST_COEFFS);
      rgba.delete();
      rgba = dst;
    }

    // Possible resize for performance (preserve aspect)
    let scaleFactor = 1.0;
    if (maxWidth && rgba.cols > maxWidth) {
      scaleFactor = maxWidth / rgba.cols;
      const dsize = new cv.Size(Math.round(rgba.cols * scaleFactor), Math.round(rgba.rows * scaleFactor));
      const resized = new cv.Mat();
      cv.resize(rgba, resized, dsize);
      rgba.delete();
      rgba = resized;
    }

    // Convertir a gris y aplicar CLAHE para mejora de contraste en sombras
    const gray = new cv.Mat();
    cv.cvtColor(rgba, gray, cv.COLOR_RGB2GRAY);
    try {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      const cl = new cv.Mat();
      clahe.apply(gray, cl);
      gray.delete();
      clahe.delete();
      // Use cl as improved gray
      // multiScaleCanny espera un mat gris
      const edges = multiScaleCanny(cl, CONFIG.cannyLevels);
      cl.delete();

      // Encontrar contornos
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);

      const detected = [];
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);

        // Filtrado rápido por area
        const area = cv.contourArea(cnt, false);
        if (area < CONFIG.minAreaPx) {
          cnt.delete();
          continue;
        }

        // Aproximar contorno para suavizar ruido (subpixel-level if possible)
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.01 * peri, true);

        // Subpixel refinement: opcionalmente usar cornerSubPix en los vertices
        // (si approx tiene puntos)
        // Convertir a Puntos si corresponde para huMoments
        const metrics = computeGeometryMetrics(cnt);
        const hu = huMoments(cnt);

        // Bounding box y minRect
        const bbox = metrics.bbox;
        const minRect = cv.minAreaRect(cnt);
        const rectPoints = cv.RotatedRect.points(minRect);

        // Centroid usando moments
        const m = cv.moments(cnt, false);
        let cx = 0, cy = 0;
        if (m.m00 !== 0) {
          cx = m.m10 / m.m00;
          cy = m.m01 / m.m00;
        }

        // Confianza heurística: combinación de solidity, circularity y área relativa
        const imageArea = edges.rows * edges.cols;
        const sizeRatio = Math.min(1, area / imageArea);
        const confidence = Math.min(1.0, 0.4 * metrics.solidity + 0.3 * metrics.circularity + 0.3 * sizeRatio);

        // Convertir medidas en mm usando pixelsPerMm (ten en cuenta scaleFactor)
        const factor = pixelsPerMm / scaleFactor; // si escalamos, revertimos
        const width_mm = (bbox.width) / factor;
        const height_mm = (bbox.height) / factor;
        const area_mm2 = (metrics.area) / (factor * factor);

        // Guardar contorno en coordenadas originales (escalar hacia arriba si corresponde)
        detected.push({
          id: `c_${Date.now()}_${i}`,
          areaPx: metrics.area,
          perimeterPx: metrics.perimeter,
          bbox: bbox,
          centroid: { x: cx / scaleFactor, y: cy / scaleFactor },
          widthPx: bbox.width / scaleFactor,
          heightPx: bbox.height / scaleFactor,
          widthMm: width_mm,
          heightMm: height_mm,
          areaMm2: area_mm2,
          circularity: metrics.circularity,
          solidity: metrics.solidity,
          extension: metrics.extension,
          compactness: metrics.compactness,
          hu: hu,
          confidence,
          approx: approx.data32S ? Array.from(approx.data32S) : undefined
        });

        // liberar mats
        approx.delete();
        cnt.delete();
      }

      // Ordenar por confidence y devolver top N
      detected.sort((a, b) => b.confidence - a.confidence);
      const top = detected.slice(0, 5);

      // Liberar mats
      contours.delete();
      hierarchy.delete();
      edges.delete();
      gray.delete();
      rgba.delete();
      src.delete();

      // Responder con detecciones
      post({ type: 'detections', id: undefined, objects: top });
    } catch (err) {
      gray.delete();
      rgba.delete();
      src.delete();
      post({ type: 'error', message: `Processing error: ${err}` });
    }
  } catch (err) {
    src.delete();
    post({ type: 'error', message: `Mat creation error: ${err}` });
  }
};

// Calibración por checkerboard - calcula cameraMatrix, distCoeffs y pixelsPerMm
const calibrateWithCheckerboard = (imageData, patternSize, squareSizeMm) => {
  const src = matFromImageData(imageData);
  try {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const patternSizeCV = new cv.Size(patternSize.w, patternSize.h);
    const corners = new cv.Mat();
    const found = cv.findChessboardCorners(gray, patternSizeCV, corners, cv.CALIB_CB_ADAPTIVE_THRESH + cv.CALIB_CB_NORMALIZE_IMAGE);
    if (!found) {
      gray.delete();
      corners.delete();
      src.delete();
      post({ type: 'calibrationResult', success: false });
      return;
    }

    // Refinar esquinas subpixel
    refineCornersSubpix(gray, corners);

    // Preparar puntos objetos (3D) y puntos imagen (2D)
    const objPoints = new cv.MatVector();
    const imgPoints = new cv.MatVector();
    const obj = new cv.Mat();
    // Crear patrón de puntos 3D (Z=0)
    const total = patternSize.w * patternSize.h;
    obj.create(total, 1, cv.CV_32FC3);
    for (let y = 0; y < patternSize.h; y++) {
      for (let x = 0; x < patternSize.w; x++) {
        const idx = y * patternSize.w + x;
        obj.data32F[idx * 3] = x * squareSizeMm;
        obj.data32F[idx * 3 + 1] = y * squareSizeMm;
        obj.data32F[idx * 3 + 2] = 0;
      }
    }
    objPoints.push_back(obj);
    imgPoints.push_back(corners);

    // Calibrar
    const cameraMatrix = new cv.Mat();
    const distCoeffs = new cv.Mat();
    const rvecs = new cv.MatVector();
    const tvecs = new cv.MatVector();
    const imgSize = new cv.Size(src.cols, src.rows);
    const rms = cv.calibrateCamera(objPoints, imgPoints, imgSize, cameraMatrix, distCoeffs, rvecs, tvecs, 0);

    // Determinar pixelsPerMm aproximado: usar distancia promedio entre esquinas en pix y mm
    // Calcular distancia entre primeras dos esquinas horizontales en imagen
    let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    try {
      // corners es un Mat Nx1x2 (float32)
      if (corners.rows >= 2) {
        const x0 = corners.data32F[0];
        const y0 = corners.data32F[1];
        const x1 = corners.data32F[2];
        const y1 = corners.data32F[3];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        // squareSizeMm es la distancia real en mm entre esquinas adyacentes
        pixelsPerMm = distPx / squareSizeMm;
      }
    } catch (err) {
      pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    }

    // Guardar parámetros globales
    CAMERA_MATRIX = cameraMatrix;
    DIST_COEFFS = distCoeffs;
    DEFAULT_PIXELS_PER_MM = pixelsPerMm;

    // Liberar
    obj.delete();
    objPoints.delete();
    imgPoints.delete();
    corners.delete();
    gray.delete();
    src.delete();

    post({
      type: 'calibrationResult',
      success: true,
      cameraMatrix: Array.from(cameraMatrix.data64F || cameraMatrix.data32F),
      distCoeffs: Array.from(distCoeffs.data64F || distCoeffs.data32F),
      pixelsPerMm
    });
  } catch (err) {
    src.delete();
    post({ type: 'error', message: `Calibration failure: ${err}` });
  }
};

// Stereo processing: recibir left & right ImageData y generar disparidad + nube de puntos (reprojectImageTo3D)
const processStereo = (left, right, params) => {
  // Necesitamos matrices de cámara y R/T. Si no están, no podemos reconstruir correctamente.
  if (!CAMERA_MATRIX || !DIST_COEFFS) {
    post({ type: 'error', message: 'Stereo requires camera calibration first' });
    return;
  }

  const leftMat = matFromImageData(left);
  const rightMat = matFromImageData(right);
  try {
    // Convert to gray
    const leftGray = new cv.Mat();
    const rightGray = new cv.Mat();
    cv.cvtColor(leftMat, leftGray, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(rightMat, rightGray, cv.COLOR_RGBA2GRAY);

    // Rectify/stereo rectify would need stereo calibration (R, T). If no stereo calib, do simple BM on crops.
    // Convert to CV_8U
    const numDisparities = params?.numDisparities || 16 * 5;
    const blockSize = params?.blockSize || 7;

    let stereo;
    if (cv.StereoSGBM_create) {
      stereo = cv.StereoSGBM_create(0, numDisparities, blockSize);
    } else if (cv.StereoBM_create) {
      stereo = cv.StereoBM_create(numDisparities, blockSize);
    } else {
      post({ type: 'error', message: 'No StereoBM/SGBM available in OpenCV.js build' });
      leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete();
      return;
    }

    const disp = new cv.Mat();
    stereo.compute(leftGray, rightGray, disp);

    // Reproject to 3D (needs Q matrix). If no stereo rectification, make an approximate Q
    // Q approximated: [1,0,0,-cx;0,1,0,-cy;0,0,0,f;0,0,1/B,0] But we cannot know baseline B here.
    // We'll make a heuristic fallback that scales disparity to depth using focal length and assumed baseline.
    const focal = CAMERA_MATRIX.data64F ? CAMERA_MATRIX.data64F[0] : (CAMERA_MATRIX.data32F ? CAMERA_MATRIX.data32F[0] : 1);
    const assumedBaselineMm = params?.assumedBaselineMm || 50; // user can calibrate baseline between cameras in mm

    // Convert disparity to depth (Z = f * B / disp)
    const dispFloat = new cv.Mat();
    disp.convertTo(dispFloat, cv.CV_32F);
    const rows = dispFloat.rows, cols = dispFloat.cols;
    const pointCloudSummary = { count: 0, zmin: Infinity, zmax: -Infinity, meanZ: 0 };

    let zSum = 0;
    let validCount = 0;
    for (let r = 0; r < rows; r += 4) {
      for (let c = 0; c < cols; c += 4) {
        const d = dispFloat.floatAt(r, c);
        if (!isFinite(d) || d <= 0.0001) continue;
        const z = (focal * assumedBaselineMm) / d; // mm
        zSum += z;
        validCount++;
        if (z < pointCloudSummary.zmin) pointCloudSummary.zmin = z;
        if (z > pointCloudSummary.zmax) pointCloudSummary.zmax = z;
      }
    }
    if (validCount > 0) {
      pointCloudSummary.count = validCount;
      pointCloudSummary.meanZ = zSum / validCount;
    } else {
      pointCloudSummary.count = 0;
    }

    // Liberar mats
    leftGray.delete(); rightGray.delete(); leftMat.delete(); rightMat.delete(); disp.delete(); dispFloat.delete();

    post({
      type: 'stereoResult',
      disparity: {
        rows: rows,
        cols: cols,
        // do not send full disparity matrix (pesado); el cliente puede solicitar recortes si quiere
      },
      pointCloudSummary
    });
  } catch (err) {
    leftMat.delete(); rightMat.delete();
    post({ type: 'error', message: `Stereo error: ${err}` });
  }
};

// Mensajes entrantes
onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init':
        if (msg.config) Object.assign(CONFIG, msg.config);
        await loadOpenCV(msg.opencvCDNs || []);
        break;
      case 'processFrame':
        if (!OPENCV_LOADED) {
          post({ type: 'error', message: 'OpenCV not loaded' });
          break;
        }
        // imageData may have transferred buffer -> re-wrap
        processSingleFrame(msg.imageData, msg.params || {});
        break;
      case 'processStereo':
        if (!OPENCV_LOADED) {
          post({ type: 'error', message: 'OpenCV not loaded' });
          break;
        }
        processStereo(msg.left, msg.right, msg.params || {});
        break;
      case 'processStereoAdvanced':
        if (!OPENCV_LOADED) {
          post({ type: 'error', message: 'OpenCV not loaded' });
          break;
        }
        processStereoAdvanced(msg.left, msg.right, msg.stereoConfig || {});
        break;
      case 'calibrateStereoAdvanced':
        if (!OPENCV_LOADED) {
          post({ type: 'error', message: 'OpenCV not loaded' });
          break;
        }
        calibrateStereoAdvanced(msg.left, msg.right, msg.patternSize, msg.squareSizeMm);
        break;
      case 'calibrateWithCheckerboard':
        if (!OPENCV_LOADED) {
          post({ type: 'error', message: 'OpenCV not loaded' });
          break;
        }
        calibrateWithCheckerboard(msg.imageData, msg.patternSize, msg.squareSizeMm);
        break;
      case 'setCalibrationParams':
        if (msg.params?.cameraMatrix) CAMERA_MATRIX = msg.params.cameraMatrix;
        if (msg.params?.distCoeffs) DIST_COEFFS = msg.params.distCoeffs;
        if (msg.params?.pixelsPerMm) DEFAULT_PIXELS_PER_MM = msg.params.pixelsPerMm;
        if (msg.params?.stereoCalib) STEREO_CALIB = msg.params.stereoCalib;
        post({ type: 'log', message: 'Calibration params set' });
        break;
      case 'shutdown':
        post({ type: 'log', message: 'Worker shutdown requested' });
        close();
        break;
      default:
        post({ type: 'log', message: `Unknown message type ${msg.type}` });
    }
  } catch (err) {
    post({ type: 'error', message: `Worker exception: ${err}` });
  }
};
