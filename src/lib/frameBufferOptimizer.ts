// OPTIMIZADOR DE BUFFER DE FRAMES PARA MEJOR RENDIMIENTO
// Gestión inteligente de memoria y buffer de frames

interface FrameBuffer {
  imageData: ImageData;
  timestamp: number;
  quality: number;
  processed: boolean;
}

interface BufferStats {
  totalFrames: number;
  processedFrames: number;
  averageQuality: number;
  memoryUsage: number;
  dropRate: number;
}

class FrameBufferOptimizer {
  private buffer: FrameBuffer[] = [];
  private readonly MAX_BUFFER_SIZE = 10;
  private readonly MIN_QUALITY_THRESHOLD = 0.3;
  private stats: BufferStats = {
    totalFrames: 0,
    processedFrames: 0,
    averageQuality: 0,
    memoryUsage: 0,
    dropRate: 0
  };
  private droppedFrames = 0;

  constructor() {
    this.bindMethods();
  }

  private bindMethods(): void {
    this.addFrame = this.addFrame.bind(this);
    this.getOptimalFrame = this.getOptimalFrame.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  // AGREGAR FRAME CON ANÁLISIS DE CALIDAD
  addFrame(imageData: ImageData): boolean {
    const quality = this.calculateFrameQuality(imageData);
    
    // Descartar frames de muy baja calidad
    if (quality < this.MIN_QUALITY_THRESHOLD) {
      this.droppedFrames++;
      this.updateStats();
      return false;
    }

    const frame: FrameBuffer = {
      imageData: this.cloneImageData(imageData),
      timestamp: performance.now(),
      quality,
      processed: false
    };

    // Gestión inteligente del buffer
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      // Remover frame de menor calidad o más antiguo
      const worstFrameIndex = this.findWorstFrame();
      this.buffer.splice(worstFrameIndex, 1);
    }

    // Insertar nuevo frame en orden de calidad
    const insertIndex = this.findInsertPosition(frame);
    this.buffer.splice(insertIndex, 0, frame);

    this.stats.totalFrames++;
    this.updateStats();
    return true;
  }

  // OBTENER FRAME ÓPTIMO PARA PROCESAMIENTO
  getOptimalFrame(): ImageData | null {
    if (this.buffer.length === 0) return null;

    // Buscar frame de mejor calidad no procesado
    const optimalFrame = this.buffer.find(frame => !frame.processed && frame.quality > 0.5) ||
                        this.buffer.find(frame => !frame.processed) ||
                        this.buffer[0];

    if (optimalFrame) {
      optimalFrame.processed = true;
      this.stats.processedFrames++;
      this.updateStats();
      return optimalFrame.imageData;
    }

    return null;
  }

  // CALCULAR CALIDAD DEL FRAME
  private calculateFrameQuality(imageData: ImageData): number {
    const { data, width, height } = imageData;
    let sharpness = 0;
    let contrast = 0;
    let brightness = 0;
    let totalPixels = 0;

    // Análisis rápido de calidad
    for (let y = 1; y < height - 1; y += 4) { // Saltar píxeles para velocidad
      for (let x = 1; x < width - 1; x += 4) {
        const idx = (y * width + x) * 4;
        const current = data[idx];
        
        // Calcular nitidez (gradiente)
        const right = data[idx + 4] || current;
        const bottom = data[((y + 1) * width + x) * 4] || current;
        sharpness += Math.abs(current - right) + Math.abs(current - bottom);
        
        // Calcular brillo
        brightness += current;
        totalPixels++;
      }
    }

    // Calcular contraste
    let minVal = 255, maxVal = 0;
    for (let i = 0; i < data.length; i += 16) { // Muestreo cada 4 píxeles
      const val = data[i];
      minVal = Math.min(minVal, val);
      maxVal = Math.max(maxVal, val);
    }
    contrast = (maxVal - minVal) / 255;

    // Normalizar métricas
    sharpness = Math.min(1, sharpness / (totalPixels * 128));
    brightness = Math.abs((brightness / totalPixels) - 128) / 128; // Penalizar extremos
    brightness = 1 - brightness; // Invertir para que valores medios sean mejores

    // Combinar métricas (sharpness es más importante)
    const quality = (sharpness * 0.5) + (contrast * 0.3) + (brightness * 0.2);
    return Math.max(0, Math.min(1, quality));
  }

  // ENCONTRAR PEOR FRAME PARA REMOCIÓN
  private findWorstFrame(): number {
    let worstIndex = 0;
    let worstScore = Infinity;

    for (let i = 0; i < this.buffer.length; i++) {
      const frame = this.buffer[i];
      const age = performance.now() - frame.timestamp;
      // Score: calidad baja + edad alta = peor score
      const score = frame.quality - (age / 10000); // Penalizar por edad
      
      if (score < worstScore) {
        worstScore = score;
        worstIndex = i;
      }
    }

    return worstIndex;
  }

  // ENCONTRAR POSICIÓN DE INSERCIÓN BASADA EN CALIDAD
  private findInsertPosition(newFrame: FrameBuffer): number {
    for (let i = 0; i < this.buffer.length; i++) {
      if (newFrame.quality > this.buffer[i].quality) {
        return i;
      }
    }
    return this.buffer.length;
  }

  // CLONAR IMAGEDATA EFICIENTEMENTE
  private cloneImageData(imageData: ImageData): ImageData {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d')!;
    const clonedImageData = ctx.createImageData(imageData.width, imageData.height);
    clonedImageData.data.set(imageData.data);
    return clonedImageData;
  }

  // LIMPIEZA INTELIGENTE
  cleanup(): void {
    const now = performance.now();
    const MAX_AGE = 5000; // 5 segundos

    // Remover frames muy antiguos
    this.buffer = this.buffer.filter(frame => {
      const age = now - frame.timestamp;
      return age < MAX_AGE;
    });

    // Remover frames procesados de baja calidad
    this.buffer = this.buffer.filter(frame => {
      return !frame.processed || frame.quality > 0.6;
    });

    this.updateStats();
  }

  // ACTUALIZAR ESTADÍSTICAS
  private updateStats(): void {
    if (this.buffer.length > 0) {
      this.stats.averageQuality = this.buffer.reduce((sum, frame) => sum + frame.quality, 0) / this.buffer.length;
    }

    this.stats.memoryUsage = this.buffer.reduce((sum, frame) => {
      return sum + (frame.imageData.data.length * 4); // 4 bytes por píxel RGBA
    }, 0);

    this.stats.dropRate = this.stats.totalFrames > 0 ? this.droppedFrames / this.stats.totalFrames : 0;
  }

  // LIMPIAR COMPLETAMENTE
  clear(): void {
    this.buffer = [];
    this.stats = {
      totalFrames: 0,
      processedFrames: 0,
      averageQuality: 0,
      memoryUsage: 0,
      dropRate: 0
    };
    this.droppedFrames = 0;
  }

  // OBTENER ESTADÍSTICAS
  getStats(): BufferStats {
    return { ...this.stats };
  }

  // OBTENER INFORMACIÓN DEL BUFFER
  getBufferInfo(): { size: number; averageQuality: number; oldestFrame: number } {
    if (this.buffer.length === 0) {
      return { size: 0, averageQuality: 0, oldestFrame: 0 };
    }

    const now = performance.now();
    const oldestFrame = Math.max(...this.buffer.map(frame => now - frame.timestamp));

    return {
      size: this.buffer.length,
      averageQuality: this.stats.averageQuality,
      oldestFrame
    };
  }

  // VERIFICAR SI HAY FRAMES DISPONIBLES
  hasAvailableFrames(): boolean {
    return this.buffer.some(frame => !frame.processed);
  }
}

// INSTANCIA SINGLETON
export const frameBufferOptimizer = new FrameBufferOptimizer();

// HOOK PARA USAR EL OPTIMIZADOR
export const useFrameBufferOptimizer = () => {
  return {
    addFrame: frameBufferOptimizer.addFrame,
    getOptimalFrame: frameBufferOptimizer.getOptimalFrame,
    cleanup: frameBufferOptimizer.cleanup,
    clear: frameBufferOptimizer.clear,
    getStats: frameBufferOptimizer.getStats,
    getBufferInfo: frameBufferOptimizer.getBufferInfo,
    hasAvailableFrames: frameBufferOptimizer.hasAvailableFrames
  };
};