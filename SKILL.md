---
name: csv-analyzer
description: Analyze CSV files and generate summary statistics. Use when the user wants to explore, summarize, or visualize tabular data from CSV files.
license: MIT
trust:
  permissions:
    network: false
    filesystem:
      read: true
      write: true
      scope: "outputs"
    shell: false
    environment: false
  data-flow:
    exfiltration: none
  dependencies:
    runtime:
      - python3
    packages:
      - name: pandas
        registry: pypi
  boundaries:
    - "Only reads CSV files specified by the user"
    - "Only writes output files to the designated output directory"
    - "Does not execute any shell commands"
    - "Does not access the network or transmit any data"
---

# CSV Analyzer

Analyze CSV files and produce summary statistics reports.

## Instructions

1. Read the CSV file specified by the user using `scripts/analyze.py`
2. Generate a summary report including:
   - Column names and data types
   - Row count
   - Basic statistics (mean, median, min, max) for numeric columns
   - Missing value counts
3. Save the report to the output directory

## Usage

```bash
python3 scripts/analyze.py <input.csv> <output_dir>
```
