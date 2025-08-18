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
 * Detecta contornos y bordes en una imagen usando OpenCV
 * Optimizado para detectar el objeto más prominente con alta precisión
 * @param cv Instancia de OpenCV
 * @param imageData Imagen a procesar
 * @param minArea Área mínima para considerar un contorno (por defecto 500)
 * @returns Objeto con rectángulos detectados, objeto prominente y matriz de bordes
 */
export function detectContours(
  cv: any,
  imageData: ImageData,
  minArea: number = 500
): { rects: BoundingRect[]; prominentObject: BoundingRect | null; edges: any } {
  try {
    // Convertir ImageData a formato OpenCV
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convertir a escala de grises
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Mejorar contraste usando ecualización de histograma
    cv.equalizeHist(gray, gray);
    
    // Desenfoque Gaussiano para reducir ruido
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    // Detección de bordes con Canny - umbrales optimizados
    cv.Canny(blurred, edges, 30, 90);
    
    // Operaciones morfológicas para mejorar los bordes
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1);
    kernel.delete();

    // Encontrar contornos
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const rects: BoundingRect[] = [];
    let prominentObject: BoundingRect | null = null;
    let maxScore = 0;
    
    const imageCenterX = src.cols / 2;
    const imageCenterY = src.rows / 2;
    const maxDistance = Math.sqrt(imageCenterX * imageCenterX + imageCenterY * imageCenterY);
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      
      if (area >= minArea) {
        const rect = cv.boundingRect(contour);
        const perimeter = cv.arcLength(contour, true);
        const moments = cv.moments(contour);
        const centerX = moments.m10 / moments.m00;
        const centerY = moments.m01 / moments.m00;
        
        // Calcular distancia desde el centro de la imagen
        const distanceFromCenter = Math.sqrt(
          Math.pow(centerX - imageCenterX, 2) + Math.pow(centerY - imageCenterY, 2)
        );
        const proximityScore = 1 - (distanceFromCenter / maxDistance);
        
        // Calcular propiedades geométricas
        const aspectRatio = rect.width / rect.height;
        const extent = area / (rect.width * rect.height);
        
        // Calcular convex hull para solidity
        const hull = new cv.Mat();
        cv.convexHull(contour, hull, false, true);
        const hullArea = cv.contourArea(hull);
        const solidity = hullArea > 0 ? area / hullArea : 0;
        hull.delete();
        
        // Calcular circularity
        const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
        
        // Calcular compactness
        const compactness = perimeter > 0 ? (perimeter * perimeter) / area : 0;
        
        // Calcular confianza basada en múltiples factores
        const confidence = calculateObjectConfidence({
          area, solidity, circularity, extent, aspectRatio, compactness, perimeter, proximityScore
        });
        
        const boundingRect: BoundingRect = {
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
          isConvex: cv.isContourConvex(contour),
          boundingCircleRadius: cv.minEnclosingCircle(contour).radius
        };
        
        rects.push(boundingRect);
        
        // Actualizar objeto más prominente basado en confianza y proximidad
        const overallScore = confidence * 0.7 + proximityScore * 0.3;
        if (overallScore > maxScore && confidence > 0.4) {
          maxScore = overallScore;
          prominentObject = boundingRect;
        }
      }
      
      contour.delete();
    }
    
    // Ordenar por confianza (mayor a menor)
    rects.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // Liberar memoria
    src.delete();
    gray.delete();
    blurred.delete();
    contours.delete();
    hierarchy.delete();

    return { rects, prominentObject, edges };
  } catch (error) {
    console.error('Error en detección de contornos:', error);
    return { rects: [], prominentObject: null, edges: null };
  }
}

/**
 * Calcula la confianza del objeto detectado basado en múltiples factores geométricos y de posición
 */
function calculateObjectConfidence(params: {
  area: number;
  solidity: number;
  circularity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
  proximityScore: number;
}): number {
  const { area, solidity, circularity, extent, aspectRatio, compactness, perimeter, proximityScore } = params;
  
  // Puntuaciones normalizadas (0-1)
  const areaScore = Math.min(area / 2000, 1); // Normalizar área
  const solidityScore = solidity; // Ya está entre 0-1
  const circularityScore = Math.min(circularity, 1); // Limitar a 1
  const extentScore = extent; // Ya está entre 0-1
  const aspectRatioScore = (aspectRatio > 0.3 && aspectRatio < 3) ? 1 : 0.5; // Penalizar ratios extremos
  const compactnessScore = Math.max(0, 1 - compactness / 100); // Invertir y normalizar
  
  // Ponderación de factores
  return (
    areaScore * 0.15 +      // Tamaño del objeto
    solidityScore * 0.15 +   // Solidez (qué tan lleno está)
    circularityScore * 0.1 + // Circularidad (para objetos redondos)
    extentScore * 0.1 +      // Extensión (qué bien llena el bounding box)
    aspectRatioScore * 0.1 + // Ratio de aspecto (preferir formas regulares)
    compactnessScore * 0.1 + // Compacidad (forma compacta vs dispersa)
    proximityScore * 0.3     // Proximidad al centro de la imagen
  );
}
