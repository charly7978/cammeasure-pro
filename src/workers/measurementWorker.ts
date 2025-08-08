import { detectContours, BoundingRect } from '../lib/imageProcessing';

interface MessageData {
  type: 'INIT' | 'READY' | 'DETECT';
  imageData?: ImageData;
  minArea?: number;
}

let cv: any = null;
let ready = false;

const loadOpenCV = () => {
  return new Promise((resolve) => {
    if ((window as any).cv) {
      cv = (window as any).cv;
      resolve(cv);
      return;
    }

    const script = document.createElement('script');
    script.src = '/opencv/opencv.js';
    script.onload = () => {
      cv = (window as any).cv;
      resolve(cv);
    };
    script.onerror = () => {
      console.error('Failed to load OpenCV!');
    };
    document.body.appendChild(script);
  });
};

const processImage = (imageData: ImageData, minArea: number): BoundingRect[] => {
  if (!cv) {
    console.warn('OpenCV not loaded yet');
    return [];
  }

  const { rects, edges } = detectContours(cv, imageData, minArea);

  // Calcular métricas geométricas avanzadas para cada bounding box
  const enhancedRects = rects.map(rect => {
    const src = cv.matFromImageData(imageData);
    const roi = src.roi(new cv.Rect(rect.x, rect.y, rect.width, rect.height));
    const gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
    const thresholded = new cv.Mat();
    cv.threshold(gray, thresholded, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // Calcular circularidad
    let circularity = 0;
    try {
      const perimeter = cv.arcLength(thresholded, true);
      circularity = perimeter > 0 ? 4 * Math.PI * rect.area / (perimeter * perimeter) : 0;
    } catch (e) {
      console.warn('Error calculating circularity', e);
    }

    // Calcular solidez
    let solidity = 0;
    try {
      const hull = new cv.Mat();
      const hull_vector = new cv.MatVector();
      let contour = new cv.Mat();
      let contours = new cv.MatVector();

      let roi_u8 = new cv.Mat();
      cv.cvtColor(roi, roi_u8, cv.COLOR_RGBA2GRAY);
      cv.threshold(roi_u8, roi_u8, 127, 255, cv.THRESH_BINARY);
      cv.findContours(roi_u8, contours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      contour = contours.get(0);

      cv.convexHull(contour, hull, false);
      hull_vector.push_back(hull);
      const hull_area = cv.contourArea(hull);
      solidity = hull_area > 0 ? rect.area / hull_area : 0;
      
      hull.delete();
      hull_vector.delete();
      contour.delete();
      contours.delete();
      roi_u8.delete();
    } catch (e) {
      console.warn('Error calculating solidity', e);
    }

    // Calcular extensión
    const extent = rect.width * rect.height > 0 ? rect.area / (rect.width * rect.height) : 0;

    // Calcular relación de aspecto
    const aspectRatio = rect.width / rect.height;

    // Calcular compacidad (relación perímetro/área)
    let compactness = 0;
    try {
      const perimeter = cv.arcLength(thresholded, true);
      compactness = perimeter > 0 ? perimeter * perimeter / rect.area : 0;
    } catch (e) {
      console.warn('Error calculating compactness', e);
    }

    // Calcular número de puntos de contorno
    let contourPoints = 0;
    try {
      let contour = new cv.Mat();
      let contours = new cv.MatVector();
      let roi_u8 = new cv.Mat();
      cv.cvtColor(roi, roi_u8, cv.COLOR_RGBA2GRAY);
      cv.threshold(roi_u8, roi_u8, 127, 255, cv.THRESH_BINARY);
      cv.findContours(roi_u8, contours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      contour = contours.get(0);
      contourPoints = contour.data32S.length / 2;

      contour.delete();
      contours.delete();
      roi_u8.delete();
    } catch (e) {
      console.warn('Error calculating contour points', e);
    }

    // Calcular centroide
    let centerX = rect.x + rect.width / 2;
    let centerY = rect.y + rect.height / 2;

    // Calcular Hu Moments (invariantes a escala, rotación y traslación)
    let huMoments: number[] = [];
    try {
      const moments = cv.moments(thresholded);
      const huMomentsArray = new cv.Mat();
      cv.HuMoments(moments, huMomentsArray);
      
      // Convertir a array de números de forma segura
      for (let i = 0; i < 7; i++) {
        const value = huMomentsArray.doublePtr(0, i)[0];
        if (typeof value === 'number' && !isNaN(value)) {
          huMoments.push(Math.abs(value) > 0 ? -Math.sign(value) * Math.log10(Math.abs(value)) : 0);
        } else {
          huMoments.push(0);
        }
      }
      huMomentsArray.delete();
    } catch (error) {
      console.warn('Error calculando Hu Moments:', error);
      huMoments = [0, 0, 0, 0, 0, 0, 0];
    }

    // Calcular convexidad
    let isConvex = false;
    try {
      let contour = new cv.Mat();
      let contours = new cv.MatVector();
      let roi_u8 = new cv.Mat();
      cv.cvtColor(roi, roi_u8, cv.COLOR_RGBA2GRAY);
      cv.threshold(roi_u8, roi_u8, 127, 255, cv.THRESH_BINARY);
      cv.findContours(roi_u8, contours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      contour = contours.get(0);
      isConvex = cv.isContourConvex(contour);

      contour.delete();
      contours.delete();
      roi_u8.delete();
    } catch (e) {
      console.warn('Error calculating convexity', e);
    }

    // Calcular radio del círculo delimitador
    let boundingCircleRadius = 0;
    try {
      let contour = new cv.Mat();
      let contours = new cv.MatVector();
      let roi_u8 = new cv.Mat();
      cv.cvtColor(roi, roi_u8, cv.COLOR_RGBA2GRAY);
      cv.threshold(roi_u8, roi_u8, 127, 255, cv.THRESH_BINARY);
      cv.findContours(roi_u8, contours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      contour = contours.get(0);

      let center = new cv.Point();
      boundingCircleRadius = cv.minEnclosingCircle(contour, center);

      contour.delete();
      contours.delete();
      roi_u8.delete();
    } catch (e) {
      console.warn('Error calculating bounding circle radius', e);
    }

    src.delete();
    roi.delete();
    gray.delete();
    thresholded.delete();

    return {
      ...rect,
      circularity,
      solidity,
      extent,
      aspectRatio,
      compactness,
      perimeter: 0, // TODO: Implementar cálculo de perímetro
      contourPoints,
      centerX,
      centerY,
      huMoments,
      isConvex,
      boundingCircleRadius
    };
  });

  edges.delete();
  return enhancedRects;
};

self.addEventListener('message', async (event: MessageEvent<MessageData>) => {
  const data = event.data;

  switch (data.type) {
    case 'INIT':
      await loadOpenCV();
      ready = true;
      self.postMessage({ type: 'READY' });
      break;
    case 'DETECT':
      if (!cv) {
        console.warn('OpenCV not loaded yet');
        return;
      }
      if (!data.imageData) {
        console.warn('No image data provided');
        return;
      }
      const rects = processImage(data.imageData, data.minArea || 100);
      self.postMessage({ type: 'DETECTED', rects });
      break;
    default:
      console.warn('Unknown message type', data.type);
  }
});
