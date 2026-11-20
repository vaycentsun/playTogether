# AGENTS.md

## 项目概览

PlayTogether 是面向 Windows x64 的轻量异地局域网游戏工具。当前首个游戏适配目标是《英雄无敌 3》原版/死亡阴影 + HD Mod，通过 `Heroes3 HD.exe` 启动，并使用游戏内的 TCP/IP 虚拟 IP 直连；不是 Steam 官方 HD Edition。

技术栈：Electron 主进程（JavaScript ESM）、React + TypeScript 渲染进程、Vite、Node.js 内置测试框架、electron-builder。虚拟网卡、NAT 穿透、加密和中继由 EasyTier 2.6.4 子进程提供，不在本项目重新实现网络驱动。

## 目录结构

- `src/`：React 界面、IPC 类型声明和样式。
- `electron/main/index.js`：Electron 生命周期及 IPC 注册。
- `electron/main/easytier.js`：EasyTier 参数、子进程生命周期、状态轮询和端口分配。
- `electron/main/invite.js`：`PT1.` 房间邀请码及网络密钥。
- `electron/main/peers.js`：玩家名称、节点角色和成员状态转换。
- `electron/main/game.js`：游戏检测、校验和启动。
- `electron/preload.cjs`：渲染进程唯一 IPC 桥接。
- `scripts/fetch-easytier.mjs`：固定版本、固定资产 ID 和 SHA-256 的核心下载器。
- `test/unit/`：无外部网络依赖的单元测试。
- `test/integration/`：真实 EasyTier 双进程互联测试。
- `core/`、`dist/`、`release/`、`.cache/`：生成目录，不手改其中的文件。

## 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build:renderer
npm run fetch:core -- --platform win32 --arch x64
npm run pack:win
npm audit
```

Windows 安装包输出到 `release/PlayTogether Setup <version>.exe`。`pack:win` 是完整标准构建命令，会先获取核心，再执行类型检查、单元测试、前端构建和 NSIS 打包。

真实核心集成测试需要准备包含 `easytier-core`、`easytier-cli` 的 macOS 核心目录：

```bash
PLAYTOGETHER_TEST_CORE_DIR=/absolute/path/to/easytier npm run test:integration
```

未设置该变量时集成测试会跳过。当前集成测试使用 `noTun`，只验证真实进程互联和状态接口，不验证 Windows 虚拟网卡或游戏联机。

## 网络与安全约束

- 网络名称和密钥只能通过 `ET_NETWORK_NAME`、`ET_NETWORK_SECRET` 环境变量传给核心；不得放进命令行参数、日志或成员状态。
- `PT1.` 邀请码包含网络密钥，只允许展示给当前房间用户，不能写入持久化设置或诊断日志。
- EasyTier RPC 必须绑定 `127.0.0.1`，保留 loopback 白名单，不能暴露到局域网或公网。
- 保持 AES-GCM 加密。不得开启退出节点、接管默认路由或修改系统 DNS；本项目只承载游戏虚拟网段。
- 保留 `contextIsolation: true`、`nodeIntegration: false` 和 preload 桥接，不向渲染进程开放 Node.js。
- 启动游戏和核心时使用参数数组，不使用 `shell: true` 或拼接 shell 命令。
- 离开房间和退出应用时必须清理核心子进程，避免残留的 `PlayTogether.exe`、`easytier-core.exe` 导致 NSIS 提示“无法关闭”。
- 默认 `tcp://public.easytier.cn:11010` 是开发用公共发现/中继节点，不是稳定性保证；可通过 `PLAYTOGETHER_PEER_URL` 覆盖。
- 手动虚拟 IP 直连是当前主流程，UDP 广播自动发现只是辅助能力。

## EasyTier 与 Windows 发布

- 升级 EasyTier 时必须同步更新下载器中的版本、官方资产 ID、SHA-256 和许可证，并重新验证命令行参数及 JSON 输出结构。
- Windows 运行需要管理员权限和 Wintun。`easytier-core.exe`、`easytier-cli.exe`、`wintun.dll`、`Packet.dll`、`WinDivert64.sys` 必须一起打包。
- 安装器当前为 per-machine NSIS，应用清单为 `requireAdministrator`。改变提权模型时必须同步修改安装、退出和进程清理逻辑。
- 应用当前没有代码签名，SmartScreen 提示属于已知发布限制；不得将未签名构建描述为正式签名版本。

## 游戏适配约束

- 只接受文件名为 `Heroes3 HD.exe` 的游戏程序，不把 `HD_Launcher.exe`、Steam 官方 HD Edition 或其他版本当作同一适配目标。
- 双方游戏本体、HD Mod 版本和地图必须一致。
- 当前主联机路径为：房主创建 TCP/IP 主机，加入者输入房主虚拟 IP。
- 不要仅凭进程启动、单元测试或 EasyTier 互联成功就宣称游戏联机成功。正式完成验收需要两台 Windows 机器实际进入同一局游戏。

## 修改与验证要求

- 主进程沿用 JavaScript ESM，渲染进程沿用 TypeScript + React，界面和错误信息使用中文。
- 修改 IPC 时同步更新 `electron/preload.cjs`、`src/vite-env.d.ts` 和对应界面。
- 修改核心逻辑后至少运行 `npm run typecheck`、`npm test`、`npm run build:renderer`；修改网络生命周期时还要运行真实核心集成测试。
- 修改安装配置、核心文件或发布资源后运行 `npm run pack:win`，检查安装包内的核心和许可证文件。
- 新功能优先保持“创建/加入房间、选择游戏、启动游戏”的精简流程，不添加聊天、商城、账号体系等对战平台功能。
