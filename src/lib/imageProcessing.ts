
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence?: number;
  // Geometric properties for advanced analysis
  circularity?: number;
  solidity?: number;
  extent?: number;
  aspectRatio?: number;
  compactness?: number;
  perimeter?: number;
  contourPoints?: number;
  centerX?: number;
  centerY?: number;
  huMoments?: number[];
  isConvex?: boolean;
  boundingCircleRadius?: number;
}

/**
 * Realiza preprocesamiento de la imagen (grises, blur, Canny, morfología) y
 * devuelve los contornos significativos junto con la matriz de bordes.
 * Todo se ejecuta con WebAssembly de OpenCV en hilo principal o worker.
 */
export function detectContours(
  cv: any,
  imageData: ImageData,
  minArea = 100
): { rects: BoundingRect[]; edges: any } {
  // Convertir a Mat
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // Escala de grises
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // Desenfoque Gaussian
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    // Canny
    cv.Canny(blurred, edges, 50, 150);
    // Operación morfológica para cerrar huecos
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    // Contornos
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const rects: BoundingRect[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area >= minArea) {
        const rect = cv.boundingRect(contour);
        const perimeter = cv.arcLength(contour, true);
        const aspectRatio = rect.width / rect.height;
        const extent = area / (rect.width * rect.height);
        
        // Calculate convex hull for solidity
        const hull = new cv.Mat();
        cv.convexHull(contour, hull, false);
        const hullArea = cv.contourArea(hull);
        const solidity = area / hullArea;
        
        // Calculate circularity
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        
        // Calculate compactness
        const compactness = (perimeter * perimeter) / area;
        
        // Calculate center
        const moments = cv.moments(contour);
        const centerX = moments.m10 / moments.m00;
        const centerY = moments.m01 / moments.m00;
        
        // Check if convex
        const isConvex = cv.isContourConvex(contour);
        
        // Calculate minimum enclosing circle
        const center = new cv.Point2f();
        const radius = cv.minEnclosingCircle(contour, center);
        
        rects.push({ 
          x: rect.x, 
          y: rect.y, 
          width: rect.width, 
          height: rect.height, 
          area,
          confidence: 0.7,
          circularity: circularity,
          solidity: solidity,
          extent: extent,
          aspectRatio: aspectRatio,
          compactness: compactness,
          perimeter: perimeter,
          contourPoints: contour.rows,
          centerX: centerX,
          centerY: centerY,
          isConvex: isConvex,
          boundingCircleRadius: radius.toFixed ? parseFloat(radius.toFixed(2)) : radius
        });
        
        hull.delete();
        center.delete();
      }
      contour.delete();
    }

    // No eliminamos edges todavía porque el llamador puede necesitarlo.
    // Eliminamos mats intermedios
    src.delete();
    gray.delete();
    blurred.delete();
    contours.delete();
    hierarchy.delete();

    return { rects, edges };
  } catch (err) {
    // Limpieza en caso de error
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    throw err;
  }
}
