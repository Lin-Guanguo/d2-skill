# d2-skill

> [Switch to English / 切换到英文](README.md)

基于 Bungie.net 官方 API 的 Destiny 2 本地工具和 Agent Skills。

这个项目为 AI Agent 提供一个安全、可审计的 Destiny 2 数据桥接层。它可以回答装备从哪里来、检查你拥有的物品和 roll、查看账号进度、查询活动历史，并执行有限范围内的物品操作，例如转移、装备、锁定和免费插槽插入。CLI 返回结构化 JSON 事实和安全操作计划；主观判断留给 Agent 和用户。

## 能做什么

- 查询官方物品信息、来源分类、当前商人路线、商人成本、是否买得起，以及水晶预览池路线。
- 检查角色和仓库里的已有物品，包括 perk、属性、插槽、重复分组和 dim 愿望单证据。
- 执行安全的原子装备操作：转移、装备、锁定/解锁、邮政官取回，以及免费可复用 plug 插入。不会自动执行拆解这类破坏性游戏内操作。
- 读取游戏进度：货币、凯旋记录、收藏品、可制作武器、指标、进度、里程碑和可用活动。
- 查询活动和统计数据：角色列表、活动历史、PGCR、历史统计、武器使用记录、公会奖励、公会统计、排行榜，以及复合地牢报告。
- 检查和管理游戏内配装栏：切换、保存当前装备、清空槽位，以及更新名称/图标/颜色标识。
- 当有用的官方 API surface 还没有被封装时，可以回退到只读 Bungie `/Platform/...` 原始请求。

## 快速开始

需要 Node.js `>=22.13.0`。

在 [Bungie Application Portal](https://www.bungie.net/en/Application) 创建 Bungie app：

- OAuth client type: `Confidential`
- Redirect URL: `https://127.0.0.1:28780/oauth/callback`
- Scopes: `ReadDestinyInventoryAndVault`, `MoveEquipDestinyItems`

然后配置并登录：

```bash
pnpm install
cp .env.example .env
# 在 .env 中填写 API_KEY、OAUTH_CLIENT_ID 和 OAUTH_CLIENT_SECRET。
pnpm build
node dist/cli.js auth login
node dist/cli.js auth status
```

常用环境变量：

- `API_KEY`: Bungie app API key。
- `OAUTH_CLIENT_ID`: Bungie OAuth client ID。
- `OAUTH_CLIENT_SECRET`: Bungie OAuth client secret。
- `D2_MANIFEST_LANGUAGE`: 物品、perk、活动和商人名称使用的本地化 manifest 语言。默认是 `zh-chs`；支持的值是 `de`、`en`、`es`、`es-mx`、`fr`、`it`、`ja`、`ko`、`pl`、`pt-br`、`ru`、`zh-chs` 和 `zh-cht`。

OAuth token、dim 愿望单 cache、profile cache 和命令审计日志都会存放在仓库外的 `~/.d2-skill/`。

## Agent Skills

在这个仓库根目录使用 Claude Code、Codex、OpenClaw 或其他 Agent。内置 skills 按 AI 应该如何使用系统来分组：

- `d2-login`: 认证、token 状态、认证恢复，以及路由到合适的 D2 skill。
- `d2-info`: 官方信息、物品来源、商人路线、实时售卖、成本、是否买得起，以及当前获取证据。
- `d2-items`: 已拥有物品、roll 和 dim 愿望单证据、重复物品 review、转移、安全装备操作、插槽，以及游戏内配装管理。
- `d2-progress`: 货币、记录、收藏品、可制作武器、指标、里程碑，以及当前或可用活动状态。
- `d2-stats`: 角色、活动历史、PGCR、历史统计、地牢报告、公会奖励、公会聚合统计和排行榜。
- `d2-api`: 只读 Bungie `/Platform/...` fallback 和 SDK coverage 诊断。

支持 `.codex/skills` 或 `.claude/skills` 的 Agent 可以通过仓库里提交的 symlink 发现同一份 repo-local skill 目录。

## CLI 示例

当你想直接获得机器可读的 JSON 事实时，可以直接使用 CLI：

```bash
node dist/cli.js info item-source --name '庆典飞行'
node dist/cli.js vendor sales --name '庆典飞行' --character current
node dist/cli.js inventory search --name '<item name>' --details perks,stats
node dist/cli.js inventory duplicates --type weapon --details perks --limit 20
node dist/cli.js item inspect --item-id <itemInstanceId>
node dist/cli.js gear transfer plan --item-id <itemInstanceId> --target vault
node dist/cli.js loadout equip plan --character current --index 0
node dist/cli.js profile craftables --name '<weapon name>'
node dist/cli.js activity history --character current --mode dungeon --count 50
node dist/cli.js report dungeon
```

完整命令面请使用 `node dist/cli.js --help` 或 `node dist/cli.js <command> --help` 查看。

每次命令都会在 `~/.d2-skill/data/yyyyMMdd/` 写入审计记录。需要重新打开精确命令证据时，使用 JSON 输出里的 `audit.path`。

## 安全模型

- CLI 负责 Bungie API 调用、OAuth、本地 cache、持久化和 JSON 输出。
- Skills 调用 CLI 并解释 stdout JSON；它们不应该复制 Bungie API 逻辑。
- 命令刻意保持原子化。Search、inspect、parse、score、group、plan 和 execute 应该保持分离，除非某个命令被明确记录为复合命令。
- CLI 提供确定性的事实、证据、分数和安全执行原语。AI 负责组合命令、比较取舍并给出建议。
- 复合输出，例如 `report dungeon`，会被标记为 composite，并保留底层证据命令可用。
- 清理工作流使用重复分组、dim 愿望单证据、物品检查和安全转移原语。用户在游戏内处理拆解。
- `api request` 只支持 GET，应该作为一次性官方 API 探索的 fallback。

## 开发

```bash
pnpm typecheck
pnpm test
pnpm build
```

核心目录：

- `src/cli.ts`: 根 CLI dispatcher。
- `src/commands/`: 命令 wiring。
- `src/auth/`, `src/account/`, `src/characters/`: 登录和账号上下文。
- `src/info/`, `src/vendors/`, `src/manifest/`: 官方信息、物品来源、商人和 manifest 逻辑。
- `src/inventory/`, `src/items/`, `src/wishlist/`: 已拥有物品事实、roll 和 dim 愿望单证据。
- `src/gear/`, `src/sockets/`, `src/loadouts/`: 安全物品操作、插槽检查和游戏内配装管理。
- `src/profile/`, `src/activity/`, `src/stats/`, `src/clan/`, `src/reports/`: 进度、活动、统计、公会数据和报告。
- `src/api/`: 只读原始 Bungie API fallback 和 SDK coverage 诊断。
- `skills/`: 面向 Agent 的 skill instructions。
- `docs/`: 项目参考和设计笔记。
