#!/usr/bin/env node

/**
 * CLI tool for door43-preview-renderers
 *
 * Usage:
 *   cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen [--output file.json] [--dcs-api-url URL]
 *   cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen [--output file.json] [--dcs-api-url URL]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllCatalogEntriesForRendering } from './getAllCatalogEntriesForRendering.js';
import { getResourceData } from './getResourceData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs(args) {
  const parsed = {
    command: args[0],
    params: {},
    quiet: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    // Handle flags without values
    if (arg === '--quiet' || arg === '-q') {
      parsed.quiet = true;
      continue;
    }

    // Handle key-value pairs
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '').replace(/-/g, '_');
      const value = args[i + 1];

      if (key === 'book') {
        parsed.params.bookId = value;
      } else if (key === 'dcs_api_url') {
        parsed.params.dcsApiUrl = value;
      } else if (key === 'output') {
        parsed.output = value;
      } else {
        parsed.params[key] = value;
      }
      i++; // Skip the value in next iteration
    }
  }

  return parsed;
}

// Display help message
function showHelp() {
  console.log(`
door43-preview-renderers CLI

Usage:
  cli.js <command> [options]

Commands:
  getAllCatalogEntries    Get all catalog entries for rendering
  getResourceData         Get resource data for a specific book

Options:
  --owner <owner>         Repository owner (required)
  --repo <repo>           Repository name (required)
  --ref <ref>             Git reference (branch/tag/commit)
  --book <bookId>         Book ID (e.g., gen, exo, mat, 1ti)
  --dcs-api-url <url>     Custom DCS API URL (optional)
  --output <file>         Output file path (optional, defaults to stdout)
  --quiet, -q             Suppress logging output (no API URLs or progress messages)

Examples:
  # Get catalog entries and output to stdout
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Get catalog entries with quiet mode (no logging, just JSON)
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --quiet

  # Get catalog entries and save to file
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output result.json

  # Quiet mode for piping to jq
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --quiet | jq '.catalogEntries[] | {owner, repo: .name, subject}'

  # Get resource data
  node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Use custom DCS API URL
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://git.door43.org/api/v1

Test Cases:
  # Valid case
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Invalid book ID (should fail)
  node src/cli.js getAllCatalogEntries --owner fr_gl --repo fr_tn --ref v2 --book 1th

  # Valid case
  node src/cli.js getAllCatalogEntries --owner fr_gl --repo gr_tn --ref v2 --book 1ti

  # Aligned Bible case (currently fails, needs fix)
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn
`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const { command, params, output, quiet } = parseArgs(args);

  // Validate required parameters
  if (!params.owner || !params.repo) {
    console.error('Error: --owner and --repo are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    let result;

    switch (command) {
      case 'getAllCatalogEntries':
      case 'getAllCatalogEntriesForRendering':
        if (!quiet) {
          console.error(`Fetching catalog entries for ${params.owner}/${params.repo}...`);
        }
        // getAllCatalogEntriesForRendering expects: (owner, repo, ref, books?, options?)
        const books = params.bookId ? [params.bookId] : [];
        const options = {
          dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1',
          quiet: quiet,
        };
        result = await getAllCatalogEntriesForRendering(
          params.owner,
          params.repo,
          params.ref,
          books,
          options
        );
        break;

      case 'getResourceData':
        console.error(`Fetching resource data for ${params.owner}/${params.repo}...`);
        result = await getResourceData(params);
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.error('Valid commands: getAllCatalogEntries, getResourceData');
        process.exit(1);
    }

    // Format output
    const jsonOutput = JSON.stringify(result, null, 2);

    // Write to file or stdout
    if (output) {
      const outputPath = path.resolve(output);
      fs.writeFileSync(outputPath, jsonOutput);
      console.error(`✓ Output written to ${outputPath}`);
      process.exit(0);
    } else {
      // Write to stdout and wait for it to flush before exiting
      process.stdout.write(jsonOutput + '\n', () => {
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('Details:', error.response.data);
      }
    }
    process.exit(1);
  }
}

// Run main function
main();
