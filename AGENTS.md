# Repository guidance

[Project README](./README.md) | [Contributing](./.github/CONTRIBUTING.md)

## Development and tests

- Change implementation in `src` and regenerate bundles with `npm run build`.
  The build also regenerates minified optional plugins in `libs`.
- Follow the existing Cucumber features, steps and fixtures. Build before
  browser tests and prefer focused scenarios using `--name`.
- Keep public examples on versioned CDN URLs, including integration examples.

## Local integration with leaflet-city-mapper

The [city-mapper demo](./examples/leaflet-elevation_city-mapper.html) keeps its
versioned CDN URLs. These environment variables let development servers and
tests use local builds before both libraries are published:

| Variable | Consumer | Absolute path |
|---|---|---|
| `LEAFLET_CITY_MAPPER_FOLDER` | Elevation's development server and integration tests | City-mapper's built `dist` directory, containing both main and worker bundles |
| `LEAFLET_ELEVATION_FOLDER` | City-mapper's elevation demo smoke test | Root of this checkout, not its `dist` directory |

- Build an explicitly selected counterpart before starting the relevant process.
- With `LEAFLET_CITY_MAPPER_FOLDER`, [the development server](./build/server.js) serves
  the selected bundles through its `/__city-mapper/` endpoints and rewrites
  the CDN script URL in served HTML. [The test loader](./test/support/unpkg.js)
  intercepts main and worker CDN requests and omits their CDN downloads.
- `LEAFLET_ELEVATION_FOLDER` is consumed by city-mapper's smoke test, not this server.
  It serves elevation assets and demo GeoJSON from this checkout and reuses
  [the cached dependency loader](./test/support/unpkg.js). City-mapper's
  `npm test` prepares that cache when this checkout is selected.
- In CI, `npm test` uses [prepareIntegration.js](./build/prepareIntegration.js)
  to clone city-mapper's `master` into a temporary directory, install its
  dependencies and build it if no local bundle directory was selected.
  Explicit selections are reused without cloning or rebuilding.
- Both CI and the shared CD workflow run `npm test`, so release tests use the
  same preparation without changing the release workflow or version selection.
  Push both source changes before expecting integration CI to pass; a run
  that checked out an older counterpart may need rerunning.
- Outside CI, without an override, the counterpart comes from the CDN and
  its pinned version must already be published. No override publishes a package.
- Overrides must not rewrite example files on disk. Keep documentation of
  these internal variables here, not in general READMEs.
