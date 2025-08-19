// SCHEDULER UNIFICADO PARA OPTIMIZACIÓN DE RENDIMIENTO
// Elimina múltiples setInterval y coordina todos los procesos de medición

interface ScheduledTask {
  id: string;
  component: string;
  callback: () => Promise<void> | void;
  frequency: number; // ms
  lastRun: number;
  isRunning: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface SchedulerStats {
  totalTasks: number;
  activeTasks: number;
  averageProcessingTime: number;
  lastCleanup: number;
  memoryUsage: number;
}

class OptimizedMeasurementScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private stats: SchedulerStats = {
    totalTasks: 0,
    activeTasks: 0,
    averageProcessingTime: 0,
    lastCleanup: 0,
    memoryUsage: 0
  };
  private readonly UNIFIED_FREQUENCY = 150; // 6.7 FPS optimizado
  private readonly CLEANUP_INTERVAL = 5000; // 5 segundos

  constructor() {
    this.bindMethods();
  }

  private bindMethods(): void {
    this.scheduleTask = this.scheduleTask.bind(this);
    this.removeTask = this.removeTask.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
  }

  // PROGRAMAR TAREA OPTIMIZADA
  scheduleTask(
    id: string, 
    component: string, 
    callback: () => Promise<void> | void, 
    frequency: number = this.UNIFIED_FREQUENCY,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    const task: ScheduledTask = {
      id,
      component,
      callback,
      frequency: Math.max(frequency, this.UNIFIED_FREQUENCY), // Mínimo optimizado
      lastRun: 0,
      isRunning: false,
      priority
    };

    this.tasks.set(id, task);
    this.stats.totalTasks = this.tasks.size;

    console.log(`📅 Tarea programada: ${id} (${component}) - ${frequency}ms`);
  }

  // REMOVER TAREA
  removeTask(id: string): void {
    if (this.tasks.has(id)) {
      this.tasks.delete(id);
      this.stats.totalTasks = this.tasks.size;
      console.log(`🗑️ Tarea removida: ${id}`);
    }
  }

  // INICIAR SCHEDULER UNIFICADO
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.runScheduledTasks();
      this.performPeriodicCleanup();
    }, this.UNIFIED_FREQUENCY);

    console.log('🚀 Scheduler optimizado iniciado');
  }

  // DETENER SCHEDULER
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('⏹️ Scheduler optimizado detenido');
  }

  // EJECUTAR TAREAS PROGRAMADAS
  private async runScheduledTasks(): Promise<void> {
    const currentTime = Date.now();
    let activeTasks = 0;
    const processingTimes: number[] = [];

    // Ordenar tareas por prioridad
    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const task of sortedTasks) {
      // Verificar si es tiempo de ejecutar la tarea
      if (currentTime - task.lastRun >= task.frequency && !task.isRunning) {
        activeTasks++;
        const startTime = performance.now();

        try {
          task.isRunning = true;
          await task.callback();
          task.lastRun = currentTime;

          const processingTime = performance.now() - startTime;
          processingTimes.push(processingTime);

        } catch (error) {
          console.error(`❌ Error ejecutando tarea ${task.id}:`, error);
        } finally {
          task.isRunning = false;
        }
      }
    }

    // Actualizar estadísticas
    this.stats.activeTasks = activeTasks;
    if (processingTimes.length > 0) {
      this.stats.averageProcessingTime = 
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
    }
  }

  // LIMPIEZA PERIÓDICA DE MEMORIA
  private performPeriodicCleanup(): void {
    const currentTime = Date.now();
    
    if (currentTime - this.stats.lastCleanup >= this.CLEANUP_INTERVAL) {
      // Forzar garbage collection si está disponible
      if (typeof window !== 'undefined' && 'gc' in window) {
        (window as any).gc();
      }

      // Limpiar tareas inactivas
      this.cleanupInactiveTasks();

      this.stats.lastCleanup = currentTime;
      this.stats.memoryUsage = this.getMemoryUsage();
    }
  }

  // LIMPIAR TAREAS INACTIVAS
  private cleanupInactiveTasks(): void {
    const currentTime = Date.now();
    const INACTIVE_THRESHOLD = 30000; // 30 segundos

    for (const [id, task] of this.tasks.entries()) {
      if (currentTime - task.lastRun > INACTIVE_THRESHOLD && !task.isRunning) {
        this.removeTask(id);
      }
    }
  }

  // OBTENER USO DE MEMORIA
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      return (window.performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  // OBTENER ESTADÍSTICAS
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  // PAUSAR TAREA ESPECÍFICA
  pauseTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.isRunning = true; // Prevenir ejecución
      console.log(`⏸️ Tarea pausada: ${id}`);
    }
  }

  // REANUDAR TAREA ESPECÍFICA
  resumeTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.isRunning = false; // Permitir ejecución
      console.log(`▶️ Tarea reanudada: ${id}`);
    }
  }

  // OBTENER INFORMACIÓN DE TAREAS ACTIVAS
  getActiveTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(task => !task.isRunning);
  }
}

// INSTANCIA SINGLETON DEL SCHEDULER
export const optimizedScheduler = new OptimizedMeasurementScheduler();

// HOOK PARA USAR EL SCHEDULER OPTIMIZADO
export const useOptimizedScheduler = () => {
  return {
    scheduleTask: optimizedScheduler.scheduleTask,
    removeTask: optimizedScheduler.removeTask,
    start: optimizedScheduler.start,
    stop: optimizedScheduler.stop,
    getStats: optimizedScheduler.getStats,
    pauseTask: optimizedScheduler.pauseTask,
    resumeTask: optimizedScheduler.resumeTask,
    getActiveTasks: optimizedScheduler.getActiveTasks
  };
};