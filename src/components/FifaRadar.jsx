import React from 'react';

// === RADAR SVG ARTESANAL (Optimizado para Alta Gama) ===
const FifaRadar = ({ stats, themeColor = 'var(--sn-text-primary)' }) => {
  // Las 6 estadísticas clásicas de FIFA
  const attributes = [
    { key: 'pac', label: 'RITMO', value: stats?.ritmo || 50 },
    { key: 'sho', label: 'TIRO', value: stats?.tiro || 50 },
    { key: 'pas', label: 'PASE', value: stats?.pase || 50 },
    { key: 'dri', label: 'REGATE', value: stats?.regate || 50 },
    { key: 'def', label: 'DEFENSA', value: stats?.defensa || 50 },
    { key: 'phy', label: 'FÍSICO', value: stats?.fisico || 50 },
  ];

  const size = 250;
  const center = size / 2;
  const radius = size / 2.5;

  // Matemática para dibujar el hexágono
  const getCoordinatesForValue = (value, index) => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const x = center + (radius * (value / 100)) * Math.cos(angle);
    const y = center + (radius * (value / 100)) * Math.sin(angle);
    return `${x},${y}`;
  };

  const polygonPoints = attributes.map((attr, i) => getCoordinatesForValue(attr.value, i)).join(' ');
  const backgroundPolygon = attributes.map((_, i) => getCoordinatesForValue(100, i)).join(' ');
  const midPolygon = attributes.map((_, i) => getCoordinatesForValue(50, i)).join(' ');

  // Rejilla y fondo tokenizados: se adaptan a claro/oscuro sin adivinar el tema.
  const gridColor = 'var(--sn-border-strong)';
  const bgColor = 'color-mix(in srgb, var(--sn-brand-glow) 7%, transparent)';

  return (
    <div className="d-flex justify-content-center align-items-center position-relative mx-auto" style={{ width: '100%', maxWidth: '300px', height: '300px' }}>
      
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{overflow: 'visible'}}>
        
        {/* Fondos del Radar */}
        <polygon points={backgroundPolygon} fill={bgColor} stroke={gridColor} strokeWidth="1.5" />
        <polygon points={midPolygon} fill="none" stroke={gridColor} strokeWidth="1" strokeDasharray="3 3" />
        
        {/* Ejes (Telaraña) */}
        {attributes.map((_, i) => {
          const edge = getCoordinatesForValue(100, i).split(',');
          return <line key={`l-${i}`} x1={center} y1={center} x2={edge[0]} y2={edge[1]} stroke={gridColor} strokeWidth="1" />;
        })}

        {/* Polígono de Estadísticas Reales (El relleno Neón Azul/Dorado) */}
        <polygon
          points={polygonPoints}
          fill="color-mix(in srgb, var(--sn-brand-glow) 32%, transparent)"
          stroke="var(--sn-brand-glow)"
          strokeWidth="2.5"
          style={{ transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
        />

        {/* Puntos brillantes en los vértices */}
        {attributes.map((attr, i) => {
          const pt = getCoordinatesForValue(attr.value, i).split(',');
          return <circle key={`c-${i}`} cx={pt[0]} cy={pt[1]} r="4" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />;
        })}
      </svg>

      {/* Etiquetas alrededor del radar */}
      {attributes.map((attr, i) => {
        // Expandimos un poco más el radio (125%) para que las letras no choquen con el gráfico
        const pt = getCoordinatesForValue(125, i).split(','); 
        return (
          <div key={`lbl-${i}`} className="position-absolute text-center" 
               style={{ 
                 left: `${(pt[0] / size) * 100}%`, 
                 top: `${(pt[1] / size) * 100}%`, 
                 transform: 'translate(-50%, -50%)', 
                 width: '60px' 
               }}>
            <div className="fw-black lh-1 fs-5" style={{ color: themeColor }}>{attr.value}</div>
            <div className="fw-bold lh-1 mt-1" style={{ fontSize: '0.65rem', color: themeColor, opacity: 0.8 }}>{attr.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default FifaRadar;