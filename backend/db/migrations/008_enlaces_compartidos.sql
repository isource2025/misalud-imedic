-- Links temporales para compartir un estudio PACS, un adjunto o el PDF de la atención.
IF OBJECT_ID('dbo.EnlacesCompartidos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.EnlacesCompartidos (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EnlacesCompartidos PRIMARY KEY,
    TokenHash CHAR(64) NOT NULL,
    IdCuenta BIGINT NOT NULL,
    IdEmpresa INT NOT NULL,
    NumeroVisita INT NOT NULL,
    Alcance VARCHAR(30) NOT NULL, -- pacs_estudio | adjunto | pdf_atencion
    Recurso NVARCHAR(500) NULL,    -- payload opaco (estudio/adjunto) o NULL para PDF
    Meta NVARCHAR(500) NULL,       -- título visible al abrir el link
    ExpiraEn DATETIME2(0) NOT NULL,
    MaxUsos INT NULL,
    Usos INT NOT NULL CONSTRAINT DF_Enlaces_Usos DEFAULT (0),
    Revocado BIT NOT NULL CONSTRAINT DF_Enlaces_Revocado DEFAULT (0),
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Enlaces_Creado DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Enlaces_TokenHash UNIQUE (TokenHash),
    CONSTRAINT FK_Enlaces_Cuenta FOREIGN KEY (IdCuenta) REFERENCES dbo.Cuentas(Id)
  );
  CREATE INDEX IX_Enlaces_Cuenta ON dbo.EnlacesCompartidos (IdCuenta, CreadoEn DESC);
END
GO
