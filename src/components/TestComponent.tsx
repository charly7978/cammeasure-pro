import React from 'react';

export const TestComponent: React.FC = () => {
  return (
    <div className="p-8 text-center">
      <h1 className="text-4xl font-bold text-green-600 mb-4">
        ✅ Aplicación Funcionando
      </h1>
      <p className="text-lg text-gray-600 mb-4">
        La aplicación se ha cargado correctamente
      </p>
      <div className="bg-blue-100 p-4 rounded-lg">
        <p className="text-blue-800">
          Si puedes ver este mensaje, la aplicación está funcionando correctamente.
        </p>
      </div>
    </div>
  );
};
