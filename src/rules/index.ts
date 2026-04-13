import type { Rule } from "../types.js";
import { networkRule } from "./network.js";
import { filesystemRule } from "./filesystem.js";
import { shellRule } from "./shell.js";
import { environmentRule } from "./environment.js";
import { dataFlowRule } from "./data-flow.js";
import { obfuscationRule } from "./obfuscation.js";

export const allRules: Rule[] = [
  networkRule,
  filesystemRule,
  shellRule,
  environmentRule,
  dataFlowRule,
  obfuscationRule,
];

export {
  networkRule,
  filesystemRule,
  shellRule,
  environmentRule,
  dataFlowRule,
  obfuscationRule,
};
