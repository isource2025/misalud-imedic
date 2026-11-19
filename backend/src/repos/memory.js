// Implementación en memoria de los repositorios del portal (modo mock y tests).
function createMemoryRepos() {
  const db = {
    cuentas: new Map(),
    codigos: new Map(),
    sesiones: new Map(),
    vinculos: new Map(),
    busquedas: new Map(),
    empresas: new Map(),
    emails: new Map(),
    auditoria: []
  };
  const seq = { cuentas: 0, codigos: 0, vinculos: 0, emails: 0 };
  const now = () => new Date();
  const clone = (o) => (o ? { ...o } : null);

  const cuentas = {
    async crear(data) {
      const id = ++seq.cuentas;
      const row = {
        id,
        telefono: null,
        fechaNacimiento: null,
        emailVerificadoEn: null,
        telefonoVerificadoEn: null,
        identidadVerificadaEn: null,
        metodoIdentidad: null,
        estado: 'activa',
        creadoEn: now(),
        ...data
      };
      db.cuentas.set(id, row);
      return clone(row);
    },
    async porId(id) {
      return clone(db.cuentas.get(Number(id)));
    },
    async porDni(dni) {
      return clone([...db.cuentas.values()].find((c) => c.dni === dni));
    },
    async existeEmailVerificado(email, exceptId) {
      const e = email.toLowerCase();
      return [...db.cuentas.values()].some(
        (c) => c.id !== exceptId && c.emailVerificadoEn && c.email.toLowerCase() === e
      );
    },
    async actualizar(id, patch) {
      const row = db.cuentas.get(Number(id));
      if (!row) return null;
      Object.assign(row, patch);
      return clone(row);
    }
  };

  const codigos = {
    async crear({ idCuenta, canal, proposito, codigoHash, expiraEn }) {
      for (const c of db.codigos.values()) {
        if (c.idCuenta === idCuenta && c.proposito === proposito && !c.usadoEn) c.usadoEn = now();
      }
      const id = ++seq.codigos;
      db.codigos.set(id, { id, idCuenta, canal, proposito, codigoHash, expiraEn, intentos: 0, usadoEn: null });
      return id;
    },
    async vigente(idCuenta, proposito) {
      const t = now();
      const rows = [...db.codigos.values()]
        .filter((c) => c.idCuenta === idCuenta && c.proposito === proposito && !c.usadoEn && c.expiraEn > t)
        .sort((a, b) => b.id - a.id);
      return clone(rows[0]);
    },
    async sumarIntento(id) {
      const c = db.codigos.get(id);
      if (c) c.intentos += 1;
    },
    async marcarUsado(id) {
      const c = db.codigos.get(id);
      if (c) c.usadoEn = now();
    }
  };

  const sesiones = {
    async crear(s) {
      db.sesiones.set(s.id, { ...s, revocada: false, creadaEn: now() });
    },
    async porId(id) {
      return clone(db.sesiones.get(id));
    },
    async rotar(id, refreshHash, ultimaActividad) {
      const s = db.sesiones.get(id);
      if (s) Object.assign(s, { refreshHash, ultimaActividad });
    },
    async tocar(id, ultimaActividad) {
      const s = db.sesiones.get(id);
      if (s) s.ultimaActividad = ultimaActividad;
    },
    async revocar(id) {
      const s = db.sesiones.get(id);
      if (s) s.revocada = true;
    },
    async revocarTodas(idCuenta) {
      for (const s of db.sesiones.values()) if (s.idCuenta === idCuenta) s.revocada = true;
    }
  };

  const vinculos = {
    async upsert({ idCuenta, idEmpresa, idPaciente, estado, puntaje, motivo }) {
      const existing = [...db.vinculos.values()].find(
        (v) => v.idCuenta === idCuenta && v.idEmpresa === idEmpresa && v.idPaciente === idPaciente
      );
      const verificadoEn = estado === 'confirmado' ? now() : null;
      if (existing) {
        const cambio = existing.estado !== estado;
        Object.assign(existing, { estado, puntaje, motivo, verificadoEn: existing.verificadoEn || verificadoEn });
        return { ...existing, cambio };
      }
      const id = ++seq.vinculos;
      const row = { id, idCuenta, idEmpresa, idPaciente, estado, puntaje, motivo, verificadoEn, creadoEn: now() };
      db.vinculos.set(id, row);
      return { ...row, cambio: true };
    },
    async listarPorCuenta(idCuenta) {
      return [...db.vinculos.values()].filter((v) => v.idCuenta === idCuenta).map(clone);
    },
    async registrarBusqueda(idCuenta, idEmpresa) {
      db.busquedas.set(`${idCuenta}:${idEmpresa}`, now());
    },
    async busquedasPorCuenta(idCuenta) {
      const map = new Map();
      for (const [k, fecha] of db.busquedas) {
        const [c, e] = k.split(':').map(Number);
        if (c === idCuenta) map.set(e, fecha);
      }
      return map;
    }
  };

  const empresas = {
    async listar() {
      return [...db.empresas.values()].map(clone);
    },
    async guardar(e) {
      db.empresas.set(e.idEmpresa, { ...e });
    }
  };

  const emails = {
    async encolar({ para, plantilla, datos }) {
      const id = ++seq.emails;
      db.emails.set(id, { id, para, plantilla, datos, estado: 'pendiente', intentos: 0, proximoIntentoEn: now() });
      return id;
    },
    async tomarPendientes(limite) {
      const t = now();
      const rows = [...db.emails.values()]
        .filter((e) => e.estado === 'pendiente' && e.proximoIntentoEn <= t)
        .slice(0, limite);
      for (const r of rows) r.estado = 'enviando';
      return rows.map(clone);
    },
    async marcarEnviado(id) {
      const e = db.emails.get(id);
      if (e) Object.assign(e, { estado: 'enviado', datos: null, enviadoEn: now(), intentos: e.intentos + 1 });
    },
    async marcarError(id, { error, proximoIntentoEn, fallido }) {
      const e = db.emails.get(id);
      if (!e) return;
      Object.assign(e, {
        estado: fallido ? 'fallido' : 'pendiente',
        ultimoError: error,
        intentos: e.intentos + 1,
        proximoIntentoEn,
        datos: fallido ? null : e.datos
      });
    }
  };

  const auditoria = {
    async registrar(evento) {
      db.auditoria.push({ fecha: now(), ...evento });
      if (db.auditoria.length > 5000) db.auditoria.shift();
    }
  };

  return { kind: 'memory', cuentas, codigos, sesiones, vinculos, empresas, emails, auditoria, _db: db };
}

module.exports = { createMemoryRepos };
