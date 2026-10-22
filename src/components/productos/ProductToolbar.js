// src/components/productos/ProductToolbar.js
import React from 'react';
import {
  FiBarChart2, FiCamera, FiClock, FiDroplet, FiFileText, FiMessageCircle, FiPackage, FiTruck, FiUserCheck, FiMaximize,
} from 'react-icons/fi';

/**
 * Barra de herramientas de Productos: todas las acciones visibles, agrupadas por tema.
 * Solo presenta botones; cada accion recibe el handler existente de Productos.
 */
export default function ProductToolbar({
  onRecojo, onAdelantar, onMensajeVenta, onPersonal,
  onAnalisis, onFotos, onScanner, onMarcaAgua, onDec, onFacu,
  sellerAssign,
}) {
  const grupos = [
    {
      titulo: 'Ventas y recojo',
      acciones: [
        { label: 'Registrar recojo', icon: FiTruck, onClick: onRecojo, title: 'Elige los paquetes que recogiste de Eshopex y genera el mensaje para WhatsApp', primary: true },
        { label: 'Adelantar venta', icon: FiClock, onClick: onAdelantar, title: 'Registra una venta de un equipo que todavía no llega' },
        { label: 'Mensaje de venta', icon: FiMessageCircle, onClick: onMensajeVenta, title: 'Genera el texto de venta para WhatsApp' },
      ],
    },
    {
      titulo: 'Paquetes y fotos',
      acciones: [
        { label: 'Paquetes personales', icon: FiPackage, onClick: onPersonal, title: 'Ver los paquetes personales guardados desde Eshopex' },
        { label: 'Fotos Eshopex', icon: FiCamera, onClick: onFotos, title: 'Buscar fotos con un tracking y una fecha' },
        { label: 'Escanear SN / IMEI', icon: FiMaximize, onClick: onScanner, title: 'Leer el número de serie o IMEI desde una imagen' },
        { label: 'Marca de agua', icon: FiDroplet, onClick: onMarcaAgua, title: 'Poner la marca de agua a varias fotos' },
      ],
    },
    {
      titulo: 'Documentos',
      acciones: [
        { label: 'DEC', icon: FiFileText, onClick: onDec, title: 'Crear la DEC o comprobante' },
        { label: 'FACU', icon: FiFileText, onClick: onFacu, title: 'Crear la FACU' },
        { label: 'Análisis', icon: FiBarChart2, onClick: onAnalisis, title: 'Ir al módulo de Análisis' },
        ...(sellerAssign ? [{ label: `Asignar vendedor (${sellerAssign.count})`, icon: FiUserCheck, onClick: sellerAssign.onClick, title: `Asignar vendedor a ${sellerAssign.count} paquetes sin vendedor` }] : []),
      ],
    },
  ];

  return (
    <div className="ux-product-toolbar" role="toolbar" aria-label="Herramientas de productos">
      {grupos.map(({ titulo, acciones }) => (
        <div key={titulo} className="ux-tool-group" role="group" aria-label={titulo}>
          <span className="ux-tool-group-title">{titulo}</span>
          <div className="ux-tool-group-items">
            {acciones.map(({ label, icon: Icon, onClick, title, primary }) => (
              <button key={label} type="button" onClick={onClick} title={title} className={`ux-tool ${primary ? 'ux-tool--primary' : ''}`}>
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
