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

// --- MODOS ---
let currentMode = 'curva';   // 'curva' (calentar y enfriar) | 'fases' (diagrama de fases)

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

    setupThemeSelector();
}

function draw() {
    updateTheme();
    background(THEME.canvasBg);

    noStroke(); fill(THEME.textDim); textAlign(CENTER, CENTER); textSize(16);
    text(currentMode === 'curva' ? 'Calentar y enfriar' : 'Presión y temperatura', CV_W / 2, CV_H / 2);
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
            canvasBg:  '#ccd6e8',
            panelBg:   '#bccadd',
            border:    '#8898b0',
            text:      '#0d1520',
            textDim:   '#4a5a6a',
            accent:    '#0077a0',
            solid:     '#2a4ab0',
            liquid:    '#137a55',
            gas:       '#c0620f',
            change:    '#9a6c00',
        };
    } else if (isContrast) {
        THEME = {
            canvasBg:  '#000000',
            panelBg:   '#000000',
            border:    '#ffff00',
            text:      '#ffffff',
            textDim:   '#cccccc',
            accent:    '#00ffff',
            solid:     '#88aaff',
            liquid:    '#00ff88',
            gas:       '#ffaa00',
            change:    '#ffff00',
        };
    } else {
        THEME = {
            canvasBg:  '#141414',
            panelBg:   '#141c24',
            border:    '#22303c',
            text:      '#d8d8d8',
            textDim:   '#666666',
            accent:    '#00c8ff',
            solid:     '#8aa8ff',
            liquid:    '#3ccf9a',
            gas:       '#ff9a4a',
            change:    '#ffd24a',
        };
    }
}
