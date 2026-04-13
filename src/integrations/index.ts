/**
 * External scanner integrations — Cisco Skill Scanner and Aguara.
 */

export { scanWithCisco, type CiscoScannerOptions } from "./cisco.js";
export { scanWithAguara, type AguaraOptions } from "./aguara.js";
export {
  createCombinedReport,
  printCombinedReport,
  combinedReportToJson,
} from "./combined-report.js";
export type {
  ExternalScanResult,
  ExternalFinding,
  CombinedReport,
} from "./types.js";
