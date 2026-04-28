# Changelog

All notable changes to `@vaif/cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-27

### Changed

- All template references to the deprecated `@vaiftech/*` namespace replaced with `@vaif/client` and `@vaif/react`
- Templates no longer pull in `@vaiftech/auth` (auth is bundled in `@vaif/client`) or `@vaiftech/sdk-expo` (universal `@vaif/client` works in Expo)
- Generated CLAUDE.md examples updated to use the modern `Vaif` class from `@vaif/client@0.3.x` and the unified `vaif_*` API key prefix
- `claude-setup` now writes `.mcp.json` referencing `@vaif/mcp` (was `@vaiftech/mcp`)
- Swift / Go template references repointed from `vaif-technologies` / `vaifllc` to the canonical `VAIF-TECH` GitHub organisation
- README rewritten to remove all `@vaiftech/*` references and surface the unified `@vaif/*` package family

### Fixed

- `vaif.config.json` `$schema` URL — was `https://vaif.studio/schemas/config.json` (404, marketing site does not serve schemas), now points at the bundled JSON Schema published from this repo at `https://raw.githubusercontent.com/VAIF-TECH/vaif-cli/main/schemas/vaif-config.schema.json`. The schema is also published inside the npm package under `schemas/`.

### Added

- `schemas/vaif-config.schema.json` — JSON Schema for `vaif.config.json` (editor autocomplete + validation)

## [0.1.0] - 2026-04 — initial @vaif/cli release

- Forked / re-published from the legacy `@vaiftech/cli` package under the new `@vaif/cli` name as part of the namespace consolidation.
