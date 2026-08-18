/**
 * dsh-whale-pet 客户端插件：把鲸鱼娘桌宠注入 DSH Web UI 右下角。
 *
 * 通过官方 shell.overlay 槽位（list / root scope）注册一个 React 组件，
 * 用 useSessions 全局标准 hook 读取 Agent 工作状态，映射为不同动作：
 *   working（running）→ 抱笔记本工作；waiting（pendingInteraction）→ 等你；
 *   completed / 刚结束 → 庆祝 + 播放鲸鱼娘语音（晓伊音色）；idle → 待机。
 * 资源经宿主路由 /api/dsh-whale-pet/assets?f=<path> 加载，无外部请求。
 *
 * 立绘素材取自 DeepSeek 社区项目 dsh-whale-musume（MIT License）；
 * 语音素材取自 DeepSeek 社区项目 aceice01/dsh-whale-pet（非商业使用许可）。
 */
window.__ModuleLoader__.load({
  id: "dsh-whale-pet",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var useState = react.useState;
    var useEffect = react.useEffect;
    var useRef = react.useRef;
    var createElement = react.createElement;

    var ASSET = "/api/dsh-whale-pet/assets?f=";

    // ── 立绘与声音 ────────────────────────────────────────────────
    var IMAGES = {
      idle: ASSET + "dsh-whale-state-idle-cute.webp",
      working: ASSET + "dsh-whale-state-running.webp",
      waiting: ASSET + "dsh-whale-state-waiting.webp",
      completed: ASSET + "dsh-whale-state-success.webp",
      celebrate: ASSET + "dsh-whale-state-celebrate.webp",
      error: ASSET + "dsh-whale-state-failure.webp",
      greet: ASSET + "dsh-whale-state-greet.webp",
    };
    // ── 鲸鱼娘语音（晓伊神经网络音色，DeepSeek 社区 aceice01/dsh-whale-pet 素材）──
    var VOICE_WELCOME = ASSET + "voice-welcome-0.mp3";
    var VOICE_CELEBRATE = [];
    for (var vi = 0; vi < 10; vi++) VOICE_CELEBRATE.push(ASSET + "voice-celebrate-" + vi + ".mp3");
    var VOICE_COQUETRY = [];
    for (var cj = 0; cj < 3; cj++) VOICE_COQUETRY.push(ASSET + "voice-coquetry-" + cj + ".mp3");

    var LABELS = {
      idle: "待机中",
      working: "工作中…",
      waiting: "在等你",
      completed: "完成啦！",
      celebrate: "完成啦！",
      error: "出错了",
    };

    // ── 样式 ──────────────────────────────────────────────────────
    var CSS = [
      ".dsh-whale-pet{position:absolute;right:18px;bottom:18px;width:148px;z-index:1000;pointer-events:auto;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;filter:drop-shadow(0 8px 18px rgba(16,42,90,.28));transition:filter .3s ease}",
      ".dsh-whale-pet:active{cursor:grabbing}",
      ".dsh-whale-pet[data-mood=\"working\"]{filter:drop-shadow(0 0 16px rgba(120,180,255,.7))}",
      ".dsh-whale-pet[data-mood=\"celebrate\"],.dsh-whale-pet[data-mood=\"completed\"]{filter:drop-shadow(0 0 16px rgba(90,220,180,.6))}",
      ".dsh-whale-pet__img{display:block;width:100%;height:auto;pointer-events:none;-webkit-user-drag:none}",
      ".dsh-whale-pet__chip{position:absolute;left:50%;top:-10px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:var(--dsw-alias-bg-float, #ffffff);border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08));font-size:12px;line-height:1.4;color:var(--dsw-alias-text-primary, #1f2733);white-space:nowrap;box-shadow:0 2px 8px rgba(16,42,90,.18)}",
      ".dsh-whale-pet__mute{border:0;background:transparent;cursor:pointer;padding:0 2px;font-size:12px;line-height:1}",
      ".dsh-whale-pet__img--bob{animation:dsh-whale-bob 3.2s ease-in-out infinite}",
      ".dsh-whale-pet__img--work{animation:dsh-whale-work .9s ease-in-out infinite}",
      ".dsh-whale-pet__img--wait{animation:dsh-whale-sway 2.4s ease-in-out infinite}",
      ".dsh-whale-pet__img--celebrate{animation:dsh-whale-happy .6s ease-in-out infinite}",
      "@keyframes dsh-whale-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}",
      "@keyframes dsh-whale-work{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
      "@keyframes dsh-whale-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}",
      "@keyframes dsh-whale-happy{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.05)}}",
      "@media (prefers-reduced-motion:reduce){.dsh-whale-pet__img--bob,.dsh-whale-pet__img--work,.dsh-whale-pet__img--wait,.dsh-whale-pet__img--celebrate{animation:none}}",
    ].join("\n");

    (function injectCss() {
      if (document.querySelector('style[data-plugin="dsh-whale-pet"]')) return;
      var el = document.createElement("style");
      el.setAttribute("data-plugin", "dsh-whale-pet");
      el.textContent = CSS;
      document.head.appendChild(el);
    })();

    // ── 状态派生：SessionListState → 单一情绪 ──────────────────────
    function deriveState(s) {
      var running = false;
      var waiting = false;
      var done = false;
      var ids = s && s.ids ? s.ids : [];
      for (var i = 0; i < ids.length; i++) {
        var row = s.byId && s.byId[ids[i]];
        if (!row || row.blank) continue;
        if (row.running) running = true;
        if (row.pendingInteraction) waiting = true;
        if (row.completed) done = true;
      }
      if (running) return "working";
      if (waiting) return "waiting";
      if (done) return "completed";
      return "idle";
    }

    // ── 声音：懒创建并缓存 Audio，静音可切换 ──────────────────────
    var audioCache = {};
    var mutedFlag = false;
    function audioFor(src) {
      if (!audioCache[src]) {
        try {
          var a = new Audio(src);
          a.preload = "auto";
          a.muted = mutedFlag;
          audioCache[src] = a;
        } catch (e) {
          audioCache[src] = null;
        }
      }
      return audioCache[src];
    }
    function playVoice(src) {
      if (mutedFlag) return;
      var a = audioFor(src);
      if (!a) return;
      try {
        a.currentTime = 0;
        var p = a.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (e) {
        /* 自动播放被浏览器拦截时静默忽略 */
      }
    }
    function playRandom(list) {
      playVoice(list[Math.floor(Math.random() * list.length)]);
    }
    function setMutedFlag(next) {
      mutedFlag = next;
      for (var key in audioCache) {
        if (audioCache[key]) audioCache[key].muted = next;
      }
    }

    var ANIM_CLASS = {
      idle: "dsh-whale-pet__img--bob",
      working: "dsh-whale-pet__img--work",
      waiting: "dsh-whale-pet__img--wait",
      completed: "dsh-whale-pet__img--celebrate",
      celebrate: "dsh-whale-pet__img--celebrate",
      error: "dsh-whale-pet__img--wait",
    };

    // ── 桌宠组件（注册进 shell.overlay，root scope → 拿到 useSessions）──
    function PetOverlay(props) {
      var useSessions = props.useSessions;
      var state = useSessions(deriveState);

      var celebrate = useState(false);
      var celebrating = celebrate[0];
      var setCelebrating = celebrate[1];

      var muted = useState(false);
      var isMuted = muted[0];
      var setMuted = muted[1];

      // 位置：null = 默认右下角；拖拽后为 {left, top}。
      var posState = useState(null);
      var pos = posState[0];
      var setPos = posState[1];

      var prevRef = useRef(state);
      var timerRef = useRef(null);
      var dragRef = useRef(null);
      var movedRef = useRef(false);
      var rootRef = useRef(null);

      // 工作状态变化 → 结束检测（边沿触发，一次庆祝 + 一句鲸鱼娘语音）。
      useEffect(function () {
        var prev = prevRef.current;
        prevRef.current = state;

        var finished = false;
        if (prev !== "working" && state === "completed") {
          // 未选中时完成：completed 标志被置位。
          finished = true;
        } else if (prev === "working" && state !== "working" && state !== "waiting") {
          // 正在观看时完成：running → idle / completed。
          finished = true;
        }
        if (!finished) return;

        setCelebrating(true);
        playRandom(VOICE_CELEBRATE);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(function () {
          setCelebrating(false);
        }, 6000);
      }, [state]);

      // 首次挂载时打声招呼（受浏览器自动播放策略约束，拦截则静默）。
      useEffect(function () {
        var t = setTimeout(function () {
          playVoice(VOICE_WELCOME);
        }, 800);
        return function () {
          clearTimeout(t);
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      }, []);

      var mood = celebrating ? "celebrate" : state;
      var src = IMAGES[mood] || IMAGES.idle;
      var label = celebrating ? LABELS.celebrate : LABELS[state] || "";

      function onPointerDown(e) {
        if (e.button !== 0) return;
        movedRef.current = false;
        var el = rootRef.current;
        if (!el) return;
        var r = el.getBoundingClientRect();
        dragRef.current = {
          dx: e.clientX - r.left,
          dy: e.clientY - r.top,
        };
        setPos({
          left: r.left,
          top: r.top,
        });
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      function onPointerMove(e) {
        if (!dragRef.current) return;
        movedRef.current = true;
        setPos({
          left: e.clientX - dragRef.current.dx,
          top: e.clientY - dragRef.current.dy,
        });
      }
      function onPointerUp() {
        dragRef.current = null;
      }
      function onClick() {
        if (movedRef.current) return; // 拖拽结束不算点击
        playRandom(VOICE_COQUETRY); // 点击撒娇（用户手势，同时解锁自动播放）
      }
      function onToggleMute(e) {
        e.stopPropagation();
        e.preventDefault();
        setMutedFlag(!isMuted);
        setMuted(!isMuted);
      }

      var imgProps = {
        className: "dsh-whale-pet__img " + (ANIM_CLASS[mood] || ""),
        src: src,
        alt: "鲸鱼娘",
        draggable: false,
      };

      var containerStyle = {
        position: "absolute",
        left: pos ? pos.left + "px" : "auto",
        top: pos ? pos.top + "px" : "auto",
        right: pos ? "auto" : "18px",
        bottom: pos ? "auto" : "18px",
      };

      return createElement(
        "div",
        {
          ref: rootRef,
          className: "dsh-whale-pet",
          "data-mood": mood,
          style: containerStyle,
          title: "鲸鱼娘 · 点击撒娇语音 · 可拖拽",
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: onPointerUp,
          onClick: onClick,
        },
        createElement(
          "div",
          { className: "dsh-whale-pet__chip" },
          createElement("span", null, label),
          createElement(
            "button",
            {
              className: "dsh-whale-pet__mute",
              title: isMuted ? "取消静音" : "静音",
              onPointerDown: function (e) {
                e.stopPropagation();
              },
              onClick: onToggleMute,
            },
            isMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A"
          )
        ),
        createElement("img", imgProps)
      );
    }

    var inject = ["slots"];

    function apply(ctx) {
      ctx.effect(function () {
        // 用 declaration injection 等 shell.overlay 被 ui-layout 声明后再注册，
        // 与插件加载顺序解耦。
        return ctx.slots.inject("shell.overlay", function () {
          return ctx.slots.register(
            {
              name: "shell.overlay",
              id: "dsh-whale-pet",
              order: 1000,
              label: "鲸鱼娘桌宠",
            },
            PetOverlay
          );
        });
      }, "dsh-whale-pet: overlay registration");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
