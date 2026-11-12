// Conformance scenarios K01–K58 from docs/llm_parity_opencode_vs_aetheria.md §13 & §15.
import { scenariosW1toW5 } from "./scenarios-w1-w5.mjs";
import { scenariosW6toW12 } from "./scenarios-w6-w12.mjs";

export const scenarios = [...scenariosW1toW5, ...scenariosW6toW12];
export const TOTAL = scenarios.length;
export const implementedCount = scenarios.filter((s) => s.implemented).length;
