import React from 'react';


import './index.css';

import { Routes, Route } from 'react-router-dom';
import Home from './Pages/home';
import DetailsPage from './Pages/details';




function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/details" element={<DetailsPage />} />
    </Routes>
  );
}

export default App;
