-- MiSalud.Imedic — base propia del portal (SQL Server).
-- No contiene datos clínicos: solo cuentas, sesiones, vínculos DNI→clínica, configuración por clínica,
-- cola de emails y auditoría. Las credenciales SQL de las clínicas NO se guardan acá (van en variables de entorno).

CREATE TABLE dbo.Cuentas (
  Id                     BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cuentas PRIMARY KEY,
  DNI                    VARCHAR(12)    NOT NULL,
  Sexo                   CHAR(1)        NOT NULL CONSTRAINT CK_Cuentas_Sexo CHECK (Sexo IN ('M','F','X')),
  NombreCompleto         NVARCHAR(200)  NOT NULL,
  Email                  NVARCHAR(254)  NOT NULL,
  Telefono               VARCHAR(30)    NULL,
  PasswordHash           VARCHAR(255)   NOT NULL,
  FechaNacimiento        DATE           NULL,
  EmailVerificadoEn      DATETIME2(0)   NULL,
  TelefonoVerificadoEn   DATETIME2(0)   NULL,
  IdentidadVerificadaEn  DATETIME2(0)   NULL,
  MetodoIdentidad        VARCHAR(30)    NULL,
  Estado                 VARCHAR(20)    NOT NULL CONSTRAINT DF_Cuentas_Estado DEFAULT ('activa'),
  CreadoEn               DATETIME2(0)   NOT NULL CONSTRAINT DF_Cuentas_CreadoEn DEFAULT (SYSUTCDATETIME()),
  ActualizadoEn          DATETIME2(0)   NOT NULL CONSTRAINT DF_Cuentas_ActualizadoEn DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_Cuentas_DNI UNIQUE (DNI)
);
GO

-- El email es único solo entre cuentas verificadas: un registro abandonado no bloquea a nadie.
CREATE UNIQUE INDEX UX_Cuentas_EmailVerificado ON dbo.Cuentas (Email) WHERE EmailVerificadoEn IS NOT NULL;
GO

CREATE TABLE dbo.CodigosVerificacion (
  Id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CodigosVerificacion PRIMARY KEY,
  IdCuenta    BIGINT        NOT NULL CONSTRAINT FK_Codigos_Cuenta REFERENCES dbo.Cuentas(Id) ON DELETE CASCADE,
  Canal       VARCHAR(10)   NOT NULL CONSTRAINT CK_Codigos_Canal CHECK (Canal IN ('email','sms')),
  Proposito   VARCHAR(20)   NOT NULL CONSTRAINT CK_Codigos_Proposito CHECK (Proposito IN ('verificar','reset','login')),
  CodigoHash  CHAR(64)      NOT NULL,
  ExpiraEn    DATETIME2(0)  NOT NULL,
  Intentos    INT           NOT NULL CONSTRAINT DF_Codigos_Intentos DEFAULT (0),
  UsadoEn     DATETIME2(0)  NULL,
  CreadoEn    DATETIME2(0)  NOT NULL CONSTRAINT DF_Codigos_CreadoEn DEFAULT (SYSUTCDATETIME())
);
GO
CREATE INDEX IX_Codigos_Cuenta ON dbo.CodigosVerificacion (IdCuenta, Proposito, CreadoEn DESC);
GO

CREATE TABLE dbo.Sesiones (
  Id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Sesiones PRIMARY KEY,
  IdCuenta         BIGINT        NOT NULL CONSTRAINT FK_Sesiones_Cuenta REFERENCES dbo.Cuentas(Id) ON DELETE CASCADE,
  RefreshHash      CHAR(64)      NOT NULL,
  CreadaEn         DATETIME2(0)  NOT NULL CONSTRAINT DF_Sesiones_CreadaEn DEFAULT (SYSUTCDATETIME()),
  UltimaActividad  DATETIME2(0)  NOT NULL,
  ExpiraEn         DATETIME2(0)  NOT NULL,
  Revocada         BIT           NOT NULL CONSTRAINT DF_Sesiones_Revocada DEFAULT (0),
  Ip               VARCHAR(64)   NULL,
  UserAgent        NVARCHAR(300) NULL
);
GO
CREATE INDEX IX_Sesiones_Cuenta ON dbo.Sesiones (IdCuenta, Revocada);
GO

CREATE TABLE dbo.EmpresasPortal (
  IdEmpresa               INT            NOT NULL CONSTRAINT PK_EmpresasPortal PRIMARY KEY,
  Habilitada              BIT            NOT NULL CONSTRAINT DF_EmpresasPortal_Habilitada DEFAULT (0),
  NombreVisible           NVARCHAR(120)  NOT NULL,
  SeccionesVisibles       NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_EmpresasPortal_Secciones DEFAULT (N'["resumen","hcIngreso","diagnostico","epicrisis"]'),
  TiposAdjuntoVisibles    NVARCHAR(MAX)  NULL,
  DemoraPublicacionHoras  INT            NOT NULL CONSTRAINT DF_EmpresasPortal_Demora DEFAULT (0),
  ActualizadoEn           DATETIME2(0)   NOT NULL CONSTRAINT DF_EmpresasPortal_ActualizadoEn DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT CK_EmpresasPortal_SeccionesJson CHECK (ISJSON(SeccionesVisibles) = 1)
);
GO

CREATE TABLE dbo.Vinculos (
  Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Vinculos PRIMARY KEY,
  IdCuenta       BIGINT        NOT NULL CONSTRAINT FK_Vinculos_Cuenta REFERENCES dbo.Cuentas(Id) ON DELETE CASCADE,
  IdEmpresa      INT           NOT NULL,
  IDPaciente     INT           NOT NULL,
  Estado         VARCHAR(12)   NOT NULL CONSTRAINT CK_Vinculos_Estado CHECK (Estado IN ('confirmado','pendiente','descartado')),
  Puntaje        INT           NOT NULL,
  Motivo         NVARCHAR(200) NULL,
  VerificadoEn   DATETIME2(0)  NULL,
  CreadoEn       DATETIME2(0)  NOT NULL CONSTRAINT DF_Vinculos_CreadoEn DEFAULT (SYSUTCDATETIME()),
  ActualizadoEn  DATETIME2(0)  NOT NULL CONSTRAINT DF_Vinculos_ActualizadoEn DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_Vinculos UNIQUE (IdCuenta, IdEmpresa, IDPaciente)
);
GO

CREATE TABLE dbo.EmailsSalida (
  Id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EmailsSalida PRIMARY KEY,
  Para              NVARCHAR(254)  NOT NULL,
  Plantilla         VARCHAR(60)    NOT NULL,
  -- Contiene el código de un solo uso mientras está pendiente; se borra al enviar o descartar.
  Datos             NVARCHAR(MAX)  NULL,
  Estado            VARCHAR(12)    NOT NULL CONSTRAINT DF_EmailsSalida_Estado DEFAULT ('pendiente'),
  Intentos          INT            NOT NULL CONSTRAINT DF_EmailsSalida_Intentos DEFAULT (0),
  UltimoError       NVARCHAR(400)  NULL,
  ProximoIntentoEn  DATETIME2(0)   NOT NULL CONSTRAINT DF_EmailsSalida_Proximo DEFAULT (SYSUTCDATETIME()),
  CreadoEn          DATETIME2(0)   NOT NULL CONSTRAINT DF_EmailsSalida_CreadoEn DEFAULT (SYSUTCDATETIME()),
  EnviadoEn         DATETIME2(0)   NULL,
  CONSTRAINT CK_EmailsSalida_Estado CHECK (Estado IN ('pendiente','enviando','enviado','fallido'))
);
GO
CREATE INDEX IX_EmailsSalida_Pendientes ON dbo.EmailsSalida (Estado, ProximoIntentoEn);
GO

CREATE TABLE dbo.Auditoria (
  Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Auditoria PRIMARY KEY,
  Fecha      DATETIME2(0)   NOT NULL CONSTRAINT DF_Auditoria_Fecha DEFAULT (SYSUTCDATETIME()),
  IdCuenta   BIGINT         NULL,
  Accion     VARCHAR(60)    NOT NULL,
  IdEmpresa  INT            NULL,
  Recurso    NVARCHAR(200)  NULL,
  Ip         VARCHAR(64)    NULL,
  Resultado  VARCHAR(20)    NOT NULL
);
GO
CREATE INDEX IX_Auditoria_Cuenta ON dbo.Auditoria (IdCuenta, Fecha DESC);
GO
