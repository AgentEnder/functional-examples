/**
 * Lightweight GitHub Actions workflow file runner for testing CI examples.
 *
 * Parses a .yml workflow file and executes `run:` steps locally while
 * skipping known CI-only actions (checkout, setup-node, etc.).
 *
 * Supports:
 * - Selective job execution via --job <name>
 * - Basic ${{ matrix.* }} and ${{ env.* }} substitution (strips to empty)
 * - working-directory on steps
 * - Reports pass/fail per step
 *
 * Does NOT support:
 * - Matrix expansion
 * - Conditional expressions (if:)
 * - Service containers, artifacts, secrets
 *
 * Usage:
 *   tsx scripts/run-workflow.mts <path-to-workflow.yml>             # run all jobs
 *   tsx scripts/run-workflow.mts <path-to-workflow.yml> --job <name>  # run specific job
 */

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

// Actions to skip (CI-only infrastructure)
const SKIP_ACTIONS = [
  'actions/checkout',
  'actions/setup-node',
  'pnpm/action-setup',
  'actions/cache',
];

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  'working-directory'?: string;
  if?: string;
}

interface WorkflowJob {
  name?: string;
  'runs-on'?: string;
  steps: WorkflowStep[];
}

interface Workflow {
  name?: string;
  jobs: Record<string, WorkflowJob>;
}

function shouldSkipAction(uses: string | undefined): boolean {
  if (!uses) return false;
  return SKIP_ACTIONS.some((action) => uses.startsWith(action));
}

function substituteVariables(text: string): string {
  // Replace ${{ matrix.* }} and ${{ env.* }} with empty strings
  return text
    .replace(/\$\{\{\s*matrix\.[^}]+\}\}/g, '')
    .replace(/\$\{\{\s*env\.[^}]+\}\}/g, '');
}

function parseArgs(): { workflowPath: string; jobName?: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(
      'Usage: tsx scripts/run-workflow.mts <path-to-workflow.yml> [--job <name>]'
    );
    process.exit(args.length === 0 ? 1 : 0);
  }

  const workflowPath = args[0];
  let jobName: string | undefined;

  const jobFlagIndex = args.indexOf('--job');
  if (jobFlagIndex !== -1 && args[jobFlagIndex + 1]) {
    jobName = args[jobFlagIndex + 1];
  }

  return { workflowPath, jobName };
}

async function main() {
  const { workflowPath, jobName } = parseArgs();

  // Read and parse workflow file
  const workflowContent = await readFile(workflowPath, 'utf-8');
  const workflow: Workflow = parseYaml(workflowContent);

  if (!workflow.jobs || typeof workflow.jobs !== 'object') {
    console.error('Error: No jobs found in workflow file');
    process.exit(1);
  }

  // GitHub Actions uses the repo root as the working directory, not the
  // workflow file location. Default to cwd (the invoker's directory).
  const workflowDir = process.cwd();
  const jobEntries = Object.entries(workflow.jobs);

  // Filter to specific job if requested
  const jobsToRun = jobName
    ? jobEntries.filter(([name]) => name === jobName)
    : jobEntries;

  if (jobsToRun.length === 0) {
    console.error(
      jobName
        ? `Error: Job '${jobName}' not found in workflow`
        : 'Error: No jobs to run'
    );
    process.exit(1);
  }

  console.log(`Running workflow: ${workflow.name || workflowPath}`);
  console.log(`Jobs: ${jobsToRun.map(([name]) => name).join(', ')}\n`);

  let totalSteps = 0;
  let failedSteps = 0;
  let skippedSteps = 0;

  for (const [jobId, job] of jobsToRun) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Job: ${job.name || jobId}`);
    console.log(`${'='.repeat(60)}\n`);

    if (!job.steps || !Array.isArray(job.steps)) {
      console.log('  No steps defined for this job\n');
      continue;
    }

    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i];
      const stepNum = i + 1;
      const stepName = step.name || `Step ${stepNum}`;

      totalSteps++;

      // Skip CI-only actions
      if (step.uses && shouldSkipAction(step.uses)) {
        console.log(`  [${stepNum}] SKIP: ${stepName}`);
        console.log(`       (CI action: ${step.uses})\n`);
        skippedSteps++;
        continue;
      }

      // Skip steps without run command
      if (!step.run) {
        if (step.uses) {
          console.log(`  [${stepNum}] SKIP: ${stepName}`);
          console.log(`       (External action: ${step.uses})\n`);
          skippedSteps++;
        }
        continue;
      }

      // Execute run step
      console.log(`  [${stepNum}] RUN: ${stepName}`);

      const command = substituteVariables(step.run);
      const workingDir = step['working-directory']
        ? isAbsolute(step['working-directory'])
          ? step['working-directory']
          : join(workflowDir, step['working-directory'])
        : workflowDir;

      console.log(
        `       Command: ${command.split('\n')[0]}${
          command.includes('\n') ? '...' : ''
        }`
      );
      if (step['working-directory']) {
        console.log(`       Working directory: ${step['working-directory']}`);
      }
      console.log();

      try {
        execSync(command, {
          cwd: workingDir,
          stdio: 'inherit',
        });
        console.log(`  [${stepNum}] ✓ PASS\n`);
      } catch {
        console.error(`  [${stepNum}] ✗ FAIL\n`);
        failedSteps++;
        // Continue to next step instead of exiting
      }
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total steps:   ${totalSteps}`);
  console.log(`Skipped:       ${skippedSteps}`);
  console.log(`Executed:      ${totalSteps - skippedSteps}`);
  console.log(`Failed:        ${failedSteps}`);
  console.log(`Passed:        ${totalSteps - skippedSteps - failedSteps}`);
  console.log();

  if (failedSteps > 0) {
    console.error('Workflow completed with failures');
    process.exit(1);
  } else {
    console.log('Workflow completed successfully');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
