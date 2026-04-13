---
name: csv-analyzer
description: Analyze CSV files and generate summary statistics.
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
    - "Does not execute any shell commands"
---

# CSV Analyzer

Analyze CSV files and produce summary statistics.
