// Línea de tiempo unificada y detalle de atención. Fan-out en paralelo a las clínicas con timeout por clínica;
// si alguna no responde se informa en clinicasNoDisponibles y se muestra lo que llegó.
const { listarHabilitadas } = require('../clinicas/empresas');
const { getClinicSource, conTimeout } = require('../clinicas/source');
const { confirmadosPorEmpresa, asegurarBusqueda } = require('./vinculos');
const cache = require('./atencionesCache');
const { sealId, openId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');
const logger = require('../lib/logger');

const TIPOS = {
  A: { tipo: 'ambulatorio', tipoLabel: 'Ambulatorio' },
  I: { tipo: 'internacion', tipoLabel: 'Internación' },
  H: { tipo: 'hospital_dia', tipoLabel: 'Hospital de día' }
};

const tipoDe = (clase) => TIPOS[clase] || { tipo: 'otro', tipoLabel: 'Atención' };

function publicar(idCuenta, empresa, v) {
  const secciones = new Set(empresa.seccionesVisibles);
  return {
    id: sealId({ c: idCuenta, e: empresa.idEmpresa, v: v.numeroVisita }),
    clinica: { id: empresa.idEmpresa, nombre: empresa.nombre },
    centro: v.centro || null,
    ...tipoDe(v.clase),
    fechaIngreso: v.fechaIngreso,
    horaIngreso: v.horaIngreso || null,
    fechaEgreso: v.fechaEgreso && v.fechaEgreso !== v.fechaIngreso ? v.fechaEgreso : null,
    servicio: v.servicio || null,
    diagnostico: secciones.has('diagnostico') ? v.diagnostico : null,
    secciones: {
      hcIngreso: secciones.has('hcIngreso') && v.tieneHcIngreso,
      epicrisis: secciones.has('epicrisis') && v.tieneEpicrisis
    }
  };
}

async function listar(cuenta, filtros = {}) {
  await asegurarBusqueda(cuenta).catch((err) => logger.warn('vinculos_rebusqueda_error', { idCuenta: cuenta.id, error: err.message }));
  const [empresas, vinculos] = await Promise.all([listarHabilitadas(), confirmadosPorEmpresa(cuenta.id)]);
  const objetivo = empresas.filter((e) => vinculos.has(e.idEmpresa));
  const source = getClinicSource();

  const resultados = await Promise.allSettled(
    objetivo.map(async (empresa) => {
      const cached = cache.get(cuenta.id, empresa.idEmpresa);
      if (cached) return cached;
      const filas = await conTimeout(source.listarAtenciones(empresa.idEmpresa, vinculos.get(empresa.idEmpresa)));
      // Un vacío no se cachea: puede ser una atención recién cargada en la clínica y no cuesta reconsultar.
      if (filas.length) cache.set(cuenta.id, empresa.idEmpresa, filas);
      return filas;
    })
  );

  const clinicasNoDisponibles = [];
  let atenciones = [];
  objetivo.forEach((empresa, i) => {
    const r = resultados[i];
    if (r.status === 'rejected') {
      logger.warn('atenciones_clinica_no_disponible', { idEmpresa: empresa.idEmpresa, code: r.reason?.code });
      clinicasNoDisponibles.push({ id: empresa.idEmpresa, nombre: empresa.nombre });
      return;
    }
    atenciones.push(...r.value.map((v) => publicar(cuenta.id, empresa, v)));
  });

  if (filtros.clinica) atenciones = atenciones.filter((a) => a.clinica.id === Number(filtros.clinica));
  if (filtros.tipo) atenciones = atenciones.filter((a) => a.tipo === filtros.tipo);
  if (filtros.desde) atenciones = atenciones.filter((a) => a.fechaIngreso >= filtros.desde);
  if (filtros.hasta) atenciones = atenciones.filter((a) => a.fechaIngreso <= filtros.hasta);
  atenciones.sort((a, b) => `${b.fechaIngreso}${b.horaIngreso || ''}`.localeCompare(`${a.fechaIngreso}${a.horaIngreso || ''}`));

  return {
    atenciones,
    clinicas: objetivo.map((e) => ({ id: e.idEmpresa, nombre: e.nombre })),
    clinicasNoDisponibles
  };
}

const publicadoSegunDemora = (fecha, horas) => !horas || (fecha && Date.now() - Date.parse(`${fecha}T00:00:00Z`) >= horas * 3_600_000);

async function detalle(cuenta, idOpaco) {
  const ref = openId(idOpaco);
  if (!ref || ref.c !== cuenta.id) throw notFound('Atención no encontrada');

  const [empresas, vinculos] = await Promise.all([listarHabilitadas(), confirmadosPorEmpresa(cuenta.id)]);
  const empresa = empresas.find((e) => e.idEmpresa === ref.e);
  const ids = vinculos.get(ref.e);
  if (!empresa || !ids?.length) throw notFound('Atención no encontrada');

  let d;
  try {
    d = await conTimeout(getClinicSource().detalleAtencion(empresa.idEmpresa, ref.v, ids));
  } catch (err) {
    logger.warn('detalle_clinica_no_disponible', { idEmpresa: empresa.idEmpresa, code: err.code });
    const e = new Error(`${empresa.nombre} no está disponible ahora. Probá de nuevo en unos minutos.`);
    e.status = 503;
    e.code = 'CLINICA_NO_DISPONIBLE';
    throw e;
  }
  if (!d) throw notFound('Atención no encontrada');

  const secciones = new Set(empresa.seccionesVisibles);
  const epicrisis = secciones.has('epicrisis')
    ? d.epicrisis.filter((ep) => publicadoSegunDemora(ep.fecha, empresa.demoraPublicacionHoras))
    : [];
  const base = publicar(cuenta.id, empresa, { ...d, tieneHcIngreso: d.hcIngreso.length > 0, tieneEpicrisis: epicrisis.length > 0 });

  return {
    ...base,
    id: idOpaco,
    profesional: d.hcIngreso.find((h) => h.profesional)?.profesional || epicrisis.find((e) => e.profesional)?.profesional || null,
    diagnosticoEgreso: secciones.has('diagnostico') ? d.diagnosticoEgreso || null : null,
    hcIngreso: secciones.has('hcIngreso') ? d.hcIngreso : [],
    epicrisis,
    _ref: { idEmpresa: empresa.idEmpresa, numeroVisita: ref.v }
  };
}

module.exports = { listar, detalle };
