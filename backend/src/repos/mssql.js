// Repositorios sobre la base propia del portal (SQL Server). Todas las consultas son parametrizadas.
const { sql, getPortalPool } = require('../db/portalDb');

const CUENTA_COLS = `Id, DNI, Sexo, NombreCompleto, Email, Telefono, PasswordHash, FechaNacimiento,
  EmailVerificadoEn, TelefonoVerificadoEn, IdentidadVerificadaEn, MetodoIdentidad, Estado, CreadoEn`;

const toCuenta = (r) =>
  r && {
    id: Number(r.Id),
    dni: r.DNI,
    sexo: r.Sexo,
    nombreCompleto: r.NombreCompleto,
    email: r.Email,
    telefono: r.Telefono,
    passwordHash: r.PasswordHash,
    fechaNacimiento: r.FechaNacimiento ? new Date(r.FechaNacimiento).toISOString().slice(0, 10) : null,
    emailVerificadoEn: r.EmailVerificadoEn,
    telefonoVerificadoEn: r.TelefonoVerificadoEn,
    identidadVerificadaEn: r.IdentidadVerificadaEn,
    metodoIdentidad: r.MetodoIdentidad,
    estado: r.Estado,
    creadoEn: r.CreadoEn
  };

const CUENTA_PATCH = {
  sexo: ['Sexo', sql.Char(1)],
  nombreCompleto: ['NombreCompleto', sql.NVarChar(200)],
  email: ['Email', sql.NVarChar(254)],
  telefono: ['Telefono', sql.VarChar(30)],
  passwordHash: ['PasswordHash', sql.VarChar(255)],
  fechaNacimiento: ['FechaNacimiento', sql.Date],
  emailVerificadoEn: ['EmailVerificadoEn', sql.DateTime2(0)],
  telefonoVerificadoEn: ['TelefonoVerificadoEn', sql.DateTime2(0)],
  identidadVerificadaEn: ['IdentidadVerificadaEn', sql.DateTime2(0)],
  metodoIdentidad: ['MetodoIdentidad', sql.VarChar(30)],
  estado: ['Estado', sql.VarChar(20)]
};

function createMssqlRepos() {
  const req = async () => (await getPortalPool()).request();

  const cuentas = {
    async crear(d) {
      const r = await (await req())
        .input('dni', sql.VarChar(12), d.dni)
        .input('sexo', sql.Char(1), d.sexo)
        .input('nombre', sql.NVarChar(200), d.nombreCompleto)
        .input('email', sql.NVarChar(254), d.email)
        .input('tel', sql.VarChar(30), d.telefono || null)
        .input('hash', sql.VarChar(255), d.passwordHash)
        .query(`INSERT INTO dbo.Cuentas (DNI, Sexo, NombreCompleto, Email, Telefono, PasswordHash)
                OUTPUT INSERTED.Id VALUES (@dni, @sexo, @nombre, @email, @tel, @hash)`);
      return cuentas.porId(r.recordset[0].Id);
    },
    async porId(id) {
      const r = await (await req()).input('id', sql.BigInt, id).query(`SELECT ${CUENTA_COLS} FROM dbo.Cuentas WHERE Id = @id`);
      return toCuenta(r.recordset[0]) || null;
    },
    async porDni(dni) {
      const r = await (await req()).input('dni', sql.VarChar(12), dni).query(`SELECT ${CUENTA_COLS} FROM dbo.Cuentas WHERE DNI = @dni`);
      return toCuenta(r.recordset[0]) || null;
    },
    async existeEmailVerificado(email, exceptId) {
      const r = await (await req())
        .input('email', sql.NVarChar(254), email)
        .input('id', sql.BigInt, exceptId || 0)
        .query('SELECT TOP 1 1 AS x FROM dbo.Cuentas WHERE Email = @email AND EmailVerificadoEn IS NOT NULL AND Id <> @id');
      return r.recordset.length > 0;
    },
    async actualizar(id, patch) {
      const request = (await req()).input('id', sql.BigInt, id);
      const sets = ['ActualizadoEn = SYSUTCDATETIME()'];
      for (const [key, value] of Object.entries(patch)) {
        const def = CUENTA_PATCH[key];
        if (!def) throw new Error(`Campo no actualizable: ${key}`);
        request.input(key, def[1], value);
        sets.push(`${def[0]} = @${key}`);
      }
      await request.query(`UPDATE dbo.Cuentas SET ${sets.join(', ')} WHERE Id = @id`);
      return cuentas.porId(id);
    }
  };

  const codigos = {
    async crear({ idCuenta, canal, proposito, codigoHash, expiraEn }) {
      const r = await (await req())
        .input('c', sql.BigInt, idCuenta)
        .input('canal', sql.VarChar(10), canal)
        .input('p', sql.VarChar(20), proposito)
        .input('h', sql.Char(64), codigoHash)
        .input('exp', sql.DateTime2(0), expiraEn)
        .query(`UPDATE dbo.CodigosVerificacion SET UsadoEn = SYSUTCDATETIME()
                  WHERE IdCuenta = @c AND Proposito = @p AND UsadoEn IS NULL;
                INSERT INTO dbo.CodigosVerificacion (IdCuenta, Canal, Proposito, CodigoHash, ExpiraEn)
                  OUTPUT INSERTED.Id VALUES (@c, @canal, @p, @h, @exp);`);
      return Number(r.recordset[0].Id);
    },
    async vigente(idCuenta, proposito) {
      const r = await (await req())
        .input('c', sql.BigInt, idCuenta)
        .input('p', sql.VarChar(20), proposito)
        .query(`SELECT TOP 1 Id, IdCuenta, CodigoHash, ExpiraEn, Intentos FROM dbo.CodigosVerificacion
                WHERE IdCuenta = @c AND Proposito = @p AND UsadoEn IS NULL AND ExpiraEn > SYSUTCDATETIME()
                ORDER BY Id DESC`);
      const x = r.recordset[0];
      return x ? { id: Number(x.Id), idCuenta: Number(x.IdCuenta), codigoHash: x.CodigoHash, expiraEn: x.ExpiraEn, intentos: x.Intentos } : null;
    },
    async sumarIntento(id) {
      await (await req()).input('id', sql.BigInt, id).query('UPDATE dbo.CodigosVerificacion SET Intentos = Intentos + 1 WHERE Id = @id');
    },
    async marcarUsado(id) {
      await (await req()).input('id', sql.BigInt, id).query('UPDATE dbo.CodigosVerificacion SET UsadoEn = SYSUTCDATETIME() WHERE Id = @id');
    }
  };

  const sesiones = {
    async crear(s) {
      await (await req())
        .input('id', sql.UniqueIdentifier, s.id)
        .input('c', sql.BigInt, s.idCuenta)
        .input('h', sql.Char(64), s.refreshHash)
        .input('ua', sql.DateTime2(0), s.ultimaActividad)
        .input('exp', sql.DateTime2(0), s.expiraEn)
        .input('ip', sql.VarChar(64), s.ip || null)
        .input('agent', sql.NVarChar(300), (s.userAgent || '').slice(0, 300) || null)
        .query(`INSERT INTO dbo.Sesiones (Id, IdCuenta, RefreshHash, UltimaActividad, ExpiraEn, Ip, UserAgent)
                VALUES (@id, @c, @h, @ua, @exp, @ip, @agent)`);
    },
    async porId(id) {
      const r = await (await req())
        .input('id', sql.UniqueIdentifier, id)
        .query('SELECT Id, IdCuenta, RefreshHash, UltimaActividad, ExpiraEn, Revocada FROM dbo.Sesiones WHERE Id = @id');
      const x = r.recordset[0];
      return x
        ? {
            id: String(x.Id).toLowerCase(),
            idCuenta: Number(x.IdCuenta),
            refreshHash: x.RefreshHash,
            ultimaActividad: x.UltimaActividad,
            expiraEn: x.ExpiraEn,
            revocada: Boolean(x.Revocada)
          }
        : null;
    },
    async rotar(id, refreshHash, ultimaActividad) {
      await (await req())
        .input('id', sql.UniqueIdentifier, id)
        .input('h', sql.Char(64), refreshHash)
        .input('ua', sql.DateTime2(0), ultimaActividad)
        .query('UPDATE dbo.Sesiones SET RefreshHash = @h, UltimaActividad = @ua WHERE Id = @id');
    },
    async tocar(id, ultimaActividad) {
      await (await req())
        .input('id', sql.UniqueIdentifier, id)
        .input('ua', sql.DateTime2(0), ultimaActividad)
        .query('UPDATE dbo.Sesiones SET UltimaActividad = @ua WHERE Id = @id');
    },
    async revocar(id) {
      await (await req()).input('id', sql.UniqueIdentifier, id).query('UPDATE dbo.Sesiones SET Revocada = 1 WHERE Id = @id');
    },
    async revocarTodas(idCuenta) {
      await (await req()).input('c', sql.BigInt, idCuenta).query('UPDATE dbo.Sesiones SET Revocada = 1 WHERE IdCuenta = @c');
    }
  };

  const vinculos = {
    async upsert({ idCuenta, idEmpresa, idPaciente, estado, puntaje, motivo }) {
      const r = await (await req())
        .input('c', sql.BigInt, idCuenta)
        .input('e', sql.Int, idEmpresa)
        .input('p', sql.Int, idPaciente)
        .input('estado', sql.VarChar(12), estado)
        .input('puntaje', sql.Int, puntaje)
        .input('motivo', sql.NVarChar(200), motivo || null)
        .query(`
          DECLARE @prev VARCHAR(12) = (SELECT Estado FROM dbo.Vinculos WHERE IdCuenta = @c AND IdEmpresa = @e AND IDPaciente = @p);
          MERGE dbo.Vinculos AS t
          USING (SELECT @c AS IdCuenta, @e AS IdEmpresa, @p AS IDPaciente) AS s
          ON t.IdCuenta = s.IdCuenta AND t.IdEmpresa = s.IdEmpresa AND t.IDPaciente = s.IDPaciente
          WHEN MATCHED THEN UPDATE SET Estado = @estado, Puntaje = @puntaje, Motivo = @motivo, ActualizadoEn = SYSUTCDATETIME(),
            VerificadoEn = COALESCE(t.VerificadoEn, CASE WHEN @estado = 'confirmado' THEN SYSUTCDATETIME() END)
          WHEN NOT MATCHED THEN INSERT (IdCuenta, IdEmpresa, IDPaciente, Estado, Puntaje, Motivo, VerificadoEn)
            VALUES (@c, @e, @p, @estado, @puntaje, @motivo, CASE WHEN @estado = 'confirmado' THEN SYSUTCDATETIME() END)
          OUTPUT INSERTED.Id, @prev AS Prev;`);
      const row = r.recordset[0];
      return { id: Number(row.Id), idCuenta, idEmpresa, idPaciente, estado, puntaje, motivo, cambio: row.Prev !== estado };
    },
    async listarPorCuenta(idCuenta) {
      const r = await (await req())
        .input('c', sql.BigInt, idCuenta)
        .query('SELECT Id, IdEmpresa, IDPaciente, Estado, Puntaje, Motivo, VerificadoEn, CreadoEn FROM dbo.Vinculos WHERE IdCuenta = @c');
      return r.recordset.map((x) => ({
        id: Number(x.Id),
        idCuenta,
        idEmpresa: x.IdEmpresa,
        idPaciente: x.IDPaciente,
        estado: x.Estado,
        puntaje: x.Puntaje,
        motivo: x.Motivo,
        verificadoEn: x.VerificadoEn,
        creadoEn: x.CreadoEn
      }));
    },
    async registrarBusqueda(idCuenta, idEmpresa) {
      await (await req())
        .input('c', sql.BigInt, idCuenta)
        .input('e', sql.Int, idEmpresa)
        .query(`
          UPDATE dbo.BusquedasVinculo SET BuscadoEn = SYSUTCDATETIME() WHERE IdCuenta = @c AND IdEmpresa = @e;
          IF @@ROWCOUNT = 0
            BEGIN TRY
              INSERT INTO dbo.BusquedasVinculo (IdCuenta, IdEmpresa) VALUES (@c, @e);
            END TRY
            BEGIN CATCH
              IF ERROR_NUMBER() <> 2627 THROW;
            END CATCH`);
    },
    async busquedasPorCuenta(idCuenta) {
      const r = await (await req())
        .input('c', sql.BigInt, idCuenta)
        .query('SELECT IdEmpresa, BuscadoEn FROM dbo.BusquedasVinculo WHERE IdCuenta = @c');
      return new Map(r.recordset.map((x) => [x.IdEmpresa, x.BuscadoEn]));
    }
  };

  const empresas = {
    async listar() {
      const r = await (await req()).query(
        'SELECT IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras FROM dbo.EmpresasPortal'
      );
      return r.recordset.map((x) => ({
        idEmpresa: x.IdEmpresa,
        habilitada: Boolean(x.Habilitada),
        nombreVisible: x.NombreVisible,
        seccionesVisibles: JSON.parse(x.SeccionesVisibles || '[]'),
        demoraPublicacionHoras: x.DemoraPublicacionHoras
      }));
    }
  };

  const emails = {
    async encolar({ para, plantilla, datos }) {
      const r = await (await req())
        .input('para', sql.NVarChar(254), para)
        .input('pl', sql.VarChar(60), plantilla)
        .input('d', sql.NVarChar(sql.MAX), JSON.stringify(datos))
        .query('INSERT INTO dbo.EmailsSalida (Para, Plantilla, Datos) OUTPUT INSERTED.Id VALUES (@para, @pl, @d)');
      return Number(r.recordset[0].Id);
    },
    async tomarPendientes(limite) {
      // READPAST permite varias réplicas del back sin tomar el mismo email dos veces.
      const r = await (await req()).input('n', sql.Int, limite).query(`
        UPDATE TOP (@n) e SET Estado = 'enviando'
        OUTPUT INSERTED.Id, INSERTED.Para, INSERTED.Plantilla, INSERTED.Datos, INSERTED.Intentos
        FROM dbo.EmailsSalida e WITH (ROWLOCK, READPAST, UPDLOCK)
        WHERE e.Estado = 'pendiente' AND e.ProximoIntentoEn <= SYSUTCDATETIME()`);
      return r.recordset.map((x) => ({
        id: Number(x.Id),
        para: x.Para,
        plantilla: x.Plantilla,
        datos: x.Datos ? JSON.parse(x.Datos) : {},
        intentos: x.Intentos
      }));
    },
    async marcarEnviado(id) {
      await (await req())
        .input('id', sql.BigInt, id)
        .query(`UPDATE dbo.EmailsSalida SET Estado = 'enviado', Datos = NULL, EnviadoEn = SYSUTCDATETIME(),
                Intentos = Intentos + 1, UltimoError = NULL WHERE Id = @id`);
    },
    async marcarError(id, { error, proximoIntentoEn, fallido }) {
      await (await req())
        .input('id', sql.BigInt, id)
        .input('err', sql.NVarChar(400), String(error || '').slice(0, 400))
        .input('prox', sql.DateTime2(0), proximoIntentoEn)
        .input('f', sql.Bit, fallido ? 1 : 0)
        .query(`UPDATE dbo.EmailsSalida SET Intentos = Intentos + 1, UltimoError = @err, ProximoIntentoEn = @prox,
                Estado = CASE WHEN @f = 1 THEN 'fallido' ELSE 'pendiente' END,
                Datos = CASE WHEN @f = 1 THEN NULL ELSE Datos END
                WHERE Id = @id`);
    }
  };

  const auditoria = {
    async registrar({ idCuenta, accion, idEmpresa, recurso, ip, resultado }) {
      await (await req())
        .input('c', sql.BigInt, idCuenta || null)
        .input('a', sql.VarChar(60), accion)
        .input('e', sql.Int, idEmpresa || null)
        .input('r', sql.NVarChar(200), recurso ? String(recurso).slice(0, 200) : null)
        .input('ip', sql.VarChar(64), ip || null)
        .input('res', sql.VarChar(20), resultado)
        .query('INSERT INTO dbo.Auditoria (IdCuenta, Accion, IdEmpresa, Recurso, Ip, Resultado) VALUES (@c, @a, @e, @r, @ip, @res)');
    }
  };

  return { kind: 'mssql', cuentas, codigos, sesiones, vinculos, empresas, emails, auditoria };
}

module.exports = { createMssqlRepos };
