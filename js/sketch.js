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

// Termómetro (vista macro)
const TH = { x: 395, top: 110, bottom: 392 };

// --- SUSTANCIAS ---
// tf / teb: temperaturas reales de fusión y ebullición (°C, a 1 atm).
// tMin / tMax: rango del termómetro y de la gráfica. tIni: temperatura inicial.
const SUSTANCIAS = {
    agua: {
        nombre: 'Agua', tf: 0, teb: 100, tMin: -40, tMax: 140, tIni: -20,
        nombres: { solid: 'hielo', liquid: 'agua líquida', gas: 'vapor de agua' },
    },
    alcohol: {
        nombre: 'Alcohol', tf: -114, teb: 78, tMin: -160, tMax: 120, tIni: -140,
        nombres: { solid: 'alcohol sólido', liquid: 'alcohol líquido', gas: 'vapor de alcohol' },
    },
    nitrogeno: {
        nombre: 'Nitrógeno', tf: -210, teb: -196, tMin: -226, tMax: -180, tIni: -220,
        nombres: { solid: 'nitrógeno sólido', liquid: 'nitrógeno líquido', gas: 'nitrógeno gas' },
    },
    hierro: {
        nombre: 'Hierro', tf: 1538, teb: 2862, tMin: 1000, tMax: 3300, tIni: 1200,
        nombres: { solid: 'hierro sólido', liquid: 'hierro fundido', gas: 'hierro gas' },
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
        drawThermometer(estado.T);
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
        };
    }
}
