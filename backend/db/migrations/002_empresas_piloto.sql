-- Clínicas piloto del MVP: Sarmiento y Güemes.
-- IdEmpresa tiene que coincidir con IDEMPRESA de vw_MiSaludEmpresas (catálogo de iMedic SaaS).
-- Sarmiento = 101; Güemes (Sanatorio Materno Infantil) = 103. Ojo: 102 es Colman.
-- Con EMPRESAS_SOURCE=imedic, nombre, servidor SQL, file server y PACS salen de vw_MiSaludEmpresas; esta tabla
-- decide qué clínicas se publican y con qué secciones.

MERGE dbo.EmpresasPortal AS t
USING (VALUES
  (101, 1, N'Sarmiento', N'["resumen","hcIngreso","diagnostico","epicrisis"]', 0),
  (103, 1, N'Güemes',    N'["resumen","hcIngreso","diagnostico","epicrisis"]', 0)
) AS s (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
ON t.IdEmpresa = s.IdEmpresa
WHEN NOT MATCHED THEN
  INSERT (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
  VALUES (s.IdEmpresa, s.Habilitada, s.NombreVisible, s.SeccionesVisibles, s.DemoraPublicacionHoras);
GO
