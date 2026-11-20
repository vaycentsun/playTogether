# PlayTogether

**简体中文** | [English](README.en.md)

为《英雄无敌 3》原版 / 死亡阴影 + HD Mod 设计的轻量异地局域网工具。通过加密的虚拟局域网，让身处异地的朋友可以使用游戏内的 TCP/IP 功能联机，无需手动配置端口映射。

> **当前状态：Alpha**
>
> 首个版本仅支持 Windows x64，游戏适配目标为通过 `Heroes3 HD.exe` 启动的原版 / 死亡阴影 + HD Mod，**不是 Steam 官方 HD Edition**。

## 功能特点

- **创建 / 加入房间**：通过 `PT1.` 邀请码组建私密网络，无需账号。
- **自动虚拟组网**：由 EasyTier 提供 NAT 穿透、加密和中继能力，自动分配虚拟 IP。
- **连接状态可见**：查看房间成员、虚拟 IP、连接方式、延迟和丢包。
- **游戏检测与启动**：自动检测常见安装目录，也可手动选择并启动 `Heroes3 HD.exe`。
- **精简网络范围**：只承载游戏虚拟网段，不接管默认路由，不修改系统 DNS。

## 安装与使用

### 环境要求

- Windows x64。
- 管理员权限，用于创建虚拟网卡。
- 双方已安装相同版本的《英雄无敌 3》原版 / 死亡阴影和 HD Mod，并使用相同地图。
- 首次联机时，在 Windows 防火墙中允许 `PlayTogether`、`easytier-core.exe` 和 `Heroes3 HD.exe` 进行专用网络通信。

从 [Releases](https://github.com/vaycentsun/playTogether/releases) 下载 `PlayTogether Setup <version>.exe`，或按照[开发指南](#开发与构建)自行构建。

> 当前安装包没有代码签名，Windows SmartScreen 可能显示未知发布者提示。

### 联机步骤

1. **房主创建房间**：输入玩家名称，点击“创建房间”，将生成的邀请码私下发给朋友。
2. **加入者进入房间**：输入玩家名称，粘贴完整的 `PT1.` 邀请码，点击“加入房间”。
3. **选择游戏**：双方选择各自的 `Heroes3 HD.exe`，然后启动游戏。
4. **房主创建游戏主机**：在游戏内进入“新游戏 → 多人游戏 → 单人场景 → TCP/IP”，创建主机。
5. **加入者连接**：进入相同的 TCP/IP 页面，输入 PlayTogether 中显示的**房主虚拟 IP**。

邀请码包含私密网络的名称和密钥，只应分享给你信任的玩家。手动输入虚拟 IP 是当前主要连接方式；UDP 广播自动发现仅作为辅助能力。

## 工作原理

PlayTogether 使用 Electron 提供桌面界面，并管理 EasyTier 2.6.4 子进程完成虚拟组网。网络优先尝试 P2P 直连，失败时可自动中继。EasyTier RPC 仅绑定本机回环地址，网络密钥通过环境变量传给核心，不放入命令行参数。

默认发现 / 中继节点为 `tcp://public.easytier.cn:11010`，仅用于开发和公共连接，不代表稳定性或可用性保证。可通过 `PLAYTOGETHER_PEER_URL` 环境变量指定其他 EasyTier 节点。

## 开发与构建

### 准备环境

- Node.js 22 或更高版本。
- npm。
- 实际创建和加入虚拟网络需要 Windows；macOS 可用于界面开发和运行 `noTun` 集成测试。

```bash
git clone https://github.com/vaycentsun/playTogether.git
cd playTogether
npm install
npm run fetch:core -- --platform win32 --arch x64
npm run dev
```

`fetch:core` 会下载固定版本的 EasyTier 官方资产并校验 SHA-256。生成的核心文件位于 `core/`，不会提交到 Git。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动 Vite 和 Electron 开发环境 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm test` | 运行无外部网络依赖的单元测试 |
| `npm run build:renderer` | 构建渲染进程 |
| `npm run fetch:core -- --platform win32 --arch x64` | 下载并校验 Windows x64 EasyTier 核心 |
| `npm run pack:win` | 完整构建并生成 Windows x64 NSIS 安装包 |
| `npm run test:integration` | 运行真实 EasyTier 双进程互联测试 |
| `npm audit` | 检查 npm 依赖安全问题 |

Windows 安装包输出到 `release/PlayTogether Setup <version>.exe`。

真实核心集成测试需要包含 `easytier-core` 和 `easytier-cli` 的 macOS 核心目录：

```bash
PLAYTOGETHER_TEST_CORE_DIR=/absolute/path/to/easytier npm run test:integration
```

未设置 `PLAYTOGETHER_TEST_CORE_DIR` 时，集成测试会跳过。该测试使用 `noTun`，只验证真实进程互联和状态接口，不验证 Windows 虚拟网卡或游戏内联机。

开发时还可以通过 `PLAYTOGETHER_EASYTIER_DIR` 指定核心目录。

## 项目结构

```text
src/                  React 界面、IPC 类型和样式
electron/main/        Electron 生命周期、组网、邀请码和游戏适配
electron/preload.cjs  渲染进程的 IPC 桥接
scripts/              EasyTier 核心下载与校验
test/unit/            单元测试
test/integration/     真实核心集成测试
resources/licenses/   第三方许可证与声明
```

## 当前限制

- 仅支持 Windows x64 虚拟网卡组网。
- 仅适配 `Heroes3 HD.exe`；不接受 `HD_Launcher.exe`、Steam 官方 HD Edition 或其他版本作为替代。
- 游戏本体、HD Mod 版本和地图不一致可能导致无法加入或游戏不同步。
- EasyTier 互联成功不等于游戏内联机成功；实际联机还取决于游戏版本、防火墙和地图等因素。
- 当前版本未进行代码签名。

## 第三方组件

虚拟网卡、NAT 穿透、加密和中继由 [EasyTier](https://github.com/EasyTier/EasyTier) 提供。相关第三方许可证和声明见 [`resources/licenses/`](resources/licenses/)。
