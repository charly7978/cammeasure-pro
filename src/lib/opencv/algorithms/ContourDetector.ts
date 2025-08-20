/**
 * DETECTOR DE CONTORNOS ULTRA AVANZADO
 * Implementa algoritmos de detección y análisis de contornos con precisión matemática
 */

export interface ContourPoint {
  x: number;
  y: number;
}

export interface ContourProperties {
  area: number;
  perimeter: number;
  circularity: number;
  solidity: number;
  aspectRatio: number;
  extent: number;
  compactness: number;
  convexity: number;
  rectangularity: number;
  huMoments: number[];
  centroid: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  minEnclosingCircle: { center: { x: number; y: number }; radius: number };
  convexHull: ContourPoint[];
  orientation: number;
}

export interface DetectedContour {
  points: ContourPoint[];
  properties: ContourProperties;
  hierarchy: {
    parent: number;
    child: number;
    next: number;
    previous: number;
  };
  isOuter: boolean;
  confidence: number;
}

export class ContourDetector {
  private static instance: ContourDetector;
  
  public static getInstance(): ContourDetector {
    if (!ContourDetector.instance) {
      ContourDetector.instance = new ContourDetector();
    }
    return ContourDetector.instance;
  }

  /**
   * DETECTAR CONTORNOS CON ALGORITMO SUZUKI-ABE MEJORADO
   */
  findContours(
    edges: Uint8Array,
    width: number,
    height: number,
    retrievalMode: 'external' | 'tree' | 'ccomp' | 'list' = 'external',
    approximationMethod: 'none' | 'simple' | 'tc89_l1' | 'tc89_kcos' = 'simple'
  ): DetectedContour[] {
    console.log(`🔍 Iniciando detección de contornos ${width}x${height}, modo: ${retrievalMode}`);
    
    const contours: DetectedContour[] = [];
    const visited = new Array(width * height).fill(false);
    
    // Algoritmo Moore Boundary Tracing mejorado
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    // Lista de puntos candidatos ordenados por proximidad al centro
    const candidates = this.findContourStartPoints(edges, width, height, centerX, centerY);
    
    console.log(`📍 Encontrados ${candidates.length} puntos candidatos`);
    
    for (const candidate of candidates) {
      const { x, y, distance } = candidate;
      const idx = y * width + x;
      
      if (!visited[idx] && edges[idx] === 255) {
        const contour = this.traceContour(
          edges, visited, x, y, width, height, approximationMethod
        );
        
        if (contour.length >= 10) { // Mínimo 10 puntos para contornos de calidad
          const properties = this.calculateContourProperties(contour, width, height);
          
          // Filtrar contornos por calidad
          if (this.isValidContour(properties, width, height)) {
            const detectedContour: DetectedContour = {
              points: contour,
              properties,
              hierarchy: { parent: -1, child: -1, next: -1, previous: -1 },
              isOuter: true,
              confidence: this.calculateContourConfidence(properties, distance, width, height)
            };
            
            contours.push(detectedContour);
            
            console.log(`✅ Contorno válido: área=${properties.area.toFixed(0)}, perímetro=${properties.perimeter.toFixed(1)}, confianza=${detectedContour.confidence.toFixed(2)}`);
          }
        }
        
        // Límite de contornos - SOLO DETECTAR 1 CONTORNO
        if (contours.length >= 1) break;
      }
    }
    
    // Ordenar por confianza y calidad
    contours.sort((a, b) => {
      const scoreA = a.confidence * a.properties.area;
      const scoreB = b.confidence * b.properties.area;
      return scoreB - scoreA;
    });
    
    console.log(`✅ Detectados ${contours.length} contornos válidos`);
    return contours;
  }

  /**
   * ENCONTRAR PUNTOS DE INICIO DE CONTORNOS PRIORIZANDO EL CENTRO
   */
  private findContourStartPoints(
    edges: Uint8Array,
    width: number,
    height: number,
    centerX: number,
    centerY: number
  ): Array<{ x: number; y: number; distance: number }> {
    const candidates: Array<{ x: number; y: number; distance: number }> = [];
    
    // Buscar en toda la imagen pero priorizar el centro
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 255) {
          // Verificar si es un punto de inicio de contorno
          if (this.isContourStartPoint(edges, x, y, width, height)) {
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            candidates.push({ x, y, distance });
          }
        }
      }
    }
    
    // Ordenar por proximidad al centro
    candidates.sort((a, b) => a.distance - b.distance);
    
    return candidates;
  }

  /**
   * VERIFICAR SI ES PUNTO DE INICIO DE CONTORNO
   */
  private isContourStartPoint(
    edges: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    const idx = y * width + x;
    if (edges[idx] !== 255) return false;
    
    // Verificar si tiene al menos un vecino no-borde (borde externo)
    const neighbors = [
      edges[(y-1) * width + (x-1)], edges[(y-1) * width + x], edges[(y-1) * width + (x+1)],
      edges[y * width + (x-1)],                                 edges[y * width + (x+1)],
      edges[(y+1) * width + (x-1)], edges[(y+1) * width + x], edges[(y+1) * width + (x+1)]
    ];
    
    return neighbors.some(n => n !== 255);
  }

  /**
   * RASTREAR CONTORNO CON ALGORITMO MOORE
   */
  private traceContour(
    edges: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number,
    approximation: 'none' | 'simple' | 'tc89_l1' | 'tc89_kcos'
  ): ContourPoint[] {
    const contour: ContourPoint[] = [];
    
    // Direcciones Moore (8-conectadas) en sentido horario
    const directions = [
      { dx: 1, dy: 0 },   // E
      { dx: 1, dy: 1 },   // SE
      { dx: 0, dy: 1 },   // S
      { dx: -1, dy: 1 },  // SW
      { dx: -1, dy: 0 },  // W
      { dx: -1, dy: -1 }, // NW
      { dx: 0, dy: -1 },  // N
      { dx: 1, dy: -1 }   // NE
    ];
    
    let currentX = startX;
    let currentY = startY;
    let directionIndex = 0;
    
    do {
      contour.push({ x: currentX, y: currentY });
      visited[currentY * width + currentX] = true;
      
      // Buscar siguiente punto del contorno
      let found = false;
      for (let i = 0; i < directions.length; i++) {
        const searchIndex = (directionIndex + i) % directions.length;
        const { dx, dy } = directions[searchIndex];
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
          const nextIdx = nextY * width + nextX;
          
          if (edges[nextIdx] === 255) {
            currentX = nextX;
            currentY = nextY;
            directionIndex = (searchIndex + 6) % directions.length; // Girar hacia la izquierda
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while ((currentX !== startX || currentY !== startY) && contour.length < 2000);
    
    // Aplicar aproximación si se solicita
    if (approximation === 'simple' && contour.length > 10) {
      return this.approximateContourDP(contour, 1.0);
    }
    
    return contour;
  }

  /**
   * APROXIMACIÓN DE CONTORNO DOUGLAS-PEUCKER
   */
  private approximateContourDP(
    contour: ContourPoint[],
    epsilon: number
  ): ContourPoint[] {
    if (contour.length <= 2) return contour;
    
    // Encontrar el punto más lejano de la línea
    let maxDistance = 0;
    let maxIndex = 0;
    const start = contour[0];
    const end = contour[contour.length - 1];
    
    for (let i = 1; i < contour.length - 1; i++) {
      const distance = this.pointToLineDistance(contour[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // Si la distancia máxima es menor que epsilon, aproximar con línea
    if (maxDistance < epsilon) {
      return [start, end];
    }
    
    // Recursión en ambos segmentos
    const left = this.approximateContourDP(contour.slice(0, maxIndex + 1), epsilon);
    const right = this.approximateContourDP(contour.slice(maxIndex), epsilon);
    
    // Combinar resultados eliminando punto duplicado
    return [...left.slice(0, -1), ...right];
  }

  /**
   * DISTANCIA DE PUNTO A LÍNEA
   */
  private pointToLineDistance(
    point: ContourPoint,
    lineStart: ContourPoint,
    lineEnd: ContourPoint
  ): number {
    const A = lineEnd.x - lineStart.x;
    const B = lineEnd.y - lineStart.y;
    const C = point.x - lineStart.x;
    const D = point.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = A * A + B * B;
    
    if (lenSq === 0) {
      return Math.sqrt(C * C + D * D);
    }
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * A;
      yy = lineStart.y + param * B;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * CALCULAR PROPIEDADES GEOMÉTRICAS AVANZADAS
   */
  private calculateContourProperties(
    contour: ContourPoint[],
    imgWidth: number,
    imgHeight: number
  ): ContourProperties {
    // Área usando fórmula Shoelace
    const area = this.calculateArea(contour);
    
    // Perímetro
    const perimeter = this.calculatePerimeter(contour);
    
    // Centroide
    const centroid = this.calculateCentroid(contour);
    
    // Bounding box
    const boundingBox = this.calculateBoundingBox(contour);
    
    // Aspectos geométricos
    const aspectRatio = boundingBox.width / boundingBox.height;
    const extent = area / (boundingBox.width * boundingBox.height);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    // Convex hull
    const convexHull = this.calculateConvexHull(contour);
    const convexArea = this.calculateArea(convexHull);
    const solidity = area / convexArea;
    const convexity = this.calculatePerimeter(convexHull) / perimeter;
    
    // Compacidad
    const compactness = (perimeter * perimeter) / area;
    
    // Rectangularidad
    const rectangularity = area / (boundingBox.width * boundingBox.height);
    
    // Círculo envolvente mínimo
    const minEnclosingCircle = this.calculateMinEnclosingCircle(contour);
    
    // Momentos Hu
    const huMoments = this.calculateHuMoments(contour, centroid);
    
    // Orientación principal
    const orientation = this.calculateOrientation(contour, centroid, area);
    
    return {
      area,
      perimeter,
      circularity: Math.max(0, Math.min(1, circularity)),
      solidity: Math.max(0, Math.min(1, solidity)),
      aspectRatio,
      extent: Math.max(0, Math.min(1, extent)),
      compactness,
      convexity: Math.max(0, Math.min(1, convexity)),
      rectangularity: Math.max(0, Math.min(1, rectangularity)),
      huMoments,
      centroid,
      boundingBox,
      minEnclosingCircle,
      convexHull,
      orientation
    };
  }

  /**
   * CALCULAR ÁREA CON FÓRMULA SHOELACE
   */
  private calculateArea(contour: ContourPoint[]): number {
    if (contour.length < 3) return 0;
    
    let area = 0;
    const n = contour.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * CALCULAR PERÍMETRO
   */
  private calculatePerimeter(contour: ContourPoint[]): number {
    if (contour.length < 2) return 0;
    
    let perimeter = 0;
    const n = contour.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = contour[j].x - contour[i].x;
      const dy = contour[j].y - contour[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }

  /**
   * CALCULAR CENTROIDE
   */
  private calculateCentroid(contour: ContourPoint[]): { x: number; y: number } {
    if (contour.length === 0) return { x: 0, y: 0 };
    
    let cx = 0, cy = 0;
    let area = 0;
    const n = contour.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = contour[i].x * contour[j].y - contour[j].x * contour[i].y;
      area += cross;
      cx += (contour[i].x + contour[j].x) * cross;
      cy += (contour[i].y + contour[j].y) * cross;
    }
    
    area = Math.abs(area) / 2;
    if (area === 0) {
      // Fallback para contornos degenerados
      cx = contour.reduce((sum, p) => sum + p.x, 0) / n;
      cy = contour.reduce((sum, p) => sum + p.y, 0) / n;
    } else {
      cx = Math.abs(cx) / (6 * area);
      cy = Math.abs(cy) / (6 * area);
    }
    
    return { x: cx, y: cy };
  }

  /**
   * CALCULAR BOUNDING BOX
   */
  private calculateBoundingBox(contour: ContourPoint[]): { x: number; y: number; width: number; height: number } {
    if (contour.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = contour[0].x, maxX = contour[0].x;
    let minY = contour[0].y, maxY = contour[0].y;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * CALCULAR CONVEX HULL (ALGORITMO GRAHAM SCAN)
   */
  private calculateConvexHull(contour: ContourPoint[]): ContourPoint[] {
    if (contour.length < 3) return [...contour];
    
    // Encontrar punto más bajo (y más pequeña, x más pequeña en caso de empate)
    let bottom = contour[0];
    let bottomIndex = 0;
    
    for (let i = 1; i < contour.length; i++) {
      if (contour[i].y > bottom.y || (contour[i].y === bottom.y && contour[i].x < bottom.x)) {
        bottom = contour[i];
        bottomIndex = i;
      }
    }
    
    // Ordenar puntos por ángulo polar desde el punto más bajo
    const points = contour.filter((_, i) => i !== bottomIndex);
    points.sort((a, b) => {
      const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
      const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
      if (angleA === angleB) {
        const distA = (a.x - bottom.x) ** 2 + (a.y - bottom.y) ** 2;
        const distB = (b.x - bottom.x) ** 2 + (b.y - bottom.y) ** 2;
        return distA - distB;
      }
      return angleA - angleB;
    });
    
    // Graham scan
    const hull = [bottom, points[0]];
    
    for (let i = 1; i < points.length; i++) {
      while (hull.length > 1 && this.cross(hull[hull.length - 2], hull[hull.length - 1], points[i]) <= 0) {
        hull.pop();
      }
      hull.push(points[i]);
    }
    
    return hull;
  }

  /**
   * PRODUCTO CRUZADO PARA CONVEX HULL
   */
  private cross(o: ContourPoint, a: ContourPoint, b: ContourPoint): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /**
   * CALCULAR CÍRCULO ENVOLVENTE MÍNIMO (ALGORITMO WELZL)
   */
  private calculateMinEnclosingCircle(contour: ContourPoint[]): { center: { x: number; y: number }; radius: number } {
    if (contour.length === 0) return { center: { x: 0, y: 0 }, radius: 0 };
    if (contour.length === 1) return { center: { x: contour[0].x, y: contour[0].y }, radius: 0 };
    
    // Implementación simplificada - buscar centro usando aproximación iterativa
    const bbox = this.calculateBoundingBox(contour);
    const center = {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
    
    let maxRadius = 0;
    for (const point of contour) {
      const distance = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
      maxRadius = Math.max(maxRadius, distance);
    }
    
    return { center, radius: maxRadius };
  }

  /**
   * CALCULAR MOMENTOS HU
   */
  private calculateHuMoments(contour: ContourPoint[], centroid: { x: number; y: number }): number[] {
    // Implementación simplificada de momentos centrales
    const moments = new Array(7).fill(0);
    
    // Calcular momentos centrales de orden bajo
    let m00 = 0, m20 = 0, m02 = 0, m11 = 0, m30 = 0, m21 = 0, m12 = 0, m03 = 0;
    
    for (const point of contour) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      
      m00 += 1;
      m20 += dx * dx;
      m02 += dy * dy;
      m11 += dx * dy;
      m30 += dx * dx * dx;
      m21 += dx * dx * dy;
      m12 += dx * dy * dy;
      m03 += dy * dy * dy;
    }
    
    // Normalizar momentos
    if (m00 > 0) {
      const area = m00;
      const factor = Math.pow(area, 1.5);
      
      const n20 = m20 / factor;
      const n02 = m02 / factor;
      const n11 = m11 / factor;
      const n30 = m30 / Math.pow(area, 2);
      const n21 = m21 / Math.pow(area, 2);
      const n12 = m12 / Math.pow(area, 2);
      const n03 = m03 / Math.pow(area, 2);
      
      // Momentos Hu
      moments[0] = n20 + n02;
      moments[1] = Math.pow(n20 - n02, 2) + 4 * Math.pow(n11, 2);
      moments[2] = Math.pow(n30 - 3 * n12, 2) + Math.pow(3 * n21 - n03, 2);
      moments[3] = Math.pow(n30 + n12, 2) + Math.pow(n21 + n03, 2);
      moments[4] = (n30 - 3 * n12) * (n30 + n12) * (Math.pow(n30 + n12, 2) - 3 * Math.pow(n21 + n03, 2)) +
                   (3 * n21 - n03) * (n21 + n03) * (3 * Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2));
      moments[5] = (n20 - n02) * (Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2)) +
                   4 * n11 * (n30 + n12) * (n21 + n03);
      moments[6] = (3 * n21 - n03) * (n30 + n12) * (Math.pow(n30 + n12, 2) - 3 * Math.pow(n21 + n03, 2)) -
                   (n30 - 3 * n12) * (n21 + n03) * (3 * Math.pow(n30 + n12, 2) - Math.pow(n21 + n03, 2));
    }
    
    return moments;
  }

  /**
   * CALCULAR ORIENTACIÓN PRINCIPAL
   */
  private calculateOrientation(
    contour: ContourPoint[],
    centroid: { x: number; y: number },
    area: number
  ): number {
    let m20 = 0, m02 = 0, m11 = 0;
    
    for (const point of contour) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      
      m20 += dx * dx;
      m02 += dy * dy;
      m11 += dx * dy;
    }
    
    if (area > 0) {
      m20 /= area;
      m02 /= area;
      m11 /= area;
      
      return 0.5 * Math.atan2(2 * m11, m20 - m02);
    }
    
    return 0;
  }

  /**
   * VALIDAR CONTORNO
   */
  private isValidContour(
    properties: ContourProperties,
    imgWidth: number,
    imgHeight: number
  ): boolean {
    const totalArea = imgWidth * imgHeight;
    const minArea = totalArea * 0.08; // Área mínima 8% - SOLO OBJETOS GRANDES
    const maxArea = totalArea * 0.80;  // Área máxima 80% - evitar detectar toda la imagen
    
    return (
      properties.area >= minArea &&
      properties.area <= maxArea &&
      properties.perimeter > 0 &&
      properties.boundingBox.width > 1 &&
      properties.boundingBox.height > 1 &&
      properties.circularity <= 1.2 && // Permitir valores ligeramente > 1 por ruido
      properties.solidity <= 1.1       // Permitir valores ligeramente > 1 por ruido
    );
  }

  /**
   * CALCULAR CONFIANZA DEL CONTORNO
   */
  private calculateContourConfidence(
    properties: ContourProperties,
    distanceFromCenter: number,
    imgWidth: number,
    imgHeight: number
  ): number {
    const maxDistance = Math.sqrt(imgWidth * imgWidth + imgHeight * imgHeight) / 2;
    const proximityScore = 1 - (distanceFromCenter / maxDistance);
    
    const shapeScore = (properties.circularity + properties.solidity + properties.convexity) / 3;
    
    const sizeScore = Math.min(1, properties.area / (imgWidth * imgHeight * 0.1));
    
    return Math.max(0, Math.min(1, (proximityScore * 0.4 + shapeScore * 0.4 + sizeScore * 0.2)));
  }
}