# Changelog

## 1.9.8

### Patch Changes

- Security audit: align peer dependencies, standardize TypeScript ^5.8.3, fix CLI dynamic versioning

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.7] - 2026-02-20

### Added

- **CLAUDE.md Template**: REST API response format documentation (`{ data: ... }` wrapping)
- **CLAUDE.md Template**: Direct `fetch()` examples alongside SDK examples for CRUD operations
- **CLAUDE.md Template**: Numeric/decimal column serialization note (JSON string precision)

### Fixed

- **API**: Reset `search_path` after query execution to prevent pool connection contamination
  - Fixes: Table Editor data browser returning 500 when project schema has tables matching platform table names (e.g. `users`)

## [1.0.5] - 2026-02-11

### Changed

- Dependency updates and alignment

## [1.0.0] - 2026-01-17

### Added

- Initial stable release
- **Type Generation**
  - `generateTypes` - Generate TypeScript types from database schema
  - Automatic table type inference
  - Column type mapping (text, integer, boolean, timestamp, uuid, jsonb, etc.)
  - Nullable field support
  - Array type support
  - Custom type name generation
- **CLI Commands**
  - `vaif types generate` - Generate types from connected project
  - `--output` flag for custom output path
  - `--project` flag for project selection
- **Output Formats**
  - TypeScript interface generation
  - Database type exports
  - Table name constants
- **Features**
  - Connects to VAIF API for schema introspection
  - Preserves column metadata
  - Handles complex PostgreSQL types
