

## Fix: `build:dev` script not found

The `package.json` does not have a `build:dev` script. The existing scripts are `dev`, `build`, `lint`, `lint:fix`, `typecheck`, and `preview`. The build system expects a `build:dev` script for development builds.

### Change
Add a `build:dev` script to `package.json` that runs the same Vite build command as `build`:

```json
"build:dev": "vite build --mode development",
```

This is a one-line addition to the `scripts` section of `package.json`. No other files need changes.

