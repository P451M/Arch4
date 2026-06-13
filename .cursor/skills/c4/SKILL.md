---
arch4-owned: true
name: c4
description: Apply C4 model concepts and terminology when creating or reviewing software architecture diagrams.
---

# C4 Model Guidance

This skill is adapted from the C4 model for visualising software architecture by
Simon Brown: https://c4model.com/. The C4 website and example diagrams are
licensed under Creative Commons Attribution 4.0 International.

Use this skill to decide what belongs in C4 architecture models and views.

## Core Abstractions

- Software system: the highest-level system being modeled, plus other software
  systems it depends on or that depend on it. Usually this is the system a team
  owns and can inspect internally.
- Container: a runtime or data-store boundary required for the software system
  to work. Examples include web apps, mobile apps, services, jobs, serverless
  functions, databases, queues, caches, object stores, and file stores. A C4
  container is not necessarily a Docker/containerization unit.
- Component: a meaningful grouping of related functionality inside a container,
  encapsulated behind a well-defined interface. Components are not separately
  deployable units by default.
- Code: implementation details such as classes, functions, modules, and source
  files. Do not model code-level details unless explicitly requested.

## Diagram Guidance

- System context views show the target software system, people, and external
  systems. If actors or dependencies are unknown, include at least the target
  software system and record open questions.
- Container views show the runtime/data-store containers inside the target
  software system and their relationships to people and external systems.
- Component views zoom into important containers and show meaningful internal
  components, not folder structures or every class.
- Create a component view only when evidenced relationships make it useful. If
  candidate components have no meaningful relationships yet, skip the view or
  record why it is intentionally relationship-free.
- Deployment views show runtime environments, deployment nodes, infrastructure,
  and software/container instances. Create them only when deployment evidence is
  present.
- Dynamic views show how existing model elements collaborate at runtime for an
  important feature, story, use case, or recurring pattern. Use them sparingly
  and suggest candidates before creating them.

## Modeling Rules

- Prefer architecture-significant runtime boundaries over package, folder, or
  repository layout.
- Model packages or libraries as containers only when no stronger runtime
  boundary is evidenced, and record that modeling convention in notes or open
  questions.
- Use directional relationships with meaningful verbs and technology/protocol
  details when evidenced.
- Relationship labels must read as a natural sentence when placed between the
  source and target names: `<source> <label> <target>`. Include needed
  prepositions such as from, to, in, through, with, or by.
- System context views normally show the target software system as one node;
  container views show its internal boundary. Ask for product/rendering guidance
  before forcing a visible boundary into a system context view.
- Avoid inventing actors, external systems, deployment topology, technologies,
  or relationships without evidence.
- Preserve uncertainty as open questions or low-confidence metadata.
