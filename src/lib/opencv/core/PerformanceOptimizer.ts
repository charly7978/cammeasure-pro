/**
 * OPTIMIZADOR DE RENDIMIENTO ADAPTATIVO
 * Sistema inteligente que ajusta la calidad del procesamiento según las capacidades del dispositivo
 */

export interface PerformanceMetrics {
  fps: number;
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  deviceScore: number;
}

export interface OptimizationSettings {
  targetFPS: number;
  maxProcessingTime: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  enableGPU: boolean;
  adaptiveMode: boolean;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private metrics: PerformanceMetrics;
  private settings: OptimizationSettings;
  private frameHistory: number[] = [];
  private processingHistory: number[] = [];
  private deviceCapabilities: any;

  private constructor() {
    this.metrics = {
      fps: 0,
      processingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      deviceScore: 0
    };

    this.settings = {
      targetFPS: 30,
      maxProcessingTime: 100, // 100ms para 10 FPS
      quality: 'high',
      enableGPU: false,
      adaptiveMode: true
    };

    this.detectDeviceCapabilities();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * DETECTAR CAPACIDADES DEL DISPOSITIVO
   */
  private detectDeviceCapabilities(): void {
    this.deviceCapabilities = {
      cores: navigator.hardwareConcurrency || 4,
      memory: (navigator as any).deviceMemory || 4,
      gpu: this.detectGPUCapabilities(),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };

    // Calcular score del dispositivo
    this.calculateDeviceScore();

    console.log('📱 Capacidades del dispositivo:', this.deviceCapabilities);
  }

  /**
   * DETECTAR CAPACIDADES GPU
   */
  private detectGPUCapabilities(): any {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          available: true,
          vendor: gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
          renderer: gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
        };
      }
    } catch (e) {
      console.warn('No se pudo detectar GPU:', e);
    }
    
    return { available: false };
  }

  /**
   * CALCULAR SCORE DEL DISPOSITIVO
   */
  private calculateDeviceScore(): void {
    let score = 50; // Base

    // Ajustar por cores
    score += (this.deviceCapabilities.cores - 4) * 5;

    // Ajustar por memoria
    score += (this.deviceCapabilities.memory - 4) * 10;

    // Ajustar por GPU
    if (this.deviceCapabilities.gpu.available) {
      score += 20;
    }

    // Penalizar móviles
    if (this.deviceCapabilities.isMobile) {
      score -= 30;
    }

    this.metrics.deviceScore = Math.max(0, Math.min(100, score));

    // Ajustar calidad automáticamente basado en score
    if (this.settings.adaptiveMode) {
      if (score >= 80) {
        this.settings.quality = 'ultra';
      } else if (score >= 60) {
        this.settings.quality = 'high';
      } else if (score >= 40) {
        this.settings.quality = 'medium';
      } else {
        this.settings.quality = 'low';
      }
    }

    console.log(`🎯 Score del dispositivo: ${this.metrics.deviceScore} - Calidad: ${this.settings.quality}`);
  }

  /**
   * ACTUALIZAR MÉTRICAS DE RENDIMIENTO
   */
  public updateMetrics(processingTime: number): void {
    // Actualizar historial
    this.processingHistory.push(processingTime);
    if (this.processingHistory.length > 30) {
      this.processingHistory.shift();
    }

    const now = performance.now();
    this.frameHistory.push(now);
    
    // Mantener solo últimos 60 frames
    while (this.frameHistory.length > 60) {
      this.frameHistory.shift();
    }

    // Calcular FPS
    if (this.frameHistory.length > 1) {
      const timeSpan = now - this.frameHistory[0];
      this.metrics.fps = (this.frameHistory.length - 1) / (timeSpan / 1000);
    }

    // Calcular tiempo de procesamiento promedio
    this.metrics.processingTime = this.processingHistory.reduce((a, b) => a + b, 0) / this.processingHistory.length;

    // Adaptar calidad si es necesario
    if (this.settings.adaptiveMode) {
      this.adaptQuality();
    }
  }

  /**
   * ADAPTAR CALIDAD AUTOMÁTICAMENTE
   */
  private adaptQuality(): void {
    const targetProcessingTime = 1000 / this.settings.targetFPS;

    if (this.metrics.processingTime > targetProcessingTime * 1.2) {
      // Reducir calidad si es muy lento
      this.decreaseQuality();
    } else if (this.metrics.processingTime < targetProcessingTime * 0.5 && this.metrics.fps > this.settings.targetFPS) {
      // Aumentar calidad si hay margen
      this.increaseQuality();
    }
  }

  /**
   * DISMINUIR CALIDAD
   */
  private decreaseQuality(): void {
    const qualities = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualities.indexOf(this.settings.quality);
    
    if (currentIndex > 0) {
      this.settings.quality = qualities[currentIndex - 1] as any;
      console.log(`⬇️ Reduciendo calidad a: ${this.settings.quality}`);
    }
  }

  /**
   * AUMENTAR CALIDAD
   */
  private increaseQuality(): void {
    const qualities = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualities.indexOf(this.settings.quality);
    
    if (currentIndex < qualities.length - 1) {
      this.settings.quality = qualities[currentIndex + 1] as any;
      console.log(`⬆️ Aumentando calidad a: ${this.settings.quality}`);
    }
  }

  /**
   * OBTENER PARÁMETROS OPTIMIZADOS PARA PROCESAMIENTO
   */
  public getOptimizedParameters(): any {
    const baseParams = {
      low: {
        scaleFactor: 0.5,
        cannyLowThreshold: 30,
        cannyHighThreshold: 100,
        blurSize: 3,
        minContourArea: 100,
        maxContours: 3,
        skipFrames: 3
      },
      medium: {
        scaleFactor: 0.75,
        cannyLowThreshold: 20,
        cannyHighThreshold: 80,
        blurSize: 5,
        minContourArea: 50,
        maxContours: 5,
        skipFrames: 2
      },
      high: {
        scaleFactor: 1.0,
        cannyLowThreshold: 10,
        cannyHighThreshold: 60,
        blurSize: 5,
        minContourArea: 30,
        maxContours: 8,
        skipFrames: 1
      },
      ultra: {
        scaleFactor: 1.0,
        cannyLowThreshold: 5,
        cannyHighThreshold: 50,
        blurSize: 7,
        minContourArea: 20,
        maxContours: 10,
        skipFrames: 0
      }
    };

    return baseParams[this.settings.quality];
  }

  /**
   * OPTIMIZAR IMAGEN ANTES DE PROCESAMIENTO
   */
  public optimizeImageData(imageData: ImageData): ImageData {
    const params = this.getOptimizedParameters();
    
    if (params.scaleFactor === 1.0) {
      return imageData;
    }

    // Escalar imagen para mejor rendimiento
    const scaledWidth = Math.round(imageData.width * params.scaleFactor);
    const scaledHeight = Math.round(imageData.height * params.scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    const ctx = canvas.getContext('2d')!;
    
    // Crear imagen temporal
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Escalar con suavizado
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight);

    return ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  }

  /**
   * DEBE PROCESAR FRAME
   */
  public shouldProcessFrame(frameNumber: number): boolean {
    const params = this.getOptimizedParameters();
    return frameNumber % (params.skipFrames + 1) === 0;
  }

  /**
   * OBTENER MÉTRICAS ACTUALES
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * OBTENER CONFIGURACIÓN ACTUAL
   */
  public getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * ACTUALIZAR CONFIGURACIÓN
   */
  public updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * OBTENER REPORTE DE RENDIMIENTO
   */
  public getPerformanceReport(): string {
    return `
📊 REPORTE DE RENDIMIENTO
========================
FPS: ${this.metrics.fps.toFixed(1)}
Tiempo de procesamiento: ${this.metrics.processingTime.toFixed(1)}ms
Calidad: ${this.settings.quality}
Score del dispositivo: ${this.metrics.deviceScore}
Cores: ${this.deviceCapabilities.cores}
Memoria: ${this.deviceCapabilities.memory}GB
GPU: ${this.deviceCapabilities.gpu.available ? 'Sí' : 'No'}
Móvil: ${this.deviceCapabilities.isMobile ? 'Sí' : 'No'}
    `.trim();
  }
}