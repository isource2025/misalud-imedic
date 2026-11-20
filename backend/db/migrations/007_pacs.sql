-- Imágenes PACS (tomógrafo) visibles en el portal.
IF COL_LENGTH('dbo.EmpresasPortal', 'PacsUrl') IS NULL
  ALTER TABLE dbo.EmpresasPortal ADD PacsUrl NVARCHAR(300) NULL;
GO

UPDATE dbo.EmpresasPortal SET PacsUrl = N'https://pacs-sarmiento.imedic.com.ar' WHERE IdEmpresa = 101 AND PacsUrl IS NULL;

UPDATE dbo.EmpresasPortal
SET SeccionesVisibles = JSON_MODIFY(SeccionesVisibles, 'append $', 'pacs')
WHERE IdEmpresa IN (1, 101, 103)
  AND NOT EXISTS (SELECT 1 FROM OPENJSON(SeccionesVisibles) WHERE [value] = N'pacs');
GO

ALTER TABLE dbo.EmpresasPortal DROP CONSTRAINT DF_EmpresasPortal_Secciones;
ALTER TABLE dbo.EmpresasPortal ADD CONSTRAINT DF_EmpresasPortal_Secciones
  DEFAULT (N'["resumen","hcIngreso","diagnostico","epicrisis","adjuntos","pacs"]') FOR SeccionesVisibles;
GO
