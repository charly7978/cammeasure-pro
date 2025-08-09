
// Advanced Geometric Analysis Worker for Professional-Grade Computer Vision
// Implements sophisticated algorithms for precise object measurement and analysis

interface GeometricAnalysisResult {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    area: number;
  };
  geometricMetrics: {
    circularity: number;
    solidity: number;
    extent: number;
    aspectRatio: number;
    compactness: number;
    perimeter: number;
    contourPoints: number;
    centerX: number;
    centerY: number;
    huMoments: number[];
    isConvex: boolean;
    boundingCircleRadius: number;
    eccentricity: number;
    orientation: number;
  };
  confidence: number;
  qualityScore: number;
}

class AdvancedGeometricProcessor {
  private cv: any;
  private isReady = false;
  private processingQueue: any[] = [];

  constructor() {
    this.initializeOpenCV();
  }

  private async initializeOpenCV() {
    try {
      // Load OpenCV.js with advanced computer vision capabilities
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      const waitForOpenCV = () => {
        if (typeof cv !== 'undefined' && cv.Mat) {
          this.cv = cv;
          this.isReady = true;
          self.postMessage({ type: 'READY' });
          console.log('Advanced OpenCV geometric processor ready');
          
          // Process queued tasks
          this.processingQueue.forEach(task => this.processGeometricAnalysis(task));
          this.processingQueue = [];
        } else {
          setTimeout(waitForOpenCV, 100);
        }
      };
      
      setTimeout(waitForOpenCV, 100);
    } catch (error) {
      console.error('Error loading OpenCV:', error);
      self.postMessage({ type: 'ERROR', error: error.message });
    }
  }

  private calculateAdvancedGeometricMetrics(contour: any, boundingRect: any): any {
    const cv = this.cv;
    
    // Calculate area and perimeter
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);
    
    // Calculate convex hull for solidity and convexity
    const hull = new cv.Mat();
    cv.convexHull(contour, hull, false);
    const hullArea = cv.contourArea(hull);
    const solidity = area / hullArea;
    const isConvex = cv.isContourConvex(contour);
    
    // Calculate circularity (4*PI*Area/Perimeter^2)
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    // Calculate extent (Area/BoundingRectArea)
    const boundingRectArea = boundingRect.width * boundingRect.height;
    const extent = area / boundingRectArea;
    
    // Calculate aspect ratio
    const aspectRatio = boundingRect.width / boundingRect.height;
    
    // Calculate compactness (Perimeter^2/Area)
    const compactness = (perimeter * perimeter) / area;
    
    // Calculate moments for center and orientation
    const moments = cv.moments(contour);
    const centerX = moments.m10 / moments.m00;
    const centerY = moments.m01 / moments.m00;
    
    // Calculate orientation using central moments
    const mu20 = moments.mu20 / moments.m00;
    const mu02 = moments.mu02 / moments.m00;
    const mu11 = moments.mu11 / moments.m00;
    const orientation = 0.5 * Math.atan2(2 * mu11, mu20 - mu02) * (180 / Math.PI);
    
    // Calculate eccentricity
    const lambda1 = 0.5 * (mu20 + mu02) + 0.5 * Math.sqrt(4 * mu11 * mu11 + (mu20 - mu02) * (mu20 - mu02));
    const lambda2 = 0.5 * (mu20 + mu02) - 0.5 * Math.sqrt(4 * mu11 * mu11 + (mu20 - mu02) * (mu20 - mu02));
    const eccentricity = Math.sqrt(1 - (lambda2 / lambda1));
    
    // Calculate Hu moments for shape description
    const huMoments = new cv.Mat();
    cv.HuMoments(moments, huMoments);
    const huMomentsArray = [];
    for (let i = 0; i < 7; i++) {
      huMomentsArray.push(huMoments.doublePtr(0, 0)[i]);
    }
    
    // Calculate minimum enclosing circle
    const center = new cv.Point2f();
    const radius = cv.minEnclosingCircle(contour, center);
    
    // Clean up
    hull.delete();
    huMoments.delete();
    center.delete();
    
    return {
      circularity: Math.max(0, Math.min(1, circularity)),
      solidity: Math.max(0, Math.min(1, solidity)),
      extent: Math.max(0, Math.min(1, extent)),
      aspectRatio: aspectRatio,
      compactness: compactness,
      perimeter: perimeter,
      contourPoints: contour.rows,
      centerX: centerX,
      centerY: centerY,
      huMoments: huMomentsArray,
      isConvex: isConvex,
      boundingCircleRadius: typeof radius === 'number' ? radius : 0,
      eccentricity: Math.max(0, Math.min(1, eccentricity)),
      orientation: orientation
    };
  }

  private calculateQualityScore(metrics: any): number {
    let score = 0;
    let factors = 0;
    
    // Circularity contribution (higher is better for regular shapes)
    if (metrics.circularity > 0.3) {
      score += metrics.circularity * 0.2;
      factors += 0.2;
    }
    
    // Solidity contribution (higher is better)
    score += metrics.solidity * 0.25;
    factors += 0.25;
    
    // Extent contribution (higher is better)
    score += metrics.extent * 0.15;
    factors += 0.15;
    
    // Aspect ratio contribution (closer to 1 or reasonable values are better)
    const aspectScore = 1 / (1 + Math.abs(Math.log(Math.max(metrics.aspectRatio, 1 / metrics.aspectRatio))));
    score += aspectScore * 0.15;
    factors += 0.15;
    
    // Compactness contribution (lower is better for regular shapes)
    const compactnessScore = Math.max(0, 1 - (metrics.compactness - 12.5) / 50);
    score += compactnessScore * 0.1;
    factors += 0.1;
    
    // Convexity bonus
    if (metrics.isConvex) {
      score += 0.1;
      factors += 0.1;
    }
    
    // Contour points contribution (more points = better definition)
    const pointsScore = Math.min(metrics.contourPoints / 50, 1);
    score += pointsScore * 0.05;
    factors += 0.05;
    
    return Math.min(score / factors, 1.0);
  }

  private detectAdvancedContours(imageData: ImageData, minArea = 1000): GeometricAnalysisResult[] {
    const cv = this.cv;
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    
    const results: GeometricAnalysisResult[] = [];
    
    try {
      // Advanced preprocessing pipeline
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Multi-scale Gaussian blur for noise reduction
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5);
      
      // Adaptive Canny edge detection
      const otsuThreshold = cv.threshold(blurred, new cv.Mat(), 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      const cannyLow = otsuThreshold * 0.5;
      const cannyHigh = otsuThreshold * 1.2;
      
      cv.Canny(blurred, edges, cannyLow, cannyHigh, 3, true);
      
      // Advanced morphological operations
      const ellipseKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, ellipseKernel);
      cv.morphologyEx(edges, edges, cv.MORPH_OPEN, ellipseKernel);
      
      // Find contours with complete hierarchy
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        if (area >= minArea) {
          // Calculate bounding rectangle
          const boundingRect = cv.boundingRect(contour);
          
          // Approximate contour to reduce noise
          const epsilon = 0.02 * cv.arcLength(contour, true);
          const approxContour = new cv.Mat();
          cv.approxPolyDP(contour, approxContour, epsilon, true);
          
          // Calculate advanced geometric metrics
          const metrics = this.calculateAdvancedGeometricMetrics(approxContour, boundingRect);
          const qualityScore = this.calculateQualityScore(metrics);
          
          // Only include high-quality detections
          if (qualityScore > 0.4) {
            results.push({
              id: `geo_${Date.now()}_${i}`,
              bounds: {
                x: boundingRect.x,
                y: boundingRect.y,
                width: boundingRect.width,
                height: boundingRect.height,
                area: area
              },
              geometricMetrics: metrics,
              confidence: qualityScore,
              qualityScore: qualityScore
            });
          }
          
          approxContour.delete();
        }
        
        contour.delete();
      }
      
      ellipseKernel.delete();
      
    } catch (error) {
      console.error('Advanced geometric analysis error:', error);
    } finally {
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
    }
    
    // Sort by quality score and return top candidates
    return results
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5);
  }

  processGeometricAnalysis(task: any) {
    if (!this.isReady) {
      this.processingQueue.push(task);
      return;
    }

    try {
      const { taskId, imageData, minArea = 1000 } = task;
      
      console.log('Processing advanced geometric analysis:', {
        imageSize: `${imageData.width}x${imageData.height}`,
        minArea,
        algorithms: 'Multi-scale Canny + Morphological + Hu Moments + Advanced Metrics'
      });
      
      const results = this.detectAdvancedContours(imageData, minArea);
      
      console.log('Advanced analysis completed:', {
        objectsFound: results.length,
        avgQuality: results.length > 0 ? 
          (results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length).toFixed(3) : 0,
        avgCircularity: results.length > 0 ?
          (results.reduce((sum, r) => sum + r.geometricMetrics.circularity, 0) / results.length).toFixed(3) : 0,
        avgSolidity: results.length > 0 ?
          (results.reduce((sum, r) => sum + r.geometricMetrics.solidity, 0) / results.length).toFixed(3) : 0
      });
      
      self.postMessage({
        type: 'SUCCESS',
        data: {
          taskId,
          data: { objects: results }
        }
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      self.postMessage({
        type: 'ERROR',
        data: {
          taskId: task.taskId,
          error: error.message
        }
      });
    }
  }
}

const processor = new AdvancedGeometricProcessor();

self.onmessage = function(event) {
  const { type, ...data } = event.data;
  
  switch (type) {
    case 'INIT':
      // Already initialized in constructor
      break;
    case 'DETECT':
      processor.processGeometricAnalysis(data);
      break;
    default:
      console.warn('Unknown message type:', type);
  }
};
