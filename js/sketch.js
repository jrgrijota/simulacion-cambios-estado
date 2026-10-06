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
const JAR   = { x: 62, y: 140, w: 250, h: 205 };   // interior del recipiente
const PLATE = { x: 44, y: 352, w: 286, h: 22 };
const TH    = { x: 395, top: 118, bottom: 384 };
const LIQ_MAX_H = 112;                              // altura del líquido con todo fundido

// --- SUSTANCIAS ---
// tf / teb: temperaturas reales de fusión y ebullición (°C, a 1 atm).
// tMin / tMax: rango del termómetro y de la gráfica. tIni: temperatura inicial.
// col: colores de la vista macroscópica. flota: si el sólido flota en su líquido.
const SUSTANCIAS = {
    agua: {
        nombre: 'Agua', tf: 0, teb: 100, tMin: -40, tMax: 140, tIni: -20,
        nombres: { solid: 'hielo', liquid: 'agua líquida', gas: 'vapor de agua' },
        col: { solid: '#d6ecff', liquid: '#3a8ee6', gas: '#cfe0f0' }, flota: true,
    },
    alcohol: {
        nombre: 'Alcohol', tf: -114, teb: 78, tMin: -160, tMax: 120, tIni: -140,
        nombres: { solid: 'alcohol sólido', liquid: 'alcohol líquido', gas: 'vapor de alcohol' },
        col: { solid: '#f2eed8', liquid: '#d9c46a', gas: '#efe6c0' }, flota: false,
    },
    nitrogeno: {
        nombre: 'Nitrógeno', tf: -210, teb: -196, tMin: -226, tMax: -180, tIni: -220,
        nombres: { solid: 'nitrógeno sólido', liquid: 'nitrógeno líquido', gas: 'nitrógeno gas' },
        col: { solid: '#eef6ff', liquid: '#9fd4ee', gas: '#d8eef8' }, flota: false,
    },
    hierro: {
        nombre: 'Hierro', tf: 1538, teb: 2862, tMin: 1000, tMax: 3300, tIni: 1200,
        nombres: { solid: 'hierro sólido', liquid: 'hierro fundido', gas: 'hierro gas' },
        col: { solid: '#8a6a5a', liquid: '#ff8a2a', gas: '#ffb070' }, flota: false,
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
    setupThemeSelector();

    cambiarSustancia('agua');
}

function draw() {
    updateTheme();
    background(THEME.canvasBg);

    if (currentMode === 'curva') {
        actualizarModelo();
        drawMacroView();
        if (frameCount % 4 === 0) updateCurvaUI();
    } else {
        noStroke(); fill(THEME.textDim); textAlign(CENTER, CENTER); textSize(16);
        text('Presión y temperatura', CV_W / 2, CV_H / 2);
    }
}


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
}

function reiniciar() {
    energia = energiaSolido(sus.tIni, sus);
    tiempo = 0;
    burbujas = [];
    gotas = [];
    estado = estadoDesdeEnergia(energia, sus);
}

function cambiarSustancia(clave) {
    sus = SUSTANCIAS[clave];
    document.getElementById('sustancia-hint').innerHTML =
        `Funde a <strong>${fmtT(sus.tf)} °C</strong> · Hierve a <strong>${fmtT(sus.teb)} °C</strong>`;
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
    const s = 46 * sqrt(estado.fs);
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
    const sep = 48;
    stroke(borde); strokeWeight(1.5); fill(c);
    for (const i of fila1) rect(cx + i * sep - s / 2, base - s, s, s, radio);
    for (const i of fila2) rect(cx + i * sep - s / 2, base - s - min(s, 46) - 2, s, s, radio);

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
        };
    }
}
