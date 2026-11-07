/* =========================================================
   UI behaviour: boot log, cursor, typing, reveals, tilt,
   node graph, timeline, contact terminal, mini simulations.
   ========================================================= */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  $("#year").textContent = new Date().getFullYear();

  /* ---------- boot sequence (once per session) ---------- */
  const boot = $("#boot");
  const bootLines = [
    "[    0.000] booting prasun_os (aarch64)…",
    "[ <ok>OK</ok> ] mounted /dev/curiosity",
    "[ <ok>OK</ok> ] started robot_state_publisher",
    "[ <ok>OK</ok> ] loaded rover.glb  (blender → glTF)",
    "[ <ok>OK</ok> ] /scan publisher online  @ 10 Hz",
    "[ <ok>OK</ok> ] policy checkpoint: ppo_social_nav.zip",
    "<hi>&gt; launching portfolio.launch.py</hi>",
  ];
  async function runBoot() {
    let seen = false;
    try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) {}
    if (reduced || seen || location.search.includes("skipboot")) { boot.classList.add("done"); return; }
    const log = $("#boot-log");
    for (const l of bootLines) {
      log.innerHTML += l.replace(/<ok>(.*?)<\/ok>/g, '<span class="ok">$1</span>')
                        .replace(/<hi>(.*?)<\/hi>/g, '<span class="hi">$1</span>') + "\n";
      await sleep(110 + Math.random() * 90);
    }
    await sleep(250);
    boot.classList.add("done");
    try { sessionStorage.setItem("booted", "1"); } catch (e) {}
  }
  runBoot().then(() => { scramble($(".scramble")); typeRoles(); });

  /* ---------- custom cursor ---------- */
  if (fine && !reduced) {
    const dot = $(".cursor-dot"), ring = $(".cursor-ring");
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; });
    (function loop() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("pointerover", (e) => {
      ring.classList.toggle("hover", !!e.target.closest("a, button, .tilt, .node"));
    });
  }

  /* ---------- nav ---------- */
  const nav = $(".nav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });

  /* ---------- scramble text ---------- */
  function scramble(el) {
    if (!el || reduced) return;
    const target = el.dataset.text, glyphs = "!<>-_\\/[]{}—=+*^?#01";
    let frame = 0;
    const total = 28;
    (function step() {
      el.textContent = target.split("").map((c, i) => {
        if (c === " ") return " ";
        return frame / total > i / target.length ? c : glyphs[(Math.random() * glyphs.length) | 0];
      }).join("");
      if (frame++ < total) requestAnimationFrame(step); else el.textContent = target;
    })();
  }

  /* ---------- typed roles ---------- */
  const roles = [
    "robot learning researcher",
    "autonomous navigation",
    "reinforcement learning · PPO · SAC",
    "multi-robot coordination",
    "ROS 2 · Gazebo · MuJoCo",
    "control systems & embedded",
  ];
  async function typeRoles() {
    const el = $("#typed");
    if (reduced) { el.textContent = roles[0]; return; }
    for (let i = 0; ; i = (i + 1) % roles.length) {
      for (const ch of roles[i]) { el.textContent += ch; await sleep(45); }
      await sleep(1600);
      while (el.textContent.length) { el.textContent = el.textContent.slice(0, -1); await sleep(22); }
      await sleep(250);
    }
  }

  /* ---------- reveal + counters ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      const idx = [...el.parentElement.children].filter((c) => c.classList.contains("reveal")).indexOf(el);
      el.style.transitionDelay = `${Math.max(0, idx) * 70}ms`;
      el.classList.add("in");
      $$("[data-count]", el).forEach(countUp);
      if (el.id === "node-graph") drawWires();
      if (el.querySelector("#contact-term")) contactTerm();
      io.unobserve(el);
    }
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el) => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    (function f(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * e);
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- project filters ---------- */
  $$(".filters button").forEach((b) => b.addEventListener("click", () => {
    $$(".filters button").forEach((x) => x.classList.toggle("active", x === b));
    const f = b.dataset.filter;
    $$(".project, .card").forEach((p) => {
      const show = f === "all" || p.dataset.tags.split(" ").includes(f);
      p.classList.toggle("hidden", !show);
      if (show) p.classList.add("in");
    });
  }));

  /* ---------- tilt + spotlight ---------- */
  if (fine && !reduced) {
    $$(".tilt").forEach((el) => {
      const max = el.classList.contains("featured") ? 3 : 7;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        el.style.transition = "border-color .3s, transform .1s";
        el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "border-color .3s, transform .6s cubic-bezier(.2,.7,.2,1)";
        el.style.transform = "";
      });
    });
    /* magnetic buttons */
    $$(".magnetic").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      b.addEventListener("pointerleave", () => (b.style.transform = ""));
    });
  }

  /* ---------- skill node graph wires ---------- */
  const edges = [
    ["perception", "learning"], ["learning", "planning"], ["planning", "control"],
    ["sim", "learning"], ["middleware", "perception"], ["middleware", "control"],
    ["hardware", "middleware"], ["lang", "sim"], ["control", "hardware"],
  ];
  function drawWires() {
    const g = $("#node-graph"), svg = $(".graph-wires", g);
    const gr = g.getBoundingClientRect();
    const box = (n) => {
      const r = $(`[data-node="${n}"]`, g).getBoundingClientRect();
      return { x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height };
    };
    svg.setAttribute("viewBox", `0 0 ${gr.width} ${gr.height}`);
    svg.innerHTML = "";
    edges.forEach(([a, b], i) => {
      const A = box(a), B = box(b);
      const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
      const dy = Math.abs(by - ay) < 10 ? 0 : 1;
      // exit from the side facing the target
      const sx = dy ? ax : (bx > ax ? A.x + A.w : A.x), sy = dy ? (by > ay ? A.y + A.h : A.y) : ay;
      const ex = dy ? bx : (bx > ax ? B.x : B.x + B.w), ey = dy ? (by > ay ? B.y : B.y + B.h) : by;
      const d = dy
        ? `M${sx},${sy} C${sx},${(sy + ey) / 2} ${ex},${(sy + ey) / 2} ${ex},${ey}`
        : `M${sx},${sy} C${(sx + ex) / 2},${sy} ${(sx + ex) / 2},${ey} ${ex},${ey}`;
      for (const cls of ["", "flow" + (i % 3 === 0 ? " hot" : "")]) {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", d);
        if (cls) { p.setAttribute("class", cls); p.style.animationDelay = `${-i * 0.37}s`; }
        p.dataset.a = a; p.dataset.b = b;
        svg.appendChild(p);
      }
    });
  }
  addEventListener("resize", () => { if ($("#node-graph").classList.contains("in")) drawWires(); });
  $$(".node").forEach((n) => {
    n.addEventListener("pointerenter", () => {
      const id = n.dataset.node;
      $$(".graph-wires path.flow").forEach((p) => p.style.opacity = (p.dataset.a === id || p.dataset.b === id) ? 1 : 0.15);
    });
    n.addEventListener("pointerleave", () => $$(".graph-wires path.flow").forEach((p) => p.style.opacity = ""));
  });

  /* ---------- timeline progress ---------- */
  const tl = $(".timeline"), tlp = $(".tl-progress");
  addEventListener("scroll", () => {
    const r = tl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
    tlp.style.height = `${p * 100}%`;
  }, { passive: true });

  /* ---------- contact terminal ---------- */
  let contactDone = false;
  async function contactTerm() {
    if (contactDone) return; contactDone = true;
    const el = $("#contact-term");
    const script = [
      ["cmd", "ros2 topic echo /prasun/status --once"],
      ["out", '<span class="c">data:</span> "Looking for research internships in robot learning, navigation & multi-robot systems."'],
      ["cmd", "ros2 service call /prasun/contact"],
      ["out", '<span class="c">email:</span>  <a class="term-link" href="mailto:prasunjha080806@gmail.com">prasunjha080806@gmail.com</a>'],
      ["out", '<span class="c">github:</span> <a class="term-link" href="https://github.com/prasunjha8" target="_blank" rel="noopener">github.com/prasunjha8</a>'],
      ["out", '<span class="c">linkedin:</span> <a class="term-link" href="https://www.linkedin.com/in/prasun-jha-703685216/" target="_blank" rel="noopener">in/prasun-jha-703685216</a>'],
      ["out", '<span class="c">where:</span>  Ranchi / Jamshedpur, India  (IST, UTC+5:30)'],
      ["out", '<span class="ok">success: true</span>'],
    ];
    const prompt = '<span class="ok">prasun@robolab</span>:<span class="c">~</span>$ ';
    for (const [kind, text] of script) {
      if (kind === "cmd") {
        el.innerHTML += prompt;
        for (const ch of text) { el.innerHTML += ch; await sleep(reduced ? 0 : 28); }
        el.innerHTML += "\n"; await sleep(reduced ? 0 : 300);
      } else { el.innerHTML += text + "\n"; await sleep(reduced ? 0 : 140); }
    }
    el.innerHTML += prompt + '<span class="caret">▍</span>';
  }

  /* ---------- portrait: voxel assemble + scatter-on-hover ---------- */
  function voxelPortrait(fig) {
    const img = fig.querySelector("img");
    const cv = document.createElement("canvas");
    cv.className = "voxel-canvas";
    img.after(cv);
    const ctx = cv.getContext("2d");
    let W, H, B, blocks = [], t0 = 0, started = false, mouse = null, raf = 0;

    function layout() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = fig.clientWidth; H = fig.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      B = W < 360 ? 12 : 9;
      // object-fit: cover mapping from canvas space to image pixels
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const ox = (W - img.naturalWidth * s) / 2, oy = (H - img.naturalHeight * s) / 2;
      blocks = [];
      for (let y = 0; y < H; y += B) for (let x = 0; x < W; x += B) {
        const z = Math.random();
        blocks.push({
          hx: x, hy: y, sx: (x - ox) / s, sy: (y - oy) / s, ss: B / s,
          fx: x + (Math.random() - 0.5) * W * 1.6, fy: y + (Math.random() - 0.3) * H * 1.2,
          z, delay: (1 - y / H) * 0.9 + Math.random() * 0.35,   // assembles bottom → top
          dx: 0, dy: 0,
        });
      }
    }

    function frame(now) {
      const T = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      let busy = false;
      for (const b of blocks) {
        const lp = Math.min(1, Math.max(0, (T - b.delay) / 1.1));
        const f = 1 - Math.pow(1 - lp, 3);
        if (lp < 1) busy = true;
        // cursor push
        let tx = 0, ty = 0;
        if (mouse) {
          const cx = b.hx + B / 2 - mouse.x, cy = b.hy + B / 2 - mouse.y, d = Math.hypot(cx, cy);
          if (d < 70) { const k = Math.pow(1 - d / 70, 2) * 9; tx = (cx / (d || 1)) * k + (Math.random() - 0.5) * k * 0.6; ty = (cy / (d || 1)) * k - k * 0.5; }
        }
        b.dx += (tx - b.dx) * 0.18; b.dy += (ty - b.dy) * 0.18;
        const disp = Math.abs(b.dx) + Math.abs(b.dy);
        if (disp > 0.15) busy = true;
        const x = b.fx + (b.hx - b.fx) * f + b.dx, y = b.fy + (b.hy - b.fy) * f + b.dy;
        const loose = Math.min(1, (1 - f) + disp / 12);
        const lift = Math.min(1, disp / 6);   // hovered tiles pop toward the viewer
        const size = B * (1 + (1 - f) * b.z * 1.4 + lift * 0.35) - (loose > 0.02 ? 1.2 * loose + 0.4 : 0);
        ctx.globalAlpha = 0.15 + 0.85 * f;
        ctx.drawImage(img, b.sx, b.sy, b.ss, b.ss, x, y, size, size);
        if (loose > 0.02) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(0,229,255,${0.55 * loose})`;
          ctx.fillRect(x, y, size, size);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.globalAlpha = 1;
      raf = busy || mouse ? requestAnimationFrame(frame) : 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function start() {
      if (started) return; started = true;
      layout(); img.style.opacity = "0"; t0 = performance.now(); kick();
    }
    const go = () => new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); start(); } }, { threshold: 0.35 }).observe(fig);
    img.complete && img.naturalWidth ? go() : img.addEventListener("load", go, { once: true });

    fig.addEventListener("pointermove", (e) => { const r = fig.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; if (started) kick(); });
    fig.addEventListener("pointerleave", () => { mouse = null; if (started) kick(); });
    new ResizeObserver(() => { if (started) { layout(); t0 = performance.now() - 5000; kick(); } }).observe(fig);
  }
  if (!reduced) $$(".portrait").forEach(voxelPortrait);

  /* ---------- recordings: load + play only while on screen ---------- */
  const vio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting && !reduced) { v.play().catch(() => {}); } else { v.pause(); }
    }
  }, { threshold: 0.25 });
  $$(".lazy-video").forEach((v) => vio.observe(v));

  /* ---------- portrait "detection" confidence ---------- */
  const conf = $("#conf");
  if (conf) new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    const t0 = performance.now();
    (function f(t) {
      const p = Math.min(1, (t - t0) / 1600);
      conf.textContent = (0.97 * (1 - Math.pow(1 - p, 3))).toFixed(2);
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }, { threshold: 0.4 }).observe(conf.closest(".portrait"));

  /* =========================================================
     Mini simulations: small, cheap 2D canvases for each project.
     Each runs only while visible.
     ========================================================= */
  const C = { cyan: "#00e5ff", orange: "#ff5a1f", green: "#3dfc8a", grid: "rgba(120,200,255,0.07)", muted: "#8b98a5" };

  function makeSim(canvas, init, step) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, state = null, running = false, last = 0;
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = init(W, H);
    };
    const loop = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      step(ctx, state, W, H, dt);
      requestAnimationFrame(loop);
    };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => {
      const was = running; running = e.isIntersecting;
      if (running && !was) { last = performance.now(); requestAnimationFrame(loop); }
    }).observe(canvas);
    resize();
    if (reduced) setTimeout(() => step(ctx, state, W, H, 0.016), 50);
  }
  const grid = (ctx, W, H, s = 20) => {
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < W; x += s) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (let y = 0; y < H; y += s) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();
  };
  const trace = (ctx, arr, x0, y0, w, h, scale, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    arr.forEach((v, i) => { const x = x0 + (i / (arr.length - 1)) * w, y = y0 + h / 2 - v * scale; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  };
  const label = (ctx, t, x, y, col = C.muted) => { ctx.fillStyle = col; ctx.font = "10px JetBrains Mono, monospace"; ctx.fillText(t, x, y); };

  const sims = {
    /* Social navigation: robot moves down a corridor; pedestrians use a simple velocity-obstacle-style repulsion. */
    crowd: (W, H) => ({
      t: 0,
      robot: { x: 40, y: H / 2, vx: 0, vy: 0 },
      peds: Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * (H - 80), v: -(20 + Math.random() * 25) * (Math.random() < .5 ? 1 : -1) })),
    }),
    moto: () => ({ t: 0, roll: 0.3, rate: 0, hist: Array(120).fill(0) }),
    slam: (W, H) => {
      const cs = 8, cols = Math.ceil(W / cs), rows = Math.ceil(H / cs);
      const walls = [];
      for (let i = 0; i < 7; i++) walls.push({ x: Math.random() * W * .8 + W * .1, y: Math.random() * H * .7 + H * .15, w: 20 + Math.random() * 50, h: 8 + Math.random() * 30 });
      return { t: 0, cs, cols, rows, seen: new Uint8Array(cols * rows), walls, ang: 0 };
    },
    flight: () => ({ t: 0, alt: 0, v: 0, integ: 0, prevErr: 0, sp: 0.5, hist: Array(160).fill(0), sph: Array(160).fill(0) }),
    pendulum: () => ({ th: 0.25, w: 0, x: 0, xv: 0, integ: 0, hist: Array(120).fill(0), kick: 2 }),
    /* Gridworld value iteration: V(s) <- max_a [ r + γ V(s') ], one synchronous sweep per tick. */
    valueiter: () => {
      const cols = 10, rows = 4, walls = new Set(["3,1", "3,2", "6,0", "6,1"]);
      const term = { "9,0": 1, "9,1": -1, "5,3": -1 };
      return { cols, rows, walls, term, V: new Float32Array(cols * rows), k: 0, acc: 0, hold: 0 };
    },
  };

  const steps = {
    crowd(ctx, s, W, H, dt) {
      s.t += dt;
      ctx.clearRect(0, 0, W, H); grid(ctx, W, H, 24);
      // corridor walls
      ctx.fillStyle = "rgba(0,229,255,.08)"; ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 16, W, 16);
      const r = s.robot;
      // goal-seeking + repulsion (social force flavour)
      let fx = 60 - r.vx, fy = (H / 2 - r.y) * 0.8 - r.vy;
      for (const p of s.peds) {
        const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy);
        if (d < 70) { fx += (dx / d) * 1800 / d; fy += (dy / d) * 4000 / d; }
      }
      r.vx += fx * dt * 2; r.vy += fy * dt * 2;
      const sp = Math.hypot(r.vx, r.vy); if (sp > 70) { r.vx *= 70 / sp; r.vy *= 70 / sp; }
      r.x += r.vx * dt; r.y = Math.max(28, Math.min(H - 28, r.y + r.vy * dt));
      if (r.x > W + 20) r.x = -20;
      const hdg = Math.atan2(r.vy, r.vx);
      // camera FOV cone
      ctx.fillStyle = "rgba(0,229,255,.08)"; ctx.beginPath(); ctx.moveTo(r.x, r.y);
      ctx.arc(r.x, r.y, 120, hdg - .5, hdg + .5); ctx.closePath(); ctx.fill();
      let violations = 0;
      for (const p of s.peds) {
        p.x += p.v * dt;
        p.y += Math.sin(s.t * 1.3 + p.x * 0.02) * 6 * dt;
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        const d = Math.hypot(r.x - p.x, r.y - p.y), close = d < 38;
        if (close) violations++;
        ctx.strokeStyle = close ? "rgba(255,90,31,.7)" : "rgba(255,90,31,.2)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.stroke();       // proxemic zone
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill();
      }
      // robot
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(hdg);
      ctx.fillStyle = C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, 7); ctx.lineTo(-8, -7); ctx.closePath(); ctx.fill(); ctx.restore();
      label(ctx, `policy: ppo  ·  proxemic violations: ${violations}`, 12, H - 24, C.cyan);
      label(ctx, "camera-only · no lidar", 12, 30);
    },
    moto(ctx, s, W, H, dt) {
      s.t += dt;
      // dynamics: inverted-pendulum-like roll, controller ≈ trained policy (PD here, for illustration)
      const g = 9.0, u = -14 * s.roll - 3.2 * s.rate;
      if (Math.random() < dt * 0.6) s.rate += (Math.random() - .5) * 1.6;
      s.rate += (g * Math.sin(s.roll) + u) * dt; s.roll += s.rate * dt;
      s.hist.push(s.roll); s.hist.shift();
      ctx.clearRect(0, 0, W, H); grid(ctx, W, H);
      const cx = W * 0.2, gy = H - 18;
      ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W * .4, gy); ctx.stroke();
      ctx.save(); ctx.translate(cx, gy); ctx.rotate(s.roll);
      ctx.fillStyle = "#222"; ctx.fillRect(-6, -26, 12, 26);                 // wheel (rear view)
      ctx.fillStyle = C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
      ctx.fillRect(-12, -62, 24, 34);                                         // body
      ctx.fillStyle = C.orange; ctx.fillRect(-16, -66, 32, 5);                // handlebar
      ctx.restore();
      label(ctx, `roll ${(s.roll * 57.3).toFixed(1)}°`, 12, 18, C.cyan);
      trace(ctx, s.hist, W * .42, 10, W * .55, H - 20, 70, C.cyan);
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.moveTo(W * .42, H / 2); ctx.lineTo(W * .97, H / 2); ctx.stroke();
      label(ctx, "SAC policy · roll(t)", W * .42, 18);
    },
    slam(ctx, s, W, H, dt) {
      s.t += dt; s.ang += dt * 5;
      const rx = W / 2 + Math.cos(s.t * .35) * W * .32, ry = H / 2 + Math.sin(s.t * .7) * H * .28;
      const hit = (x, y) => x < 2 || y < 2 || x > W - 2 || y > H - 2 || s.walls.some((w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
      ctx.clearRect(0, 0, W, H);
      // cast rays, mark free cells
      const rays = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        let d = 0; for (; d < 90; d += 3) { const x = rx + Math.cos(a) * d, y = ry + Math.sin(a) * d; if (hit(x, y)) break;
          const c = ((x / s.cs) | 0) + ((y / s.cs) | 0) * s.cols; s.seen[c] = Math.max(s.seen[c], 1); }
        const hx = rx + Math.cos(a) * d, hy = ry + Math.sin(a) * d;
        if (d < 90) { const c = ((hx / s.cs) | 0) + ((hy / s.cs) | 0) * s.cols; s.seen[c] = 2; }
        rays.push([hx, hy, d < 90]);
      }
      for (let i = 0; i < s.seen.length; i++) {
        if (!s.seen[i]) continue;
        ctx.fillStyle = s.seen[i] === 2 ? "rgba(255,90,31,.85)" : "rgba(0,229,255,.07)";
        ctx.fillRect((i % s.cols) * s.cs, ((i / s.cols) | 0) * s.cs, s.cs - 1, s.cs - 1);
      }
      ctx.strokeStyle = "rgba(0,229,255,.25)"; ctx.beginPath();
      rays.forEach(([x, y], i) => { if (i % 2 === ((s.t * 10) | 0) % 2) { ctx.moveTo(rx, ry); ctx.lineTo(x, y); } }); ctx.stroke();
      ctx.fillStyle = C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(rx, ry, 5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      const known = s.seen.reduce((a, v) => a + (v ? 1 : 0), 0);
      label(ctx, `slam_toolbox · map ${((known / s.seen.length) * 100).toFixed(0)}%`, 10, 16, C.cyan);
      if (known / s.seen.length > 0.9) s.seen.fill(0);
    },
    flight(ctx, s, W, H, dt) {
      s.t += dt;
      if (Math.floor(s.t / 4) !== Math.floor((s.t - dt) / 4)) s.sp = (Math.random() - .5) * 1.4;
      const err = s.sp - s.alt; s.integ += err * dt;
      const u = 6 * err + 1.2 * s.integ + 3.6 * ((err - s.prevErr) / dt || 0); s.prevErr = err;
      const gust = Math.sin(s.t * 7) * 0.6 + (Math.random() - .5) * 2;
      s.v += (Math.max(-8, Math.min(8, u)) - 1.4 * s.v + gust) * dt; s.alt += s.v * dt;
      s.hist.push(s.alt); s.hist.shift(); s.sph.push(s.sp); s.sph.shift();
      ctx.clearRect(0, 0, W, H); grid(ctx, W, H);
      ctx.setLineDash([4, 4]); trace(ctx, s.sph, 10, 10, W - 20, H - 20, 40, "rgba(255,90,31,.8)"); ctx.setLineDash([]);
      trace(ctx, s.hist, 10, 10, W - 20, H - 20, 40, C.cyan);
      const py = 10 + (H - 20) / 2 - s.alt * 40, px = W - 10;
      ctx.save(); ctx.translate(px, py); ctx.rotate(-s.v * 0.15);
      ctx.fillStyle = C.cyan; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-10, -4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill(); ctx.fillRect(-6, -9, 4, 18); ctx.restore();
      label(ctx, "altitude hold · PID", 10, 16, C.cyan); label(ctx, "-- setpoint", W - 90, H - 8, C.orange);
    },
    pendulum(ctx, s, W, H, dt) {
      // linearised cart-pole, PID on angle + weak PD on cart position
      for (let k = 0; k < 4; k++) {
        const h = dt / 4;
        s.integ += s.th * h;
        const F = 60 * s.th + 14 * s.w + 4 * s.integ + 1.2 * s.x + 2.2 * s.xv;
        s.xv += F * h; s.x += s.xv * h;
        s.w += (12 * Math.sin(s.th) - F * Math.cos(s.th)) * h; s.th += s.w * h;
      }
      s.kick -= dt; if (s.kick < 0) { s.w += (Math.random() - .5) * 2.4; s.kick = 2 + Math.random() * 2; }
      s.hist.push(s.th); s.hist.shift();
      ctx.clearRect(0, 0, W, H); grid(ctx, W, H);
      const gy = H - 22, cx = W * 0.22 + Math.max(-W * .15, Math.min(W * .15, s.x * 30));
      ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.beginPath(); ctx.moveTo(10, gy + 8); ctx.lineTo(W * .44, gy + 8); ctx.stroke();
      ctx.fillStyle = "#1b2430"; ctx.fillRect(cx - 22, gy - 8, 44, 14);
      ctx.fillStyle = "#333"; [-14, 14].forEach((o) => { ctx.beginPath(); ctx.arc(cx + o, gy + 6, 4, 0, 7); ctx.fill(); });
      const L = 70, tx = cx + Math.sin(s.th) * L, ty = gy - 8 - Math.cos(s.th) * L;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(cx, gy - 8); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 1;
      trace(ctx, s.hist, W * .48, 10, W * .49, H - 20, 120, C.cyan);
      label(ctx, `θ ${(s.th * 57.3).toFixed(1)}° · Kalman + PID`, W * .48, 16, C.cyan);
    },
  };

  steps.valueiter = (ctx, s, W, H, dt) => {
    const { cols, rows, walls, term } = s, gamma = 0.9, stepR = -0.02;
    const id = (x, y) => x + y * cols, key = (x, y) => x + "," + y;
    const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const next = (x, y, m) => {
      const nx = x + m[0], ny = y + m[1];
      return (nx < 0 || ny < 0 || nx >= cols || ny >= rows || walls.has(key(nx, ny))) ? [x, y] : [nx, ny];
    };
    s.acc += dt;
    if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { s.V.fill(0); s.k = 0; } }
    else if (s.acc > 0.18) {
      s.acc = 0; let delta = 0; const NV = new Float32Array(s.V);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const k = key(x, y); if (walls.has(k)) continue;
        if (k in term) { NV[id(x, y)] = term[k]; continue; }
        let best = -Infinity;
        for (const m of moves) { const [nx, ny] = next(x, y, m); best = Math.max(best, stepR + gamma * s.V[id(nx, ny)]); }
        delta = Math.max(delta, Math.abs(best - s.V[id(x, y)])); NV[id(x, y)] = best;
      }
      s.V = NV; s.k++;
      if (s.k > 2 && delta < 1e-3) s.hold = 2.5;
    }
    ctx.clearRect(0, 0, W, H);
    const cs = Math.min((W - 20) / cols, (H - 26) / rows), ox = (W - cs * cols) / 2, oy = 20;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const k = key(x, y), px = ox + x * cs, py = oy + y * cs, v = s.V[id(x, y)];
      if (walls.has(k)) { ctx.fillStyle = "#1b2430"; ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2); continue; }
      ctx.fillStyle = v >= 0 ? "rgba(0,229,255," + (Math.min(1, v) * 0.75 + 0.04) + ")" : "rgba(255,90,31," + (Math.min(1, -v) * 0.75 + 0.04) + ")";
      ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
      if (k in term) { label(ctx, term[k] > 0 ? "+1" : "−1", px + cs / 2 - 7, py + cs / 2 + 4, "#fff"); continue; }
      if (s.k === 0) continue;
      // greedy-policy arrow
      let bi = 0, bv = -Infinity;
      moves.forEach((m, i) => { const [nx, ny] = next(x, y, m); const q = s.V[id(nx, ny)]; if (q > bv) { bv = q; bi = i; } });
      const [dx, dy] = moves[bi], cx = px + cs / 2, cy = py + cs / 2, r = cs * 0.22;
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(cx - dx * r, cy - dy * r); ctx.lineTo(cx + dx * r, cy + dy * r);
      ctx.lineTo(cx + dx * r * 0.3 - dy * r * 0.5, cy + dy * r * 0.3 - dx * r * 0.5);
      ctx.moveTo(cx + dx * r, cy + dy * r);
      ctx.lineTo(cx + dx * r * 0.3 + dy * r * 0.5, cy + dy * r * 0.3 + dx * r * 0.5);
      ctx.stroke(); ctx.lineWidth = 1;
    }
    label(ctx, "value iteration · sweep " + s.k + " · γ=0.9" + (s.hold > 0 ? " · converged" : ""), ox, 13, C.cyan);
  };

  $$(".mini-sim").forEach((c) => {
    const k = c.dataset.sim;
    if (sims[k]) makeSim(c, sims[k], steps[k]);
  });
})();
