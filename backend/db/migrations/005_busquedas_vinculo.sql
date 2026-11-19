-- Última búsqueda de fichas por (cuenta, clínica). Sin fila = nunca se buscó en esa clínica (p. ej. se habilitó
-- después de que la cuenta validó identidad), y el portal la busca antes de listar atenciones.
CREATE TABLE dbo.BusquedasVinculo (
  IdCuenta   BIGINT       NOT NULL CONSTRAINT FK_Busquedas_Cuenta REFERENCES dbo.Cuentas(Id) ON DELETE CASCADE,
  IdEmpresa  INT          NOT NULL,
  BuscadoEn  DATETIME2(0) NOT NULL CONSTRAINT DF_Busquedas_BuscadoEn DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT PK_BusquedasVinculo PRIMARY KEY (IdCuenta, IdEmpresa)
);
GO
