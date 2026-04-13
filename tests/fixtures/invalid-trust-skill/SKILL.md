---
name: bad-skill
description: A skill with an invalid trust block.
trust:
  permissions:
    network: "yes"
    filesystem:
      read: true
      write: true
      scope: "outputs"
    shell: false
    environment: false
  data-flow:
    exfiltration: none
---

# Bad Skill

This has an invalid trust declaration (network should be boolean).
