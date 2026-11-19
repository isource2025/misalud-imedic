-- Adjuntos de estudios (imPedidosEstudiosAdjuntos) visibles en el portal.
-- FileServerUrl: túnel fijo de Cloudflare del file server de cada clínica. CLINICA_<ID>_FILE_SERVER_URL lo pisa.
IF COL_LENGTH('dbo.EmpresasPortal', 'FileServerUrl') IS NULL
  ALTER TABLE dbo.EmpresasPortal ADD FileServerUrl NVARCHAR(300) NULL;
GO

UPDATE dbo.EmpresasPortal SET FileServerUrl = N'https://files-vidal.imedic.com.ar' WHERE IdEmpresa = 1 AND FileServerUrl IS NULL;
UPDATE dbo.EmpresasPortal SET FileServerUrl = N'https://files-sarmiento.imedic.com.ar' WHERE IdEmpresa = 101 AND FileServerUrl IS NULL;
UPDATE dbo.EmpresasPortal SET FileServerUrl = N'https://files-materno.imedic.com.ar' WHERE IdEmpresa = 103 AND FileServerUrl IS NULL;

UPDATE dbo.EmpresasPortal
SET SeccionesVisibles = JSON_MODIFY(SeccionesVisibles, 'append $', 'adjuntos')
WHERE IdEmpresa IN (1, 101, 103)
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(SeccionesVisibles) WHERE [value] = N'adjuntos');
GO

ALTER TABLE dbo.EmpresasPortal DROP CONSTRAINT DF_EmpresasPortal_Secciones;
ALTER TABLE dbo.EmpresasPortal ADD CONSTRAINT DF_EmpresasPortal_Secciones
  DEFAULT (N'["resumen","hcIngreso","diagnostico","epicrisis","adjuntos"]') FOR SeccionesVisibles;
GO
