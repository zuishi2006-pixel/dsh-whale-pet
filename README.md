# dsh-whale-pet —— 鲸鱼娘桌宠

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 打造的右下角看板娘插件。

一只鲸鱼娘会待在 Web 界面右下角，根据 Agent 当前的工作状态做出不同动作：

| Agent 状态 | 鲸鱼娘动作 | 立绘 |
|---|---|---|
| `running = true`（工作中） | 抱起笔记本陪你干活，带淡蓝光晕 | `running` |
| `pendingInteraction`（等你答复） | 歪头等你 | `waiting` |
| 任务刚完成 | 庆祝 + 随机播一句「晓伊」鲸鱼娘语音 | `celebrate` |
| `completed`（未打开前） | 完成啦 | `success` |
| 空闲 | 安静待机、轻轻漂浮 | `idle-cute` |

- 立绘素材取自 DeepSeek 社区开源项目 [dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume)（MIT License），不自行重新设计形象。
- 语音素材（二次元鲸鱼娘「晓伊」神经网络音色，49 条台词中的 welcome/celebrate/coquetry 片段）取自 DeepSeek 社区项目 [aceice01/dsh-whale-pet](https://github.com/aceice01/dsh-whale-pet)（非商业使用许可，见 [NOTICE](./NOTICE)）。

## 特性

- 官方 `shell.overlay` 槽位注入（React 组件，走 `useSessions` 全局标准 hook），零侵入、不改业务 DOM。
- 状态机：`working` / `waiting` / `completed` / `celebrate` / `idle`，随 Agent 运行状态实时切换。
- 任务完成边沿检测：只播一次庆祝语音，不重复轰炸（10 句随机）。
- 首次出现会用「晓伊」语音打招呼；点击鲸鱼娘随机撒娇语音。
- 可拖拽；右上角小喇叭可静音/取消静音。
- 全部资源本地加载（宿主静态路由），无外部请求、无遥测。
- 尊重 `prefers-reduced-motion`，减少动效。

## 目录结构

```
dsh-whale-pet/
├── package.json        # dsh.bundle + dsh.client 双面声明
├── cordis.patch.yml    # bundle patch：insert 宿主行
├── lib/
│   ├── index.js        # 宿主半边：注册 /api/dsh-whale-pet/assets 静态资源路由
│   └── client.js       # 浏览器半边：shell.overlay 桌宠组件
├── assets/             # 鲸鱼娘立绘 (webp) + 鲸鱼娘语音 (mp3)
├── NOTICE              # 素材来源与授权
└── README.md
```

## 安装

1. 把本目录安装为 profile 的树外插件（复制到 `$DSH_HOME/profiles/node_modules/dsh-whale-pet/`）。
2. 在 profile 的 `package.json` 的 `dsh.profile.bundles` 末尾追加 `"dsh-whale-pet"`。
3. 重启 `dsh web`（插件集变化需重启生效），刷新页面即可在右下角看到鲸鱼娘。

示例（`dsh web` profile）：

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {},
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-whale-pet"
      ]
    }
  }
}
```

## 二次开发

- 换动作/立绘：改 `lib/client.js` 里的 `IMAGES` 与 `deriveState`。
- 换语音：替换 `assets/voice-*.mp3`（庆祝 10 句、撒娇 3 句、问候 1 句）。
- 换文案：改 `LABELS`。

## License

本插件代码 MIT；鲸鱼娘立绘来自 [dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume)（MIT），鲸鱼娘语音来自 [aceice01/dsh-whale-pet](https://github.com/aceice01/dsh-whale-pet)（非商业使用许可，仅本地非商业演示）。详见 [NOTICE](./NOTICE)。
