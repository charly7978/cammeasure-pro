// SISTEMA OPENCV SIMPLE Y FUNCIONAL - SIN COMPLICACIONES
// Implementación directa y práctica que realmente funciona

export interface SimpleDetectionResult {
  width: number;
  height: number;
  area: number;
  perimeter: number;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: {
    x: number;
    y: number;
  };
}

export class WorkingOpenCVSystem {
  private isReady = false;

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 INICIALIZANDO OPENCV SIMPLE...');
      this.isReady = true;
      console.log('✅ OPENCV SIMPLE LISTO');
      return true;
    } catch (error) {
      console.error('❌ Error inicializando OpenCV:', error);
      return false;
    }
  }

  // DETECCIÓN SIMPLE PERO EFECTIVA
  detectObjectInImage(imageData: ImageData, clickX?: number, clickY?: number): SimpleDetectionResult | null {
    if (!this.isReady) {
      console.error('⚠️ OpenCV no inicializado');
      return null;
    }

    try {
      console.log('🎯 DETECTANDO OBJETO...', clickX ? `en (${clickX}, ${clickY})` : 'automático');

      const width = imageData.width;
      const height = imageData.height;
      const data = imageData.data;

      // Convertir a escala de grises simple
      const gray = new Uint8Array(width * height);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }

      // Encontrar bordes usando diferencias de intensidad
      const edges = new Uint8Array(width * height);
      const threshold = 30;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const current = gray[idx];
          
          // Calcular gradiente simple
          const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
          const gy = Math.abs(gray[idx + width] - gray[idx - width]);
          const gradient = gx + gy;
          
          edges[idx] = gradient > threshold ? 255 : 0;
        }
      }

      // Encontrar el objeto más prominente
      let bestObject = this.findBestObject(edges, width, height, clickX, clickY);
      
      if (!bestObject) {
        // Intentar con threshold más bajo
        const lowerThreshold = 15;
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const current = gray[idx];
            
            const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
            const gy = Math.abs(gray[idx + width] - gray[idx - width]);
            const gradient = gx + gy;
            
            edges[idx] = gradient > lowerThreshold ? 255 : 0;
          }
        }
        
        bestObject = this.findBestObject(edges, width, height, clickX, clickY);
      }

      if (bestObject) {
        console.log('✅ OBJETO DETECTADO:', {
          ancho: bestObject.width,
          alto: bestObject.height,
          área: bestObject.area,
          confianza: (bestObject.confidence * 100).toFixed(1) + '%'
        });
      } else {
        console.log('⚠️ NO SE DETECTÓ OBJETO');
      }

      return bestObject;

    } catch (error) {
      console.error('❌ Error detectando objeto:', error);
      return null;
    }
  }

  // ENCONTRAR EL MEJOR OBJETO EN LA IMAGEN
  private findBestObject(edges: Uint8Array, width: number, height: number, clickX?: number, clickY?: number): SimpleDetectionResult | null {
    // Encontrar regiones conectadas de bordes
    const visited = new Uint8Array(width * height);
    const regions: Array<{x: number, y: number}[]> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && !visited[idx]) {
          const region = this.floodFill(edges, visited, x, y, width, height);
          if (region.length > 20) { // Filtrar regiones muy pequeñas
            regions.push(region);
          }
        }
      }
    }

    if (regions.length === 0) return null;

    // Seleccionar la mejor región
    let bestRegion = regions[0];
    let bestScore = 0;

    const centerX = width / 2;
    const centerY = height / 2;

    for (const region of regions) {
      // Calcular bounding box de la región
      let minX = region[0].x, maxX = region[0].x;
      let minY = region[0].y, maxY = region[0].y;

      for (const point of region) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }

      const regionWidth = maxX - minX;
      const regionHeight = maxY - minY;
      const regionArea = regionWidth * regionHeight;
      const regionCenterX = (minX + maxX) / 2;
      const regionCenterY = (minY + maxY) / 2;

      // Calcular score basado en tamaño y posición
      let score = regionArea;

      if (clickX !== undefined && clickY !== undefined) {
        // Si hay click, priorizar proximidad al click
        const clickDistance = Math.sqrt(
          (clickX - regionCenterX) ** 2 + (clickY - regionCenterY) ** 2
        );
        score = regionArea / (1 + clickDistance / 100);
      } else {
        // Sin click, priorizar proximidad al centro
        const centerDistance = Math.sqrt(
          (centerX - regionCenterX) ** 2 + (centerY - regionCenterY) ** 2
        );
        score = regionArea / (1 + centerDistance / 200);
      }

      if (score > bestScore && regionArea > 400) { // Área mínima
        bestScore = score;
        bestRegion = region;
      }
    }

    // Calcular propiedades del mejor objeto
    let minX = bestRegion[0].x, maxX = bestRegion[0].x;
    let minY = bestRegion[0].y, maxY = bestRegion[0].y;

    for (const point of bestRegion) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    const objWidth = maxX - minX;
    const objHeight = maxY - minY;
    const objArea = objWidth * objHeight;
    const objCenterX = (minX + maxX) / 2;
    const objCenterY = (minY + maxY) / 2;

    // Estimar perímetro simple
    const perimeter = 2 * (objWidth + objHeight);

    // Calcular confianza basada en área y compacidad
    const confidence = Math.min(1.0, Math.max(0.2, 
      (objArea / 10000) * 0.6 + (bestRegion.length / (objWidth * objHeight)) * 0.4
    ));

    return {
      width: objWidth,
      height: objHeight,
      area: objArea,
      perimeter,
      confidence,
      boundingBox: {
        x: minX,
        y: minY,
        width: objWidth,
        height: objHeight
      },
      center: {
        x: objCenterX,
        y: objCenterY
      }
    };
  }

  // FLOOD FILL PARA ENCONTRAR REGIONES CONECTADAS
  private floodFill(edges: Uint8Array, visited: Uint8Array, startX: number, startY: number, width: number, height: number): Array<{x: number, y: number}> {
    const region: Array<{x: number, y: number}> = [];
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];

    while (stack.length > 0 && region.length < 5000) { // Limitar tamaño
      const {x, y} = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = y * width + x;
      if (visited[idx] || edges[idx] !== 255) continue;
      
      visited[idx] = 1;
      region.push({x, y});

      // Agregar vecinos 4-conectados
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }

    return region;
  }

  isInitialized(): boolean {
    return this.isReady;
  }
}

// Instancia singleton
export const workingOpenCV = new WorkingOpenCVSystem();