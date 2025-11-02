import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Productos from './pages/Productos';
import Servicios from './pages/Servicios';
import Calculadora from './pages/Calculadora';
import Ganancias from './pages/Ganancias';
import Analisis from './pages/Analisis';
import GastosIndex from './pages/GastosIndex';
import api from './api';

function App() {
  // Leer la última vista guardada; si no hay, usa 'home'
  const [vista, setVista] = useState(() => localStorage.getItem('vista') || 'home');
  const [analisisBack, setAnalisisBack] = useState('home');

  // Guardar la vista cada vez que cambie
  useEffect(() => {
    localStorage.setItem('vista', vista);
  }, [vista]);

  // Si hay token en localStorage, deja el header Authorization por defecto (axios)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && api?.defaults) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }, []);

  return (
    <>
      {vista === 'home'        && <Home setVista={setVista} setAnalisisBack={setAnalisisBack} />}
      {vista === 'productos'   && <Productos setVista={setVista} setAnalisisBack={setAnalisisBack} />} 
      {vista === 'servicios'   && <Servicios setVista={setVista} />}
      {vista === 'calculadora' && <Calculadora setVista={setVista} />}
      {vista === 'ganancias'   && <Ganancias setVista={setVista} />}
      {vista === 'gastos'      && <GastosIndex setVista={setVista} />}
      {vista === 'analisis'    && <Analisis setVista={setVista} analisisBack={analisisBack} />}
    </>
  );
}

export default App;
