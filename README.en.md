# PlayTogether

[简体中文](README.md) | **English**

A lightweight virtual LAN tool for *Heroes of Might and Magic III* (original / Shadow of Death) with the HD Mod. It creates an encrypted virtual network so friends can play together over the game's built-in TCP/IP mode without manually configuring port forwarding.

> **Current status: Alpha**
>
> The first release supports Windows x64 only. The supported game setup is the original game / Shadow of Death with the HD Mod, launched through `Heroes3 HD.exe`. **Steam's official HD Edition is not supported.**

## Features

- **Create and join rooms**: Set up a private network with a `PT1.` invite code; no account required.
- **Automatic virtual networking**: EasyTier provides NAT traversal, encryption, and relaying, with automatically assigned virtual IP addresses.
- **Visible connection status**: View room members, virtual IPs, connection routes, latency, and packet loss.
- **Game detection and launching**: Detect common installation directories or manually select and launch `Heroes3 HD.exe`.
- **Limited network scope**: Carry only the game's virtual subnet without taking over the default route or changing system DNS.

## Installation and Usage

### Requirements

- Windows x64.
- Administrator privileges to create the virtual network adapter.
- The same versions of *Heroes of Might and Magic III* (original / Shadow of Death) and the HD Mod on every computer, plus the same map.
- On first use, allow `PlayTogether`, `easytier-core.exe`, and `Heroes3 HD.exe` to communicate over private networks in Windows Firewall.

Download `PlayTogether Setup <version>.exe` from [Releases](https://github.com/vaycentsun/playTogether/releases), or build it yourself using the [development guide](#development-and-building).

> The current installer is not code-signed, so Windows SmartScreen may warn about an unknown publisher.

### Playing Together

1. **Host a room**: Enter a player name and select **Create Room**, then privately share the generated invite code with your friends.
2. **Join the room**: Enter a player name, paste the complete `PT1.` invite code, and select **Join Room**.
3. **Select the game**: On each computer, select its `Heroes3 HD.exe` and launch the game.
4. **Create the in-game host**: In the game, go to **New Game → Multiplayer → Single Scenario → TCP/IP** and create a host.
5. **Connect to the host**: Open the same TCP/IP screen and enter the **host's virtual IP address** shown in PlayTogether.

The invite code contains the private network name and secret. Share it only with players you trust. Entering the virtual IP manually is the primary connection method; UDP broadcast discovery is only an auxiliary feature.

## How It Works

PlayTogether uses Electron for its desktop interface and manages an EasyTier 2.6.4 subprocess for virtual networking. Connections prefer direct P2P routes and can fall back to relaying. The EasyTier RPC endpoint is bound to loopback only, and network credentials are passed to the core through environment variables rather than command-line arguments.

The default discovery/relay peer is `tcp://public.easytier.cn:11010`. It is a public development peer, not a guarantee of availability or stability. Set the `PLAYTOGETHER_PEER_URL` environment variable to use a different EasyTier peer.

## Development and Building

### Prerequisites

- Node.js 22 or later.
- npm.
- Windows is required to create or join an actual virtual network. macOS can be used for UI development and `noTun` integration tests.

```bash
git clone https://github.com/vaycentsun/playTogether.git
cd playTogether
npm install
npm run fetch:core -- --platform win32 --arch x64
npm run dev
```

`fetch:core` downloads a pinned EasyTier release asset and verifies its SHA-256 checksum. Generated core files are stored in `core/` and are not committed to Git.

### Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Electron for development |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run unit tests without external network dependencies |
| `npm run build:renderer` | Build the renderer |
| `npm run fetch:core -- --platform win32 --arch x64` | Download and verify the Windows x64 EasyTier core |
| `npm run pack:win` | Run the full build and create a Windows x64 NSIS installer |
| `npm run test:integration` | Run a real two-process EasyTier integration test |
| `npm audit` | Check npm dependencies for security issues |

The Windows installer is written to `release/PlayTogether Setup <version>.exe`.

The real-core integration test requires a macOS core directory containing `easytier-core` and `easytier-cli`:

```bash
PLAYTOGETHER_TEST_CORE_DIR=/absolute/path/to/easytier npm run test:integration
```

The integration test is skipped when `PLAYTOGETHER_TEST_CORE_DIR` is not set. It uses `noTun` and verifies only real process connectivity and status APIs, not the Windows virtual adapter or in-game multiplayer.

During development, `PLAYTOGETHER_EASYTIER_DIR` can also override the core directory.

## Project Structure

```text
src/                  React UI, IPC types, and styles
electron/main/        Electron lifecycle, networking, invites, and game adapter
electron/preload.cjs  IPC bridge for the renderer
scripts/              EasyTier core download and verification
test/unit/            Unit tests
test/integration/     Real-core integration tests
resources/licenses/   Third-party licenses and notices
```

## Current Limitations

- Virtual adapter networking is supported on Windows x64 only.
- Only `Heroes3 HD.exe` is accepted. `HD_Launcher.exe`, Steam's official HD Edition, and other versions are not supported substitutes.
- Mismatched game versions, HD Mod versions, or maps may prevent players from joining or cause desynchronization.
- Successful EasyTier connectivity does not guarantee successful in-game multiplayer; game versions, firewall settings, maps, and other factors still apply.
- The current release is not code-signed.

## Third-Party Components

Virtual networking, NAT traversal, encryption, and relaying are provided by [EasyTier](https://github.com/EasyTier/EasyTier). Third-party licenses and notices are available in [`resources/licenses/`](resources/licenses/).
