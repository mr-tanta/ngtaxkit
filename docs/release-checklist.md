# Release Checklist

Use this checklist before tagging npm or PyPI releases.

## Code Gates

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`

## Artifact Gates

- Build npm package with `npm pack` from `packages/typescript`.
- Install the tarball into a fresh temp npm project.
- Run `node scripts/smoke/npm-installed.mjs` from that temp project.
- Build Python wheel with `python -m build --wheel` from `packages/python`.
- Install the wheel into a fresh virtual environment.
- Run `python scripts/smoke/python-installed.py` using the virtual environment interpreter from outside the repo package path.

## Rate Source Review

- Run `rates.audit()` in TypeScript and Python.
- Confirm `missingMetadata` / `missing_metadata` is acceptable.
- Review every `needs_review` source before high-impact rate changes.
- Update `shared/rates/source_metadata_2026.json` and the Python copied package data together.
- Record source metadata changes separately in the changelog.

## Release Notes

Changelog entries should separate:

- code/API changes
- rate value changes
- source metadata changes
- verification status changes
- packaging or CI changes

## Publishing

- Tag full npm + PyPI releases as `vX.Y.Z`.
- Tag npm-only patch releases as `npm-vX.Y.Z` so only the npm workflow runs.
- Tag Python-only patch releases as `py-vX.Y.Z` so only the PyPI workflow runs.
- Let GitHub Actions run CI before npm/PyPI publish jobs.
- Confirm the published npm tarball and PyPI wheel include bundled rate and source metadata files.
