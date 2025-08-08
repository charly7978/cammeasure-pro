import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  Zap,
  Ruler,
  Settings,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { PrecisionAnalysisSystem, PrecisionMetrics, MeasurementQuality, CalibrationAccuracy } from '@/lib/precisionAnalysis';

interface PrecisionAnalysisPanelProps {
  isVisible: boolean;
  currentMeasurement?: {
    value: number;
    confidence: number;
    referenceValue?: number;
  };
  imageData?: ImageData;
  detectedObjects?: any[];
  calibrationData?: any;
  onRecommendationClick?: (recommendation: string) => void;
}

export const PrecisionAnalysisPanel: React.FC<PrecisionAnalysisPanelProps> = ({
  isVisible,
  currentMeasurement,
  imageData,
  detectedObjects = [],
  calibrationData,
  onRecommendationClick
}) => {
  const [precisionSystem] = useState(() => new PrecisionAnalysisSystem());
  const [precisionMetrics, setPrecisionMetrics] = useState<PrecisionMetrics | null>(null);
  const [qualityAnalysis, setQualityAnalysis] = useState<MeasurementQuality | null>(null);
  const [calibrationAccuracy, setCalibrationAccuracy] = useState<CalibrationAccuracy | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  useEffect(() => {
    if (!isVisible || !currentMeasurement) return;

    // Analizar precisión de la medición actual
    const precision = precisionSystem.analyzeMeasurementPrecision(
      currentMeasurement.value,
      currentMeasurement.referenceValue,
      currentMeasurement.confidence
    );
    setPrecisionMetrics(precision);

    // Analizar calidad de imagen si está disponible
    if (imageData) {
      const quality = precisionSystem.analyzeImageQuality(imageData, detectedObjects);
      setQualityAnalysis(quality);
    }

    // Analizar precisión de calibración
    if (calibrationData) {
      const calibAccuracy = precisionSystem.analyzeCalibrationAccuracy(calibrationData);
      setCalibrationAccuracy(calibAccuracy);
    }

    // Generar recomendaciones
    if (precision && qualityAnalysis && calibrationAccuracy) {
      const recs = precisionSystem.generatePrecisionRecommendations(
        precision,
        qualityAnalysis,
        calibrationAccuracy
      );
      setRecommendations(recs);
    }

    // Obtener métricas de rendimiento del sistema
    const performance = precisionSystem.getSystemPerformanceMetrics();
    setPerformanceMetrics(performance);
  }, [isVisible, currentMeasurement, imageData, detectedObjects, calibrationData]);

  if (!isVisible || !precisionMetrics) {
    return null;
  }

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-measurement-active';
    if (score >= 0.6) return 'text-calibration';
    return 'text-destructive';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 0.8) return 'default';
    if (score >= 0.6) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-card to-card/80 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Análisis de Precisión</h3>
        </div>
        
        <Badge 
          variant={getScoreBadgeVariant(precisionMetrics.confidence)}
          className="animate-measurement-pulse"
        >
          {precisionMetrics.qualityScore}/100
        </Badge>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
          <TabsTrigger value="metrics" className="text-xs">
            <Target className="w-3 h-3 mr-1" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="quality" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            Calidad
          </TabsTrigger>
          <TabsTrigger value="calibration" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            Calibración
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="text-xs">
            <Lightbulb className="w-3 h-3 mr-1" />
            Consejos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Accuracy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Precisión</span>
                <span className={`text-sm font-bold ${getScoreColor(precisionMetrics.accuracy)}`}>
                  {(precisionMetrics.accuracy * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={precisionMetrics.accuracy * 100} 
                className="h-2"
              />
            </div>

            {/* Consistency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Consistencia</span>
                <span className={`text-sm font-bold ${getScoreColor(precisionMetrics.precision)}`}>
                  {(precisionMetrics.precision * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={precisionMetrics.precision * 100} 
                className="h-2"
              />
            </div>

            {/* Stability */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estabilidad</span>
                <span className={`text-sm font-bold ${getScoreColor(precisionMetrics.stability)}`}>
                  {(precisionMetrics.stability * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={precisionMetrics.stability * 100} 
                className="h-2"
              />
            </div>

            {/* Confidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confianza</span>
                <span className={`text-sm font-bold ${getScoreColor(precisionMetrics.confidence)}`}>
                  {(precisionMetrics.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={precisionMetrics.confidence * 100} 
                className="h-2"
              />
            </div>
          </div>

          {/* Error Estimate */}
          <div className="p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Error Estimado</span>
              <span className="text-sm font-bold text-accent">
                ±{precisionMetrics.errorEstimate.toFixed(1)}mm
              </span>
            </div>
          </div>

          {/* Performance Trend */}
          {performanceMetrics && (
            <div className="p-3 bg-measurement-active/10 border border-measurement-active/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Tendencia del Sistema</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-4 h-4 ${
                    performanceMetrics.qualityTrend === 'improving' ? 'text-measurement-active' :
                    performanceMetrics.qualityTrend === 'declining' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`} />
                  <span className="text-xs capitalize">{performanceMetrics.qualityTrend}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {performanceMetrics.measurementCount} mediciones realizadas
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quality" className="mt-4 space-y-3">
          {qualityAnalysis && (
            <>
              {/* Lighting */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">Iluminación</span>
                </div>
                <Badge variant={getScoreBadgeVariant(qualityAnalysis.lighting.score)}>
                  {(qualityAnalysis.lighting.score * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* Focus */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">Enfoque</span>
                </div>
                <Badge variant={getScoreBadgeVariant(qualityAnalysis.focus.score)}>
                  {(qualityAnalysis.focus.score * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* Stability */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span className="text-sm">Estabilidad</span>
                </div>
                <Badge variant={getScoreBadgeVariant(qualityAnalysis.stability.score)}>
                  {(qualityAnalysis.stability.score * 100).toFixed(0)}%
                </Badge>
              </div>

              {/* Distance */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  <span className="text-sm">Distancia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getScoreBadgeVariant(qualityAnalysis.distance.score)}>
                    {(qualityAnalysis.distance.score * 100).toFixed(0)}%
                  </Badge>
                  {qualityAnalysis.distance.optimalRange && (
                    <CheckCircle className="w-3 h-3 text-measurement-active" />
                  )}
                </div>
              </div>

              {/* Angle */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Ángulo</span>
                </div>
                <Badge variant={getScoreBadgeVariant(qualityAnalysis.angle.score)}>
                  {(qualityAnalysis.angle.score * 100).toFixed(0)}%
                </Badge>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="calibration" className="mt-4 space-y-3">
          {calibrationAccuracy && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Precisión Píxeles/mm</span>
                  <span className={`text-sm font-bold ${getScoreColor(calibrationAccuracy.pixelsPerMmAccuracy)}`}>
                    {(calibrationAccuracy.pixelsPerMmAccuracy * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={calibrationAccuracy.pixelsPerMmAccuracy * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Coincidencia Dispositivo</span>
                  <span className={`text-sm font-bold ${getScoreColor(calibrationAccuracy.deviceProfileMatch)}`}>
                    {(calibrationAccuracy.deviceProfileMatch * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={calibrationAccuracy.deviceProfileMatch * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Consistencia Ambiental</span>
                  <span className={`text-sm font-bold ${getScoreColor(calibrationAccuracy.environmentalConsistency)}`}>
                    {(calibrationAccuracy.environmentalConsistency * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={calibrationAccuracy.environmentalConsistency * 100} className="h-2" />
              </div>

              <div className="p-3 bg-calibration/10 border border-calibration/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-calibration">Precisión General</span>
                  <span className="text-sm font-bold text-calibration">
                    {(calibrationAccuracy.overallAccuracy * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4 space-y-2">
          {recommendations.length > 0 ? (
            recommendations.map((recommendation, index) => (
              <div 
                key={index}
                className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg cursor-pointer hover:bg-amber-500/20 transition-colors"
                onClick={() => onRecommendationClick?.(recommendation)}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-amber-600">{recommendation}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-measurement-active" />
              <p className="text-sm">¡Excelente! No hay recomendaciones adicionales.</p>
            </div>
          )}

          {/* System Performance Summary */}
          {performanceMetrics && performanceMetrics.recommendedActions.length > 0 && (
            <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <h4 className="text-sm font-medium text-primary mb-2">Acciones Recomendadas del Sistema:</h4>
              {performanceMetrics.recommendedActions.map((action: string, index: number) => (
                <div key={index} className="flex items-start gap-2 mt-1">
                  <AlertTriangle className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-primary/80">{action}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};