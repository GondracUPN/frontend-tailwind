import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Productos from './pages/Productos';
import Calculadora from './pages/Calculadora';

function App() {
  // Leer la última vista guardada; si no hay, usa 'home'
  const [vista, setVista] = useState(() => localStorage.getItem('vista') || 'home');

  // Guardar la vista cada vez que cambie
  useEffect(() => {
    localStorage.setItem('vista', vista);
  }, [vista]);

  return (
    <>
      {vista === 'home' && <Home setVista={setVista} />}
      {vista === 'productos' && <Productos setVista={setVista} />}
       {vista === 'calculadora' && <Calculadora setVista={setVista} />}
    </>
  );
}

export default App;
