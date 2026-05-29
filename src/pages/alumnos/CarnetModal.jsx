import React from 'react';
import { Modal, Button } from '../../components/ui';

const FRENTE_ID  = 'sn-carnet-frente';
const REVERSO_ID = 'sn-carnet-reverso';

const imprimirCR80 = () => {
  const v = window.open('', '_blank', 'noopener,noreferrer');
  if (!v) return;
  const frente  = document.getElementById(FRENTE_ID)?.innerHTML ?? '';
  const reverso = document.getElementById(REVERSO_ID)?.innerHTML ?? '';
  v.document.write(`
    <html>
      <head>
        <title>Carnet FC Sechura</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Inter:wght@400;700&display=swap');
          @page { size: A4; margin: 1cm; }
          body { font-family: 'Inter', sans-serif; background: white; display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 0; padding: 20px; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
          .carnet-id-horizontal { width: 8.54cm; height: 5.4cm; border-radius: 8px; overflow: hidden; display: flex; border: 1px solid #cbd5e1; position: relative; }
          .carnet-left { width: 35%; background: linear-gradient(135deg, #1A1038 0%, #4C1D95 100%) !important; color: white; padding: 5px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-right: 2px solid #A78BFA; }
          .carnet-right { width: 65%; background: #ffffff; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="carnet-id-horizontal">${frente}</div>
        <div class="carnet-id-horizontal" style="flex-direction: column; background: linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%) !important;">${reverso}</div>
        <script>window.onload = () => setTimeout(() => { window.print(); window.close(); }, 400);</script>
      </body>
    </html>
  `);
  v.document.close();
};

export const CarnetModal = ({ alumno, onClose }) => (
  <Modal
    open={!!alumno}
    onClose={onClose}
    size="lg"
    title="Carnet oficial · Vista de impresión"
    description="Tamaño CR80 (8.54 × 5.4 cm). El frente lleva el QR público."
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button variant="primary" onClick={imprimirCR80} icon={<PrinterIcon />}>Mandar a impresión</Button>
      </>
    }
  >
    {alumno && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-4)', alignItems: 'center' }}>
        {/* === FRENTE === */}
        <div id={FRENTE_ID} className="carnet-id-horizontal" style={frenteStyle}>
          <div className="carnet-left" style={leftStyle}>
            <h6 style={brandStyle}>FC SECHURA</h6>
            {alumno.foto ? (
              <img src={alumno.foto} alt="" style={fotoStyle} />
            ) : (
              <div style={{ ...fotoStyle, background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 24 }}>
                {(alumno.nombre ?? '?').charAt(0)}
              </div>
            )}
          </div>
          <div className="carnet-right" style={rightStyle}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 7, color: '#64748b', fontWeight: 'bold' }}>DOC. DE IDENTIDAD DEPORTIVO</span>
            </div>
            <div>
              <div style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Apellidos</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase', lineHeight: 1, fontFamily: 'Montserrat, sans-serif' }}>{alumno.apellido}</div>
              <div style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4 }}>Nombres</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', lineHeight: 1 }}>{alumno.nombre}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 5 }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold' }}>DNI</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#1e293b' }}>{alumno.dni}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold' }}>EDAD</div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#1e293b' }}>{alumno.edad} A.</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold' }}>CATEGORÍA</div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#0d9488' }}>{alumno.categoria}</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                {alumno.qr && <img src={alumno.qr} alt="QR" style={{ width: '1.8cm', height: '1.8cm', border: '1px solid #e2e8f0', padding: 2, borderRadius: 4 }} />}
              </div>
            </div>
          </div>
        </div>

        {/* === REVERSO === */}
        <div id={REVERSO_ID} className="carnet-id-horizontal" style={{ ...frenteStyle, flexDirection: 'column', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
          <div style={{ background: '#1e3a8a', color: 'white', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '1.2cm' }}>
            <span style={{ fontSize: 10, fontWeight: 900, fontFamily: 'Montserrat, sans-serif' }}>INFO. DE EMERGENCIA</span>
            <span style={{ fontSize: 12, fontWeight: 'bold' }}>FC SECHURA</span>
          </div>
          <div style={{ padding: '8px 15px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Linea label="APODERADO RESPONSABLE:" valor={alumno.apoderado} />
            <Linea label="CELULAR DE CONTACTO:"   valor={alumno.celular}   azul />
            <Linea label="DIRECCIÓN REGISTRADA:"  valor={`${alumno.direccion ?? ''} - ${alumno.distrito ?? ''}`} pequena />
          </div>
          <div style={{ background: '#f1f5f9', padding: 4, textAlign: 'center', fontSize: 6, color: '#475569', borderTop: '1px solid #e2e8f0' }}>
            Carnet personal e intransferible. Uso obligatorio para entrenamientos y torneos oficiales.
          </div>
          <div style={{ background: '#1A1038', color: '#A78BFA', textAlign: 'center', fontSize: 7, fontWeight: 'bold', letterSpacing: 2, padding: '3px 0' }}>
            DISCIPLINA · HONOR · TALENTO
          </div>
        </div>
      </div>
    )}
  </Modal>
);

const Linea = ({ label, valor, azul, pequena }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ fontSize: 7, color: '#64748b', fontWeight: 'bold' }}>{label}</div>
    <div style={{ fontSize: pequena ? 8 : (azul ? 10 : 9), color: azul ? '#1e3a8a' : '#0f172a', fontWeight: azul ? 900 : 'bold' }}>{valor}</div>
  </div>
);

const PrinterIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>);

const frenteStyle = {
  width: '8.54cm', height: '5.4cm',
  display: 'flex', borderRadius: 8, overflow: 'hidden',
  border: '1px solid #cbd5e1', background: 'white',
  boxShadow: 'var(--sn-shadow-md)',
};

const leftStyle = {
  width: '35%',
  background: 'linear-gradient(135deg, #1A1038 0%, #4C1D95 100%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 5, borderRight: '2px solid #A78BFA',
};

const rightStyle = {
  width: '65%', padding: 10,
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  background: 'white',
};

const brandStyle = {
  margin: '0 0 5px', fontSize: 10, fontWeight: 900,
  color: 'white', fontFamily: 'Montserrat, sans-serif',
};

const fotoStyle = {
  width: '2.2cm', height: '2.2cm',
  borderRadius: '50%',
  border: '2px solid white',
  objectFit: 'cover',
};
