export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence: number;
  circularity: number;
  solidity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
  contourPoints: number;
  centerX: number;
  centerY: number;
  huMoments: number[];
  isConvex: boolean;
  boundingCircleRadius: number;
  depth?: number;
  realWidth?: number;
  realHeight?: number;
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
        const moments = cv.moments(contour);
        const centerX = moments.m10 / moments.m00;
        const centerY = moments.m01 / moments.m00;
        
        // Calcular convex hull para solidity
        const hull = new cv.Mat();
        cv.convexHull(contour, hull, false, true);
        const hullArea = cv.contourArea(hull);
        const solidity = hullArea > 0 ? area / hullArea : 0;
        hull.delete();
        
        // Calcular propiedades geométricas
        const extent = area / (rect.width * rect.height);
        const aspectRatio = rect.width / rect.height;
        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        const compactness = (perimeter * perimeter) / area;
        
        // Calcular Hu moments
        const huMoments = cv.HuMoments(moments);
        const huMomentsArray = [];
        for (let j = 0; j < huMoments.rows; j++) {
          huMomentsArray.push(huMoments.data32F[j]);
        }
        
        // Calcular círculo circunscrito
        const minEnclosingCircle = cv.minEnclosingCircle(contour);
        const boundingCircleRadius = minEnclosingCircle.radius;
        const isConvex = cv.isContourConvex(contour);
        
        // Calcular confianza basada en múltiples factores
        const confidence = calculateAdvancedPositionScore({
          area, solidity, circularity, extent, aspectRatio, compactness, perimeter
        });
        
        rects.push({ 
          x: rect.x, 
          y: rect.y, 
          width: rect.width, 
          height: rect.height, 
          area,
          confidence,
          circularity,
          solidity,
          extent,
          aspectRatio,
          compactness,
          perimeter,
          contourPoints: contour.rows,
          centerX,
          centerY,
          huMoments: huMomentsArray,
          isConvex,
          boundingCircleRadius
        });
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

function calculateAdvancedPositionScore(params: {
  area: number;
  solidity: number;
  circularity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
}): number {
  const { area, solidity, circularity, extent, aspectRatio, compactness, perimeter } = params;
  
  const areaScore = Math.min(area / 1000, 1);
  const solidityScore = solidity;
  const circularityScore = Math.min(circularity, 1);
  const extentScore = extent;
  const aspectRatioScore = aspectRatio > 0.5 && aspectRatio < 2 ? 1 : 0.5;
  const compactnessScore = Math.max(0, 1 - compactness / 100);
  
  return (areaScore * 0.2 + solidityScore * 0.2 + circularityScore * 0.2 + 
          extentScore * 0.15 + aspectRatioScore * 0.15 + compactnessScore * 0.1);
}
