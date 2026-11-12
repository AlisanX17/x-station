# X Station

A PlayStation-inspired Windows desktop game launcher built with Electron. The project is designed to be maintained through GitHub and built into a Windows installer with GitHub Actions—no Visual Studio required.

## Features in v1
- PS5-inspired dark interface with blue lighting and responsive layout
- Add an installed game's `.exe` to the local library
- Add and launch `.exe` / `.msi` installer files
- Play / Run Setup actions
- Search, recently played, remove library entries without deleting original files
- Local library persistence in the Electron user-data folder
- GitHub Actions workflow to build a Windows NSIS installer

## Important behavior
Selecting a setup file runs the installer; it does not silently install the game or discover the final game executable. After installation, add the installed game's main `.exe` separately to use the Play action. X Station stores file paths and does not copy or modify game files.

## Build from GitHub
1. Create a new public or private repository named `x-station`.
2. Upload the contents of this folder to the repository root (not the containing folder itself).
3. Open **Actions** and enable workflows if GitHub asks.
4. Run **Build X Station for Windows** from the Actions tab, or push a change to `main`.
5. Open the completed workflow run and download the `X-Station-Windows-Installer` artifact.

## Run locally (optional)
Requires Node.js 22.

```bash
npm install
npm start
```

## Build locally (optional)

```bash
npm run dist
```

## Security
The renderer has no Node.js integration. File selection and launching are exposed through a narrow preload bridge and IPC handlers. Only user-selected local files are launched.
