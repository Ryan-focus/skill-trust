/**
 * Interactive wizard for generating SKILL.md trust declarations.
 *
 * Guides users through a series of questions about their skill's behavior
 * and produces a valid trust block for SKILL.md frontmatter.
 */

import * as readline from "node:readline/promises";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardAnswers {
  name: string;
  description: string;
  network: boolean;
  fsRead: boolean;
  fsWrite: boolean;
  fsScope: "outputs" | "workspace" | "system";
  shell: boolean;
  environment: boolean;
  exfiltration: "none" | "endpoints";
  endpoints: Array<{ target: string; purpose: string; data: string }>;
  runtimeDeps: string[];
  packages: Array<{ name: string; registry: string }>;
  boundaries: string[];
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

async function askYesNo(
  rl: readline.Interface,
  question: string,
  defaultVal = false
): Promise<boolean> {
  const hint = defaultVal ? "[Y/n]" : "[y/N]";
  const answer = await rl.question(`  ${question} ${hint} `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "") return defaultVal;
  return trimmed === "y" || trimmed === "yes";
}

async function askString(
  rl: readline.Interface,
  question: string,
  defaultVal = ""
): Promise<string> {
  const hint = defaultVal ? ` (${defaultVal})` : "";
  const answer = await rl.question(`  ${question}${hint}: `);
  return answer.trim() || defaultVal;
}

async function askChoice<T extends string>(
  rl: readline.Interface,
  question: string,
  choices: T[],
  defaultVal: T
): Promise<T> {
  const choiceStr = choices
    .map((c) => (c === defaultVal ? `[${c}]` : c))
    .join(" / ");
  const answer = await rl.question(`  ${question} (${choiceStr}): `);
  const trimmed = answer.trim().toLowerCase() as T;
  if (choices.includes(trimmed)) return trimmed;
  return defaultVal;
}

// ---------------------------------------------------------------------------
// Wizard flow
// ---------------------------------------------------------------------------

/**
 * Run the interactive trust declaration wizard.
 *
 * @param targetDir - Directory where SKILL.md will be created or updated.
 * @returns Generated SKILL.md content.
 */
export async function runWizard(targetDir: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log();
    console.log("  skill-trust: Interactive Trust Declaration Wizard");
    console.log("  " + "=".repeat(48));
    console.log();
    console.log("  This wizard will help you create a trust declaration for your skill.");
    console.log("  Answer each question about your skill's behavior.");
    console.log();

    const answers = await collectAnswers(rl);
    const content = generateSkillMd(answers);
    const resolvedDir = path.resolve(targetDir);
    const cwd = process.cwd();
    if (!resolvedDir.startsWith(cwd + path.sep) && resolvedDir !== cwd) {
      throw new Error(
        `Target directory must be within the current working directory (${cwd}).`
      );
    }
    const outputPath = path.join(resolvedDir, "SKILL.md");

    if (fs.existsSync(outputPath)) {
      const overwrite = await askYesNo(
        rl,
        `SKILL.md already exists at ${outputPath}. Overwrite?`,
        false
      );
      if (!overwrite) {
        console.log("\n  Aborted. Generated content printed below:\n");
        console.log(content);
        return content;
      }
    }

    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`\n  SKILL.md written to ${outputPath}`);
    return content;
  } finally {
    rl.close();
  }
}

async function collectAnswers(rl: readline.Interface): Promise<WizardAnswers> {
  // --- Basic info ---
  console.log("  --- Basic Information ---\n");
  const name = await askString(rl, "Skill name");
  const description = await askString(rl, "Short description");

  // --- Permissions ---
  console.log("\n  --- Permissions ---\n");
  const network = await askYesNo(rl, "Does this skill access the network?");
  const fsRead = await askYesNo(rl, "Does this skill read files?");
  const fsWrite = await askYesNo(rl, "Does this skill write files?");

  let fsScope: "outputs" | "workspace" | "system" = "outputs";
  if (fsWrite) {
    fsScope = await askChoice(
      rl,
      "File write scope",
      ["outputs", "workspace", "system"] as const,
      "outputs"
    );
  }

  const shell = await askYesNo(rl, "Does this skill execute shell commands?");
  const environment = await askYesNo(rl, "Does this skill access environment variables?");

  // --- Data flow ---
  console.log("\n  --- Data Flow ---\n");
  const exfiltration = network
    ? await askChoice(
        rl,
        "Data exfiltration",
        ["none", "endpoints"] as ("none" | "endpoints")[],
        "none"
      )
    : "none" as const;

  const endpoints: WizardAnswers["endpoints"] = [];
  if (exfiltration === "endpoints") {
    console.log("  Add exfiltration endpoints (empty target to stop):\n");
    let adding = true;
    while (adding) {
      const target = await askString(rl, "  Endpoint URL");
      if (!target) { adding = false; break; }
      const purpose = await askString(rl, "  Purpose");
      const data = await askString(rl, "  Data sent");
      endpoints.push({ target, purpose, data });
      console.log();
    }
  }

  // --- Dependencies ---
  console.log("\n  --- Dependencies ---\n");
  const runtimeDeps: string[] = [];
  const runtimeStr = await askString(
    rl,
    "Runtime dependencies (comma-separated, e.g. python3,jq)"
  );
  if (runtimeStr) {
    runtimeDeps.push(...runtimeStr.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const packages: WizardAnswers["packages"] = [];
  const addPkgs = await askYesNo(rl, "Add package dependencies?");
  if (addPkgs) {
    console.log("  Add packages (empty name to stop):\n");
    let adding = true;
    while (adding) {
      const pkgName = await askString(rl, "  Package name");
      if (!pkgName) { adding = false; break; }
      const registry = await askChoice(
        rl,
        "  Registry",
        ["npm", "pypi", "crates"],
        "npm"
      );
      packages.push({ name: pkgName, registry });
      console.log();
    }
  }

  // --- Boundaries ---
  console.log("\n  --- Boundaries ---\n");
  const boundaries: string[] = [];
  const boundaryStr = await askString(
    rl,
    "Behavioral boundaries (comma-separated promises, e.g. 'Never modifies input files')"
  );
  if (boundaryStr) {
    boundaries.push(...boundaryStr.split(",").map((s) => s.trim()).filter(Boolean));
  }

  return {
    name,
    description,
    network,
    fsRead,
    fsWrite,
    fsScope,
    shell,
    environment,
    exfiltration,
    endpoints,
    runtimeDeps,
    packages,
    boundaries,
  };
}

// ---------------------------------------------------------------------------
// SKILL.md generation
// ---------------------------------------------------------------------------

/**
 * Generate SKILL.md content from wizard answers.
 */
export function generateSkillMd(answers: WizardAnswers): string {
  const lines: string[] = ["---"];

  lines.push(`name: "${escapeYaml(answers.name)}"`);
  lines.push(`description: "${escapeYaml(answers.description)}"`);
  lines.push("");
  lines.push("trust:");

  // Permissions
  lines.push("  permissions:");
  lines.push(`    network: ${answers.network}`);
  lines.push("    filesystem:");
  lines.push(`      read: ${answers.fsRead}`);
  lines.push(`      write: ${answers.fsWrite}`);
  lines.push(`      scope: "${answers.fsScope}"`);
  lines.push(`    shell: ${answers.shell}`);
  lines.push(`    environment: ${answers.environment}`);

  // Data flow
  lines.push("");
  lines.push("  data-flow:");
  if (answers.exfiltration === "none" || answers.endpoints.length === 0) {
    lines.push('    exfiltration: "none"');
  } else {
    lines.push("    exfiltration:");
    for (const ep of answers.endpoints) {
      lines.push(`      - target: "${escapeYaml(ep.target)}"`);
      lines.push(`        purpose: "${escapeYaml(ep.purpose)}"`);
      lines.push(`        data: "${escapeYaml(ep.data)}"`);
    }
  }

  // Dependencies
  if (answers.runtimeDeps.length > 0 || answers.packages.length > 0) {
    lines.push("");
    lines.push("  dependencies:");
    if (answers.runtimeDeps.length > 0) {
      lines.push("    runtime:");
      for (const dep of answers.runtimeDeps) {
        lines.push(`      - "${escapeYaml(dep)}"`);
      }
    }
    if (answers.packages.length > 0) {
      lines.push("    packages:");
      for (const pkg of answers.packages) {
        lines.push(`      - name: "${escapeYaml(pkg.name)}"`);
        lines.push(`        registry: "${escapeYaml(pkg.registry)}"`);
      }
    }
  }

  // Boundaries
  if (answers.boundaries.length > 0) {
    lines.push("");
    lines.push("  boundaries:");
    for (const b of answers.boundaries) {
      lines.push(`    - "${escapeYaml(b)}"`);
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`# ${answers.name}`);
  lines.push("");
  lines.push(answers.description);
  lines.push("");

  return lines.join("\n");
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
