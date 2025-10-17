# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

- Run (PowerShell)

```powershell path=null start=null
./scripts/run.ps1
```

- Run (CMD)

```bat path=null start=null
scripts\run.bat
```

- Clean build artifacts (delete compiled output directory)

```powershell path=null start=null
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
```

- Manual compile and run (if not using scripts)

```powershell path=null start=null
$files = Get-ChildItem -Recurse -Filter *.java | % FullName
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue; New-Item -ItemType Directory out | Out-Null
javac -encoding UTF-8 -d out $files
if (Test-Path 'src/main/resources') { Copy-Item -Recurse -Force 'src/main/resources/*' out 2>$null }
java -cp out com.cmpmarketplace.App
```

Notes
- Requires Java tools on PATH (`javac`, `java`).
- No linter or test framework is configured in this repo.

## Architecture overview

- Entry point: `com.cmpmarketplace.App`
  - Launches Swing UI on EDT via `MainFrame`.

- UI layer: `com.cmpmarketplace.ui.MainFrame`
  - Two-pane Swing UI (left: listing form and price estimate; right: registration tab and assistant tab).
  - Event handlers:
    - Photo upload: updates label only (no persistence).
    - Price estimate: delegates to `ai.PriceEstimator.estimate(...)` and displays result.
    - Assistant ask: delegates to `ai.ChatAssistant.query(...)` and appends results to chat area.
    - Register (stub): calls `db.Database.registerUser(...)` and shows a dialog with the boolean result.

- AI utilities: `com.cmpmarketplace.ai`
  - `PriceEstimator`: loads `src/main/resources/data/sample_listings.csv` via classpath (`/data/sample_listings.csv`).
    - Filters by category/condition, computes average, adjusts with simple keyword heuristics, floors at $10.
  - `ChatAssistant`: loads the same CSV and returns up to 6 simple text matches; otherwise shows a few sample rows.

- Data/model: `com.cmpmarketplace.model.Product`
  - Simple POJO backing the listing form (no persistence wired).

- Database stub: `com.cmpmarketplace.db.Database`
  - `registerUser` currently validates non-empty inputs and returns `true`; no JDBC wiring.
  - A prospective schema exists at `src/main/resources/db/schema.sql` (not applied by the app/scripts).

- Resources
  - Runtime resources live under `src/main/resources`. The run scripts copy this directory to `out/` so `getResourceAsStream("/...")` works at runtime.

Project characteristics
- Plain Java + Swing, no Maven/Gradle. All compilation is handled by the `scripts/` helpers.
- No tests, CI, or linting present. Add them explicitly if needed for future work.
