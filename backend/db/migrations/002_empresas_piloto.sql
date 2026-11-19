-- Clínicas piloto del MVP: Güemes y Sarmiento.
-- IdEmpresa debe coincidir con dbo.Empresas.IDEMPRESA del catálogo de iMedic SaaS.
-- Sarmiento = 101 (relevado). Güemes = 102 es provisorio: confirmarlo con el super admin de iMedic antes del piloto.
-- Cuando el super admin de iMedic publique el flag Empresas.PortalHabilitado, se puede usar EMPRESAS_SOURCE=imedic
-- y esta tabla queda solo para la configuración de cada clínica (secciones visibles, demora de publicación).

MERGE dbo.EmpresasPortal AS t
USING (VALUES
  (101, 1, N'Sarmiento', N'["resumen","hcIngreso","diagnostico","epicrisis"]', 0),
  (102, 1, N'Güemes',    N'["resumen","hcIngreso","diagnostico","epicrisis"]', 0)
) AS s (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
ON t.IdEmpresa = s.IdEmpresa
WHEN NOT MATCHED THEN
  INSERT (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
  VALUES (s.IdEmpresa, s.Habilitada, s.NombreVisible, s.SeccionesVisibles, s.DemoraPublicacionHoras);
GO
