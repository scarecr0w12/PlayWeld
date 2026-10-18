# Installation and requirements

Choose a packaged testing build to try the desktop, or source setup to change PlayWeld. Organizing Project files and lexical search do not require a model account.

## Packaged Windows and Linux builds

1. Open [Releases](https://github.com/scarecr0w12/PlayWeld/releases), select a published testing prerelease and read its notes.
2. Download the matching Windows x64 installer or supplied Linux AppImage/DEB. Retain the manifest and checksum file.
3. Compare the downloaded SHA-256 with its release checksum entry. Substitute your actual path:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Downloads\PlayWeld-version-x64.exe'
```

On Linux use sha256sum on the downloaded file. A matching checksum checks agreement with that digest; it does not authenticate the publisher.

The public 0.21.0 executable and metadata are unsigned. Testing prereleases are downloaded manually and excluded from stable automatic updates. The recorded Windows 0.20.0-to-0.21.0 upgrade does not establish full uninstall/rollback or every Linux installation scenario. Do not treat an unsigned package as signed. Follow the [release guide](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/RELEASE_GUIDE.md) and selected release's evidence.

## Source prerequisites

Use Git, Node 24 or later and npm 11 with the lockfile. Linux native builds need libx11-dev, libxkbfile-dev and libsecret-1-dev; isolation tests need a supported Bubblewrap environment. Windows builds need C++/Python native-module prerequisites; follow the [developer environment](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/DEVELOPER_GUIDE.md#development-environment) and actual compiler errors/Spectre-library guidance.

Keep Windows and Linux dependency trees separate. Engines, DCC applications, licenses, endpoints and model weights are separate installations. Packaged desktop use does not require the source toolchain.

Next: [first Project](https://github.com/scarecr0w12/PlayWeld/wiki/First-Project) or [source development](https://github.com/scarecr0w12/PlayWeld/wiki/Development-and-Contributing).
