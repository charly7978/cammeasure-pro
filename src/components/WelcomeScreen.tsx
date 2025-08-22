import { useState, useEffect } from 'react';
import { Camera, Ruler, Target, Zap, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onStart();
    }, 500);
  };

  if (!isVisible) return null;

  return (
    <div className={`welcome-screen ${isExiting ? 'ar-fade-out' : ''}`}>
      {/* Efectos de partículas flotantes */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/20 rounded-full ar-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 max-w-lg mx-auto px-6 text-center">
        {/* Logo animado */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-blue-600 to-purple-600 opacity-50 animate-pulse" />
          <div className="relative bg-gradient-to-br from-gray-900 to-black p-6 rounded-3xl border border-gray-800">
            <div className="flex justify-center items-center gap-3 mb-4">
              <Camera className="w-12 h-12 text-blue-400" />
              <Ruler className="w-12 h-12 text-purple-400 ar-float" />
              <Target className="w-12 h-12 text-green-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              CamMeasure Pro
            </h1>
            <p className="text-gray-400 mt-2">Realidad Aumentada Avanzada</p>
          </div>
        </div>

        {/* Características */}
        <div className="space-y-4 mb-8">
          <div className="ar-transparent rounded-xl p-4 ar-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-yellow-400" />
              <div className="text-left">
                <h3 className="font-semibold text-white">Medición en Tiempo Real</h3>
                <p className="text-sm text-gray-400">Detecta y mide objetos instantáneamente</p>
              </div>
            </div>
          </div>

          <div className="ar-transparent rounded-xl p-4 ar-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-green-400" />
              <div className="text-left">
                <h3 className="font-semibold text-white">Calibración Inteligente</h3>
                <p className="text-sm text-gray-400">Precisión milimétrica con IA</p>
              </div>
            </div>
          </div>

          <div className="ar-transparent rounded-xl p-4 ar-fade-in" style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <div className="text-left">
                <h3 className="font-semibold text-white">Modo AR Inmersivo</h3>
                <p className="text-sm text-gray-400">Experiencia visual futurista</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de inicio */}
        <Button
          onClick={handleStart}
          size="lg"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                     text-white font-semibold py-6 rounded-xl shadow-2xl shadow-purple-600/20 
                     transform hover:scale-105 transition-all duration-300 ar-fade-in"
          style={{ animationDelay: '0.8s' }}
        >
          <span className="text-lg">Iniciar Experiencia AR</span>
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>

        <p className="text-xs text-gray-500 mt-4 ar-fade-in" style={{ animationDelay: '1s' }}>
          Asegúrate de permitir el acceso a la cámara
        </p>
      </div>

      {/* Efecto de gradiente animado de fondo */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-tl from-green-900/10 via-transparent to-orange-900/10 animate-pulse" 
             style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
};

export default WelcomeScreen;