// Clínicas simuladas para MOCK_MODE: mismas firmas que mssqlSource, datos ficticios.
const { config } = require('../config');
const { normalizeDni } = require('../lib/text');

const SARMIENTO = 101;
const GUEMES = 102;

const demora = () => new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 550)));

// padron[idEmpresa] = [{ idPaciente, dni, nombre, sexo, fechaNacimiento }]
const padron = {
  [GUEMES]: [
    { idPaciente: 5501, dni: '30123456', nombre: 'GOMEZ MARIA LAURA', sexo: 'F', fechaNacimiento: '1985-04-12' },
    // Ficha duplicada de la misma persona (carga repetida en admisión).
    { idPaciente: 5502, dni: '30123456', nombre: 'GOMEZ MARIA L', sexo: 'F', fechaNacimiento: '1985-04-12' }
  ],
  [SARMIENTO]: [
    { idPaciente: 8801, dni: '30123456', nombre: 'GOMEZ, MARIA LAURA', sexo: 'F', fechaNacimiento: '1985-04-12' },
    // Mismo DNI mal cargado: otra persona. Debe quedar descartado.
    { idPaciente: 8802, dni: '30123456', nombre: 'GOMEZ JUAN CARLOS', sexo: 'M', fechaNacimiento: '1950-01-30' }
  ]
};

// visitas[idEmpresa] = [{ numeroVisita, idPaciente, ... }]
const visitas = { [GUEMES]: [], [SARMIENTO]: [] };

const PLANTILLAS = [
  {
    empresa: GUEMES,
    offsetDias: -22,
    hora: '09:40',
    clase: 'A',
    servicio: 'Clínica médica',
    centro: 'Sede Centro',
    diagnostico: { codigo: 'J02.9', descripcion: 'Faringitis aguda, no especificada' },
    hcIngreso: {
      motivoConsulta: 'Dolor de garganta y fiebre de 38,5 °C de 48 horas de evolución.',
      enfermedadActual:
        'Paciente que consulta por odinofagia progresiva, fiebre y malestar general. Niega tos y dificultad respiratoria. Al examen: fauces congestivas sin exudado, sin adenopatías palpables.',
      profesional: 'Dra. Paula Fernández',
      sector: 'Consultorios externos'
    }
  },
  {
    empresa: SARMIENTO,
    offsetDias: -65,
    hora: '17:15',
    clase: 'A',
    servicio: 'Traumatología',
    centro: 'Sede Sarmiento',
    diagnostico: { codigo: 'S93.4', descripcion: 'Esguince y torcedura del tobillo' },
    hcIngreso: {
      motivoConsulta: 'Dolor e inflamación en tobillo derecho tras torcedura jugando al fútbol.',
      enfermedadActual:
        'Traumatismo por inversión del tobillo derecho hace 3 horas. Edema perimaleolar externo, dolor a la palpación del ligamento peroneo-astragalino anterior. Radiografía sin lesiones óseas.',
      profesional: 'Dr. Martín Acosta',
      sector: 'Guardia'
    }
  },
  {
    empresa: GUEMES,
    offsetDias: -168,
    hora: '23:05',
    clase: 'I',
    duracionDias: 3,
    servicio: 'Cirugía general',
    centro: 'Sede Centro',
    diagnostico: { codigo: 'K35.8', descripcion: 'Apendicitis aguda, otras y las no especificadas' },
    diagnosticoEgreso: { codigo: 'K35.8', descripcion: 'Apendicitis aguda, otras y las no especificadas' },
    hcIngreso: {
      motivoConsulta: 'Dolor abdominal en fosa ilíaca derecha de 12 horas de evolución.',
      enfermedadActual:
        'Dolor periumbilical que migra a fosa ilíaca derecha, acompañado de náuseas y un vómito. Signo de Blumberg positivo. Leucocitosis 14.500/mm³. Ecografía compatible con apendicitis aguda.',
      profesional: 'Dr. Ricardo Molina',
      sector: 'Guardia'
    },
    epicrisis: {
      texto:
        'Paciente de 41 años que ingresa por cuadro de abdomen agudo compatible con apendicitis. Se realiza apendicectomía laparoscópica sin complicaciones. Evoluciona favorablemente, afebril, con buena tolerancia oral y herida sin signos de infección. Se otorga el alta con analgesia por vía oral, control por consultorio externo de cirugía a los 7 días y pautas de alarma.',
      profesional: 'Dr. Ricardo Molina',
      sector: 'Internación — Cirugía'
    }
  },
  {
    empresa: SARMIENTO,
    offsetDias: -270,
    hora: '08:20',
    clase: 'I',
    duracionDias: 5,
    servicio: 'Clínica médica',
    centro: 'Sede Sarmiento',
    diagnostico: { codigo: 'J18.9', descripcion: 'Neumonía, no especificada' },
    diagnosticoEgreso: { codigo: 'J18.9', descripcion: 'Neumonía, no especificada' },
    hcIngreso: {
      motivoConsulta: 'Fiebre, tos productiva y dificultad para respirar de 4 días de evolución.',
      enfermedadActual:
        'Cuadro de tos con expectoración, fiebre de hasta 39 °C y disnea de esfuerzo. Saturación 92 % aire ambiente. Rales crepitantes en base pulmonar derecha. Radiografía con consolidación basal derecha.',
      profesional: 'Dra. Silvina Ruiz',
      sector: 'Guardia'
    },
    epicrisis: {
      texto:
        'Ingresa por neumonía adquirida en la comunidad de base derecha. Recibe tratamiento antibiótico endovenoso con buena respuesta clínica, normalización de la saturación y descenso de reactantes de fase aguda. Se rota a vía oral al tercer día. Alta con antibiótico por vía oral hasta completar 7 días y control con clínica médica en 10 días con radiografía de tórax.',
      profesional: 'Dra. Silvina Ruiz',
      sector: 'Internación — Clínica médica'
    }
  },
  {
    empresa: GUEMES,
    offsetDias: -372,
    hora: '10:00',
    clase: 'H',
    servicio: 'Cardiología',
    centro: 'Sede Norte',
    diagnostico: { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)' },
    hcIngreso: {
      motivoConsulta: 'Estudios programados por control de hipertensión arterial.',
      enfermedadActual:
        'Paciente con diagnóstico reciente de hipertensión arterial en tratamiento. Concurre para monitoreo ambulatorio de presión arterial y ecocardiograma programados.',
      profesional: 'Dr. Andrés Villalba',
      sector: 'Hospital de día'
    }
  },
  {
    empresa: SARMIENTO,
    offsetDias: -470,
    hora: '11:30',
    clase: 'A',
    servicio: 'Ginecología',
    centro: 'Sede Sarmiento',
    diagnostico: { codigo: 'Z01.4', descripcion: 'Examen ginecológico (general) (de rutina)' },
    hcIngreso: {
      motivoConsulta: 'Control ginecológico anual.',
      enfermedadActual: 'Asintomática. Se realiza examen ginecológico de rutina y se solicitan estudios de control.',
      profesional: 'Dra. Carolina Benítez',
      sector: 'Consultorios externos'
    }
  }
];

const isoDias = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

let nextVisita = { [GUEMES]: 180000, [SARMIENTO]: 92000 };

function sembrarVisitas(idPacientePorEmpresa) {
  for (const p of PLANTILLAS) {
    const idPaciente = idPacientePorEmpresa[p.empresa];
    if (!idPaciente) continue;
    const fechaIngreso = isoDias(p.offsetDias);
    const fechaEgreso = p.clase === 'A' || p.clase === 'H' ? fechaIngreso : isoDias(p.offsetDias + (p.duracionDias || 1));
    visitas[p.empresa].push({
      numeroVisita: (nextVisita[p.empresa] += 7),
      idPaciente,
      fechaIngreso,
      horaIngreso: p.hora,
      fechaEgreso,
      clase: p.clase,
      servicio: p.servicio,
      centro: p.centro,
      diagnostico: p.diagnostico,
      diagnosticoEgreso: p.diagnosticoEgreso || null,
      hcIngreso: p.hcIngreso ? [{ fecha: fechaIngreso, hora: p.hora, ...p.hcIngreso }] : [],
      epicrisis: p.epicrisis
        ? [{ fecha: fechaEgreso, hora: '12:30', diagnostico: p.diagnosticoEgreso || p.diagnostico, ...p.epicrisis }]
        : []
    });
  }
}

sembrarVisitas({ [GUEMES]: 5501, [SARMIENTO]: 8801 });
// La ficha duplicada de Güemes también tiene una atención: se muestran juntas.
visitas[GUEMES].push({
  numeroVisita: 170011,
  idPaciente: 5502,
  fechaIngreso: isoDias(-610),
  horaIngreso: '19:50',
  fechaEgreso: isoDias(-610),
  clase: 'A',
  servicio: 'Guardia',
  centro: 'Sede Centro',
  diagnostico: { codigo: 'R51', descripcion: 'Cefalea' },
  diagnosticoEgreso: null,
  hcIngreso: [
    {
      fecha: isoDias(-610),
      hora: '19:50',
      motivoConsulta: 'Cefalea intensa de 6 horas de evolución.',
      enfermedadActual: 'Cefalea holocraneana sin signos de alarma neurológica. Mejora con analgesia endovenosa.',
      profesional: 'Dr. Lucas Romero',
      sector: 'Guardia'
    }
  ],
  epicrisis: []
});

let nextPaciente = 9000;

/** Solo mock: al verificar identidad, crea fichas en ambas clínicas para que el flujo completo muestre datos. */
function asegurarPaciente({ dni, nombre, sexo, fechaNacimiento }) {
  const d = normalizeDni(dni);
  if (padron[GUEMES].some((p) => p.dni === d)) return;
  const ids = {};
  for (const empresa of [GUEMES, SARMIENTO]) {
    const idPaciente = ++nextPaciente;
    ids[empresa] = idPaciente;
    padron[empresa].push({ idPaciente, dni: d, nombre: nombre.toUpperCase(), sexo, fechaNacimiento });
  }
  sembrarVisitas(ids);
}

function verificarDisponible(idEmpresa) {
  const caidas = String(config.MOCK_CLINICA_CAIDA || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  if (caidas.includes(Number(idEmpresa))) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('Clínica simulada caída'), { code: 'ETIMEOUT' })), 1200)
    );
  }
  return demora();
}

const sinDetalle = ({ hcIngreso, epicrisis, diagnosticoEgreso, idPaciente, ...v }) => ({
  ...v,
  tieneHcIngreso: hcIngreso.length > 0,
  tieneEpicrisis: epicrisis.length > 0
});

module.exports = {
  async buscarPacientesPorDni(idEmpresa, dni) {
    await verificarDisponible(idEmpresa);
    const d = normalizeDni(dni);
    return (padron[idEmpresa] || []).filter((p) => p.dni === d).map((p) => ({ ...p }));
  },
  async listarAtenciones(idEmpresa, idsPaciente) {
    await verificarDisponible(idEmpresa);
    return (visitas[idEmpresa] || [])
      .filter((v) => idsPaciente.includes(v.idPaciente))
      .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso))
      .map(sinDetalle);
  },
  async detalleAtencion(idEmpresa, numeroVisita, idsPaciente) {
    await verificarDisponible(idEmpresa);
    const v = (visitas[idEmpresa] || []).find((x) => x.numeroVisita === numeroVisita && idsPaciente.includes(x.idPaciente));
    if (!v) return null;
    const { idPaciente, ...rest } = v;
    return { ...sinDetalle(v), diagnosticoEgreso: rest.diagnosticoEgreso, hcIngreso: rest.hcIngreso, epicrisis: rest.epicrisis };
  },
  asegurarPaciente,
  EMPRESAS_MOCK: [
    { idEmpresa: GUEMES, habilitada: true, nombreVisible: 'Güemes', seccionesVisibles: ['resumen', 'hcIngreso', 'diagnostico', 'epicrisis'], demoraPublicacionHoras: 0 },
    { idEmpresa: SARMIENTO, habilitada: true, nombreVisible: 'Sarmiento', seccionesVisibles: ['resumen', 'hcIngreso', 'diagnostico', 'epicrisis'], demoraPublicacionHoras: 0 }
  ]
};
