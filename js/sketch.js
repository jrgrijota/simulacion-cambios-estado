// ═══════════════════════════════════════════════════════════════════
//  SIMULACIÓN: CAMBIOS DE ESTADO
//  Física y Química para la ESO
//
//  Prioridad: claridad pedagógica por encima de la exactitud numérica.
//  Las temperaturas de fusión y ebullición son reales; los tiempos y
//  energías están escalados para que cada tramo se vea bien en clase.
// ═══════════════════════════════════════════════════════════════════

// --- LAYOUT DEL CANVAS ---
const CV_W = 1050, CV_H = 700;

// Vista macroscópica: panel, recipiente cerrado, placa y termómetro
const MACRO = { x: 20, y: 72, w: 425, h: 358 };
const JAR   = { x: 54, y: 140, w: 236, h: 205 };   // interior del recipiente
const PLATE = { x: 38, y: 352, w: 268, h: 22 };
const TH    = { x: 352, top: 118, bottom: 384 };
const LIQ_MAX_H = 112;                              // altura del líquido con todo fundido

// Vista microscópica: panel, ventana de partículas y leyenda de estados
const MICRO  = { x: 458, y: 72, w: 572, h: 358 };
const LENS_CURVA = { x: 474, y: 100, w: 322, h: 314 };
let LENS = LENS_CURVA;     // ventana de partículas activa (cada modo tiene la suya)
const LEGEND = { x: 810, y: 100, w: 206, h: 314 };

// Gráfica temperatura–tiempo
const GRAPH = { x: 20, y: 442, w: 1010, h: 246 };
const PLOT  = { x0: 84, x1: 1008, y0: 494, y1: 654 };

// Partículas: red de 8 × 8 en el sólido
const P_COLS = 8, P_ROWS = 8, P_N = P_COLS * P_ROWS;
const P_R    = 9;          // radio
const P_SEP  = 2 * P_R + 3; // separación en la red cristalina

// --- SUSTANCIAS ---
// tf / teb: temperaturas reales de fusión y ebullición (°C, a 1 atm).
// tMin / tMax: rango del termómetro y de la gráfica. tIni: temperatura inicial.
// col: colores de la vista macroscópica. flota: si el sólido flota en su líquido.
const SUSTANCIAS = {
    agua: {
        nombre: 'Agua', tf: 0, teb: 100, tMin: -40, tMax: 140, tIni: -20,
        nombres: { solid: 'hielo', liquid: 'agua líquida', gas: 'vapor de agua' },
        col: { solid: '#d6ecff', liquid: '#3a8ee6', gas: '#cfe0f0' }, flota: true,
        curiosidad: 'El hielo flota porque es menos denso que el agua líquida: algo muy raro entre los sólidos.',
    },
    alcohol: {
        nombre: 'Alcohol', tf: -114, teb: 78, tMin: -160, tMax: 120, tIni: -140,
        nombres: { solid: 'alcohol sólido', liquid: 'alcohol líquido', gas: 'vapor de alcohol' },
        col: { solid: '#f2eed8', liquid: '#d9c46a', gas: '#efe6c0' }, flota: false,
        curiosidad: 'Hierve antes que el agua: por eso el alcohol de las heridas se evapora tan rápido.',
    },
    nitrogeno: {
        nombre: 'Nitrógeno', tf: -210, teb: -196, tMin: -226, tMax: -180, tIni: -220,
        nombres: { solid: 'nitrógeno sólido', liquid: 'nitrógeno líquido', gas: 'nitrógeno gas' },
        col: { solid: '#eef6ff', liquid: '#9fd4ee', gas: '#d8eef8' }, flota: false,
        curiosidad: 'A temperatura ambiente es un gas: forma el 78 % del aire que respiramos.',
    },
    hierro: {
        nombre: 'Hierro', tf: 1538, teb: 2862, tMin: 1000, tMax: 3300, tIni: 1200,
        nombres: { solid: 'hierro sólido', liquid: 'hierro fundido', gas: 'hierro gas' },
        col: { solid: '#8a6a5a', liquid: '#ff8a2a', gas: '#ffb070' }, flota: false,
        curiosidad: 'Para fundirlo hacen falta hornos a más de 1500 °C, como los altos hornos de las acerías.',
    },
};

// --- MODELO DE ENERGÍA (didáctico) ---
// Energía (unidades escaladas) que absorbe cada tramo de la curva:
//   calentar sólido · fusión · calentar líquido · vaporización · calentar gas
// Es igual para todas las sustancias: así la forma de la curva es comparable
// y lo único que cambia son las temperaturas de fusión y ebullición.
// La vaporización absorbe más energía que la fusión (como en la realidad).
const SEG_E  = [10, 14, 16, 26, 10];
const E_TOT  = SEG_E.reduce((a, b) => a + b, 0);
const POT_MAX = 1.0;   // unidades de energía por "minuto" con la placa al 100 %

// --- MODOS ---
let currentMode = 'curva';   // 'curva' (calentar y enfriar) | 'fases' (diagrama de fases)

// --- ESTADO DE LA SIMULACIÓN ---
let sus;                 // sustancia actual
let energia = 0;         // energía almacenada (unidades didácticas)
let tiempo  = 0;         // tiempo simulado (min)
let potencia = 0.5;      // -1 (enfriar al máximo) … +1 (calentar al máximo)
let velocidad = 1;       // multiplicador de tiempo
let enMarcha = true;
let estado;              // resultado de estadoDesdeEnergia()

// --- ESTADO GLOBAL ---
let THEME = {};


// ─────────────────────────────────────────────────────────────────
function setup() {
    const canvas = createCanvas(CV_W, CV_H);
    canvas.parent('canvas-container');
    frameRate(60);
    textFont('monospace');

    document.getElementById('mode-curva').addEventListener('click', () => setMode('curva'));
    document.getElementById('mode-fases').addEventListener('click', () => setMode('fases'));

    setupCurvaControls();
    setupFasesControls();
    setupThemeSelector();

    cambiarSustancia('agua');
}

function draw() {
    updateTheme();
    background(THEME.canvasBg);

    if (currentMode === 'curva') {
        actualizarModelo();
        drawMacroView();
        updateParticles(estado, agitacion(estado.T, sus.tMin, sus.tf, sus.teb, sus.tMax), enMarcha);
        drawMicroView();
        drawGraph();
        drawBanner(mensajeDidactico());
        if (frameCount % 4 === 0) updateCurvaUI();
    } else {
        drawFasesMode();
    }
}

// Ratón y pantalla táctil (p5 traduce los toques a eventos de ratón)
function mousePressed()  { if (currentMode === 'fases') fasesPressed(); }
function mouseDragged()  { if (currentMode === 'fases') fasesDragged(); }
function mouseReleased() { arrastrando = false; }


// ═══════════════════════════════════════════════════════════════════
//  MODELO: ENERGÍA → TEMPERATURA Y ESTADO
// ═══════════════════════════════════════════════════════════════════

// A partir de la energía almacenada devuelve la temperatura, la fracción de
// sustancia en cada estado y el tramo de la curva en el que estamos.
function estadoDesdeEnergia(E, s) {
    const [eS, eF, eL, eV, eG] = SEG_E;
    let T, fs = 0, fl = 0, fg = 0, tramo;

    if (E < eS) {
        tramo = 'solido';
        T = lerp(s.tMin, s.tf, E / eS);
        fs = 1;
    } else if (E < eS + eF) {
        tramo = 'fusion';
        T = s.tf;
        fl = (E - eS) / eF;
        fs = 1 - fl;
    } else if (E < eS + eF + eL) {
        tramo = 'liquido';
        T = lerp(s.tf, s.teb, (E - eS - eF) / eL);
        fl = 1;
    } else if (E < eS + eF + eL + eV) {
        tramo = 'vaporizacion';
        T = s.teb;
        fg = (E - eS - eF - eL) / eV;
        fl = 1 - fg;
    } else {
        tramo = 'gas';
        T = lerp(s.teb, s.tMax, min(1, (E - eS - eF - eL - eV) / eG));
        fg = 1;
    }
    return { T, fs, fl, fg, tramo };
}

// Energía que corresponde a un sólido a temperatura T (para el estado inicial).
function energiaSolido(T, s) {
    return SEG_E[0] * constrain((T - s.tMin) / (s.tf - s.tMin), 0, 1);
}

function actualizarModelo() {
    if (enMarcha) {
        const dt = min(deltaTime / 1000, 0.1) * velocidad;
        tiempo += dt;
        energia = constrain(energia + potencia * POT_MAX * dt, 0, E_TOT);
    }
    estado = estadoDesdeEnergia(energia, sus);
    if (enMarcha) registrarMuestra();
}

function reiniciar() {
    energia = energiaSolido(sus.tIni, sus);
    tiempo = 0;
    historial = [];
    burbujas = [];
    gotas = [];
    initParticles();
    estado = estadoDesdeEnergia(energia, sus);
}

function cambiarSustancia(clave) {
    sus = SUSTANCIAS[clave];
    document.getElementById('sustancia-hint').innerHTML =
        `Funde a <strong>${fmtT(sus.tf)} °C</strong> · Hierve a <strong>${fmtT(sus.teb)} °C</strong><br>` +
        `<em>¿Sabías que…?</em> ${sus.curiosidad}`;
    reiniciar();
    updateCurvaUI();
}

// Nombre del estado o del cambio de estado, según el sentido de la energía.
function describirEstado(e) {
    const signo = Math.sign(potencia);
    switch (e.tramo) {
        case 'solido':  return { txt: 'Sólido',  cls: 'st-solid' };
        case 'liquido': return { txt: 'Líquido', cls: 'st-liquid' };
        case 'gas':     return { txt: 'Gas',     cls: 'st-gas' };
        case 'fusion':
            if (signo > 0) return { txt: 'Fusión  (sólido → líquido)', cls: 'st-change' };
            if (signo < 0) return { txt: 'Solidificación  (líquido → sólido)', cls: 'st-change' };
            return { txt: 'Sólido y líquido a la vez', cls: 'st-change' };
        case 'vaporizacion':
            if (signo > 0) return { txt: 'Vaporización  (líquido → gas)', cls: 'st-change' };
            if (signo < 0) return { txt: 'Condensación  (gas → líquido)', cls: 'st-change' };
            return { txt: 'Líquido y gas a la vez', cls: 'st-change' };
    }
}


// ═══════════════════════════════════════════════════════════════════
//  CONTROLES DEL MODO CURVA
// ═══════════════════════════════════════════════════════════════════
function setupCurvaControls() {
    document.getElementById('select-sustancia')
        .addEventListener('change', (e) => cambiarSustancia(e.target.value));

    const slPot = document.getElementById('slider-potencia');
    slPot.addEventListener('input', () => setPotencia(parseInt(slPot.value, 10)));
    setPotencia(parseInt(slPot.value, 10));

    document.querySelectorAll('.seg-btn[data-speed]').forEach(btn => {
        btn.addEventListener('click', () => {
            velocidad = parseFloat(btn.dataset.speed);
            document.querySelectorAll('.seg-btn[data-speed]').forEach(b => {
                b.classList.toggle('active', b === btn);
                b.setAttribute('aria-checked', String(b === btn));
            });
        });
    });

    const btnPausa = document.getElementById('btn-pausa');
    btnPausa.addEventListener('click', () => {
        enMarcha = !enMarcha;
        btnPausa.textContent = enMarcha ? '⏸ Pausar' : '▶ Reanudar';
        btnPausa.setAttribute('aria-pressed', String(!enMarcha));
        btnPausa.classList.toggle('active', !enMarcha);
    });

    document.getElementById('btn-reiniciar').addEventListener('click', reiniciar);

    const chkUniones = document.getElementById('check-uniones');
    const chkEstelas = document.getElementById('check-estelas');
    chkUniones.addEventListener('change', () => { verUniones = chkUniones.checked; });
    chkEstelas.addEventListener('change', () => { verEstelas = chkEstelas.checked; });
}

function setPotencia(v) {
    potencia = v / 100;
    const sl = document.getElementById('slider-potencia');
    const from = v >= 0 ? 50 : 50 + v / 2;
    const to   = v >= 0 ? 50 + v / 2 : 50;
    sl.style.setProperty('--from', from + '%');
    sl.style.setProperty('--to', to + '%');
    sl.style.setProperty('--pc', v >= 0 ? '#ff5a5acc' : '#3a8ee6cc');
    document.getElementById('val-potencia').textContent =
        v === 0 ? '0 %' : (v > 0 ? '+' : '−') + Math.abs(v) + ' %';

    const placa = document.getElementById('metric-placa');
    placa.textContent = v > 0 ? 'Calienta' : v < 0 ? 'Enfría' : 'Apagada';
    placa.parentElement.className = 'metric metric-text ' + (v > 0 ? 'hot' : v < 0 ? 'cold' : '');
}

function updateCurvaUI() {
    if (!estado) return;
    document.getElementById('metric-temp').textContent = fmtT(estado.T);
    document.getElementById('metric-tiempo').textContent = tiempo.toFixed(1);
    const d = describirEstado(estado);
    const el = document.getElementById('metric-estado');
    el.textContent = d.txt;
    el.className = 'estado-value ' + d.cls;

    const { sensible, latente } = repartoEnergia(energia);
    const total = sensible + latente;
    const pS = total > 0 ? Math.round(100 * sensible / total) : 0;
    const pL = total > 0 ? 100 - pS : 0;
    document.getElementById('bar-sensible').style.width = pS + '%';
    document.getElementById('bar-latente').style.width = pL + '%';
    document.getElementById('pct-sensible').textContent = pS + ' %';
    document.getElementById('pct-latente').textContent = pL + ' %';
}

// Reparte la energía almacenada entre la que subió la temperatura (tramos con
// pendiente) y la que separó las partículas (mesetas de cambio de estado).
function repartoEnergia(E) {
    let sensible = 0, latente = 0, acum = 0;
    SEG_E.forEach((e, i) => {
        const parte = constrain(E - acum, 0, e);
        if (i === 1 || i === 3) latente += parte; else sensible += parte;
        acum += e;
    });
    return { sensible, latente };
}

// ═══════════════════════════════════════════════════════════════════
//  FRANJA DE MENSAJES: explica qué está pasando y por qué
// ═══════════════════════════════════════════════════════════════════
const BANNER = { x: 20, y: 12, w: 1010, h: 50 };

function mensajeDidactico() {
    const s = Math.sign(potencia);
    const tf = fmtT(sus.tf) + ' °C', teb = fmtT(sus.teb) + ' °C';
    const N = sus.nombres;

    if (s < 0 && energia <= 0) return { tag: 'LÍMITE', col: THEME.textDim,
        txt: `Has llegado a la temperatura más baja de esta simulación. Calienta para seguir.` };
    if (s > 0 && energia >= E_TOT) return { tag: 'LÍMITE', col: THEME.textDim,
        txt: `Has llegado a la temperatura más alta de esta simulación. Enfría para seguir.` };

    switch (estado.tramo) {
        case 'solido':
            if (s > 0) return { tag: 'SÓLIDO', col: THEME.solid,
                txt: `El ${N.solid} se calienta: sus partículas vibran cada vez más deprisa y la temperatura sube.` };
            if (s < 0) return { tag: 'SÓLIDO', col: THEME.solid,
                txt: `El ${N.solid} se enfría: sus partículas vibran cada vez más despacio y la temperatura baja.` };
            return { tag: 'SÓLIDO', col: THEME.solid,
                txt: `Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.` };
        case 'fusion':
            if (s > 0) return { tag: 'FUSIÓN', col: THEME.change,
                txt: `La energía se usa para romper las uniones entre partículas, no para subir la temperatura. Por eso se queda en ${tf} hasta que todo se funde.` };
            if (s < 0) return { tag: 'SOLIDIFICACIÓN', col: THEME.change,
                txt: `Las partículas del líquido pierden energía y vuelven a ordenarse. La temperatura se mantiene en ${tf} hasta que todo es sólido.` };
            return { tag: 'EQUILIBRIO', col: THEME.change,
                txt: `Sólido y líquido conviven a ${tf}. Mientras no entre ni salga energía, la proporción no cambia.` };
        case 'liquido':
            if (s > 0) return { tag: 'LÍQUIDO', col: THEME.liquid,
                txt: `El ${N.liquid} se calienta: sus partículas se mueven y se deslizan cada vez más rápido.` };
            if (s < 0) return { tag: 'LÍQUIDO', col: THEME.liquid,
                txt: `El ${N.liquid} se enfría: sus partículas se mueven cada vez más despacio.` };
            return { tag: 'LÍQUIDO', col: THEME.liquid,
                txt: `Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.` };
        case 'vaporizacion':
            if (s > 0) return { tag: 'EBULLICIÓN', col: THEME.change,
                txt: `Las partículas se separan del todo y escapan como gas (por eso salen burbujas). La energía se gasta en separarlas: la temperatura no pasa de ${teb}.` };
            if (s < 0) return { tag: 'CONDENSACIÓN', col: THEME.change,
                txt: `Las partículas del gas pierden energía, se juntan y vuelven a ser líquido (gotas en la tapa). La temperatura se mantiene en ${teb}.` };
            return { tag: 'EQUILIBRIO', col: THEME.change,
                txt: `Líquido y gas conviven a ${teb}. Mientras no entre ni salga energía, la proporción no cambia.` };
        case 'gas':
            if (s > 0) return { tag: 'GAS', col: THEME.gas,
                txt: `El ${N.gas} se calienta: sus partículas se mueven cada vez más rápido y ocupan todo el recipiente.` };
            if (s < 0) return { tag: 'GAS', col: THEME.gas,
                txt: `El ${N.gas} se enfría: sus partículas se mueven cada vez más despacio.` };
            return { tag: 'GAS', col: THEME.gas,
                txt: `Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.` };
    }
}

function drawBanner(m) {
    const { x, y, w, h } = BANNER;
    const borde = color(m.col);
    stroke(THEME.border); strokeWeight(1); fill(THEME.panelBg);
    rect(x, y, w, h, 10);
    noStroke(); fill(borde);
    rect(x, y, 5, h, 10, 0, 0, 10);

    // Etiqueta del estado o del cambio
    textStyle(BOLD); textSize(13);
    const tw = textWidth(m.tag) + 22;
    const bg = color(m.col); bg.setAlpha(40);
    fill(bg); stroke(m.col); strokeWeight(1.5);
    rect(x + 16, y + h / 2 - 13, tw, 26, 13);
    noStroke(); fill(m.col); textAlign(CENTER, CENTER);
    text(m.tag, x + 16 + tw / 2, y + h / 2 + 1);
    textStyle(NORMAL);

    fill(THEME.text); textSize(13); textAlign(LEFT, CENTER); textLeading(17);
    const tx = x + 16 + tw + 16;
    text(m.txt, tx, y + 4, x + w - tx - 14, h - 8);
}


// ═══════════════════════════════════════════════════════════════════
//  VISTA MACROSCÓPICA: "LO QUE VEMOS"
// ═══════════════════════════════════════════════════════════════════
let burbujas = [];   // burbujas de vapor durante la ebullición
let gotas    = [];   // gotas que se forman en la tapa al condensar
let motas    = [];   // motas que sugieren el gas que llena el recipiente

function drawMacroView() {
    drawPanelFrame(MACRO, 'LO QUE VEMOS', 'el recipiente a simple vista');

    const fondo = JAR.y + JAR.h;
    const hLiq  = LIQ_MAX_H * estado.fl;
    const ySup  = fondo - hLiq;          // superficie del líquido

    drawGas(ySup);
    drawLiquid(ySup, hLiq);
    drawSolid(ySup, hLiq);
    drawBubbles(ySup, hLiq);
    drawDroplets(ySup);
    drawJarGlass();
    drawPlate();
    drawHeatArrows();
    drawComposicion();
    drawThermometer(estado.T);
}

function drawPanelFrame(r, titulo, sub) {
    stroke(THEME.border); strokeWeight(1); fill(THEME.panelBg);
    rect(r.x, r.y, r.w, r.h, 10);
    noStroke(); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(12); fill(THEME.accent);
    text(titulo, r.x + 14, r.y + 17);
    const w = textWidth(titulo);
    textStyle(NORMAL); textSize(11); fill(THEME.textDim);
    text('· ' + sub, r.x + 20 + w, r.y + 17);
}

// El gas ocupa TODO el recipiente: neblina + motas que se mueven.
function drawGas(ySup) {
    if (motas.length === 0) {
        for (let i = 0; i < 70; i++) motas.push({ x: random(JAR.w), y: random(JAR.h), f: random(1) });
    }
    if (estado.fg <= 0) return;
    const c = color(sus.col.gas);
    c.setAlpha(18 + 55 * estado.fg);
    noStroke(); fill(c);
    rect(JAR.x, JAR.y, JAR.w, ySup - JAR.y);

    c.setAlpha(170);
    fill(c);
    for (const m of motas) {
        if (m.f > estado.fg) continue;          // más gas → más motas
        if (enMarcha) {
            m.x = (m.x + random(-1.4, 1.4) * velocidad + JAR.w) % JAR.w;
            m.y = (m.y + random(-1.4, 1.4) * velocidad + JAR.h) % JAR.h;
        }
        const y = JAR.y + m.y;
        if (y < ySup - 3) circle(JAR.x + m.x, y, 2.6);
    }
}

function drawLiquid(ySup, hLiq) {
    if (hLiq < 0.5) return;
    const c = color(sus.col.liquid);
    c.setAlpha(205);
    noStroke(); fill(c);
    beginShape();
    vertex(JAR.x, JAR.y + JAR.h);
    for (let x = 0; x <= JAR.w; x += 10) {
        const ola = enMarcha ? sin(x * 0.05 + frameCount * 0.06) * 1.6 : 0;
        vertex(JAR.x + x, ySup + ola);
    }
    vertex(JAR.x + JAR.w, JAR.y + JAR.h);
    endShape(CLOSE);

    // Brillo de la superficie
    stroke(255, 255, 255, 70); strokeWeight(1.5);
    line(JAR.x + 4, ySup + 2, JAR.x + JAR.w - 4, ySup + 2);
}

// Trozos de sólido: se encogen y se redondean al fundirse.
// El hielo flota en el agua; los demás sólidos se quedan en el fondo.
function drawSolid(ySup, hLiq) {
    if (estado.fs <= 0) return;
    const s = 42 * sqrt(estado.fs);
    const fondo = JAR.y + JAR.h;
    const cx = JAR.x + JAR.w / 2;
    let base = fondo;
    if (sus.flota && hLiq > 0) base = min(fondo, ySup + s * 0.85);

    // Color del sólido (el hierro se pone al rojo al acercarse a su fusión)
    let c = color(sus.col.solid);
    if (sus === SUSTANCIAS.hierro) {
        c = lerpColor(c, color('#ff5a1e'), constrain(map(estado.T, sus.tMin, sus.tf, 0.15, 0.75), 0, 1));
    }
    c.setAlpha(235);
    const borde = lerpColor(c, color(0), 0.35);
    const radio = 3 + (1 - estado.fs) * s * 0.35;

    const fila1 = [-2, -1, 0, 1, 2], fila2 = [-1, 0, 1];
    const sep = 45;
    stroke(borde); strokeWeight(1.5); fill(c);
    for (const i of fila1) rect(cx + i * sep - s / 2, base - s, s, s, radio);
    for (const i of fila2) rect(cx + i * sep - s / 2, base - s - min(s, 42) - 2, s, s, radio);

    // Reflejo
    noStroke(); fill(255, 255, 255, 80);
    for (const i of fila1) rect(cx + i * sep - s / 2 + 4, base - s + 4, s * 0.25, 3, 2);
}

function drawBubbles(ySup, hLiq) {
    const hirviendo = estado.tramo === 'vaporizacion' && potencia > 0;
    if (enMarcha && hirviendo && random() < potencia * velocidad * 0.9) {
        burbujas.push({ x: JAR.x + random(10, JAR.w - 10), y: JAR.y + JAR.h - 3, r: random(2, 5), v: random(0.8, 1.8) });
    }
    noFill(); stroke(255, 255, 255, 150); strokeWeight(1.2);
    for (let i = burbujas.length - 1; i >= 0; i--) {
        const b = burbujas[i];
        if (enMarcha) { b.y -= b.v * velocidad; b.r += 0.02; b.x += random(-0.4, 0.4); }
        if (b.y < ySup + 2 || hLiq < 2) { burbujas.splice(i, 1); continue; }
        circle(b.x, b.y, b.r * 2);
    }
}

// Al condensar se forman gotas en la tapa que caen al líquido.
function drawDroplets(ySup) {
    const condensando = estado.tramo === 'vaporizacion' && potencia < 0;
    if (enMarcha && condensando && random() < -potencia * velocidad * 0.5) {
        gotas.push({ x: JAR.x + random(12, JAR.w - 12), y: JAR.y + 2, r: 1, v: 0 });
    }
    const c = color(sus.col.liquid);
    c.setAlpha(220);
    noStroke(); fill(c);
    for (let i = gotas.length - 1; i >= 0; i--) {
        const g = gotas[i];
        if (enMarcha) {
            if (g.r < 3.6) g.r += 0.035 * velocidad;   // crece pegada a la tapa
            else { g.v += 0.25; g.y += g.v; }           // y luego cae
        }
        if (g.y > ySup) { gotas.splice(i, 1); continue; }
        ellipse(g.x, g.y + g.r * 0.4, g.r * 1.8, g.r * 2.3);
    }
}

function drawJarGlass() {
    // Tapa
    stroke(THEME.jarWall); strokeWeight(2); fill(THEME.jarLid);
    rect(JAR.x - 9, JAR.y - 14, JAR.w + 18, 14, 4);
    // Paredes
    noFill(); strokeWeight(3);
    beginShape();
    vertex(JAR.x, JAR.y);
    vertex(JAR.x, JAR.y + JAR.h - 10);
    quadraticVertex(JAR.x, JAR.y + JAR.h, JAR.x + 10, JAR.y + JAR.h);
    vertex(JAR.x + JAR.w - 10, JAR.y + JAR.h);
    quadraticVertex(JAR.x + JAR.w, JAR.y + JAR.h, JAR.x + JAR.w, JAR.y + JAR.h - 10);
    vertex(JAR.x + JAR.w, JAR.y);
    endShape();
    // Reflejo del vidrio
    stroke(THEME.jarShine); strokeWeight(2);
    line(JAR.x + 9, JAR.y + 12, JAR.x + 9, JAR.y + JAR.h - 22);

    noStroke(); fill(THEME.textDim); textSize(11); textAlign(CENTER, BOTTOM);
    text('recipiente cerrado', JAR.x + JAR.w / 2, JAR.y - 18);
}

function drawPlate() {
    const { x, y, w, h } = PLATE;
    // Superficie: roja al calentar, azul al enfriar
    let sup = color(THEME.plateTop);
    if (potencia > 0) sup = lerpColor(sup, color('#ff3b1e'), 0.25 + 0.75 * potencia);
    if (potencia < 0) sup = lerpColor(sup, color('#3a9cff'), 0.25 + 0.75 * -potencia);

    noStroke(); fill(THEME.plateBody);
    rect(x, y, w, h, 4);
    fill(sup);
    rect(x + 4, y, w - 8, 5, 2);
    if (potencia !== 0) {                     // resplandor
        const g = color(sup); g.setAlpha(60 * abs(potencia));
        fill(g); rect(x + 4, y - 4, w - 8, 4, 2);
    }

    fill(THEME.plateText); textSize(11); textAlign(CENTER, CENTER);
    const pct = Math.round(abs(potencia) * 100);
    const txt = potencia > 0 ? `CALIENTA ${pct} % · entra energía`
              : potencia < 0 ? `ENFRÍA ${pct} % · sale energía`
              : 'PLACA APAGADA';
    text(txt, x + w / 2, y + 13);
}

// Flechas onduladas: la energía entra (calentar) o sale (enfriar) del recipiente.
function drawHeatArrows() {
    if (potencia === 0) return;
    const entra = potencia > 0;
    const c = color(entra ? THEME.heat : THEME.cold);
    c.setAlpha(90 + 140 * abs(potencia));
    const y0 = PLATE.y - 4, y1 = PLATE.y - 50;
    const fase = enMarcha ? frameCount * 0.15 * (entra ? 1 : -1) : 0;

    noFill(); stroke(c); strokeWeight(2.5);
    for (const fx of [0.2, 0.5, 0.8]) {
        const x = JAR.x + JAR.w * fx;
        beginShape();
        for (let y = y0; y >= y1 + 6; y -= 3) vertex(x + sin(y * 0.25 + fase) * 3, y);
        endShape();
        // Punta: hacia arriba si entra, hacia abajo si sale
        noStroke(); fill(c);
        if (entra) triangle(x, y1 - 2, x - 6, y1 + 8, x + 6, y1 + 8);
        else       triangle(x, y0 + 4, x - 6, y0 - 6, x + 6, y0 - 6);
        noFill(); stroke(c);
    }
}

// Barra de composición: qué parte de la sustancia está en cada estado.
function drawComposicion() {
    const x = PLATE.x, y = 388, w = PLATE.w, h = 20;
    const partes = [
        { f: estado.fs, col: THEME.solid,  txt: 'sólido' },
        { f: estado.fl, col: THEME.liquid, txt: 'líquido' },
        { f: estado.fg, col: THEME.gas,    txt: 'gas' },
    ];
    let cx = x;
    textSize(11); textAlign(CENTER, CENTER); textStyle(BOLD);
    for (const p of partes) {
        const pw = w * p.f;
        if (pw <= 0) continue;
        noStroke(); fill(p.col);
        rect(cx, y, pw, h);
        fill(THEME.canvasBg);
        const etiqueta = `${p.txt} ${Math.round(p.f * 100)} %`;
        if (pw > textWidth(etiqueta) + 8) text(etiqueta, cx + pw / 2, y + h / 2 + 1);
        else if (pw > textWidth(p.txt) + 6) text(p.txt, cx + pw / 2, y + h / 2 + 1);
        cx += pw;
    }
    textStyle(NORMAL);
    noFill(); stroke(THEME.border); strokeWeight(1);
    rect(x, y, w, h, 4);
}


// ═══════════════════════════════════════════════════════════════════
//  VISTA MICROSCÓPICA: "LO QUE NO VEMOS" (modelo de partículas)
//
//  Todas las partículas son iguales y tienen el mismo color en cualquier
//  estado: lo que cambia es su orden, su separación y su movimiento.
//  Cuántas hay en cada estado lo decide el modelo de energía.
// ═══════════════════════════════════════════════════════════════════
let particulas = [];
let sitios = [];          // huecos de la red cristalina
let sitiosPorOrden = [];  // ordenados: los primeros se funden antes (los de fuera)
let verUniones = true;
let verEstelas = true;

function initParticles() {
    const x0 = LENS.x + LENS.w / 2 - (P_COLS - 1) * P_SEP / 2;
    const yb = LENS.y + LENS.h - P_R - 4;
    sitios = [];
    for (let i = 0; i < P_N; i++) {
        const fila = Math.floor(i / P_COLS), col = i % P_COLS;   // fila 0 = abajo
        // Se funden antes las partículas de arriba y de los bordes
        const orden = fila + abs(col - (P_COLS - 1) / 2) * 0.9 + ((i * 7919) % 13) / 40;
        sitios.push({ x: x0 + col * P_SEP, y: yb - fila * P_SEP, fila, col, orden, ocupa: i });
    }
    sitiosPorOrden = [...sitios].sort((a, b) => b.orden - a.orden);

    particulas = sitios.map((s, i) => ({
        x: s.x, y: s.y, vx: 0, vy: 0, st: 'solid', sitio: s,
        f1: random(TWO_PI), f2: random(TWO_PI),
    }));
}

// Coloca todas las partículas directamente en un estado (al cambiar de modo),
// sin mostrar una transición que en realidad no ha ocurrido.
function colocarParticulas(st) {
    initParticles();
    if (st === 'solid') return;
    sitios.forEach(s => { s.ocupa = -1; });
    const porFila = Math.floor((LENS.w - 6) / (2 * P_R));
    particulas.forEach((p, i) => {
        p.st = st; p.sitio = null;
        if (st === 'liquid') {
            p.x = LENS.x + 3 + P_R + (i % porFila) * 2 * P_R + random(-1, 1);
            p.y = LENS.y + LENS.h - 3 - P_R - Math.floor(i / porFila) * 2 * P_R;
            p.vx = random(-1, 1); p.vy = 0;
        } else {
            p.x = random(LENS.x + P_R, LENS.x + LENS.w - P_R);
            p.y = random(LENS.y + P_R, LENS.y + LENS.h - P_R);
            const a = random(TWO_PI);
            p.vx = 3.5 * cos(a); p.vy = 3.5 * sin(a);
        }
    });
}

// Ajusta cuántas partículas hay en cada estado según las fracciones del modelo.
function asignarEstados(est) {
    const nS = Math.round(est.fs * P_N);
    const nG = Math.round(est.fg * P_N);
    let cS = particulas.filter(p => p.st === 'solid').length;
    let cG = particulas.filter(p => p.st === 'gas').length;

    // Fusión: se suelta la partícula sólida más exterior
    while (cS > nS) {
        const s = sitiosPorOrden[P_N - cS];
        const p = particulas[s.ocupa];
        p.st = 'liquid'; p.sitio = null; s.ocupa = -1;
        p.vy = -0.8; p.vx = random(-0.8, 0.8);
        cS--;
    }
    // Solidificación: la partícula libre más cercana ocupa el siguiente hueco de la red
    while (cS < nS) {
        const s = sitiosPorOrden[P_N - cS - 1];
        let mejor = -1, dMin = Infinity;
        particulas.forEach((p, i) => {
            if (p.st === 'solid') return;
            const d = dist(p.x, p.y, s.x, s.y) + (p.st === 'gas' ? 1000 : 0);
            if (d < dMin) { dMin = d; mejor = i; }
        });
        if (mejor < 0) break;
        const p = particulas[mejor];
        if (p.st === 'gas') cG--;
        p.st = 'solid'; p.sitio = s; s.ocupa = mejor;
        cS++;
    }
    // Vaporización: escapa la partícula de líquido más alta (la de la superficie)
    while (cG < nG) {
        const liq = particulas.filter(p => p.st === 'liquid');
        if (liq.length === 0) break;
        const p = liq.reduce((a, b) => (b.y < a.y ? b : a));
        p.st = 'gas'; p.vy = -3; p.vx = random(-2, 2);
        cG++;
    }
    // Condensación: la partícula de gas más baja vuelve al líquido
    while (cG > nG) {
        const gas = particulas.filter(p => p.st === 'gas');
        const p = gas.reduce((a, b) => (b.y > a.y ? b : a));
        p.st = 'liquid';
        cG--;
    }
}

// Agitación de las partículas según la temperatura, dentro del rango de cada
// estado (así se ve igual en todas las sustancias): amplitud de vibración del
// sólido y rapidez del líquido y del gas.
function agitacion(T, tMin, tFus, tEb, tMax) {
    return {
        ampSol: constrain(map(T, tMin, tFus, 0.8, 3.2), 0.8, 3.2),
        vLiq:   constrain(map(T, tFus, tEb, 0.9, 1.9), 0.9, 1.9),
        vGas:   constrain(map(T, tEb, tMax, 3.2, 4.6), 3.2, 4.6),
    };
}

// est: fracciones { fs, fl, fg } · ag: agitación · activo: si se mueven
function updateParticles(est, ag, activo) {
    asignarEstados(est);
    if (!activo) return;

    const { ampSol, vLiq, vGas } = ag;
    const t = millis() * 0.02;

    for (const p of particulas) {
        if (p.st === 'solid') {
            // Muelle hacia su hueco de la red + vibración
            const tx = p.sitio.x + ampSol * sin(t * 1.7 + p.f1);
            const ty = p.sitio.y + ampSol * cos(t * 1.3 + p.f2);
            p.vx = p.vx * 0.7 + (tx - p.x) * 0.12;
            p.vy = p.vy * 0.7 + (ty - p.y) * 0.12;
            const v = Math.hypot(p.vx, p.vy);
            if (v > 3) { p.vx *= 3 / v; p.vy *= 3 / v; }
        } else if (p.st === 'liquid') {
            p.vy += 0.16;                               // se quedan abajo
            p.vx += random(-0.25, 0.25); p.vy += random(-0.25, 0.25);
            termostato(p, vLiq);
        } else {
            p.vx += random(-0.05, 0.05); p.vy += random(-0.05, 0.05);
            termostato(p, vGas);
        }
        p.x += p.vx; p.y += p.vy;
    }

    for (let k = 0; k < 2; k++) colisiones();
    paredes();
}

// Lleva poco a poco la rapidez de la partícula hacia la que marca la temperatura.
function termostato(p, objetivo) {
    const v = Math.hypot(p.vx, p.vy);
    if (v < 1e-4) { p.vx = random(-1, 1) * objetivo; p.vy = random(-1, 1) * objetivo; return; }
    const f = lerp(1, objetivo / v, 0.08);
    p.vx *= f; p.vy *= f;
}

function colisiones() {
    const dMin = 2 * P_R;
    for (let i = 0; i < P_N; i++) {
        const a = particulas[i];
        for (let j = i + 1; j < P_N; j++) {
            const b = particulas[j];
            if (a.st === 'solid' && b.st === 'solid') continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d === 0 || d > dMin * 1.35) continue;
            const nx = dx / d, ny = dy / d;

            if (d < dMin) {
                const solape = dMin - d;
                // Las partículas del sólido no se desplazan
                const wa = a.st === 'solid' ? 0 : (b.st === 'solid' ? 1 : 0.5);
                const wb = 1 - wa;
                a.x -= nx * solape * wa; a.y -= ny * solape * wa;
                b.x += nx * solape * wb; b.y += ny * solape * wb;

                const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rel < 0) {
                    if (wa > 0 && wb > 0) {           // choque elástico entre iguales
                        a.vx += rel * nx; a.vy += rel * ny;
                        b.vx -= rel * nx; b.vy -= rel * ny;
                    } else {                          // rebote contra el sólido
                        const p = wa > 0 ? a : b, s = wa > 0 ? -1 : 1;
                        const vn = (p.vx * nx + p.vy * ny) * s;
                        if (vn < 0) { p.vx -= 2 * vn * nx * s; p.vy -= 2 * vn * ny * s; }
                    }
                }
            } else if (a.st === 'liquid' && b.st === 'liquid') {
                // Atracción débil entre partículas del líquido: se mantienen juntas
                a.vx += nx * 0.05; a.vy += ny * 0.05;
                b.vx -= nx * 0.05; b.vy -= ny * 0.05;
            }
        }
    }
}

function paredes() {
    const x0 = LENS.x + P_R + 2, x1 = LENS.x + LENS.w - P_R - 2;
    const y0 = LENS.y + P_R + 2, y1 = LENS.y + LENS.h - P_R - 2;
    for (const p of particulas) {
        if (p.st === 'solid') continue;
        if (p.x < x0) { p.x = x0; p.vx = abs(p.vx); }
        if (p.x > x1) { p.x = x1; p.vx = -abs(p.vx); }
        if (p.y < y0) { p.y = y0; p.vy = abs(p.vy); }
        if (p.y > y1) { p.y = y1; p.vy = -abs(p.vy) * (p.st === 'liquid' ? 0.5 : 1); }
    }
}

function drawMicroView() {
    drawPanelFrame(MICRO, 'LO QUE NO VEMOS', 'las partículas de la sustancia');
    drawParticleWindow();
    drawLeyendaEstados();
}

function drawParticleWindow() {
    stroke(THEME.border); strokeWeight(1); fill(THEME.lensBg);
    rect(LENS.x, LENS.y, LENS.w, LENS.h, 8);

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(LENS.x, LENS.y, LENS.w, LENS.h);
    drawingContext.clip();

    if (verUniones) drawUniones();

    if (verEstelas) {
        const c = color(THEME.particle); c.setAlpha(60);
        stroke(c); strokeWeight(P_R * 0.8);
        for (const p of particulas) {
            if (p.st === 'solid') continue;
            line(p.x, p.y, p.x - p.vx * 4, p.y - p.vy * 4);
        }
    }

    stroke(THEME.particleEdge); strokeWeight(1.5); fill(THEME.particle);
    for (const p of particulas) circle(p.x, p.y, P_R * 2 - 3);
    noStroke(); fill(255, 255, 255, 110);
    for (const p of particulas) circle(p.x - 2.5, p.y - 2.5, 5);

    drawingContext.restore();
}

// Atracciones: fuertes y ordenadas en el sólido, débiles en el líquido, nulas en el gas.
function drawUniones() {
    // Una partícula que se está solidificando solo se une a la red al llegar a su hueco
    const enSitio = (s) => s && s.ocupa >= 0 &&
        dist(particulas[s.ocupa].x, particulas[s.ocupa].y, s.x, s.y) < 6;
    stroke(THEME.bond); strokeWeight(3);
    for (const s of sitios) {
        if (!enSitio(s)) continue;
        const a = particulas[s.ocupa];
        for (const vecino of [s.col < P_COLS - 1 ? sitios[s.fila * P_COLS + s.col + 1] : null,
                              s.fila < P_ROWS - 1 ? sitios[(s.fila + 1) * P_COLS + s.col] : null]) {
            if (enSitio(vecino)) {
                const b = particulas[vecino.ocupa];
                line(a.x, a.y, b.x, b.y);
            }
        }
    }
    const c = color(THEME.bond); c.setAlpha(110);
    stroke(c); strokeWeight(1.3);
    const dMax = 2 * P_R * 1.3;
    for (let i = 0; i < P_N; i++) {
        const a = particulas[i];
        if (a.st !== 'liquid') continue;
        for (let j = i + 1; j < P_N; j++) {
            const b = particulas[j];
            if (b.st !== 'liquid') continue;
            if (abs(a.x - b.x) < dMax && abs(a.y - b.y) < dMax && dist(a.x, a.y, b.x, b.y) < dMax) {
                line(a.x, a.y, b.x, b.y);
            }
        }
    }
}

const LEYENDA = [
    { st: 'solid',  f: 'fs', titulo: 'SÓLIDO',  txt: 'Partículas muy juntas y ordenadas. Solo vibran en su sitio.' },
    { st: 'liquid', f: 'fl', titulo: 'LÍQUIDO', txt: 'Partículas juntas pero desordenadas. Se deslizan unas sobre otras.' },
    { st: 'gas',    f: 'fg', titulo: 'GAS',     txt: 'Partículas muy separadas. Se mueven libres y rápidas en todas direcciones.' },
];

function drawLeyendaEstados() {
    const gap = 9;
    const h = (LEGEND.h - 2 * gap) / 3;
    LEYENDA.forEach((L, i) => {
        const y = LEGEND.y + i * (h + gap);
        const frac = estado[L.f];
        const activo = frac > 0;
        const col = color(THEME[L.st]);

        const fondo = color(THEME[L.st]); fondo.setAlpha(activo ? 34 : 0);
        stroke(activo ? col : THEME.border); strokeWeight(activo ? 2 : 1); fill(fondo);
        rect(LEGEND.x, y, LEGEND.w, h, 8);

        noStroke(); textStyle(BOLD); textSize(13); textAlign(LEFT, TOP);
        fill(activo ? col : THEME.textDim);
        text(L.titulo, LEGEND.x + 12, y + 10);
        textAlign(RIGHT, TOP);
        if (activo) text(Math.round(frac * 100) + ' %', LEGEND.x + LEGEND.w - 12, y + 10);
        textStyle(NORMAL);

        fill(activo ? THEME.text : THEME.textDim); textSize(12); textAlign(LEFT, TOP); textLeading(16);
        text(L.txt, LEGEND.x + 12, y + 32, LEGEND.w - 24, h - 36);
    });
}


// ═══════════════════════════════════════════════════════════════════
//  GRÁFICA TEMPERATURA–TIEMPO
// ═══════════════════════════════════════════════════════════════════
let historial = [];             // muestras { t, T, tramo, signo }
const MUESTRA_DT = 0.1;         // min entre muestras
const MAX_MUESTRAS = 2400;

function registrarMuestra() {
    const ult = historial[historial.length - 1];
    if (ult && tiempo - ult.t < MUESTRA_DT) return;
    historial.push({ t: tiempo, T: estado.T, tramo: estado.tramo, signo: Math.sign(potencia) });
    if (historial.length > MAX_MUESTRAS) historial = historial.filter((_, i) => i % 2 === 0);
}

// Eje de tiempo que crece a saltos para que la gráfica no "baile".
function ejeTiempoMax() {
    const tUlt = historial.length ? historial[historial.length - 1].t : 0;
    const saltos = [20, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800, 1200];
    return saltos.find(s => s >= tUlt * 1.08) || Math.ceil(tUlt * 1.1 / 100) * 100;
}

// Agrupa las muestras en tramos seguidos del mismo estado (y mismo sentido en las mesetas).
function tramosHistorial() {
    const tramos = [];
    historial.forEach((m, i) => {
        const meseta = m.tramo === 'fusion' || m.tramo === 'vaporizacion';
        const clave = meseta ? m.tramo + m.signo : m.tramo;
        const ult = tramos[tramos.length - 1];
        if (ult && ult.clave === clave) { ult.fin = m; ult.iFin = i; }
        else tramos.push({ clave, tramo: m.tramo, signo: m.signo, ini: m, fin: m, iIni: i, iFin: i, meseta });
    });
    return tramos;
}

function colorTramo(tramo) {
    return { solido: THEME.solid, liquido: THEME.liquid, gas: THEME.gas,
             fusion: THEME.change, vaporizacion: THEME.change }[tramo];
}

function nombreMeseta(tr) {
    if (tr.tramo === 'fusion') {
        return tr.signo > 0 ? 'FUSIÓN' : tr.signo < 0 ? 'SOLIDIFICACIÓN' : 'SÓLIDO + LÍQUIDO';
    }
    return tr.signo > 0 ? 'VAPORIZACIÓN' : tr.signo < 0 ? 'CONDENSACIÓN' : 'LÍQUIDO + GAS';
}

function drawGraph() {
    drawPanelFrame(GRAPH, 'LA GRÁFICA', 'temperatura de la sustancia a lo largo del tiempo');
    const { x0, x1, y0, y1 } = PLOT;
    const tMax = ejeTiempoMax();
    const xOf = (t) => map(t, 0, tMax, x0, x1);
    const yOf = (T) => map(T, sus.tMin, sus.tMax, y1, y0);

    // Rejilla y ejes
    textSize(11);
    const pasoT = escalaPaso(sus.tMax - sus.tMin);
    for (let T = Math.ceil(sus.tMin / pasoT) * pasoT; T <= sus.tMax; T += pasoT) {
        stroke(THEME.grid); strokeWeight(1);
        line(x0, yOf(T), x1, yOf(T));
        noStroke(); fill(THEME.textDim); textAlign(RIGHT, CENTER);
        text(fmtT(T), x0 - 8, yOf(T));
    }
    const pasoX = tMax / 10;
    for (let t = 0; t <= tMax + 1e-6; t += pasoX) {
        stroke(THEME.grid); strokeWeight(1);
        line(xOf(t), y0, xOf(t), y1);
        noStroke(); fill(THEME.textDim); textAlign(CENTER, TOP);
        text(Math.round(t), xOf(t), y1 + 6);
    }
    stroke(THEME.axis); strokeWeight(1.5);
    line(x0, y0, x0, y1); line(x0, y1, x1, y1);

    noStroke(); fill(THEME.textDim); textAlign(LEFT, CENTER);
    text('T (°C)', GRAPH.x + 14, y0 - 13);
    textAlign(RIGHT, TOP);
    text('tiempo (min)', x1, y1 + 20);

    // Temperaturas de fusión y ebullición
    lineaReferencia(yOf(sus.tf),  `punto de fusión · ${fmtT(sus.tf)} °C`,      THEME.solid);
    lineaReferencia(yOf(sus.teb), `punto de ebullición · ${fmtT(sus.teb)} °C`, THEME.gas);

    if (historial.length < 2) return;

    // Curva coloreada por tramos
    strokeWeight(3.5); noFill(); strokeJoin(ROUND);
    const tramos = tramosHistorial();
    let prev = null;
    for (const tr of tramos) {
        stroke(colorTramo(tr.tramo));
        beginShape();
        if (prev) vertex(xOf(prev.t), yOf(prev.T));     // continuidad entre tramos
        for (let i = tr.iIni; i <= tr.iFin; i++) {
            vertex(xOf(historial[i].t), yOf(historial[i].T));
        }
        endShape();
        prev = tr.fin;
    }

    // Rótulos: nombre del cambio sobre cada meseta y del estado en cada rampa.
    // Si un rótulo de meseta choca con el anterior, sube un piso.
    let finRotulo = -Infinity, pisoAnterior = 0;
    for (const tr of tramos) {
        const dur = tr.fin.t - tr.ini.t;
        const xm = xOf((tr.ini.t + tr.fin.t) / 2);
        if (tr.meseta && xOf(tr.fin.t) - xOf(tr.ini.t) > 40) {
            const nombre = nombreMeseta(tr);
            textStyle(BOLD); textSize(12);
            const ancho = max(textWidth(nombre), 120);
            const piso = (xm - ancho / 2 < finRotulo + 8) ? 1 - pisoAnterior : 0;
            const y = yOf(tr.ini.T) - piso * 28;
            noStroke(); textAlign(CENTER, BOTTOM);
            fill(THEME.change);
            text(nombre, xm, y - 16);
            textStyle(NORMAL); textSize(10); fill(THEME.textDim);
            text('temperatura constante', xm, y - 5);
            finRotulo = xm + ancho / 2;
            pisoAnterior = piso;
        } else if (!tr.meseta && dur > tMax * 0.06 && abs(tr.fin.T - tr.ini.T) > 0) {
            const nombre = { solido: 'sólido', liquido: 'líquido', gas: 'gas' }[tr.tramo];
            const ym = yOf((tr.ini.T + tr.fin.T) / 2);
            noStroke(); fill(colorTramo(tr.tramo)); textSize(11); textAlign(LEFT, CENTER);
            text(nombre, xm + 8, ym + 10);
        }
    }

    // Punto actual
    const u = historial[historial.length - 1];
    const c = color(colorTramo(u.tramo));
    c.setAlpha(70); noStroke(); fill(c);
    circle(xOf(u.t), yOf(u.T), 18);
    fill(colorTramo(u.tramo)); stroke(THEME.canvasBg); strokeWeight(2);
    circle(xOf(u.t), yOf(u.T), 9);
}

function lineaReferencia(y, etiqueta, col) {
    stroke(col); strokeWeight(1);
    drawingContext.setLineDash([5, 5]);
    line(PLOT.x0, y, PLOT.x1, y);
    drawingContext.setLineDash([]);
    noStroke(); fill(col); textSize(10); textAlign(RIGHT, BOTTOM);
    text(etiqueta, PLOT.x1 - 4, y - 3);
}


// ═══════════════════════════════════════════════════════════════════
//  TERMÓMETRO
// ═══════════════════════════════════════════════════════════════════
function drawThermometer(T) {
    const { x, top, bottom } = TH;
    const bulbR = 15, tubeW = 12;
    const yOf = (t) => map(t, sus.tMin, sus.tMax, bottom - 6, top + 8);

    // Tubo y bulbo
    stroke(THEME.thermoGlass); strokeWeight(2); fill(THEME.thermoTube);
    rect(x - tubeW / 2, top, tubeW, bottom - top, tubeW / 2);
    circle(x, bottom + bulbR - 4, bulbR * 2);

    // Columna de líquido
    const yT = yOf(T);
    noStroke(); fill(THEME.thermoFill);
    rect(x - 3, yT, 6, bottom - yT + 4, 3);
    circle(x, bottom + bulbR - 4, bulbR * 2 - 8);

    // Escala
    textSize(11); textAlign(RIGHT, CENTER);
    const paso = escalaPaso(sus.tMax - sus.tMin);
    for (let t = Math.ceil(sus.tMin / paso) * paso; t <= sus.tMax; t += paso) {
        const y = yOf(t);
        stroke(THEME.thermoTick); strokeWeight(1);
        line(x - tubeW / 2 - 6, y, x - tubeW / 2 - 1, y);
        noStroke(); fill(THEME.textDim);
        text(fmtT(t), x - tubeW / 2 - 9, y);
    }

    // Marcas de fusión y ebullición
    marcaTermometro(yOf(sus.tf),  'fusión',     sus.tf,  THEME.solid);
    marcaTermometro(yOf(sus.teb), 'ebullición', sus.teb, THEME.gas);

    // Lectura digital
    noStroke(); fill(THEME.text); textAlign(CENTER, BOTTOM); textSize(15); textStyle(BOLD);
    text(fmtT(T) + ' °C', x, top - 10);
    textStyle(NORMAL);
}

function marcaTermometro(y, etiqueta, t, col) {
    const x0 = TH.x + 8;
    stroke(col); strokeWeight(1.5);
    line(x0, y, x0 + 12, y);
    noStroke(); fill(col); textSize(11); textAlign(LEFT, CENTER);
    text(etiqueta, x0 + 15, y - 7);
    text(fmtT(t) + " °C", x0 + 15, y + 7);
}

// Paso "redondo" para las marcas de una escala de amplitud dada.
function escalaPaso(rango) {
    const pasos = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    return pasos.find(p => rango / p <= 8) || 1000;
}

// Temperatura redondeada con signo menos tipográfico.
function fmtT(t) {
    const r = Math.round(t);
    return (r < 0 ? '−' : '') + Math.abs(r);
}


// ═══════════════════════════════════════════════════════════════════
//  MODOS
// ═══════════════════════════════════════════════════════════════════
function setMode(mode) {
    currentMode = mode;
    document.body.classList.remove('mode-curva', 'mode-fases');
    document.body.classList.add('mode-' + mode);
    ['curva', 'fases'].forEach(m => {
        const btn = document.getElementById('mode-' + m);
        btn.classList.toggle('active', m === mode);
        btn.setAttribute('aria-selected', String(m === mode));
    });
    cursor(ARROW);

    // Cada modo tiene su ventana de partículas
    if (mode === 'fases') {
        LENS = LENS_FASES;
        entrarFases();
    } else {
        LENS = LENS_CURVA;
        colocarParticulas(estado.fs === 1 ? 'solid' : estado.fl === 1 ? 'liquid' : estado.fg === 1 ? 'gas' : 'solid');
    }
    // En el diagrama se arrastra el punto: el canvas no debe desplazar la página
    document.querySelector('#canvas-container canvas').style.touchAction = mode === 'fases' ? 'none' : '';
}


// ═══════════════════════════════════════════════════════════════════
//  TEMAS (oscuro · claro · alto contraste)
// ═══════════════════════════════════════════════════════════════════
function setupThemeSelector() {
    const themeBtn   = document.getElementById('theme-btn');
    const themePanel = document.getElementById('theme-panel');
    const themeOpts  = document.querySelectorAll('.theme-opt');

    const closePanel = () => {
        themePanel.classList.remove('open');
        themePanel.setAttribute('aria-hidden', 'true');
        themeBtn.classList.remove('active');
        themeBtn.setAttribute('aria-expanded', 'false');
    };

    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = themePanel.classList.toggle('open');
        themeBtn.classList.toggle('active', isOpen);
        themeBtn.setAttribute('aria-expanded', String(isOpen));
        themePanel.setAttribute('aria-hidden', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
        if (!themeBtn.contains(e.target) && !themePanel.contains(e.target)) closePanel();
    });

    themeOpts.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.body.classList.remove('theme-light', 'theme-contrast');
            if (theme !== 'dark') document.body.classList.add('theme-' + theme);
            themeOpts.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closePanel();
        });
    });
}

// Colores del canvas. Los colores de estado (sólido, líquido, gas y cambio
// de estado) son los mismos en toda la simulación para que el alumno los asocie.
function updateTheme() {
    const isLight    = document.body.classList.contains('theme-light');
    const isContrast = document.body.classList.contains('theme-contrast');

    if (isLight) {
        THEME = {
            canvasBg:   '#ccd6e8',
            panelBg:    '#bccadd',
            border:     '#8898b0',
            text:       '#0d1520',
            textDim:    '#4a5a6a',
            accent:     '#0077a0',
            solid:      '#2a4ab0',
            liquid:     '#137a55',
            gas:        '#c0620f',
            change:     '#9a6c00',
            thermoGlass:'#6a7a90',
            thermoTube: '#e8eef6',
            thermoTick: '#6a7a90',
            thermoFill: '#d83030',
            jarWall:    '#4a5a70',
            jarLid:     '#9aa8bc',
            jarShine:   'rgba(255,255,255,0.55)',
            plateBody:  '#3a4250',
            plateTop:   '#6a7484',
            plateText:  '#f0f4f8',
            heat:       '#e0401e',
            cold:       '#1a72d0',
            lensBg:     '#dfe6f0',
            grid:       '#b4c0d2',
            axis:       '#5a6a80',
            particle:   '#3a4c66',
            particleEdge:'#1a2638',
            bond:       'rgba(0,110,160,0.75)',
        };
    } else if (isContrast) {
        THEME = {
            canvasBg:   '#000000',
            panelBg:    '#000000',
            border:     '#ffff00',
            text:       '#ffffff',
            textDim:    '#cccccc',
            accent:     '#00ffff',
            solid:      '#88aaff',
            liquid:     '#00ff88',
            gas:        '#ffaa00',
            change:     '#ffff00',
            thermoGlass:'#ffffff',
            thermoTube: '#000000',
            thermoTick: '#ffffff',
            thermoFill: '#ff3333',
            jarWall:    '#ffffff',
            jarLid:     '#333333',
            jarShine:   'rgba(255,255,255,0.5)',
            plateBody:  '#222222',
            plateTop:   '#888888',
            plateText:  '#ffffff',
            heat:       '#ff5533',
            cold:       '#33aaff',
            lensBg:     '#000000',
            grid:       '#333300',
            axis:       '#ffffff',
            particle:   '#ffffff',
            particleEdge:'#000000',
            bond:       '#00ffff',
        };
    } else {
        THEME = {
            canvasBg:   '#141414',
            panelBg:    '#141c24',
            border:     '#22303c',
            text:       '#d8d8d8',
            textDim:    '#666666',
            accent:     '#00c8ff',
            solid:      '#8aa8ff',
            liquid:     '#3ccf9a',
            gas:        '#ff9a4a',
            change:     '#ffd24a',
            thermoGlass:'#585858',
            thermoTube: '#1a1a1a',
            thermoTick: '#555555',
            thermoFill: '#ff4a4a',
            jarWall:    '#6a7480',
            jarLid:     '#2a3038',
            jarShine:   'rgba(255,255,255,0.12)',
            plateBody:  '#2a2e34',
            plateTop:   '#4a5058',
            plateText:  '#c8c8c8',
            heat:       '#ff5a3a',
            cold:       '#3a9cff',
            lensBg:     '#0b1016',
            grid:       '#1e2630',
            axis:       '#4a5868',
            particle:   '#dde6f0',
            particleEdge:'#6a7a8c',
            bond:       'rgba(0,200,255,0.6)',
        };
    }
}
