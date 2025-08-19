// SISTEMA DE LOGGING INTELIGENTE - ELIMINA CONSOLE.LOGS EN PRODUCCIÓN
// Mantiene funcionalidad completa en desarrollo y optimiza rendimiento en producción

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  component?: string;
  data?: any;
}

class SmartLogger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000;
  private readonly IS_PRODUCTION = process.env.NODE_ENV === 'production';
  private readonly IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

  constructor() {
    // Configuración más restrictiva para evitar spam
    this.disableAllLogs();
  }

  // DESABILITAR TODOS LOS LOGS (MEJORAR RENDIMIENTO)
  private disableAllLogs(): void {
    this.debug = () => {};
    this.info = () => {};
    this.warn = () => {};
    this.error = this.IS_PRODUCTION ? () => {} : console.error; // Solo errores en desarrollo
  }

  // LOG DE DEBUG (Solo desarrollo)
  debug(message: string, component?: string, data?: any): void {
    if (this.IS_PRODUCTION) return;

    const entry: LogEntry = {
      level: 'debug',
      message,
      timestamp: Date.now(),
      component,
      data
    };

    this.addLog(entry);
    console.log(`🔍 [${component || 'DEBUG'}] ${message}`, data || '');
  }

  // LOG DE INFORMACIÓN (Solo desarrollo)
  info(message: string, component?: string, data?: any): void {
    if (this.IS_PRODUCTION) return;

    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: Date.now(),
      component,
      data
    };

    this.addLog(entry);
    console.log(`ℹ️ [${component || 'INFO'}] ${message}`, data || '');
  }

  // LOG DE ADVERTENCIA (Limitado en producción)
  warn(message: string, component?: string, data?: any): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: Date.now(),
      component,
      data
    };

    this.addLog(entry);
    
    if (!this.IS_PRODUCTION) {
      console.warn(`⚠️ [${component || 'WARN'}] ${message}`, data || '');
    }
  }

  // LOG DE ERROR (Siempre activo)
  error(message: string, component?: string, data?: any): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: Date.now(),
      component,
      data
    };

    this.addLog(entry);
    console.error(`❌ [${component || 'ERROR'}] ${message}`, data || '');
  }

  // AGREGAR LOG AL BUFFER
  private addLog(entry: LogEntry): void {
    if (this.IS_PRODUCTION) return;

    this.logs.push(entry);
    
    // Mantener solo los últimos logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  // OBTENER LOGS FILTRADOS
  getLogs(level?: LogLevel, component?: string): LogEntry[] {
    if (this.IS_PRODUCTION) return [];

    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    if (component) {
      filteredLogs = filteredLogs.filter(log => log.component === component);
    }

    return filteredLogs;
  }

  // LIMPIAR LOGS
  clearLogs(): void {
    if (this.IS_PRODUCTION) return;
    this.logs = [];
  }

  // EXPORTAR LOGS (Solo desarrollo)
  exportLogs(): string {
    if (this.IS_PRODUCTION) return '';
    
    return JSON.stringify(this.logs, null, 2);
  }

  // ESTADÍSTICAS DE LOGS
  getLogStats(): { total: number; byLevel: Record<LogLevel, number> } {
    if (this.IS_PRODUCTION) return { total: 0, byLevel: { debug: 0, info: 0, warn: 0, error: 0 } };

    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };

    this.logs.forEach(log => {
      byLevel[log.level]++;
    });

    return {
      total: this.logs.length,
      byLevel
    };
  }
}

// INSTANCIA SINGLETON DEL LOGGER
export const smartLogger = new SmartLogger();

// FUNCIONES DE CONVENIENCIA PARA REEMPLAZAR CONSOLE.LOG
export const logger = {
  debug: (message: string, component?: string, data?: any) => smartLogger.debug(message, component, data),
  info: (message: string, component?: string, data?: any) => smartLogger.info(message, component, data),
  warn: (message: string, component?: string, data?: any) => smartLogger.warn(message, component, data),
  error: (message: string, component?: string, data?: any) => smartLogger.error(message, component, data),
  getLogs: smartLogger.getLogs.bind(smartLogger),
  clearLogs: smartLogger.clearLogs.bind(smartLogger),
  exportLogs: smartLogger.exportLogs.bind(smartLogger),
  getStats: smartLogger.getLogStats.bind(smartLogger)
};

// HOOK PARA USAR EL LOGGER OPTIMIZADO
export const useSmartLogger = (component: string) => {
  return {
    debug: (message: string, data?: any) => logger.debug(message, component, data),
    info: (message: string, data?: any) => logger.info(message, component, data),
    warn: (message: string, data?: any) => logger.warn(message, component, data),
    error: (message: string, data?: any) => logger.error(message, component, data)
  };
};