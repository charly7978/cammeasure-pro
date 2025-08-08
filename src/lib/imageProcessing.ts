export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence?: number; // Opcional para compatibilidad con el worker
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
        rects.push({ 
          x: rect.x, 
          y: rect.y, 
          width: rect.width, 
          height: rect.height, 
          area,
          confidence: 0.7 // Valor por defecto
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