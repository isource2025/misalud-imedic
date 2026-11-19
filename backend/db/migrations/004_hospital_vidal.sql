-- Hospital José Ramón Vidal (Corrientes) = IDEMPRESA 1 en vw_MiSaludEmpresas.
MERGE dbo.EmpresasPortal AS t
USING (VALUES
  (1, 1, N'Hospital Vidal', N'["resumen","hcIngreso","diagnostico","epicrisis"]', 0)
) AS s (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
ON t.IdEmpresa = s.IdEmpresa
WHEN MATCHED THEN
  UPDATE SET Habilitada = s.Habilitada, NombreVisible = s.NombreVisible
WHEN NOT MATCHED THEN
  INSERT (IdEmpresa, Habilitada, NombreVisible, SeccionesVisibles, DemoraPublicacionHoras)
  VALUES (s.IdEmpresa, s.Habilitada, s.NombreVisible, s.SeccionesVisibles, s.DemoraPublicacionHoras);
GO
