// OPTIMIZADOR INTELIGENTE DE RENDIMIENTO - PREVENCIÓN DE CONGELAMIENTO
// Sistema avanzado de gestión de recursos y throttling adaptivo

interface PerformanceMetrics {
  framerate: number;
  memoryUsage: number;
  processingTime: number;
  cpuUsage: number;
  isOverloaded: boolean;
}

interface ProcessingTask {
  id: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number;
  component: string;
  processor: () => Promise<any>;
}

class PerformanceOptimizer {
  private metrics: PerformanceMetrics = {
    framerate: 0,
    memoryUsage: 0,
    processingTime: 0,
    cpuUsage: 0,
    isOverloaded: false
  };
  
  private taskQueue: ProcessingTask[] = [];
  private isProcessing = false;
  private lastFrameTime = 0;
  private frameTimeHistory: number[] = [];
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  
  // Thresholds adaptativos
  private readonly MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly FRAMERATE_THRESHOLD = 15; // FPS mínimo
  private readonly PROCESSING_TIME_THRESHOLD = 100; // ms máximo
  
  constructor() {
    this.startPerformanceMonitoring();
  }

  // MONITOREO INTELIGENTE DE RENDIMIENTO
  private startPerformanceMonitoring(): void {
    // Monitor de memoria cada 2 segundos
    this.memoryCheckInterval = setInterval(() => {
      this.updateMemoryMetrics();
      this.checkSystemHealth();
    }, 2000);
  }

  // ACTUALIZAR MÉTRICAS DE MEMORIA
  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
    }
  }

  // VERIFICAR SALUD DEL SISTEMA
  private checkSystemHealth(): void {
    const isOverloaded = 
      this.metrics.memoryUsage > this.MEMORY_THRESHOLD ||
      this.metrics.framerate < this.FRAMERATE_THRESHOLD ||
      this.metrics.processingTime > this.PROCESSING_TIME_THRESHOLD;

    if (isOverloaded !== this.metrics.isOverloaded) {
      this.metrics.isOverloaded = isOverloaded;
      
      if (isOverloaded) {
        console.warn('⚠️ Sistema sobrecargado, aplicando optimizaciones automáticas');
        this.applyEmergencyOptimizations();
      } else {
        console.log('✅ Sistema normalizado, restaurando procesamiento normal');
      }
    }
  }

  // APLICAR OPTIMIZACIONES DE EMERGENCIA
  private applyEmergencyOptimizations(): void {
    // Limpiar cola de tareas no prioritarias
    this.taskQueue = this.taskQueue.filter(task => task.priority === 'high');
    
    // Forzar garbage collection
    this.forceGarbageCollection();
    
    // Reducir calidad de procesamiento temporalmente
    this.reduceProcessingQuality();
  }

  // FORZAR GARBAGE COLLECTION
  private forceGarbageCollection(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
    
    // Disparar garbage collection indirecta
    const temp = new Array(1000).fill(null);
    temp.length = 0;
  }

  // REDUCIR CALIDAD DE PROCESAMIENTO
  private reduceProcessingQuality(): void {
    // Enviar evento para reducir calidad
    window.dispatchEvent(new CustomEvent('performance:reduce-quality', { 
      detail: { level: 'emergency' }
    }));
  }

  // AÑADIR TAREA A LA COLA INTELIGENTE
  addTask(task: ProcessingTask): void {
    // Si el sistema está sobrecargado, solo procesar tareas de alta prioridad
    if (this.metrics.isOverloaded && task.priority !== 'high') {
      console.log(`⏸️ Saltando tarea ${task.id} (prioridad: ${task.priority}) - sistema sobrecargado`);
      return;
    }

    // Insertar tarea ordenada por prioridad
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const insertIndex = this.taskQueue.findIndex(
      t => priorityOrder[t.priority] < priorityOrder[task.priority]
    );
    
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    // Procesar inmediatamente si no hay procesamiento activo
    if (!this.isProcessing) {
      this.processNextTask();
    }
  }

  // PROCESAR SIGUIENTE TAREA
  private async processNextTask(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) return;

    this.isProcessing = true;
    const task = this.taskQueue.shift()!;
    
    try {
      const startTime = performance.now();
      
      // Verificar si el sistema puede manejar la tarea
      if (this.canProcessTask(task)) {
        await task.processor();
      } else {
        console.log(`⏸️ Postergando tarea ${task.id} - sistema no puede procesarla`);
        // Requeue with lower priority
        this.taskQueue.push({ ...task, priority: 'low' });
      }
      
      const processingTime = performance.now() - startTime;
      this.updateProcessingMetrics(processingTime);
      
    } catch (error) {
      console.error(`❌ Error procesando tarea ${task.id}:`, error);
    } finally {
      this.isProcessing = false;
      
      // Procesar siguiente tarea después de un delay adaptivo
      const delay = this.calculateAdaptiveDelay();
      setTimeout(() => this.processNextTask(), delay);
    }
  }

  // VERIFICAR SI PUEDE PROCESAR TAREA
  private canProcessTask(task: ProcessingTask): boolean {
    // Si es alta prioridad, siempre procesar
    if (task.priority === 'high') return true;
    
    // Verificar si el sistema tiene recursos disponibles
    const hasMemory = this.metrics.memoryUsage < this.MEMORY_THRESHOLD * 0.8;
    const hasTime = this.metrics.processingTime < this.PROCESSING_TIME_THRESHOLD * 0.8;
    const hasFramerate = this.metrics.framerate > this.FRAMERATE_THRESHOLD * 1.2;
    
    return hasMemory && hasTime && hasFramerate;
  }

  // CALCULAR DELAY ADAPTIVO
  private calculateAdaptiveDelay(): number {
    if (this.metrics.isOverloaded) return 500; // Delay largo si sobrecargado
    if (this.metrics.processingTime > 50) return 200; // Delay medio si lento
    return 50; // Delay mínimo si todo va bien
  }

  // ACTUALIZAR MÉTRICAS DE PROCESAMIENTO
  private updateProcessingMetrics(processingTime: number): void {
    this.metrics.processingTime = processingTime;
    
    // Actualizar framerate
    const currentTime = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      this.frameTimeHistory.push(frameTime);
      
      // Mantener solo los últimos 10 frames
      if (this.frameTimeHistory.length > 10) {
        this.frameTimeHistory.shift();
      }
      
      // Calcular framerate promedio
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length;
      this.metrics.framerate = 1000 / avgFrameTime;
    }
    this.lastFrameTime = currentTime;
  }

  // THROTTLE INTELIGENTE PARA FUNCIONES
  createIntelligentThrottle<T extends (...args: any[]) => any>(
    func: T,
    component: string
  ): (...args: Parameters<T>) => void {
    let lastExecution = 0;
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      const now = performance.now();
      const baseDelay = this.getComponentThrottleDelay(component);
      const adaptiveDelay = this.calculateAdaptiveDelay();
      const finalDelay = Math.max(baseDelay, adaptiveDelay);
      
      clearTimeout(timeoutId);
      
      if (now - lastExecution >= finalDelay) {
        lastExecution = now;
        func(...args);
      } else {
        timeoutId = setTimeout(() => {
          lastExecution = performance.now();
          func(...args);
        }, finalDelay - (now - lastExecution));
      }
    };
  }

  // OBTENER DELAY DE THROTTLE POR COMPONENTE
  private getComponentThrottleDelay(component: string): number {
    const delays = {
      'RealTimeMeasurement': 300,
      'Real3DMeasurement': 800,
      'MeasurementEngine': 500,
      'CameraStream': 100
    };
    
    return delays[component as keyof typeof delays] || 200;
  }

  // CREAR DEBOUNCE INTELIGENTE
  createIntelligentDebounce<T extends (...args: any[]) => any>(
    func: T,
    component: string
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    const baseDelay = this.getComponentThrottleDelay(component);
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      const adaptiveDelay = Math.max(baseDelay, this.calculateAdaptiveDelay());
      
      timeoutId = setTimeout(() => {
        if (!this.metrics.isOverloaded || component === 'CameraStream') {
          func(...args);
        }
      }, adaptiveDelay);
    };
  }

  // OPTIMIZAR IMAGEN ANTES DE PROCESAMIENTO
  optimizeImageData(imageData: ImageData, quality: 'high' | 'medium' | 'low' = 'medium'): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    let scaleFactor = 1;
    switch (quality) {
      case 'low':
        scaleFactor = 0.5;
        break;
      case 'medium':
        scaleFactor = this.metrics.isOverloaded ? 0.7 : 1;
        break;
      case 'high':
        scaleFactor = 1;
        break;
    }
    
    canvas.width = imageData.width * scaleFactor;
    canvas.height = imageData.height * scaleFactor;
    
    // Crear ImageData temporal
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Escalar imagen
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // OBTENER MÉTRICAS ACTUALES
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // OBTENER ESTADO DE LA COLA
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    nextTaskPriority: string | null;
  } {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.isProcessing,
      nextTaskPriority: this.taskQueue[0]?.priority || null
    };
  }

  // LIMPIAR RECURSOS
  cleanup(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    this.taskQueue = [];
    this.isProcessing = false;
  }
}

// INSTANCIA SINGLETON
export const performanceOptimizer = new PerformanceOptimizer();

// HOOK PARA USAR EL OPTIMIZADOR
export const usePerformanceOptimizer = () => {
  return {
    addTask: performanceOptimizer.addTask.bind(performanceOptimizer),
    createIntelligentThrottle: performanceOptimizer.createIntelligentThrottle.bind(performanceOptimizer),
    createIntelligentDebounce: performanceOptimizer.createIntelligentDebounce.bind(performanceOptimizer),
    optimizeImageData: performanceOptimizer.optimizeImageData.bind(performanceOptimizer),
    getMetrics: performanceOptimizer.getMetrics.bind(performanceOptimizer),
    getQueueStatus: performanceOptimizer.getQueueStatus.bind(performanceOptimizer)
  };
};