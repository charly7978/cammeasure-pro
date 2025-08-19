// SISTEMA DE COLA INTELIGENTE PARA PROCESAMIENTO DE FRAMES
// Evita superposición de procesos pesados y optimiza la fluidez

interface QueuedTask {
  id: string;
  priority: 'high' | 'medium' | 'low';
  component: string;
  callback: () => Promise<void>;
  estimatedTime: number;
  maxRetries: number;
  retryCount: number;
  createdAt: number;
}

interface ProcessingStats {
  totalProcessed: number;
  averageTime: number;
  queueLength: number;
  processedPerSecond: number;
  lastProcessTime: number;
}

class IntelligentProcessingQueue {
  private queue: QueuedTask[] = [];
  private isProcessing: boolean = false;
  private rafId: number | null = null;
  private stats: ProcessingStats = {
    totalProcessed: 0,
    averageTime: 0,
    queueLength: 0,
    processedPerSecond: 0,
    lastProcessTime: 0
  };
  
  private readonly MAX_QUEUE_SIZE = 10;
  private readonly MAX_PROCESSING_TIME = 100; // ms
  private lastFrameTime = 0;

  constructor() {
    this.bindMethods();
    this.startProcessingLoop();
  }

  private bindMethods(): void {
    this.enqueue = this.enqueue.bind(this);
    this.processNext = this.processNext.bind(this);
    this.clear = this.clear.bind(this);
  }

  // AGREGAR TAREA A LA COLA CON INTELIGENCIA
  enqueue(
    id: string,
    component: string,
    callback: () => Promise<void>,
    priority: 'high' | 'medium' | 'low' = 'medium',
    estimatedTime: number = 50
  ): boolean {
    // Evitar duplicados de la misma tarea
    const existingIndex = this.queue.findIndex(task => task.id === id);
    if (existingIndex !== -1) {
      // Actualizar tarea existente en lugar de duplicar
      this.queue[existingIndex] = {
        ...this.queue[existingIndex],
        callback,
        priority,
        estimatedTime,
        createdAt: Date.now()
      };
      return true;
    }

    // Control de tamaño de cola
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Remover tareas de baja prioridad más antiguas
      const lowPriorityIndex = this.queue.findIndex(task => task.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.queue.splice(lowPriorityIndex, 1);
      } else {
        // Si no hay tareas de baja prioridad, remover la más antigua
        this.queue.shift();
      }
    }

    const task: QueuedTask = {
      id,
      priority,
      component,
      callback,
      estimatedTime,
      maxRetries: 2,
      retryCount: 0,
      createdAt: Date.now()
    };

    // Insertar según prioridad
    const insertIndex = this.findInsertIndex(task);
    this.queue.splice(insertIndex, 0, task);
    
    this.updateStats();
    return true;
  }

  // ENCONTRAR POSICIÓN DE INSERCIÓN BASADA EN PRIORIDAD
  private findInsertIndex(newTask: QueuedTask): number {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[newTask.priority] > priorityOrder[this.queue[i].priority]) {
        return i;
      }
    }
    
    return this.queue.length;
  }

  // INICIAR LOOP DE PROCESAMIENTO CON requestAnimationFrame
  private startProcessingLoop(): void {
    const processLoop = (currentTime: number) => {
      // Calcular FPS para ajuste dinámico
      if (this.lastFrameTime > 0) {
        const frameTime = currentTime - this.lastFrameTime;
        const fps = 1000 / frameTime;
        
        // Ajustar procesamiento según FPS
        if (fps < 30) {
          // Si FPS es bajo, procesar menos frecuentemente
          if (currentTime - this.stats.lastProcessTime < 100) {
            this.rafId = requestAnimationFrame(processLoop);
            return;
          }
        }
      }
      this.lastFrameTime = currentTime;

      // Procesar siguiente tarea si no está procesando y hay tareas
      if (!this.isProcessing && this.queue.length > 0) {
        this.processNext();
      }

      // Continuar loop
      this.rafId = requestAnimationFrame(processLoop);
    };

    this.rafId = requestAnimationFrame(processLoop);
  }

  // PROCESAR SIGUIENTE TAREA
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift()!;
    const startTime = performance.now();

    try {
      // Timeout para evitar tareas que toman demasiado tiempo
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.MAX_PROCESSING_TIME * 2);
      });

      await Promise.race([task.callback(), timeoutPromise]);

      const processingTime = performance.now() - startTime;
      this.updateProcessingStats(processingTime);

    } catch (error) {
      console.warn(`Task ${task.id} from ${task.component} failed:`, error);
      
      // Reintentar si no se han agotado los reintentos
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        this.queue.unshift(task); // Reinsertar al inicio para reintento
      }
    } finally {
      this.isProcessing = false;
      this.stats.lastProcessTime = performance.now();
    }
  }

  // ACTUALIZAR ESTADÍSTICAS DE PROCESAMIENTO
  private updateProcessingStats(processingTime: number): void {
    this.stats.totalProcessed++;
    this.stats.averageTime = (this.stats.averageTime * (this.stats.totalProcessed - 1) + processingTime) / this.stats.totalProcessed;
    
    // Calcular procesados por segundo
    const now = Date.now();
    if (this.stats.lastProcessTime > 0) {
      const timeDiff = (now - this.stats.lastProcessTime) / 1000;
      this.stats.processedPerSecond = 1 / timeDiff;
    }
  }

  // ACTUALIZAR ESTADÍSTICAS GENERALES
  private updateStats(): void {
    this.stats.queueLength = this.queue.length;
  }

  // LIMPIAR COLA
  clear(): void {
    this.queue = [];
    this.updateStats();
  }

  // PAUSAR PROCESAMIENTO
  pause(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // REANUDAR PROCESAMIENTO
  resume(): void {
    if (!this.rafId) {
      this.startProcessingLoop();
    }
  }

  // OBTENER ESTADÍSTICAS
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  // OBTENER ESTADO DE LA COLA
  getQueueInfo(): { length: number; tasks: string[] } {
    return {
      length: this.queue.length,
      tasks: this.queue.map(task => `${task.component}:${task.id}`)
    };
  }

  // VERIFICAR SI ESTÁ OCUPADO
  isBusy(): boolean {
    return this.isProcessing || this.queue.length > 5;
  }

  // DESTRUCTOR
  destroy(): void {
    this.pause();
    this.clear();
  }
}

// INSTANCIA SINGLETON
export const intelligentQueue = new IntelligentProcessingQueue();

// HOOK PARA USAR LA COLA INTELIGENTE
export const useIntelligentQueue = () => {
  return {
    enqueue: intelligentQueue.enqueue,
    clear: intelligentQueue.clear,
    pause: intelligentQueue.pause,
    resume: intelligentQueue.resume,
    getStats: intelligentQueue.getStats,
    getQueueInfo: intelligentQueue.getQueueInfo,
    isBusy: intelligentQueue.isBusy
  };
};