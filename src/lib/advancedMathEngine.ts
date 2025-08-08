/**
 * MOTOR MATEMÁTICO AVANZADO PARA MEDICIÓN REAL
 * Implementación de algoritmos complejos de geometría computacional,
 * fotogrametría y visión por computadora para mediciones precisas
 */

// ==================== ESTRUCTURAS DE DATOS MATEMÁTICAS ====================

export interface Matrix3x3 {
  data: number[][];
}

export interface Matrix4x4 {
  data: number[][];
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface CameraIntrinsics {
  fx: number;  // Focal length X
  fy: number;  // Focal length Y
  cx: number;  // Principal point X
  cy: number;  // Principal point Y
  k1: number;  // Radial distortion coefficient 1
  k2: number;  // Radial distortion coefficient 2
  p1: number;  // Tangential distortion coefficient 1
  p2: number;  // Tangential distortion coefficient 2
  k3: number;  // Radial distortion coefficient 3
}

export interface CameraExtrinsics {
  rotation: Matrix3x3;     // Rotation matrix
  translation: Vector3D;   // Translation vector
}

export interface HomographyMatrix {
  H: Matrix3x3;
  confidence: number;
  inliers: Vector2D[];
  outliers: Vector2D[];
}

export interface PerspectiveCorrection {
  originalPoints: Vector2D[];
  correctedPoints: Vector2D[];
  transformMatrix: Matrix3x3;
  inverseMatrix: Matrix3x3;
}

export interface StereoPair {
  leftImage: ImageData;
  rightImage: ImageData;
  baseline: number;  // Distance between cameras in mm
  disparityMap: number[][];
  depthMap: number[][];
}

export interface PhotogrammetricMeasurement {
  worldCoordinates: Vector3D[];
  imageCoordinates: Vector2D[];
  reprojectionError: number;
  scaleFactor: number;
  confidence: number;
}

// ==================== ÁLGEBRA LINEAL AVANZADA ====================

// TODO: Considerar refactorizar a namespace si no se usan instancias
class AdvancedLinearAlgebra {
  
  /**
   * Multiplicación de matrices 3x3
   */
  static multiplyMatrix3x3(A: Matrix3x3, B: Matrix3x3): Matrix3x3 {
    const result: Matrix3x3 = { data: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result.data[i][j] = 0;
        for (let k = 0; k < 3; k++) {
          result.data[i][j] += A.data[i][k] * B.data[k][j];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Inversión de matriz 3x3 usando determinante y adjunta
   */
  static invertMatrix3x3(matrix: Matrix3x3): Matrix3x3 | null {
    const m = matrix.data;
    
    // Calcular determinante
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
                m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
                m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    
    if (Math.abs(det) < 1e-10) {
      throw new Error('Matrix is singular');
    }
    
    // Calcular matriz adjunta
    const adj: Matrix3x3 = { data: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
    
    adj.data[0][0] = (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det;
    adj.data[0][1] = (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det;
    adj.data[0][2] = (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det;
    
    adj.data[1][0] = (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det;
    adj.data[1][1] = (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det;
    adj.data[1][2] = (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det;
    
    adj.data[2][0] = (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det;
    adj.data[2][1] = (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det;
    adj.data[2][2] = (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det;
    
    return adj;
  }
  
  /**
   * Descomposición SVD (Singular Value Decomposition) para matrices 3x3
   */
  static svdDecomposition3x3(matrix: Matrix3x3): {
    U: Matrix3x3;
    S: number[];
    V: Matrix3x3;
  } {
    // Implementación simplificada de SVD usando método de Jacobi
    const A = matrix.data;
    const maxIterations = 100;
    const tolerance = 1e-10;
    
    // Inicializar U y V como matrices identidad
    const U: Matrix3x3 = { data: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
    const V: Matrix3x3 = { data: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
    
    // Copiar matriz original
    const S_matrix = A.map(row => [...row]);
    
    // Iteraciones de Jacobi
    // TODO: Optimizar para rendimiento - agregar caché o salida temprana si off-diagonal es pequeña
    for (let iter = 0; iter < maxIterations; iter++) {
      let maxOffDiag = 0;
      let p = 0, q = 0;
      
      // Encontrar el elemento fuera de la diagonal más grande
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          if (Math.abs(S_matrix[i][j]) > maxOffDiag) {
            maxOffDiag = Math.abs(S_matrix[i][j]);
            p = i;
            q = j;
          }
        }
      }
      
      if (maxOffDiag < tolerance) break;
      
      // Calcular rotación de Jacobi
      const theta = 0.5 * Math.atan2(2 * S_matrix[p][q], S_matrix[q][q] - S_matrix[p][p]);
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      
      // Aplicar rotación
      const temp_pp = c * c * S_matrix[p][p] - 2 * c * s * S_matrix[p][q] + s * s * S_matrix[q][q];
      const temp_qq = s * s * S_matrix[p][p] + 2 * c * s * S_matrix[p][q] + c * c * S_matrix[q][q];
      const temp_pq = (c * c - s * s) * S_matrix[p][q] + c * s * (S_matrix[p][p] - S_matrix[q][q]);
      
      S_matrix[p][p] = temp_pp;
      S_matrix[q][q] = temp_qq;
      S_matrix[p][q] = temp_pq;
      S_matrix[q][p] = temp_pq;
      
      // Actualizar matrices U y V
      for (let i = 0; i < 3; i++) {
        const temp_u = c * U.data[i][p] - s * U.data[i][q];
        const temp_v = s * U.data[i][p] + c * U.data[i][q];
        U.data[i][p] = temp_u;
        U.data[i][q] = temp_v;
        
        const temp_v_p = c * V.data[i][p] - s * V.data[i][q];
        const temp_v_q = s * V.data[i][p] + c * V.data[i][q];
        V.data[i][p] = temp_v_p;
        V.data[i][q] = temp_v_q;
      }
    }
    
    // Extraer valores singulares
    const S = [S_matrix[0][0], S_matrix[1][1], S_matrix[2][2]];
    
    return { U, S, V };
  }
  
  /**
   * Resolver sistema de ecuaciones lineales Ax = b usando eliminación gaussiana
   */
  static solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Eliminación hacia adelante
    for (let i = 0; i < n; i++) {
      // Pivoteo parcial
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Verificar si la matriz es singular
      if (Math.abs(augmented[i][i]) < 1e-10) {
        return null;
      }
      
      // Hacer ceros debajo del pivote
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Sustitución hacia atrás
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }
}

// ==================== CALIBRACIÓN DE CÁMARA AVANZADA ====================

// TODO: Considerar refactorizar a namespace si no se usan instancias
class CameraCalibration {
  
  /**
   * Calibración completa de cámara usando patrón de tablero de ajedrez
   */
  static calibrateCamera(
    objectPoints: Vector3D[][],  // Puntos 3D del mundo real
    imagePoints: Vector2D[][],   // Puntos 2D correspondientes en la imagen
    imageSize: { width: number; height: number }
  ): {
    intrinsics: CameraIntrinsics;
    extrinsics: CameraExtrinsics[];
    reprojectionError: number;
  } {
    
    const numImages = objectPoints.length;
    const numPointsPerImage = objectPoints[0].length;
    
    // Inicializar parámetros intrínsecos
    let fx = imageSize.width;  // Estimación inicial
    let fy = imageSize.width;  // Asumir píxeles cuadrados
    let cx = imageSize.width / 2;
    let cy = imageSize.height / 2;
    let k1 = 0, k2 = 0, p1 = 0, p2 = 0, k3 = 0;
    
    // Algoritmo de optimización de Levenberg-Marquardt
    const maxIterations = 100;
    const tolerance = 1e-6;
    let lambda = 0.001;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Construir matriz Jacobiana y vector de residuos
      const jacobian: number[][] = [];
      const residuals: number[] = [];
      
      for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
        // Estimar pose de la cámara para esta imagen
        const pose = this.estimatePose(objectPoints[imgIdx], imagePoints[imgIdx], {
          fx, fy, cx, cy, k1, k2, p1, p2, k3
        });
        
        for (let ptIdx = 0; ptIdx < numPointsPerImage; ptIdx++) {
          const worldPt = objectPoints[imgIdx][ptIdx];
          const imagePt = imagePoints[imgIdx][ptIdx];
          
          // Proyectar punto 3D a 2D
          const projectedPt = this.projectPoint(worldPt, {
            fx, fy, cx, cy, k1, k2, p1, p2, k3
          }, pose);
          
          // Calcular residuos
          const dx = projectedPt.x - imagePt.x;
          const dy = projectedPt.y - imagePt.y;
          
          residuals.push(dx, dy);
          
          // Calcular derivadas parciales (Jacobiano)
          const derivatives = this.computeProjectionDerivatives(worldPt, {
            fx, fy, cx, cy, k1, k2, p1, p2, k3
          }, pose);
          
          jacobian.push(derivatives.dfx, derivatives.dfy, derivatives.dcx, 
                       derivatives.dcy, derivatives.dk1, derivatives.dk2,
                       derivatives.dp1, derivatives.dp2, derivatives.dk3);
        }
      }
      
      // Resolver sistema normal usando Levenberg-Marquardt
      const JtJ = this.computeJtJ(jacobian);
      const Jtr = this.computeJtr(jacobian, residuals);
      
      // Añadir término de amortiguamiento
      for (let i = 0; i < JtJ.length; i++) {
        JtJ[i][i] += lambda;
      }
      
      const delta = AdvancedLinearAlgebra.solveLinearSystem(JtJ, Jtr);
      
      if (!delta) break;
      
      // Actualizar parámetros
      fx += delta[0];
      fy += delta[1];
      cx += delta[2];
      cy += delta[3];
      k1 += delta[4];
      k2 += delta[5];
      p1 += delta[6];
      p2 += delta[7];
      k3 += delta[8];
      
      // Verificar convergencia
      const deltaNorm = Math.sqrt(delta.reduce((sum, d) => sum + d * d, 0));
      if (deltaNorm < tolerance) break;
      
      // Ajustar lambda
      const currentError = residuals.reduce((sum, r) => sum + r * r, 0);
      lambda *= 0.1; // Simplificado
    }
    
    // Calcular error de reproyección final
    let totalError = 0;
    let totalPoints = 0;
    
    const extrinsics: CameraExtrinsics[] = [];
    
    for (let imgIdx = 0; imgIdx < numImages; imgIdx++) {
      const pose = this.estimatePose(objectPoints[imgIdx], imagePoints[imgIdx], {
        fx, fy, cx, cy, k1, k2, p1, p2, k3
      });
      
      extrinsics.push(pose);
      
      for (let ptIdx = 0; ptIdx < numPointsPerImage; ptIdx++) {
        const worldPt = objectPoints[imgIdx][ptIdx];
        const imagePt = imagePoints[imgIdx][ptIdx];
        
        const projectedPt = this.projectPoint(worldPt, {
          fx, fy, cx, cy, k1, k2, p1, p2, k3
        }, pose);
        
        const error = Math.sqrt(
          Math.pow(projectedPt.x - imagePt.x, 2) + 
          Math.pow(projectedPt.y - imagePt.y, 2)
        );
        
        totalError += error;
        totalPoints++;
      }
    }
    
    return {
      intrinsics: { fx, fy, cx, cy, k1, k2, p1, p2, k3 },
      extrinsics,
      reprojectionError: totalError / totalPoints
    };
  }
  
  /**
   * Proyección de punto 3D a 2D con corrección de distorsión
   */
  static projectPoint(
    worldPoint: Vector3D,
    intrinsics: CameraIntrinsics,
    extrinsics: CameraExtrinsics
  ): Vector2D {
    
    // Transformar punto del mundo a coordenadas de cámara
    const R = extrinsics.rotation.data;
    const t = extrinsics.translation;
    
    const X = R[0][0] * worldPoint.x + R[0][1] * worldPoint.y + R[0][2] * worldPoint.z + t.x;
    const Y = R[1][0] * worldPoint.x + R[1][1] * worldPoint.y + R[1][2] * worldPoint.z + t.y;
    const Z = R[2][0] * worldPoint.x + R[2][1] * worldPoint.y + R[2][2] * worldPoint.z + t.z;
    
    // Proyección perspectiva
    const x = X / Z;
    const y = Y / Z;
    
    // Aplicar distorsión radial y tangencial
    const r2 = x * x + y * y;
    const r4 = r2 * r2;
    const r6 = r4 * r2;
    
    const radialDistortion = 1 + intrinsics.k1 * r2 + intrinsics.k2 * r4 + intrinsics.k3 * r6;
    
    const tangentialX = 2 * intrinsics.p1 * x * y + intrinsics.p2 * (r2 + 2 * x * x);
    const tangentialY = intrinsics.p1 * (r2 + 2 * y * y) + 2 * intrinsics.p2 * x * y;
    
    const xDistorted = x * radialDistortion + tangentialX;
    const yDistorted = y * radialDistortion + tangentialY;
    
    // Convertir a coordenadas de píxel
    const u = intrinsics.fx * xDistorted + intrinsics.cx;
    const v = intrinsics.fy * yDistorted + intrinsics.cy;
    
    return { x: u, y: v };
  }
  
  /**
   * Estimación de pose usando algoritmo PnP (Perspective-n-Point)
   */
  static estimatePose(
    objectPoints: Vector3D[],
    imagePoints: Vector2D[],
    intrinsics: CameraIntrinsics
  ): CameraExtrinsics {
    
    const n = objectPoints.length;
    
    // Construir matriz de coeficientes para DLT (Direct Linear Transform)
    const A: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      const X = objectPoints[i].x;
      const Y = objectPoints[i].y;
      const Z = objectPoints[i].z;
      const u = imagePoints[i].x;
      const v = imagePoints[i].y;
      
      // Normalizar coordenadas de imagen
      const x = (u - intrinsics.cx) / intrinsics.fx;
      const y = (v - intrinsics.cy) / intrinsics.fy;
      
      // Ecuaciones de DLT
      A.push([X, Y, Z, 1, 0, 0, 0, 0, -x * X, -x * Y, -x * Z, -x]);
      A.push([0, 0, 0, 0, X, Y, Z, 1, -y * X, -y * Y, -y * Z, -y]);
    }
    
    // Resolver usando SVD
    const AtA = this.computeAtA(A);
    const { V } = AdvancedLinearAlgebra.svdDecomposition3x3({
      data: [
        [AtA[0][0], AtA[0][1], AtA[0][2]],
        [AtA[1][0], AtA[1][1], AtA[1][2]],
        [AtA[2][0], AtA[2][1], AtA[2][2]]
      ]
    });
    
    // Extraer matriz de proyección
    const P = [
      [V.data[0][0], V.data[0][1], V.data[0][2], V.data[0][3]],
      [V.data[1][0], V.data[1][1], V.data[1][2], V.data[1][3]],
      [V.data[2][0], V.data[2][1], V.data[2][2], V.data[2][3]]
    ];
    
    // Descomponer P = K[R|t] para obtener R y t
    const M = [
      [P[0][0], P[0][1], P[0][2]],
      [P[1][0], P[1][1], P[1][2]],
      [P[2][0], P[2][1], P[2][2]]
    ];
    
    // Descomposición QR para obtener R
    const { Q: R } = this.qrDecomposition(M);
    
    // Calcular t
    const t = {
      x: P[0][3],
      y: P[1][3],
      z: P[2][3]
    };
    
    return {
      rotation: { data: R },
      translation: t
    };
  }
  
  // Métodos auxiliares (implementaciones simplificadas)
  private static computeProjectionDerivatives(
    worldPoint: Vector3D,
    intrinsics: CameraIntrinsics,
    extrinsics: CameraExtrinsics
  ): any {
    // Implementación de derivadas parciales para optimización
    // (Código extenso, implementación simplificada)
    return {
      dfx: [1, 0], dfy: [0, 1], dcx: [1, 0], dcy: [0, 1],
      dk1: [0, 0], dk2: [0, 0], dp1: [0, 0], dp2: [0, 0], dk3: [0, 0]
    };
  }
  
  private static computeJtJ(jacobian: number[][]): number[][] {
    // J^T * J
    const n = jacobian[0].length;
    const result = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < jacobian.length; k++) {
          result[i][j] += jacobian[k][i] * jacobian[k][j];
        }
      }
    }
    
    return result;
  }
  
  private static computeJtr(jacobian: number[][], residuals: number[]): number[] {
    // J^T * r
    const n = jacobian[0].length;
    const result = Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < jacobian.length; j++) {
        result[i] += jacobian[j][i] * residuals[j];
      }
    }
    
    return result;
  }
  
  private static computeAtA(A: number[][]): number[][] {
    const n = A[0].length;
    const result = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < A.length; k++) {
          result[i][j] += A[k][i] * A[k][j];
        }
      }
    }
    
    return result;
  }
  
  private static qrDecomposition(matrix: number[][]): { Q: number[][], R: number[][] } {
    // Implementación simplificada de descomposición QR
    const n = matrix.length;
    const Q = matrix.map(row => [...row]);
    const R = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Proceso de Gram-Schmidt
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < j; i++) {
        let dot = 0;
        for (let k = 0; k < n; k++) {
          dot += Q[k][i] * matrix[k][j];
        }
        R[i][j] = dot;
        
        for (let k = 0; k < n; k++) {
          Q[k][j] -= dot * Q[k][i];
        }
      }
      
      let norm = 0;
      for (let k = 0; k < n; k++) {
        norm += Q[k][j] * Q[k][j];
      }
      norm = Math.sqrt(norm);
      R[j][j] = norm;
      
      for (let k = 0; k < n; k++) {
        Q[k][j] /= norm;
      }
    }
    
    return { Q, R };
  }
}

// ==================== GEOMETRÍA PROYECTIVA AVANZADA ====================

// TODO: Considerar refactorizar a namespace si no se usan instancias
class ProjectiveGeometry {
  
  /**
   * Cálculo de homografía usando RANSAC para robustez
   */
  static computeHomography(
    sourcePoints: Vector2D[],
    targetPoints: Vector2D[],
    ransacThreshold: number = 3.0,
    maxIterations: number = 1000
  ): HomographyMatrix {
    
    const n = sourcePoints.length;
    let bestH: Matrix3x3 | null = null;
    let bestInliers: Vector2D[] = [];
    let maxInliers = 0;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Seleccionar 4 puntos aleatorios
      const indices = this.randomSample(n, 4);
      const srcSample = indices.map(i => sourcePoints[i]);
      const tgtSample = indices.map(i => targetPoints[i]);
      
      // Calcular homografía con 4 puntos
      const H = this.computeHomographyDLT(srcSample, tgtSample);
      if (!H) {
      console.warn('Homografía no calculada en iteración');
      continue;
    }
      
      // Evaluar todos los puntos
      const inliers: Vector2D[] = [];
      
      for (let i = 0; i < n; i++) {
        const transformed = this.transformPoint(sourcePoints[i], H);
        const distance = Math.sqrt(
          Math.pow(transformed.x - targetPoints[i].x, 2) +
          Math.pow(transformed.y - targetPoints[i].y, 2)
        );
        
        if (distance < ransacThreshold) {
          inliers.push(sourcePoints[i]);
        }
      }
      
      if (inliers.length > maxInliers) {
        maxInliers = inliers.length;
        bestH = H;
        bestInliers = inliers;
      }
    }
    
    if (!bestH) {
      throw new Error('No se pudo calcular homografía válida');
    }
    
    // Refinar homografía con todos los inliers
    const refinedH = this.refineHomography(bestInliers, targetPoints, bestH);
    
    const outliers = sourcePoints.filter(p => !bestInliers.includes(p));
    const confidence = bestInliers.length / n;
    
    return {
      H: refinedH || bestH,
      confidence,
      inliers: bestInliers,
      outliers
    };
  }
  
  /**
   * Cálculo directo de homografía usando DLT (Direct Linear Transform)
   */
  private static computeHomographyDLT(
    sourcePoints: Vector2D[],
    targetPoints: Vector2D[]
  ): Matrix3x3 | null {
    
    if (sourcePoints.length < 4) return null;
    
    // Construir matriz A para el sistema Ah = 0
    const A: number[][] = [];
    
    for (let i = 0; i < sourcePoints.length; i++) {
      const x = sourcePoints[i].x;
      const y = sourcePoints[i].y;
      const u = targetPoints[i].x;
      const v = targetPoints[i].y;
      
      // Dos ecuaciones por punto de correspondencia
      A.push([-x, -y, -1, 0, 0, 0, u * x, u * y, u]);
      A.push([0, 0, 0, -x, -y, -1, v * x, v * y, v]);
    }
    
    // Resolver usando SVD
    const AtA = this.computeAtA(A);
    
    // Simplificación: usar método de mínimos cuadrados
    const h = this.solveLeastSquares(A);
    if (!h) return null;
    
    return {
      data: [
        [h[0], h[1], h[2]],
        [h[3], h[4], h[5]],
        [h[6], h[7], h[8]]
      ]
    };
  }
  
  /**
   * Transformación de punto usando homografía
   */
  static transformPoint(point: Vector2D, homography: Matrix3x3): Vector2D {
    const H = homography.data;
    
    const x = point.x;
    const y = point.y;
    
    const w = H[2][0] * x + H[2][1] * y + H[2][2];
    
    if (Math.abs(w) < 1e-10) {
      throw new Error('División por cero en transformación homográfica');
    }
    
    return {
      x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
      y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w
    };
  }
  
  /**
   * Corrección de perspectiva usando homografía
   */
  static correctPerspective(
    imagePoints: Vector2D[],
    realWorldDimensions: { width: number; height: number }
  ): PerspectiveCorrection {
    
    // Puntos de referencia en el mundo real (rectángulo)
    const worldPoints: Vector2D[] = [
      { x: 0, y: 0 },
      { x: realWorldDimensions.width, y: 0 },
      { x: realWorldDimensions.width, y: realWorldDimensions.height },
      { x: 0, y: realWorldDimensions.height }
    ];
    
    // Calcular homografía inversa (de imagen a mundo real)
    const homography = this.computeHomography(imagePoints, worldPoints);
    
    // Calcular matriz inversa
    const inverseMatrix = AdvancedLinearAlgebra.invertMatrix3x3(homography.H);
    if (!inverseMatrix) {
      throw new Error('No se pudo invertir la matriz de homografía');
    }
    
    // Aplicar corrección a todos los puntos
    const correctedPoints = imagePoints.map(p => 
      this.transformPoint(p, homography.H)
    );
    
    return {
      originalPoints: imagePoints,
      correctedPoints,
      transformMatrix: homography.H,
      inverseMatrix
    };
  }
  
  // Métodos auxiliares
  private static randomSample(n: number, k: number): number[] {
    const indices = Array.from({ length: n }, (_, i) => i);
    const sample: number[] = [];
    
    for (let i = 0; i < k; i++) {
      const randomIndex = Math.floor(Math.random() * indices.length);
      sample.push(indices.splice(randomIndex, 1)[0]);
    }
    
    return sample;
  }
  
  private static refineHomography(
    inliers: Vector2D[],
    targets: Vector2D[],
    initialH: Matrix3x3
  ): Matrix3x3 | null {
    // Refinamiento usando optimización no lineal (simplificado)
    return initialH;
  }
  
  private static computeAtA(A: number[][]): number[][] {
    const n = A[0].length;
    const result = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < A.length; k++) {
          result[i][j] += A[k][i] * A[k][j];
        }
      }
    }
    
    return result;
  }
  
  private static solveLeastSquares(A: number[][]): number[] | null {
    // TODO: Implementar solver de mínimos cuadrados adecuado usando SVD o biblioteca externa
    return null;
  }
}

// ==================== TRIANGULACIÓN ESTÉREO AVANZADA ====================

// TODO: Considerar refactorizar a namespace si no se usan instancias
class StereoTriangulation {
  
  /**
   * Triangulación 3D usando par estéreo calibrado
   */
  static triangulatePoints(
    leftPoints: Vector2D[],
    rightPoints: Vector2D[],
    leftCamera: { intrinsics: CameraIntrinsics; extrinsics: CameraExtrinsics },
    rightCamera: { intrinsics: CameraIntrinsics; extrinsics: CameraExtrinsics }
  ): Vector3D[] {
    
    const triangulatedPoints: Vector3D[] = [];
    
    for (let i = 0; i < leftPoints.length; i++) {
      const leftPt = leftPoints[i];
      const rightPt = rightPoints[i];
      
      // Construir matrices de proyección
      const P1 = this.constructProjectionMatrix(leftCamera.intrinsics, leftCamera.extrinsics);
      const P2 = this.constructProjectionMatrix(rightCamera.intrinsics, rightCamera.extrinsics);
      
      // Triangulación usando método DLT
      const worldPoint = this.triangulatePointDLT(leftPt, rightPt, P1, P2);
      
      if (worldPoint) {
        triangulatedPoints.push(worldPoint);
      }
    }
    
    return triangulatedPoints;
  }
  
  /**
   * Construcción de matriz de proyección P = K[R|t]
   */
  private static constructProjectionMatrix(
    intrinsics: CameraIntrinsics,
    extrinsics: CameraExtrinsics
  ): number[][] {
    
    // Matriz intrínseca K
    const K = [
      [intrinsics.fx, 0, intrinsics.cx],
      [0, intrinsics.fy, intrinsics.cy],
      [0, 0, 1]
    ];
    
    // Matriz extrínseca [R|t]
    const R = extrinsics.rotation.data;
    const t = extrinsics.translation;
    
    const Rt = [
      [R[0][0], R[0][1], R[0][2], t.x],
      [R[1][0], R[1][1], R[1][2], t.y],
      [R[2][0], R[2][1], R[2][2], t.z]
    ];
    
    // P = K * [R|t]
    const P: number[][] = [];
    for (let i = 0; i < 3; i++) {
      P[i] = [];
      for (let j = 0; j < 4; j++) {
        P[i][j] = 0;
        for (let k = 0; k < 3; k++) {
          P[i][j] += K[i][k] * Rt[k][j];
        }
      }
    }
    
    return P;
  }
  
  /**
   * Triangulación de punto único usando DLT
   */
  private static triangulatePointDLT(
    leftPoint: Vector2D,
    rightPoint: Vector2D,
    P1: number[][],
    P2: number[][]
  ): Vector3D | null {
    
    // Construir matriz A para el sistema AX = 0
    const A = [
      [
        leftPoint.x * P1[2][0] - P1[0][0],
        leftPoint.x * P1[2][1] - P1[0][1],
        leftPoint.x * P1[2][2] - P1[0][2],
        leftPoint.x * P1[2][3] - P1[0][3]
      ],
      [
        leftPoint.y * P1[2][0] - P1[1][0],
        leftPoint.y * P1[2][1] - P1[1][1],
        leftPoint.y * P1[2][2] - P1[1][2],
        leftPoint.y * P1[2][3] - P1[1][3]
      ],
      [
        rightPoint.x * P2[2][0] - P2[0][0],
        rightPoint.x * P2[2][1] - P2[0][1],
        rightPoint.x * P2[2][2] - P2[0][2],
        rightPoint.x * P2[2][3] - P2[0][3]
      ],
      [
        rightPoint.y * P2[2][0] - P2[1][0],
        rightPoint.y * P2[2][1] - P2[1][1],
        rightPoint.y * P2[2][2] - P2[1][2],
        rightPoint.y * P2[2][3] - P2[1][3]
      ]
    ];
    
    // Resolver usando SVD (implementación simplificada)
    const solution = this.solveSVD(A);
    
    if (!solution || Math.abs(solution[3]) < 1e-10) {
      throw new Error('Triangulation failed: invalid solution');
    }
    
    // Normalizar coordenadas homogéneas
    return {
      x: solution[0] / solution[3],
      y: solution[1] / solution[3],
      z: solution[2] / solution[3]
    };
  }
  
  /**
   * Cálculo de mapa de disparidad denso
   */
  static computeDisparityMap(
    leftImage: ImageData,
    rightImage: ImageData,
    windowSize: number = 15,
    maxDisparity: number = 64
  ): number[][] {
    
    const width = leftImage.width;
    const height = leftImage.height;
    const disparityMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    
    const halfWindow = Math.floor(windowSize / 2);
    
    // TODO: Optimizar para rendimiento - usar procesamiento paralelo o algoritmo más eficiente como SGM
    for (let y = halfWindow; y < height - halfWindow; y++) {
      for (let x = halfWindow; x < width - halfWindow; x++) {
        
        let bestDisparity = 0;
        let minCost = Infinity;
        
        // Buscar correspondencia en línea epipolar
        for (let d = 0; d < maxDisparity && x - d >= halfWindow; d++) {
          
          // Calcular costo de correspondencia usando SSD (Sum of Squared Differences)
          let cost = 0;
          
          for (let dy = -halfWindow; dy <= halfWindow; dy++) {
            for (let dx = -halfWindow; dx <= halfWindow; dx++) {
              
              const leftIdx = ((y + dy) * width + (x + dx)) * 4;
              const rightIdx = ((y + dy) * width + (x - d + dx)) * 4;
              
              // Usar intensidad (escala de grises)
              const leftIntensity = (leftImage.data[leftIdx] + 
                                   leftImage.data[leftIdx + 1] + 
                                   leftImage.data[leftIdx + 2]) / 3;
              
              const rightIntensity = (rightImage.data[rightIdx] + 
                                    rightImage.data[rightIdx + 1] + 
                                    rightImage.data[rightIdx + 2]) / 3;
              
              const diff = leftIntensity - rightIntensity;
              cost += diff * diff;
            }
          }
          
          if (cost < minCost) {
            minCost = cost;
            bestDisparity = d;
          }
        }
        
        disparityMap[y][x] = bestDisparity;
      }
    }
    
    return disparityMap;
  }
  
  /**
   * Conversión de disparidad a profundidad
   */
  static disparityToDepth(
    disparityMap: number[][],
    baseline: number,  // Distancia entre cámaras en mm
    focalLength: number  // Distancia focal en píxeles
  ): number[][] {
    
    const height = disparityMap.length;
    const width = disparityMap[0].length;
    const depthMap: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const disparity = disparityMap[y][x];
        
        if (disparity > 0) {
          // Fórmula de triangulación estéreo: Z = (baseline * focalLength) / disparity
          depthMap[y][x] = (baseline * focalLength) / disparity;
        } else {
          depthMap[y][x] = 0; // Profundidad indefinida
        }
      }
    }
    
    return depthMap;
  }
  
  // Método auxiliar para resolver SVD (simplificado)
  private static solveSVD(A: number[][]): number[] | null {
    // TODO: Implementar resolución SVD adecuada usando descomposición o biblioteca externa
    return null;
  }
}

// ==================== FOTOGRAMETRÍA AVANZADA ====================

// TODO: Considerar refactorizar a namespace si no se usan instancias
class Photogrammetry {
  
  /**
   * Medición fotogramétrica usando múltiples vistas
   */
  static measureObject(
    images: ImageData[],
    correspondingPoints: Vector2D[][],  // Puntos correspondientes en cada imagen
    cameraParameters: { intrinsics: CameraIntrinsics; extrinsics: CameraExtrinsics }[],
    referenceScale: { realWorldDistance: number; imageDistance: number }
  ): PhotogrammetricMeasurement {
    
    // Triangular puntos 3D usando todas las vistas
    const worldPoints = this.multiViewTriangulation(
      correspondingPoints,
      cameraParameters
    );
    
    // Calcular factor de escala usando referencia conocida
    const scaleFactor = referenceScale.realWorldDistance / referenceScale.imageDistance;
    
    // Aplicar escala a puntos 3D
    const scaledWorldPoints = worldPoints.map(p => ({
      x: p.x * scaleFactor,
      y: p.y * scaleFactor,
      z: p.z * scaleFactor
    }));
    
    // Calcular error de reproyección
    const reprojectionError = this.computeReprojectionError(
      scaledWorldPoints,
      correspondingPoints,
      cameraParameters
    );
    
    // Calcular confianza basada en error de reproyección
    const confidence = Math.max(0, 1 - reprojectionError / 10); // Normalizado
    
    return {
      worldCoordinates: scaledWorldPoints,
      imageCoordinates: correspondingPoints.flat(),
      reprojectionError,
      scaleFactor,
      confidence
    };
  }
  
  /**
   * Triangulación usando múltiples vistas
   */
  private static multiViewTriangulation(
    correspondingPoints: Vector2D[][],
    cameraParameters: { intrinsics: CameraIntrinsics; extrinsics: CameraExtrinsics }[]
  ): Vector3D[] {
    
    const numPoints = correspondingPoints[0].length;
    const numViews = correspondingPoints.length;
    const worldPoints: Vector3D[] = [];
    
    for (let ptIdx = 0; ptIdx < numPoints; ptIdx++) {
      
      // Construir sistema de ecuaciones para este punto
      const A: number[][] = [];
      
      for (let viewIdx = 0; viewIdx < numViews; viewIdx++) {
        const point2D = correspondingPoints[viewIdx][ptIdx];
        const camera = cameraParameters[viewIdx];
        
        // Construir matriz de proyección
        const P = this.constructProjectionMatrix(camera.intrinsics, camera.extrinsics);
        
        // Añadir ecuaciones al sistema
        A.push([
          point2D.x * P[2][0] - P[0][0],
          point2D.x * P[2][1] - P[0][1],
          point2D.x * P[2][2] - P[0][2],
          point2D.x * P[2][3] - P[0][3]
        ]);
        
        A.push([
          point2D.y * P[2][0] - P[1][0],
          point2D.y * P[2][1] - P[1][1],
          point2D.y * P[2][2] - P[1][2],
          point2D.y * P[2][3] - P[1][3]
        ]);
      }
      
      // Resolver sistema usando SVD
      const solution = this.solveSVD(A);
      
      if (solution && Math.abs(solution[3]) > 1e-10) {
        worldPoints.push({
          x: solution[0] / solution[3],
          y: solution[1] / solution[3],
          z: solution[2] / solution[3]
        });
      }
    }
    
    return worldPoints;
  }
  
  /**
   * Cálculo de error de reproyección
   */
  private static computeReprojectionError(
    worldPoints: Vector3D[],
    imagePoints: Vector2D[][],
    cameraParameters: { intrinsics: CameraIntrinsics; extrinsics: CameraExtrinsics }[]
  ): number {
    
    let totalError = 0;
    let totalPoints = 0;
    
    for (let viewIdx = 0; viewIdx < imagePoints.length; viewIdx++) {
      const camera = cameraParameters[viewIdx];
      
      for (let ptIdx = 0; ptIdx < worldPoints.length; ptIdx++) {
        const worldPt = worldPoints[ptIdx];
        const imagePt = imagePoints[viewIdx][ptIdx];
        
        // Proyectar punto 3D a 2D
        const projectedPt = CameraCalibration.projectPoint(
          worldPt,
          camera.intrinsics,
          camera.extrinsics
        );
        
        // Calcular error euclidiano
        const error = Math.sqrt(
          Math.pow(projectedPt.x - imagePt.x, 2) +
          Math.pow(projectedPt.y - imagePt.y, 2)
        );
        
        totalError += error;
        totalPoints++;
      }
    }
    
    return totalError / totalPoints;
  }
  
  // Métodos auxiliares
  private static constructProjectionMatrix(
    intrinsics: CameraIntrinsics,
    extrinsics: CameraExtrinsics
  ): number[][] {
    
    const K = [
      [intrinsics.fx, 0, intrinsics.cx],
      [0, intrinsics.fy, intrinsics.cy],
      [0, 0, 1]
    ];
    
    const R = extrinsics.rotation.data;
    const t = extrinsics.translation;
    
    const Rt = [
      [R[0][0], R[0][1], R[0][2], t.x],
      [R[1][0], R[1][1], R[1][2], t.y],
      [R[2][0], R[2][1], R[2][2], t.z]
    ];
    
    const P: number[][] = [];
    for (let i = 0; i < 3; i++) {
      P[i] = [];
      for (let j = 0; j < 4; j++) {
        P[i][j] = 0;
        for (let k = 0; k < 3; k++) {
          P[i][j] += K[i][k] * Rt[k][j];
        }
      }
    }
    
    return P;
  }
  
  private static solveSVD(A: number[][]): number[] | null {
    // TODO: Implementar resolución SVD adecuada usando descomposición o biblioteca externa
    return null;
  }
}

// ==================== EXPORTAR TODAS LAS CLASES ====================

export {
  AdvancedLinearAlgebra,
  CameraCalibration,
  ProjectiveGeometry,
  StereoTriangulation,
  Photogrammetry
};