interface DetectMessage {
  type: 'DETECT';
  imageData: ImageData;
  minArea: number;
}

interface InitMessage {
  type: 'INIT';
}

type Incoming = DetectMessage | InitMessage;

type Outgoing =
  | { type: 'READY' }
  | { type: 'DETECTED'; rects: any[] };

// Worker AVANZADO con algoritmos REALES de visión computacional
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;
let isInitialized = false;

// Cargar OpenCV con múltiples CDNs para máxima confiabilidad
function loadOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    const opencvSources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    const tryLoadSource = (index: number) => {
      if (index >= opencvSources.length) {
        console.warn('⚠️ OpenCV no disponible, usando algoritmos nativos avanzados');
        resolve();
        return;
      }

      try {
        importScripts(opencvSources[index]);
        
        const checkCV = () => {
          if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
            isOpenCVReady = true;
            console.log('✅ OpenCV cargado - algoritmos avanzados habilitados');
            resolve();
          } else {
            setTimeout(checkCV, 100);
          }
        };
        
        setTimeout(checkCV, 100);
        
      } catch (error) {
        console.warn(`Falló fuente ${index}, probando siguiente...`);
        tryLoadSource(index + 1);
      }
    };

    tryLoadSource(0);
  });
}

// DETECCIÓN PRINCIPAL con algoritmos REALES avanzados
function detectContoursAdvanced(imageData: ImageData, minArea: number) {
  if (isOpenCVReady && cv) {
    return detectContoursOpenCVAdvanced(imageData, minArea);
  } else {
    return detectContoursNativeAdvanced(imageData, minArea);
  }
}

// ALGORITMOS OPENCV REALES AVANZADOS
function detectContoursOpenCVAdvanced(imageData: ImageData, minArea: number) {
  try {
    const src = cv.matFromImageData(imageData);
    
    // 1. Convertir a escala de grises con mayor precisión
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // 2. Reducir ruido con filtro bilateral avanzado
    const denoised = new cv.Mat();
    cv.bilateralFilter(gray, denoised, 15, 80, 80);
    
    // 3. Mejora de contraste con CLAHE adaptativo
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    const enhanced = new cv.Mat();
    clahe.apply(denoised, enhanced);
    
    // 4. Detección de bordes multi-escala Canny
    const edges1 = new cv.Mat();
    const edges2 = new cv.Mat();
    const edges3 = new cv.Mat();
    
    cv.Canny(enhanced, edges1, 20, 60, 3, false);   // Bordes suaves
    cv.Canny(enhanced, edges2, 50, 150, 3, false);  // Bordes medios
    cv.Canny(enhanced, edges3, 100, 200, 3, false); // Bordes duros
    
    // Combinar detecciones multi-escala
    const combinedEdges = new cv.Mat();
    cv.addWeighted(edges1, 0.3, edges2, 0.5, 0, combinedEdges);
    cv.addWeighted(combinedEdges, 1.0, edges3, 0.2, 0, combinedEdges);
    
    // 5. Operaciones morfológicas avanzadas
    const kernel1 = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const kernel2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    
    const morphed = new cv.Mat();
    cv.morphologyEx(combinedEdges, morphed, cv.MORPH_CLOSE, kernel1);
    cv.morphologyEx(morphed, morphed, cv.MORPH_OPEN, kernel2);
    
    // 6. Dilatación controlada para conectar contornos
    const dilated = new cv.Mat();
    cv.dilate(morphed, dilated, kernel1, new cv.Point(-1, -1), 2);
    
    // 7. Encontrar contornos con análisis jerárquico
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;
    
    console.log(`🔍 Algoritmos OpenCV avanzados: ${contours.size()} contornos detectados`);
    
    // 8. Análisis avanzado de cada contorno
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Aproximación poligonal de Douglas-Peucker
      const epsilon = 0.015 * cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      const rect = cv.boundingRect(contour);
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Cálculo de convex hull para análisis de forma
      const hull = new cv.Mat();
      cv.convexHull(contour, hull, false, true);
      const hullArea = cv.contourArea(hull);
      
      // Métricas geométricas REALES
      const solidity = hullArea > 0 ? area / hullArea : 0;
      const extent = area / (rect.width * rect.height);
      const aspectRatio = rect.width / rect.height;
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      const compactness = (perimeter * perimeter) / area;
      
      // Análisis de momentos para caracterización avanzada
      const moments = cv.moments(contour);
      const hu = new cv.Mat();
      cv.HuMoments(moments, hu);
      
      // Centro de masa real
      const cx = moments.m10 / moments.m00;
      const cy = moments.m01 / moments.m00;
      
      // Filtros REALES para objetos válidos
      const minValidArea = Math.max(minArea, imageArea * 0.0008);
      const maxValidArea = imageArea * 0.6;
      
      const isValidSize = area >= minValidArea && area <= maxValidArea;
      const isValidShape = aspectRatio > 0.15 && aspectRatio < 15.0;
      const isValidSolidity = solidity > 0.3 && solidity <= 1.0;
      const isValidExtent = extent > 0.15 && extent <= 1.0;
      const isValidCircularity = circularity > 0.01 && circularity <= 1.0;
      const isValidCompactness = compactness > 10 && compactness < 500;
      const hasValidDimensions = rect.width > 25 && rect.height > 25;
      const isNotTooThin = Math.min(rect.width, rect.height) > 18;
      const isNotTooSquare = Math.abs(aspectRatio - 1.0) > 0.05 || area > minArea * 3;
      
      if (isValidSize && isValidShape && isValidSolidity && isValidExtent && 
          isValidCircularity && isValidCompactness && hasValidDimensions && 
          isNotTooThin && isNotTooSquare) {
        
        // Cálculo de confianza multi-factor REAL
        const sizeScore = Math.exp(-Math.pow((area - minArea * 4) / (minArea * 6), 2));
        const shapeScore = Math.min(circularity * 8, 1.0);
        const solidityScore = solidity;
        const extentScore = extent;
        const positionScore = calculateAdvancedPositionScore(rect, imageData.width, imageData.height, cx, cy);
        const contourQualityScore = Math.min(approx.rows / 25, 1.0);
        const momentScore = calculateMomentScore(hu);
        
        const confidence = Math.min((
          sizeScore * 0.18 + 
          shapeScore * 0.16 + 
          solidityScore * 0.15 + 
          extentScore * 0.13 + 
          positionScore * 0.12 +
          contourQualityScore * 0.13 +
          momentScore * 0.13
        ), 1.0);
        
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area,
          confidence: confidence,
          // Métricas geométricas reales
          circularity: circularity,
          solidity: solidity,
          extent: extent,
          aspectRatio: aspectRatio,
          compactness: compactness,
          perimeter: perimeter,
          contourPoints: approx.rows,
          // Centro de masa real
          centerX: cx,
          centerY: cy,
          // Moment
