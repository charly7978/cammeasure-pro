import React, { useRef, useState } from 'react';
import MeasureScreen from './components/MeasureScreen';

const App: React.FC = () => {
  return (
    <div style={{ minHeight: '100dvh', background: '#0b1220', color: 'white' }}>
      <MeasureScreen />
    </div>
  );
};

export default App;
