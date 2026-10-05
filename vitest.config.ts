/** @file Configuración de pruebas unitarias de contrato, presentación y rutas, independiente de E2E y servicios activos. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
