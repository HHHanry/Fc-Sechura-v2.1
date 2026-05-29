import React, { useMemo, useState } from 'react';
import { Modal, Button } from '../../components/ui';
import { ubigeoPeru, calcularEdad } from './ubigeo';
import { CATEGORIAS } from '../../config/businessRules';
import { toast } from '../../hooks/useToast';

const FOTO_MAX_BYTES = 550_000;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const initialState = (hoy) => ({
  nombre: '', apellido: '', edad: '', categoria: '6', dni: '', fechaNacimiento: '',
  apoderado: '', celular: '', colegio: '',
  pais: 'PerÃº', departamento: 'Piura', provincia: 'Sechura', distrito: 'Sechura', direccion: '',
  foto: null, fechaInscripcion: hoy, vencimientoMensualidad: hoy,
});

export const AlumnoForm = ({ open, modoEdicion, alumno, hoy, onSubmit, onClose, alumnosExistentes = [], cargando = false }) => {
  const [formData, setFormData] = useState(() => alumno ? { ...alumno } : initialState(hoy));
  const [archivoFoto, setArchivoFoto] = useState(null);

  // Sincroniza el form cuando se abre con un alumno distinto
  React.useEffect(() => {
    setFormData(alumno ? {
      ...alumno,
      pais: alumno.pais || 'PerÃº',
      departamento: alumno.departamento || 'Piura',
      provincia: alumno.provincia || alumno.ciudad || 'Sechura',
      distrito: alumno.distrito || 'Sechura',
      fechaInscripcion: alumno.fechaInscripcion || hoy,
      vencimientoMensualidad: alumno.vencimientoMensualidad || hoy,
    } : initialState(hoy));
    setArchivoFoto(null);
  }, [alumno, hoy, open]);

  const departamentos = useMemo(() => Object.keys(ubigeoPeru[formData.pais] || {}), [formData.pais]);
  const provincias    = useMemo(() => formData.departamento ? Object.keys(ubigeoPeru[formData.pais]?.[formData.departamento] || {}) : [], [formData.pais, formData.departamento]);
  const distritos     = useMemo(() => formData.provincia ? (ubigeoPeru[formData.pais]?.[formData.departamento]?.[formData.provincia] || []) : [], [formData.pais, formData.departamento, formData.provincia]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = { ...formData, [name]: value };

    if (name === 'fechaNacimiento') next.edad = calcularEdad(value);
    if (name === 'fechaInscripcion' && !modoEdicion) next.vencimientoMensualidad = value;

    if (name === 'pais') {
      const dep = Object.keys(ubigeoPeru[value])[0];
      const prv = Object.keys(ubigeoPeru[value][dep])[0];
      next = { ...next, departamento: dep, provincia: prv, distrito: ubigeoPeru[value][dep][prv][0] };
    }
    if (name === 'departamento') {
      const prv = Object.keys(ubigeoPeru[formData.pais][value])[0];
      next = { ...next, provincia: prv, distrito: ubigeoPeru[formData.pais][value][prv][0] };
    }
    if (name === 'provincia') {
      next = { ...next, distrito: ubigeoPeru[formData.pais][formData.departamento][value][0] };
    }
    setFormData(next);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > FOTO_MAX_BYTES) {
      toast.warn(`La foto pesa ${(f.size / 1024).toFixed(0)}KB. Maximo permitido: 550KB.`);
      e.target.value = '';
      return;
    }
    setArchivoFoto(f);
    setFormData((prev) => ({ ...prev, foto: URL.createObjectURL(f) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modoEdicion) {
      const dniDuplicado = alumnosExistentes.some((a) => a.dni === formData.dni);
      if (dniDuplicado) {
        toast.error('Este DNI ya estÃ¡ registrado en el sistema.');
        return;
      }
    }
    let fotoFinal = formData.foto;
    if (archivoFoto) fotoFinal = await fileToBase64(archivoFoto);

    onSubmit({ ...formData, foto: fotoFinal });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={modoEdicion ? 'Editar ficha del alumno' : 'Registrar nuevo alumno'}
      description={modoEdicion ? 'Modifica los datos. Los cambios se reflejarÃ¡n al guardar.' : 'Completa la ficha del nuevo jugador. El estado de cuenta nace como pendiente.'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button type="submit" form="sn-alumno-form" variant="primary" loading={cargando}>
            {modoEdicion ? 'Actualizar ficha' : 'Generar registro'}
          </Button>
        </>
      }
    >
      <form id="sn-alumno-form" onSubmit={handleSubmit} noValidate>
        <Section title="1. Datos personales" required>
          <Grid cols={2}>
            <Field label="Nombres" name="nombre" value={formData.nombre} onChange={handleChange} required />
            <Field label="Apellidos" name="apellido" value={formData.apellido} onChange={handleChange} required />
          </Grid>
          <Grid cols={3}>
            <Field label="DNI" name="dni" value={formData.dni} onChange={handleChange} maxLength={8} disabled={modoEdicion} required />
            <Field label="Fecha de nacimiento" type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required />
            <Field label="Edad calculada" name="edad" value={formData.edad} readOnly placeholder="â€”" />
          </Grid>
        </Section>

        <Section title="2. Residencia">
          <Grid cols={4}>
            <Select label="PaÃ­s" name="pais" value={formData.pais} onChange={handleChange} required options={Object.keys(ubigeoPeru)} />
            <Select label="Departamento" name="departamento" value={formData.departamento} onChange={handleChange} required options={departamentos} />
            <Select label="Provincia" name="provincia" value={formData.provincia} onChange={handleChange} required options={provincias} />
            <Select label="Distrito" name="distrito" value={formData.distrito} onChange={handleChange} required options={distritos} highlight />
          </Grid>
        </Section>

        <Section title="3. AcadÃ©mico y contacto">
          <Grid cols={3}>
            <Field label="Celular (WhatsApp)" name="celular" value={formData.celular} onChange={handleChange} placeholder="Opcional" />
            <Field label="DirecciÃ³n especÃ­fica" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Calle, Mz, Lote..." />
            <Field label="InstituciÃ³n educativa" name="colegio" value={formData.colegio} onChange={handleChange} placeholder="Opcional" />
          </Grid>
          <Grid cols={2}>
            <Field label="Apoderado responsable" name="apoderado" value={formData.apoderado} onChange={handleChange} required placeholder="Obligatorio (contacto de emergencia)" />
            <Select label="CategorÃ­a deportiva" name="categoria" value={formData.categoria} onChange={handleChange} required
              options={CATEGORIAS} renderOption={(c) => `Cat. ${c}`}
            />
          </Grid>
        </Section>

        <Section title="4. ParÃ¡metros de facturaciÃ³n" highlight>
          <Grid cols={2}>
            <Field label="Fecha de inscripciÃ³n" type="date" name="fechaInscripcion" value={formData.fechaInscripcion} onChange={handleChange} required
              hint={!modoEdicion ? 'El estado nace como PENDIENTE hasta que registre su primer pago en Caja.' : null}
            />
            <Field label="Vencimiento del mes (corte)" type="date" name="vencimientoMensualidad" value={formData.vencimientoMensualidad} onChange={handleChange} required
              hint="Por defecto coincide con la inscripciÃ³n. Avanza al cobrar."
            />
          </Grid>
        </Section>

        <Section title="5. Foto del jugador">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sn-space-4)', flexWrap: 'wrap' }}>
            <div style={fotoPreviewStyle}>
              {formData.foto
                ? <img src={formData.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)' }}>Sin foto</span>}
            </div>
            <input type="file" accept="image/*" onChange={handleFile} style={fileInputStyle} className="sn-focusable" />
          </div>
        </Section>
      </form>
    </Modal>
  );
};

/* ============= sub-elementos ============ */

const Section = ({ title, required, highlight, children }) => (
  <div style={{
    marginBottom: 'var(--sn-space-5)',
    paddingTop: 'var(--sn-space-2)',
    paddingBottom: 'var(--sn-space-3)',
    borderTop: '1px solid var(--sn-border-faint)',
    ...(highlight ? {
      background: 'rgba(167,139,250,0.06)',
      border: '1px solid var(--sn-border-glow)',
      borderRadius: 'var(--sn-radius-md)',
      padding: 'var(--sn-space-4)',
    } : null),
  }}>
    <h4 style={{
      margin: '0 0 var(--sn-space-3)',
      fontSize: 'var(--sn-fs-xs)',
      fontWeight: 800,
      letterSpacing: 'var(--sn-tracking-mega)',
      color: highlight ? 'var(--sn-brand-glow)' : 'var(--sn-text-muted)',
    }}>{title}{required && <span style={{ color: 'var(--sn-crit)' }}> *</span>}</h4>
    {children}
  </div>
);

const Grid = ({ cols = 2, children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 4 ? 160 : cols === 3 ? 200 : 240}px, 1fr))`,
    gap: 'var(--sn-space-4)',
    marginBottom: 'var(--sn-space-3)',
  }}>{children}</div>
);

const Field = ({ label, hint, ...rest }) => (
  <label style={{ display: 'block' }}>
    <span style={fieldLabelStyle}>{label}{rest.required && <span style={{ color: 'var(--sn-crit)' }}> *</span>}</span>
    <input {...rest} className="sn-focusable" style={inputStyle} />
    {hint && <span style={hintStyle}>{hint}</span>}
  </label>
);

const Select = ({ label, options = [], renderOption, highlight, ...rest }) => (
  <label style={{ display: 'block' }}>
    <span style={fieldLabelStyle}>{label}{rest.required && <span style={{ color: 'var(--sn-crit)' }}> *</span>}</span>
    <select {...rest} className="sn-focusable" style={{ ...inputStyle, ...(highlight ? { borderColor: 'var(--sn-brand-glow)', color: 'var(--sn-brand-glow)', fontWeight: 700 } : null) }}>
      {options.map((o) => <option key={o} value={o}>{renderOption ? renderOption(o) : o}</option>)}
    </select>
  </label>
);

/* ============= styles ============ */

const fieldLabelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  letterSpacing: 'var(--sn-tracking-wide)',
  color: 'var(--sn-text-secondary)',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-primary)',
  fontFamily: 'var(--sn-font-ui)',
  fontSize: 'var(--sn-fs-base)',
  padding: '0.7rem 0.85rem',
  outline: 'none',
  transition: 'border-color var(--sn-dur-fast) var(--sn-ease)',
};

const hintStyle = {
  display: 'block', marginTop: 6,
  fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)',
};

const fotoPreviewStyle = {
  width: 96, height: 96,
  borderRadius: 'var(--sn-radius-md)',
  background: 'var(--sn-input-bg)',
  border: '1px dashed var(--sn-border-soft)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  overflow: 'hidden',
};

const fileInputStyle = {
  flex: 1, minWidth: 240,
  background: 'var(--sn-input-bg)',
  border: '1px solid var(--sn-border-soft)',
  borderRadius: 'var(--sn-radius-md)',
  color: 'var(--sn-text-secondary)',
  padding: '0.6rem 0.75rem',
  fontFamily: 'var(--sn-font-ui)',
};
