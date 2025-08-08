export interface MeasurementReport {
  id: string;
  timestamp: number;
  measurements: {
    primary: {
      value: number;
      unit: string;
      type: '2d' | '3d' | 'area' | 'volume' | 'depth';
      confidence: number;
    };
    secondary?: {
      width?: number;
      height?: number;
      depth?: number;
      area?: number;
      volume?: number;
      perimeter?: number;
      diagonal?: number;
      unit: string;
    };
  };
  precision: {
    accuracy: number;
    precision: number;
    stability: number;
    errorEstimate: number;
    qualityScore: number;
  };
  calibration: {
    pixelsPerMm: number;
    isCalibrated: boolean;
    method: string;
    accuracy: number;
  };
  environment: {
    lighting: string;
    stability: number;
    distance: number;
    angle: number;
    deviceInfo: any;
  };
  imageData?: {
    width: number;
    height: number;
    objectBounds: any[];
    thumbnail?: string; // Base64 encoded thumbnail
  };
  notes?: string;
  tags?: string[];
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'excel' | 'xml';
  includeImages: boolean;
  includeMetadata: boolean;
  includePrecisionAnalysis: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filterBy?: {
    minQuality?: number;
    measurementType?: string[];
    tags?: string[];
  };
  groupBy?: 'date' | 'type' | 'quality' | 'none';
  compression?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  styling: {
    theme: 'professional' | 'technical' | 'minimal';
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    logo?: string;
  };
}

export interface ReportSection {
  type: 'summary' | 'measurements' | 'charts' | 'images' | 'analysis' | 'recommendations';
  title: string;
  content: any;
  visible: boolean;
}

export class AdvancedExportSystem {
  private reports: MeasurementReport[] = [];
  private templates: ReportTemplate[] = [];

  constructor() {
    this.loadReports();
    this.initializeDefaultTemplates();
  }

  // Crear reporte de medición
  createMeasurementReport(
    measurementData: any,
    precisionMetrics: any,
    calibrationData: any,
    environmentalData: any,
    imageData?: ImageData,
    notes?: string,
    tags?: string[]
  ): MeasurementReport {
    const report: MeasurementReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      measurements: {
        primary: {
          value: measurementData.distance2D || measurementData.area || measurementData.volume || 0,
          unit: measurementData.unit || 'mm',
          type: measurementData.mode || '2d',
          confidence: measurementData.confidence || 0.8
        },
        secondary: {
          width: measurementData.additionalData?.width,
          height: measurementData.additionalData?.height,
          depth: measurementData.additionalData?.estimatedDepth,
          area: measurementData.area,
          volume: measurementData.volume,
          perimeter: measurementData.additionalData?.perimeter,
          diagonal: measurementData.additionalData?.diagonal,
          unit: measurementData.unit || 'mm'
        }
      },
      precision: {
        accuracy: precisionMetrics?.accuracy || 0.8,
        precision: precisionMetrics?.precision || 0.8,
        stability: precisionMetrics?.stability || 0.8,
        errorEstimate: precisionMetrics?.errorEstimate || 0,
        qualityScore: precisionMetrics?.qualityScore || 80
      },
      calibration: {
        pixelsPerMm: calibrationData?.pixelsPerMm || 8,
        isCalibrated: calibrationData?.isCalibrated || false,
        method: calibrationData?.method || 'auto',
        accuracy: calibrationData?.accuracy || 0.8
      },
      environment: {
        lighting: environmentalData?.lightingCondition || 'medium',
        stability: environmentalData?.stabilityScore || 0.8,
        distance: environmentalData?.distanceToObject || 30,
        angle: environmentalData?.cameraAngle || 0,
        deviceInfo: environmentalData?.deviceInfo || {}
      },
      notes,
      tags: tags || []
    };

    // Agregar datos de imagen si están disponibles
    if (imageData) {
      report.imageData = {
        width: imageData.width,
        height: imageData.height,
        objectBounds: [], // Se llenarían con los objetos detectados
        thumbnail: this.createThumbnail(imageData)
      };
    }

    this.reports.push(report);
    this.saveReports();
    
    return report;
  }

  // Exportar reportes según opciones especificadas
  async exportReports(options: ExportOptions): Promise<Blob> {
    const filteredReports = this.filterReports(options);
    const groupedReports = this.groupReports(filteredReports, options.groupBy || 'none');

    switch (options.format) {
      case 'json':
        return this.exportToJSON(groupedReports, options);
      case 'csv':
        return this.exportToCSV(groupedReports, options);
      case 'pdf':
        return await this.exportToPDF(groupedReports, options);
      case 'excel':
        return this.exportToExcel(groupedReports, options);
      case 'xml':
        return this.exportToXML(groupedReports, options);
      default:
        throw new Error(`Formato de exportación no soportado: ${options.format}`);
    }
  }

  // Filtrar reportes según criterios
  private filterReports(options: ExportOptions): MeasurementReport[] {
    let filtered = [...this.reports];

    // Filtrar por rango de fechas
    if (options.dateRange) {
      filtered = filtered.filter(report => {
        const reportDate = new Date(report.timestamp);
        return reportDate >= options.dateRange!.start && reportDate <= options.dateRange!.end;
      });
    }

    // Filtrar por calidad mínima
    if (options.filterBy?.minQuality) {
      filtered = filtered.filter(report => 
        report.precision.qualityScore >= options.filterBy!.minQuality!
      );
    }

    // Filtrar por tipo de medición
    if (options.filterBy?.measurementType?.length) {
      filtered = filtered.filter(report => 
        options.filterBy!.measurementType!.includes(report.measurements.primary.type)
      );
    }

    // Filtrar por tags
    if (options.filterBy?.tags?.length) {
      filtered = filtered.filter(report => 
        report.tags?.some(tag => options.filterBy!.tags!.includes(tag))
      );
    }

    return filtered;
  }

  // Agrupar reportes
  private groupReports(reports: MeasurementReport[], groupBy: string): any {
    if (groupBy === 'none') {
      return { all: reports };
    }

    const grouped: { [key: string]: MeasurementReport[] } = {};

    reports.forEach(report => {
      let key: string;
      
      switch (groupBy) {
        case 'date':
          key = new Date(report.timestamp).toISOString().split('T')[0];
          break;
        case 'type':
          key = report.measurements.primary.type;
          break;
        case 'quality':
          if (report.precision.qualityScore >= 90) key = 'excellent';
          else if (report.precision.qualityScore >= 70) key = 'good';
          else if (report.precision.qualityScore >= 50) key = 'fair';
          else key = 'poor';
          break;
        default:
          key = 'all';
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(report);
    });

    return grouped;
  }

  // Exportar a JSON
  private exportToJSON(groupedReports: any, options: ExportOptions): Blob {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalReports: Object.values(groupedReports).flat().length,
        options: options,
        version: '1.0'
      },
      reports: groupedReports
    };

    // Remover datos de imagen si no se requieren
    if (!options.includeImages) {
      this.removeImageData(exportData.reports);
    }

    // Remover metadatos si no se requieren
    if (!options.includeMetadata) {
      this.removeMetadata(exportData.reports);
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  // Exportar a CSV
  private exportToCSV(groupedReports: any, options: ExportOptions): Blob {
    const allReports = Object.values(groupedReports).flat() as MeasurementReport[];
    
    const headers = [
      'ID',
      'Fecha',
      'Valor Principal',
      'Unidad',
      'Tipo',
      'Confianza',
      'Score Calidad',
      'Precisión',
      'Estabilidad',
      'Error Estimado',
      'Calibrado',
      'Píxeles/mm',
      'Iluminación',
      'Distancia',
      'Ángulo',
      'Notas',
      'Tags'
    ];

    // Agregar headers adicionales si se incluyen metadatos
    if (options.includeMetadata) {
      headers.push('Ancho', 'Alto', 'Área', 'Volumen', 'Perímetro', 'Diagonal');
    }

    const csvRows = [headers.join(',')];

    allReports.forEach(report => {
      const row = [
        report.id,
        new Date(report.timestamp).toISOString(),
        report.measurements.primary.value.toString(),
        report.measurements.primary.unit,
        report.measurements.primary.type,
        report.measurements.primary.confidence.toString(),
        report.precision.qualityScore.toString(),
        report.precision.precision.toString(),
        report.precision.stability.toString(),
        report.precision.errorEstimate.toString(),
        report.calibration.isCalibrated.toString(),
        report.calibration.pixelsPerMm.toString(),
        report.environment.lighting,
        report.environment.distance.toString(),
        report.environment.angle.toString(),
        `"${report.notes || ''}"`,
        `"${report.tags?.join(';') || ''}"`
      ];

      if (options.includeMetadata) {
        row.push(
          report.measurements.secondary?.width?.toString() || '',
          report.measurements.secondary?.height?.toString() || '',
          report.measurements.secondary?.area?.toString() || '',
          report.measurements.secondary?.volume?.toString() || '',
          report.measurements.secondary?.perimeter?.toString() || '',
          report.measurements.secondary?.diagonal?.toString() || ''
        );
      }

      csvRows.push(row.join(','));
    });

    return new Blob([csvRows.join('\n')], { type: 'text/csv' });
  }

  // Exportar a PDF (simplificado - en producción usarías una librería como jsPDF)
  private async exportToPDF(groupedReports: any, options: ExportOptions): Promise<Blob> {
    // Esta es una implementación simplificada
    // En producción, usarías jsPDF o similar para generar PDFs reales
    
    const allReports = Object.values(groupedReports).flat() as MeasurementReport[];
    
    let pdfContent = `
REPORTE DE MEDICIONES - CamMeasure Pro
=====================================

Fecha de exportación: ${new Date().toLocaleString()}
Total de mediciones: ${allReports.length}

`;

    allReports.forEach((report, index) => {
      pdfContent += `
MEDICIÓN ${index + 1}
-----------------
ID: ${report.id}
Fecha: ${new Date(report.timestamp).toLocaleString()}
Valor: ${report.measurements.primary.value} ${report.measurements.primary.unit}
Tipo: ${report.measurements.primary.type.toUpperCase()}
Calidad: ${report.precision.qualityScore}/100
Confianza: ${(report.measurements.primary.confidence * 100).toFixed(0)}%
Error estimado: ±${report.precision.errorEstimate.toFixed(1)}mm

`;

      if (options.includeMetadata && report.measurements.secondary) {
        const sec = report.measurements.secondary;
        pdfContent += `Dimensiones adicionales:
- Ancho: ${sec.width || 'N/A'} ${sec.unit}
- Alto: ${sec.height || 'N/A'} ${sec.unit}
- Área: ${sec.area || 'N/A'} ${sec.unit}²
- Volumen: ${sec.volume || 'N/A'} ${sec.unit}³

`;
      }

      if (report.notes) {
        pdfContent += `Notas: ${report.notes}\n`;
      }

      if (report.tags?.length) {
        pdfContent += `Tags: ${report.tags.join(', ')}\n`;
      }

      pdfContent += '\n' + '='.repeat(50) + '\n';
    });

    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  // Exportar a Excel (simplificado)
  private exportToExcel(groupedReports: any, options: ExportOptions): Blob {
    // En producción, usarías una librería como SheetJS para generar archivos Excel reales
    // Por ahora, generamos un CSV con extensión .xlsx
    return this.exportToCSV(groupedReports, options);
  }

  // Exportar a XML
  private exportToXML(groupedReports: any, options: ExportOptions): Blob {
    const allReports = Object.values(groupedReports).flat() as MeasurementReport[];
    
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<MeasurementReports>
  <Metadata>
    <ExportDate>${new Date().toISOString()}</ExportDate>
    <TotalReports>${allReports.length}</TotalReports>
    <Version>1.0</Version>
  </Metadata>
  <Reports>
`;

    allReports.forEach(report => {
      xmlContent += `
    <Report id="${report.id}">
      <Timestamp>${report.timestamp}</Timestamp>
      <Date>${new Date(report.timestamp).toISOString()}</Date>
      <Measurements>
        <Primary>
          <Value>${report.measurements.primary.value}</Value>
          <Unit>${report.measurements.primary.unit}</Unit>
          <Type>${report.measurements.primary.type}</Type>
          <Confidence>${report.measurements.primary.confidence}</Confidence>
        </Primary>`;

      if (options.includeMetadata && report.measurements.secondary) {
        xmlContent += `
        <Secondary>
          <Width>${report.measurements.secondary.width || ''}</Width>
          <Height>${report.measurements.secondary.height || ''}</Height>
          <Area>${report.measurements.secondary.area || ''}</Area>
          <Volume>${report.measurements.secondary.volume || ''}</Volume>
          <Unit>${report.measurements.secondary.unit}</Unit>
        </Secondary>`;
      }

      xmlContent += `
      </Measurements>
      <Precision>
        <Accuracy>${report.precision.accuracy}</Accuracy>
        <Precision>${report.precision.precision}</Precision>
        <Stability>${report.precision.stability}</Stability>
        <QualityScore>${report.precision.qualityScore}</QualityScore>
        <ErrorEstimate>${report.precision.errorEstimate}</ErrorEstimate>
      </Precision>
      <Calibration>
        <PixelsPerMm>${report.calibration.pixelsPerMm}</PixelsPerMm>
        <IsCalibrated>${report.calibration.isCalibrated}</IsCalibrated>
        <Method>${report.calibration.method}</Method>
      </Calibration>`;

      if (report.notes) {
        xmlContent += `
      <Notes><![CDATA[${report.notes}]]></Notes>`;
      }

      if (report.tags?.length) {
        xmlContent += `
      <Tags>
        ${report.tags.map(tag => `<Tag>${tag}</Tag>`).join('\n        ')}
      </Tags>`;
      }

      xmlContent += `
    </Report>`;
    });

    xmlContent += `
  </Reports>
</MeasurementReports>`;

    return new Blob([xmlContent], { type: 'application/xml' });
  }

  // Crear thumbnail de imagen
  private createThumbnail(imageData: ImageData, maxSize: number = 150): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';

    // Calcular dimensiones del thumbnail manteniendo proporción
    const scale = Math.min(maxSize / imageData.width, maxSize / imageData.height);
    canvas.width = imageData.width * scale;
    canvas.height = imageData.height * scale;

    // Crear ImageData escalado
    const scaledImageData = ctx.createImageData(canvas.width, canvas.height);
    
    // Algoritmo de escalado simple (nearest neighbor)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
        const srcIndex = (srcY * imageData.width + srcX) * 4;
        const destIndex = (y * canvas.width + x) * 4;
        
        scaledImageData.data[destIndex] = imageData.data[srcIndex];
        scaledImageData.data[destIndex + 1] = imageData.data[srcIndex + 1];
        scaledImageData.data[destIndex + 2] = imageData.data[srcIndex + 2];
        scaledImageData.data[destIndex + 3] = imageData.data[srcIndex + 3];
      }
    }

    ctx.putImageData(scaledImageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  // Remover datos de imagen de los reportes
  private removeImageData(reports: any): void {
    const processReports = (reportList: MeasurementReport[]) => {
      reportList.forEach(report => {
        if (report.imageData) {
          delete report.imageData.thumbnail;
        }
      });
    };

    if (Array.isArray(reports)) {
      processReports(reports);
    } else {
      Object.values(reports).forEach((reportList: any) => {
        if (Array.isArray(reportList)) {
          processReports(reportList);
        }
      });
    }
  }

  // Remover metadatos de los reportes
  private removeMetadata(reports: any): void {
    const processReports = (reportList: MeasurementReport[]) => {
      reportList.forEach(report => {
        delete report.measurements.secondary;
        delete report.environment;
        delete report.imageData;
      });
    };

    if (Array.isArray(reports)) {
      processReports(reports);
    } else {
      Object.values(reports).forEach((reportList: any) => {
        if (Array.isArray(reportList)) {
          processReports(reportList);
        }
      });
    }
  }

  // Generar estadísticas de los reportes
  generateStatistics(reports?: MeasurementReport[]): any {
    const reportsToAnalyze = reports || this.reports;
    
    if (reportsToAnalyze.length === 0) {
      return {
        totalMeasurements: 0,
        averageQuality: 0,
        measurementTypes: {},
        qualityDistribution: {},
        timeRange: null
      };
    }

    const stats = {
      totalMeasurements: reportsToAnalyze.length,
      averageQuality: reportsToAnalyze.reduce((sum, r) => sum + r.precision.qualityScore, 0) / reportsToAnalyze.length,
      measurementTypes: {} as { [key: string]: number },
      qualityDistribution: {
        excellent: 0, // 90-100
        good: 0,      // 70-89
        fair: 0,      // 50-69
        poor: 0       // 0-49
      },
      timeRange: {
        start: Math.min(...reportsToAnalyze.map(r => r.timestamp)),
        end: Math.max(...reportsToAnalyze.map(r => r.timestamp))
      },
      averageValues: {} as { [key: string]: number },
      calibrationStats: {
        calibratedCount: 0,
        averagePixelsPerMm: 0
      }
    };

    // Analizar tipos de medición
    reportsToAnalyze.forEach(report => {
      const type = report.measurements.primary.type;
      stats.measurementTypes[type] = (stats.measurementTypes[type] || 0) + 1;

      // Distribución de calidad
      const quality = report.precision.qualityScore;
      if (quality >= 90) stats.qualityDistribution.excellent++;
      else if (quality >= 70) stats.qualityDistribution.good++;
      else if (quality >= 50) stats.qualityDistribution.fair++;
      else stats.qualityDistribution.poor++;

      // Estadísticas de calibración
      if (report.calibration.isCalibrated) {
        stats.calibrationStats.calibratedCount++;
      }
    });

    // Calcular promedio de píxeles por mm
    const calibratedReports = reportsToAnalyze.filter(r => r.calibration.isCalibrated);
    if (calibratedReports.length > 0) {
      stats.calibrationStats.averagePixelsPerMm = 
        calibratedReports.reduce((sum, r) => sum + r.calibration.pixelsPerMm, 0) / calibratedReports.length;
    }

    return stats;
  }

  // Inicializar plantillas por defecto
  private initializeDefaultTemplates(): void {
    this.templates = [
      {
        id: 'professional',
        name: 'Reporte Profesional',
        description: 'Reporte completo con análisis detallado',
        sections: [
          { type: 'summary', title: 'Resumen Ejecutivo', content: {}, visible: true },
          { type: 'measurements', title: 'Mediciones', content: {}, visible: true },
          { type: 'analysis', title: 'Análisis de Precisión', content: {}, visible: true },
          { type: 'charts', title: 'Gráficos y Estadísticas', content: {}, visible: true },
          { type: 'recommendations', title: 'Recomendaciones', content: {}, visible: true }
        ],
        styling: {
          theme: 'professional',
          colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#10b981'
          }
        }
      },
      {
        id: 'technical',
        name: 'Reporte Técnico',
        description: 'Reporte detallado para análisis técnico',
        sections: [
          { type: 'measurements', title: 'Datos de Medición', content: {}, visible: true },
          { type: 'analysis', title: 'Análisis Técnico', content: {}, visible: true },
          { type: 'images', title: 'Imágenes y Diagramas', content: {}, visible: true }
        ],
        styling: {
          theme: 'technical',
          colors: {
            primary: '#1e40af',
            secondary: '#374151',
            accent: '#059669'
          }
        }
      },
      {
        id: 'minimal',
        name: 'Reporte Básico',
        description: 'Reporte simple con información esencial',
        sections: [
          { type: 'summary', title: 'Resumen', content: {}, visible: true },
          { type: 'measurements', title: 'Mediciones', content: {}, visible: true }
        ],
        styling: {
          theme: 'minimal',
          colors: {
            primary: '#6b7280',
            secondary: '#9ca3af',
            accent: '#3b82f6'
          }
        }
      }
    ];
  }

  // Cargar reportes desde localStorage
  private loadReports(): void {
    try {
      const saved = localStorage.getItem('cammeasure_reports');
      if (saved) {
        this.reports = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      this.reports = [];
    }
  }

  // Guardar reportes en localStorage
  private saveReports(): void {
    try {
      localStorage.setItem('cammeasure_reports', JSON.stringify(this.reports));
    } catch (error) {
      console.error('Error saving reports:', error);
    }
  }

  // Obtener todos los reportes
  getAllReports(): MeasurementReport[] {
    return [...this.reports];
  }

  // Obtener reporte por ID
  getReportById(id: string): MeasurementReport | undefined {
    return this.reports.find(report => report.id === id);
  }

  // Eliminar reporte
  deleteReport(id: string): boolean {
    const index = this.reports.findIndex(report => report.id === id);
    if (index !== -1) {
      this.reports.splice(index, 1);
      this.saveReports();
      return true;
    }
    return false;
  }

  // Limpiar todos los reportes
  clearAllReports(): void {
    this.reports = [];
    this.saveReports();
  }

  // Obtener plantillas disponibles
  getTemplates(): ReportTemplate[] {
    return [...this.templates];
  }
}