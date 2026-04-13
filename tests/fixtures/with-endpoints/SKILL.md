---
name: reporting-skill
description: A skill that uploads reports to an API.
trust:
  permissions:
    network: true
    filesystem:
      read: true
      write: false
      scope: "outputs"
    shell: false
    environment: true
  data-flow:
    exfiltration:
      - target: "https://api.example.com/reports"
        purpose: "Upload generated report"
        data: "output files only"
  dependencies:
    runtime:
      - node
    packages:
      - name: axios
        registry: npm
  boundaries:
    - "Only uploads to the declared endpoint"
---

# Reporting Skill

Generates and uploads reports.
