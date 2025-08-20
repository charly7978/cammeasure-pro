// SISTEMA DE MEDICIÓN SIMPLE Y EFICIENTE
export interface SimpleMeasurement {
  area: number;
  perimeter: number;
  width: number;
  height: number;
  confidence: number;
  timestamp: number;
}

export interface SimplePoint {
  x: number;
  y: number;
}

export class SimpleMeasurementSystem {
  // DETECTAR CONTORNOS BÁSICOS - RÁPIDO Y SIMPLE
  detectBasicContours(imageData: ImageData): SimplePoint[] {
    const { data, width, height } = imageData;
    const contours: SimplePoint[] = [];
    
    // Convertir a escala de grises y detectar bordes básicos
    const gray = new Uint8Array(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // Detección simple de bordes usando diferencias
    const threshold = 50;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const current = gray[idx];
        
        // Gradiente horizontal y vertical
        const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
        const gy = Math.abs(gray[idx + width] - gray[idx - width]);
        const gradient = Math.sqrt(gx * gx + gy * gy);
        
        if (gradient > threshold) {
          contours.push({ x, y });
        }
      }
    }
    
    return contours;
  }
  
  // MEDIR OBJETO SIMPLE
  measureSimpleObject(contours: SimplePoint[], pixelsPerMm: number = 1): SimpleMeasurement {
    if (contours.length === 0) {
      return {
        area: 0,
        perimeter: 0,
        width: 0,
        height: 0,
        confidence: 0,
        timestamp: Date.now()
      };
    }
    
    // Calcular bounding box
    let minX = contours[0].x, maxX = contours[0].x;
    let minY = contours[0].y, maxY = contours[0].y;
    
    for (const point of contours) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const area = contours.length; // Aproximación simple
    
    // Perímetro aproximado
    let perimeter = 0;
    for (let i = 0; i < contours.length - 1; i++) {
      const p1 = contours[i];
      const p2 = contours[i + 1];
      perimeter += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }
    
    // Confianza basada en cantidad de puntos
    const confidence = Math.min(1.0, contours.length / 100);
    
    return {
      area: area * pixelsPerMm * pixelsPerMm,
      perimeter: perimeter * pixelsPerMm,
      width: width * pixelsPerMm,
      height: height * pixelsPerMm,
      confidence,
      timestamp: Date.now()
    };
  }
  
  // MEDICIÓN POR CLICK MANUAL
  measureByClick(imageData: ImageData, clickX: number, clickY: number, pixelsPerMm: number = 1): SimpleMeasurement {
    console.log(`🎯 MIDIENDO EN COORDENADA: ${clickX}, ${clickY}`);
    
    // Detectar contornos en área pequeña alrededor del click
    const regionSize = 50;
    const startX = Math.max(0, clickX - regionSize);
    const startY = Math.max(0, clickY - regionSize);
    const endX = Math.min(imageData.width, clickX + regionSize);
    const endY = Math.min(imageData.height, clickY + regionSize);
    
    const contours: SimplePoint[] = [];
    const { data, width } = imageData;
    
    // Buscar bordes en región local
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        
        // Si es borde, agregar punto
        if (x > 0 && y > 0 && x < width - 1 && y < imageData.height - 1) {
          const idx2 = ((y - 1) * width + x) * 4;
          const grayUp = Math.round(0.299 * data[idx2] + 0.587 * data[idx2 + 1] + 0.114 * data[idx2 + 2]);
          
          if (Math.abs(gray - grayUp) > 30) {
            contours.push({ x, y });
          }
        }
      }
    }
    
    const measurement = this.measureSimpleObject(contours, pixelsPerMm);
    
    console.log(`✅ MEDICIÓN MANUAL COMPLETADA:`, {
      puntos: contours.length,
      área: Math.round(measurement.area),
      perímetro: Math.round(measurement.perimeter),
      confianza: (measurement.confidence * 100).toFixed(1) + '%'
    });
    
    return measurement;
  }
}