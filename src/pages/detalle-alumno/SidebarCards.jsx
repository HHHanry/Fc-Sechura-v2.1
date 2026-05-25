import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, Badge, EmptyState, Skeleton } from '../../components/ui';
import { useMisionesDeAlumno } from '../../hooks/useMisiones';
import { useCompetenciasDeAlumno } from '../../hooks/useCompetencias';
import { useCanteraDeAlumno } from '../../hooks/useCantera';
import {
  MISION_ESTADOS, MISION_AREAS_LIST,
  POSICIONES, COMPETENCIAS_POR_POSICION, NIVELES_COMPETENCIA,
  POTENCIAL,
} from '../../config/businessRules';

const sideCardHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'var(--sn-space-4) var(--sn-space-5)',
  borderBottom: '1px solid var(--sn-border-faint)',
};

const eyebrowStyle = {
  fontSize: 'var(--sn-fs-xs)', fontWeight: 800,
  letterSpacing: 'var(--sn-tracking-mega)',
  color: 'var(--sn-brand-glow)', textTransform: 'uppercase',
};

const sideCardTitleStyle = {
  fontFamily: 'var(--sn-font-display)', fontWeight: 700,
  color: 'var(--sn-text-primary)', fontSize: 'var(--sn-fs-md)',
};

const linkPillStyle = {
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--sn-radius-pill)',
  background: 'color-mix(in srgb, var(--sn-brand-glow) 12%, transparent)',
  border: '1px solid var(--sn-border-glow)',
  color: 'var(--sn-brand-glow)',
  fontSize: 'var(--sn-fs-xs)', fontWeight: 700,
  textDecoration: 'none', letterSpacing: 'var(--sn-tracking-wide)',
  whiteSpace: 'nowrap',
};

const PlanRow = ({ label, tone, texto }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <Badge tone={tone}>{label}</Badge>
    <div style={{ color: 'var(--sn-text-primary)', fontWeight: 600, fontSize: 'var(--sn-fs-sm)', lineHeight: 1.35 }}>
      {texto}
    </div>
  </div>
);

/* =====================================================
   PlanVivoCard — Resumen Fase 2
   ===================================================== */
export const PlanVivoCard = ({ alumnoId }) => {
  const { misiones, loading } = useMisionesDeAlumno(alumnoId);

  const activa = misiones.find(
    (m) => m.estado === MISION_ESTADOS.EN_PROCESO || m.estado === MISION_ESTADOS.NO_LOGRADO,
  );
  const ultimaLograda = misiones.find(
    (m) => m.estado === MISION_ESTADOS.LOGRADO || m.estado === MISION_ESTADOS.DESTACADO,
  );
  const conteoArea = {};
  misiones.forEach((m) => { if (m.area) conteoArea[m.area] = (conteoArea[m.area] ?? 0) + 1; });
  const areaTop = Object.entries(conteoArea).sort((a, b) => b[1] - a[1])[0]?.[0];
  const areaTopLabel = MISION_AREAS_LIST.find((a) => a.value === areaTop)?.label;

  return (
    <Card>
      <CardBody style={{ padding: 0 }}>
        <div style={sideCardHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Plan vivo</div>
            <div style={sideCardTitleStyle}>Misiones del jugador</div>
          </div>
          <Link to="/misiones" state={{ alumno: { id: alumnoId } }} style={linkPillStyle}>
            Gestionar →
          </Link>
        </div>
        <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)' }}>
          {loading ? (
            <Skeleton height={70} />
          ) : misiones.length === 0 ? (
            <EmptyState title="Sin misiones" description="Asígnale la primera misión desde la sección plan vivo." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
              {activa && <PlanRow label="Activa" tone="warn" texto={activa.descripcion} />}
              {ultimaLograda && <PlanRow label="Última lograda" tone="success" texto={ultimaLograda.descripcion} />}
              {areaTopLabel && <PlanRow label="Área más repetida" tone="brand" texto={areaTopLabel} />}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

/* =====================================================
   CompetenciasCard — Resumen Fase 3
   ===================================================== */
const POSICIONES_LABEL = {
  [POSICIONES.PORTERO]: 'Portero',
  [POSICIONES.DEFENSA]: 'Defensa',
  [POSICIONES.VOLANTE]: 'Volante',
  [POSICIONES.DELANTERO]: 'Delantero',
};

export const CompetenciasCard = ({ alumnoId }) => {
  const { competencias, loading } = useCompetenciasDeAlumno(alumnoId);

  const resumen = useMemo(() => {
    if (!competencias?.competencias) return null;
    const pos = competencias.posicion;
    const comps = COMPETENCIAS_POR_POSICION[pos] ?? [];
    const vals = comps.map((c) => competencias.competencias[c] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const nivel = NIVELES_COMPETENCIA.slice().reverse().find((n) => avg >= n.value) ?? NIVELES_COMPETENCIA[0];
    const mejor = comps.reduce((best, c) =>
      (competencias.competencias[c] ?? 0) > (competencias.competencias[best] ?? 0) ? c : best
    , comps[0]);
    return { pos, avg, nivel, mejor, mejorVal: competencias.competencias[mejor] ?? 0 };
  }, [competencias]);

  return (
    <Card>
      <CardBody style={{ padding: 0 }}>
        <div style={sideCardHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Competencias</div>
            <div style={sideCardTitleStyle}>Mapa por posición</div>
          </div>
          <Link to="/competencias" state={{ alumno: { id: alumnoId } }} style={linkPillStyle}>
            Evaluar →
          </Link>
        </div>
        <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)' }}>
          {loading ? (
            <Skeleton height={70} />
          ) : !resumen ? (
            <EmptyState title="Sin evaluación" description="Evalúa las competencias de este jugador desde la sección Competencias." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
              <PlanRow label="Posición" tone="brand" texto={POSICIONES_LABEL[resumen.pos] ?? resumen.pos} />
              <PlanRow label="Nivel global" tone={resumen.avg >= 3.5 ? 'elite' : resumen.avg >= 2.5 ? 'success' : 'info'} texto={`${resumen.nivel.label} (${resumen.avg.toFixed(1)})`} />
              <PlanRow label="Mejor competencia" tone="elite" texto={`${resumen.mejor} (${resumen.mejorVal}/4)`} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

/* =====================================================
   CanteraCard — Resumen Fase 4
   ===================================================== */
export const CanteraCard = ({ alumnoId }) => {
  const { cantera, loading } = useCanteraDeAlumno(alumnoId);
  const potInfo = cantera ? POTENCIAL.find((p) => p.value === cantera.potencial) : null;

  return (
    <Card>
      <CardBody style={{ padding: 0 }}>
        <div style={sideCardHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Cantera</div>
            <div style={sideCardTitleStyle}>Proyección</div>
          </div>
          <Link to="/cantera" state={{ alumno: { id: alumnoId } }} style={linkPillStyle}>
            Evaluar →
          </Link>
        </div>
        <div style={{ padding: 'var(--sn-space-4) var(--sn-space-5)' }}>
          {loading ? (
            <Skeleton height={70} />
          ) : !cantera ? (
            <EmptyState title="Sin evaluación" description="Evalúa el potencial de este jugador desde la sección Cantera." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sn-space-3)' }}>
              {potInfo && (
                <PlanRow
                  label="Potencial"
                  tone={cantera.potencial === 'elite' ? 'elite' : cantera.potencial === 'alto' ? 'success' : 'info'}
                  texto={potInfo.label}
                />
              )}
              {cantera.alertas?.length > 0 && (
                <PlanRow label="Alertas" tone="warn" texto={cantera.alertas.join(', ')} />
              )}
              {cantera.notas && (
                <div style={{ fontSize: 'var(--sn-fs-xs)', color: 'var(--sn-text-muted)', fontStyle: 'italic' }}>
                  "{cantera.notas.length > 80 ? cantera.notas.slice(0, 80) + '…' : cantera.notas}"
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
