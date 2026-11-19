// ═══════════════════════════════════════════════════════════════════
//  SIMULACIÓN: CAMBIOS DE ESTADO
//  Física y Química para la ESO
//
//  Prioridad: claridad pedagógica por encima de la exactitud numérica.
//  Las temperaturas de fusión y ebullición son reales; los tiempos y
//  energías están escalados para que cada tramo se vea bien en clase.
// ═══════════════════════════════════════════════════════════════════

// --- LAYOUT DEL CANVAS ---
// El modo «Presión y temperatura» usa un lienzo de 1050 × 700. El modo «Calentar y
// enfriar» es una escena con su propio tamaño (portátil o móvil): ver js/escena.js,
// que fija estas medidas en calcularEscena().
const FASES_W = 1050, FASES_H = 700;
let CV_W = FASES_W, CV_H = FASES_H;

// Recipiente, placa y termómetro; ventana de partículas; gráfica (las fija calcularEscena)
let LENS_CURVA, GRAPH, PLOT;
let LENS;     // ventana de partículas activa (cada modo tiene la suya)

// Partículas: red de 16 × 4 en el sólido. Es ancha y baja, como el líquido que
// forma al fundirse: así, al solidificar, las partículas se ordenan en el fondo,
// donde ya están, sin subir a ocupar huecos por encima del líquido.
let P_COLS = 16;
let P_ROWS = 4, P_N = P_COLS * P_ROWS;
let P_R    = 9;            // radio (en la escena depende del tamaño del modelo)
let K_VEL  = 1;            // escala de las velocidades con el radio (P_R / 9)
// Separación en la red cristalina. En casi todas las sustancias el sólido es
// más compacto que el líquido (partículas tocándose); el agua es la excepción:
// el hielo tiene una red abierta y por eso flota. La lupa lo enseña así.
function sepRed() {
    const abierta = currentMode === 'fases' ? dg === DIAGRAMAS.agua : sus.flota;
    return abierta ? 2 * P_R + 2 : 2 * P_R - 0.5;
}

// --- SUSTANCIAS ---
// tf / teb: temperaturas reales de fusión y ebullición (°C, a 1 atm).
// tMin / tMax: rango del termómetro y de la gráfica. tIni: temperatura inicial.
// tMax deja al gas un margen amplio para que se vea cómo se sigue calentando.
// col: colores de la vista macroscópica. flota: si el sólido flota en su líquido.
const SUSTANCIAS = {
    agua: {
        nombre: 'Agua', molecula: 'h2o', tf: 0, teb: 100, tMin: -40, tMax: 250, tIni: -20,
        nombres: { solid: 'hielo', liquid: 'agua líquida', gas: 'vapor de agua' },
        col: { solid: '#d6ecff', liquid: '#3a8ee6', gas: '#cfe0f0' }, flota: true,
        curiosidad: 'El hielo flota porque es menos denso que el agua líquida: algo muy raro entre los sólidos.',
    },
    alcohol: {
        nombre: 'Alcohol', tf: -114, teb: 78, tMin: -160, tMax: 240, tIni: -140,
        nombres: { solid: 'alcohol sólido', liquid: 'alcohol líquido', gas: 'vapor de alcohol' },
        col: { solid: '#f2eed8', liquid: '#d9c46a', gas: '#efe6c0' }, flota: false,
        curiosidad: 'Hierve antes que el agua: por eso el alcohol de las heridas se evapora tan rápido.',
    },
    nitrogeno: {
        nombre: 'Nitrógeno', molecula: 'n2', tf: -210, teb: -196, tMin: -226, tMax: -150, tIni: -220,
        nombres: { solid: 'nitrógeno sólido', liquid: 'nitrógeno líquido', gas: 'nitrógeno gas' },
        col: { solid: '#eef6ff', liquid: '#9fd4ee', gas: '#d8eef8' }, flota: false,
        curiosidad: 'A temperatura ambiente es un gas: forma el 78 % del aire que respiramos.',
    },
    hierro: {
        nombre: 'Hierro', tf: 1538, teb: 2862, tMin: 1000, tMax: 4200, tIni: 1200,
        nombres: { solid: 'hierro sólido', liquid: 'hierro fundido', gas: 'hierro gas' },
        col: { solid: '#8a6a5a', liquid: '#ff8a2a', gas: '#ffb070' }, flota: false,
        curiosidad: 'Para fundirlo hacen falta hornos a más de 1500 °C, como los altos hornos de las acerías.',
    },
    // Hielo seco: a 1 atm no puede ser líquido y sublima a −78,5 °C
    // (tf = teb = temperatura de sublimación; ver calcularTramos).
    hieloSeco: {
        nombre: 'Hielo seco (CO₂)', molecula: 'co2', sublima: true,
        tf: -78.5, teb: -78.5, tMin: -120, tMax: 20, tIni: -110,
        nombres: { solid: 'hielo seco', liquid: 'CO₂ líquido', gas: 'CO₂ gas' },
        col: { solid: '#eef2f6', liquid: '#cfe0f0', gas: '#e4ecf4' }, flota: false,
        curiosidad: 'Se usa para conservar alimentos congelados y para hacer «niebla» en los escenarios: no deja charco porque no pasa por líquido.',
    },
};

// --- MODELO DE ENERGÍA (didáctico) ---
// Energía (unidades escaladas) que absorbe cada tramo de la curva:
//   calentar sólido · fusión · calentar líquido · vaporización · calentar gas
// Las mesetas son iguales para todas las sustancias, y la vaporización absorbe
// más energía que la fusión (como en la realidad). Los tres tramos de
// calentamiento se reparten E_CALOR según ΔT × calor específico relativo:
// el líquido necesita el doble de energía por grado que el sólido y el gas
// (en el agua, 4,18 frente a unos 2 J/g·°C), así que su pendiente es menor.
const E_FUSION = 14, E_VAPOR = 26, E_CALOR = 50;
const C_REL = { solido: 1, liquido: 2, gas: 1 };
const POT_MAX = 1.0;   // unidades de energía por "minuto" con la placa al 100 %

// Energías de los cinco tramos de una sustancia (se calculan una vez).
function calcularTramos(s) {
    const pS = C_REL.solido  * (s.tf  - s.tMin);
    const pL = C_REL.liquido * (s.teb - s.tf);
    const pG = C_REL.gas     * (s.tMax - s.teb);
    const k  = E_CALOR / (pS + pL + pG);
    // En la sublimación las partículas se separan del todo de una vez: absorbe
    // la energía de la fusión y la de la vaporización juntas (como en la realidad).
    s.segE = s.sublima ? [pS * k, E_FUSION + E_VAPOR, 0, 0, pG * k]
                       : [pS * k, E_FUSION, pL * k, E_VAPOR, pG * k];
    s.eTot = s.segE.reduce((a, b) => a + b, 0);
}
Object.values(SUSTANCIAS).forEach(calcularTramos);

// --- MODOS ---
let currentMode = 'curva';   // 'curva' (calentar y enfriar) | 'fases' (diagrama de fases)

// --- ESTADO DE LA SIMULACIÓN ---
let sus;                 // sustancia actual
let energia = 0;         // energía almacenada (unidades didácticas)
let energiaInicial = 0;  // energía al reiniciar (para contar solo la aportada)
let tiempo  = 0;         // tiempo simulado (min)
let potencia = 0.5;      // -1 (enfriar al máximo) … +1 (calentar al máximo)
const velocidad = 1;     // multiplicador de tiempo (fijo: sin botones de velocidad)
let estado;              // resultado de estadoDesdeEnergia()
let limite = 0;          // +1 / −1: la placa se apagó sola al llegar al tope / al fondo

// --- ESTADO GLOBAL ---
let THEME = {};


// ─────────────────────────────────────────────────────────────────
function setup() {
    calcularEscena();
    const canvas = createCanvas(CV_W, CV_H);
    pixelDensity(Math.min(3, Math.max(2, displayDensity())));
    canvas.parent('canvas-container');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', i18n.t('Simulación de cambios de estado: recipiente, partículas y gráfica. Los mensajes de la simulación se leen en voz alta.'));
    fitCanvas();
    frameRate(60);
    textFont('monospace');
    if (document.fonts) document.fonts.load('600 12px Fredoka');

    document.getElementById('mode-curva').addEventListener('click', () => setMode('curva'));
    document.getElementById('mode-fases').addEventListener('click', () => setMode('fases'));

    setupCurvaControls();
    setupFasesControls();
    setupThemeSelector();

    setupEscenaControles();
    cambiarSustancia('agua');

    // Ajustes de la dirección (fichas del alumnado): ver js/parametros.js.
    // «sustancia», «temperatura» y «presion» (en atm) valen para el modo en el que
    // se abra; la presión del diagrama va en escala logarítmica.
    const pulsar = (sel) => (v) => { const b = document.querySelector(sel(v)); if (b) b.click(); };
    aplicarParametrosUrl({
        tema:        (v) => { const t = { simulaciencia: 'marca', marca: 'marca', claro: 'light', oscuro: 'dark', contraste: 'contrast' }[v];
                                  const b = t && document.querySelector(`.theme-opt[data-theme="${t}"]`); if (b) b.click(); },
        modo:        urlParam.click({ curva: 'mode-curva', fases: 'mode-fases' }),
        sustancia:   (v) => {
            if (currentMode === 'fases') return urlParam.select('select-fases-sustancia')(v);
            const clave = { 'hielo-seco': 'hieloSeco', 'hieloseco': 'hieloSeco' }[v] || v;
            const b = document.querySelector(`[data-sus="${clave}"]`); if (b) b.click();
        },
        potencia:    urlParam.range('slider-potencia'),
        placa:       pulsar((v) => `[data-placa="${{ enfriar: -1, apagar: 0, calentar: 1 }[v]}"]`),
        retos:       (v) => { if (['1', 'si', 'sí', 'true'].includes(v)) abrirRetos(true); },
        uniones:     urlParam.toggle('check-uniones', (c) => c.checked),
        estelas:     urlParam.toggle('check-estelas', (c) => c.checked),
        temperatura: urlParam.range('slider-fases-T'),
        presion:     (v) => {
            const pAtm = parseFloat(v.replace(',', '.'));
            if (!(pAtm > 0)) return;
            const pos = 1000 * (Math.log(pAtm) - Math.log(dg.pMin)) / (Math.log(dg.pMax) - Math.log(dg.pMin));
            urlParam.range('slider-fases-P')(String(pos));
        },
    });
}

function draw() {
    updateTheme();
    if (currentMode === 'curva') {
        clear();
        textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
        actualizarModelo();
        updateParticles(estado, agitacion(estado.T, sus.tMin, sus.tf, sus.teb, sus.tMax));
        drawEscena();
        if (frameCount % 4 === 0) updateCurvaUI();
        return;
    }
    if (THEME.fun) {
        // El marco exterior se dibuja dentro del lienzo: así encoge con él y nunca
        // choca con los tableros (en el móvil el lienzo se reduce mucho).
        clear();
        stroke(THEME.border); strokeWeight(2); fill(THEME.canvasBg);
        rect(1, 1, CV_W - 2, CV_H - 2, 34);
    } else {
        background(THEME.canvasBg);
    }
    textFont(THEME.fun ? 'Fredoka' : 'monospace');

    drawFasesMode();
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
    const [eS, eF, eL, eV, eG] = s.segE;
    let T, fs = 0, fl = 0, fg = 0, tramo;

    if (E < eS) {
        tramo = 'solido';
        T = lerp(s.tMin, s.tf, E / eS);
        fs = 1;
    } else if (E < eS + eF && s.sublima) {
        tramo = 'sublimacion';
        T = s.tf;
        fg = (E - eS) / eF;
        fs = 1 - fg;
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
    return s.segE[0] * constrain((T - s.tMin) / (s.tf - s.tMin), 0, 1);
}

function actualizarModelo() {
    const dt = min(deltaTime / 1000, 0.1);
    tiempo += dt;
    energia = constrain(energia + potencia * POT_MAX * dt, 0, sus.eTot);
    // Al llegar al extremo del termómetro se apaga la placa: si siguiera
    // encendida, la gráfica pintaría una meseta que no existe.
    if ((potencia > 0 && energia >= sus.eTot) || (potencia < 0 && energia <= 0)) {
        const signo = Math.sign(potencia);
        document.getElementById('slider-potencia').value = 0;
        setPotencia(0);
        limite = signo;
    }
    estado = estadoDesdeEnergia(energia, sus);
    registrarMuestra();
}

function reiniciar() {
    energia = energiaSolido(sus.tIni, sus);
    energiaInicial = energia;
    limite = 0;
    tiempo = 0;
    historial = [];
    burbujasV = [];
    gotasV = [];
    trozosVivos = null;
    initParticles();
    estado = estadoDesdeEnergia(energia, sus);
    if (typeof retosReiniciar === 'function') retosReiniciar();
}

// Marca como activo un botón de un grupo de opciones (role="radio")
function marcarGrupo(selector, activo) {
    document.querySelectorAll(selector).forEach(b => {
        b.classList.toggle('active', b === activo);
        b.setAttribute('aria-checked', String(b === activo));
    });
}

function cambiarSustancia(clave) {
    sus = SUSTANCIAS[clave];
    sus.clave = clave;
    marcarGrupo('[data-sus]', document.querySelector(`[data-sus="${clave}"]`));
    document.getElementById('sustancia-hint').innerHTML =
        i18n.t(sus.sublima
                   ? 'A 1 atm no es líquido: sublima a <strong>{tf} °C</strong><br><em>¿Sabías que…?</em> {c}'
                   : 'Funde a <strong>{tf} °C</strong> · Hierve a <strong>{teb} °C</strong><br><em>¿Sabías que…?</em> {c}',
               { tf: fmtT(sus.tf), teb: fmtT(sus.teb), c: i18n.t(sus.curiosidad) });
    const hint = document.getElementById('sustancia-hint');
    hint.innerHTML = hint.innerHTML.replace('<br>', '<span class="curiosidad"><br>') + '</span>';
    reiniciar();
    updateCurvaUI();
}

// Nombre del estado o del cambio de estado, según el sentido de la energía.
function describirEstado(e) {
    const signo = Math.sign(potencia);
    switch (e.tramo) {
        case 'solido':  return { txt: i18n.t('Sólido'),  cls: 'st-solid' };
        case 'liquido': return { txt: i18n.t('Líquido'), cls: 'st-liquid' };
        case 'gas':     return { txt: i18n.t('Gas'),     cls: 'st-gas' };
        case 'fusion':
            if (signo > 0) return { txt: i18n.t('Fusión  (sólido → líquido)'), cls: 'st-change' };
            if (signo < 0) return { txt: i18n.t('Solidificación  (líquido → sólido)'), cls: 'st-change' };
            return { txt: i18n.t('Sólido y líquido a la vez'), cls: 'st-change' };
        case 'sublimacion':
            if (signo > 0) return { txt: i18n.t('Sublimación  (sólido → gas)'), cls: 'st-change' };
            if (signo < 0) return { txt: i18n.t('Sublimación inversa  (gas → sólido)'), cls: 'st-change' };
            return { txt: i18n.t('Sólido y gas a la vez'), cls: 'st-change' };
        case 'vaporizacion':
            if (signo > 0) return { txt: i18n.t('Vaporización  (líquido → gas)'), cls: 'st-change' };
            if (signo < 0) return { txt: i18n.t('Condensación  (gas → líquido)'), cls: 'st-change' };
            return { txt: i18n.t('Líquido y gas a la vez'), cls: 'st-change' };
    }
}


// ═══════════════════════════════════════════════════════════════════
//  CONTROLES DEL MODO CURVA
// ═══════════════════════════════════════════════════════════════════
function setupCurvaControls() {
    document.querySelectorAll('[data-sus]').forEach(btn => {
        btn.addEventListener('click', () => cambiarSustancia(btn.dataset.sus));
    });

    const slPot = document.getElementById('slider-potencia');
    slPot.addEventListener('input', () => setPotencia(parseInt(slPot.value, 10)));
    setPotencia(parseInt(slPot.value, 10));


    // Botones rápidos de la placa: cambian el sentido y conservan la intensidad
    // elegida en el deslizador (al encender desde «Apagar», al 50 %).
    document.querySelectorAll('[data-placa]').forEach(btn => {
        btn.addEventListener('click', () => {
            const signo = parseInt(btn.dataset.placa, 10);
            const mag = Math.abs(parseInt(slPot.value, 10)) || 50;
            slPot.value = signo * mag;
            setPotencia(signo * mag);
        });
    });

    // En los grupos de opciones, las flechas pasan a la opción vecina (como en un grupo de radio)
    document.querySelectorAll('.carril[role="radiogroup"], .carril[role="tablist"]').forEach(grupo => {
        grupo.addEventListener('keydown', (e) => {
            const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!paso) return;
            e.preventDefault();
            const btns = [...grupo.querySelectorAll('button')];
            const i = btns.indexOf(document.activeElement);
            const sig = btns[(i + paso + btns.length) % btns.length];
            sig.focus();
            sig.click();
        });
    });

    document.getElementById('btn-reiniciar').addEventListener('click', reiniciar);

    // Atajo de teclado: R (reiniciar).
    // No actúan si el foco está en un control, que ya usa esas teclas.
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (currentMode !== 'curva') return;
        if (e.target.closest('button, input, select, textarea, summary, a')) return;
        if (e.key === 'r' || e.key === 'R') reiniciar();
    });

    const chkUniones = document.getElementById('check-uniones');
    const chkEstelas = document.getElementById('check-estelas');
    chkUniones.addEventListener('change', () => { verUniones = chkUniones.checked; });
    chkEstelas.addEventListener('change', () => { verEstelas = chkEstelas.checked; });
}

function setPotencia(v) {
    potencia = v / 100;
    limite = 0;
    const sl = document.getElementById('slider-potencia');
    const from = v >= 0 ? 50 : 50 + v / 2;
    const to   = v >= 0 ? 50 + v / 2 : 50;
    sl.style.setProperty('--from', from + '%');
    sl.style.setProperty('--to', to + '%');
    sl.style.setProperty('--pc', v >= 0 ? '#ff5a5acc' : '#3a8ee6cc');
    document.getElementById('val-potencia').textContent =
        v === 0 ? '0 %' : (v > 0 ? '+' : '−') + Math.abs(v) + ' %';

    const signo = Math.sign(v);
    marcarGrupo('[data-placa]', document.querySelector('[data-placa="' + signo + '"]'));

}

function updateCurvaUI() {
    if (!estado) return;
    anunciar(mensajeDidactico());
    if (typeof retosComprobar === 'function') retosComprobar();
}

// Reparte la energía almacenada entre la que subió la temperatura (tramos con
// pendiente) y la que separó las partículas (mesetas de cambio de estado).
function repartoEnergia(E) {
    let sensible = 0, latente = 0, acum = 0;
    sus.segE.forEach((e, i) => {
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
    const N = { solid: i18n.t(sus.nombres.solid), liquid: i18n.t(sus.nombres.liquid), gas: i18n.t(sus.nombres.gas) };

    if (limite < 0) return { tag: i18n.t('LÍMITE'), col: THEME.textDim,
        txt: i18n.t('El termómetro ha llegado a su mínimo y la placa se ha apagado sola. Sin energía que salga, la temperatura ya no baja. Calienta para seguir.') };
    if (limite > 0) return { tag: i18n.t('LÍMITE'), col: THEME.textDim,
        txt: i18n.t('El termómetro ha llegado a su máximo y la placa se ha apagado sola. Sin energía que entre, la temperatura ya no sube. Enfría para seguir.') };

    switch (estado.tramo) {
        case 'solido':
            if (s > 0) return { tag: i18n.t('SÓLIDO'), col: THEME.solid,
                txt: i18n.t('El {s} se calienta: sus partículas vibran cada vez más deprisa y la temperatura sube.', { s: N.solid }) };
            if (s < 0) return { tag: i18n.t('SÓLIDO'), col: THEME.solid,
                txt: i18n.t('El {s} se enfría: sus partículas vibran cada vez más despacio y la temperatura baja.', { s: N.solid }) };
            return { tag: i18n.t('SÓLIDO'), col: THEME.solid,
                txt: i18n.t('Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.') };
        case 'fusion':
            if (s > 0) return { tag: i18n.t('FUSIÓN'), col: THEME.change,
                txt: i18n.t('La energía se usa para romper las uniones entre partículas, no para subir la temperatura. Por eso se queda en {tf} hasta que todo se funde.', { tf }) };
            if (s < 0) return { tag: i18n.t('SOLIDIFICACIÓN'), col: THEME.change,
                txt: i18n.t('Las partículas del líquido pierden energía y vuelven a ordenarse. La temperatura se mantiene en {tf} hasta que todo es sólido.', { tf }) };
            return { tag: i18n.t('EQUILIBRIO'), col: THEME.change,
                txt: i18n.t('Sólido y líquido conviven a {tf}. Mientras no entre ni salga energía, la proporción no cambia.', { tf }) };
        case 'sublimacion':
            if (s > 0) return { tag: i18n.t('SUBLIMACIÓN'), col: THEME.change,
                txt: i18n.t('Las partículas escapan del sólido directamente como gas, sin pasar por líquido. La energía se gasta en separarlas: la temperatura se queda en {tf}.', { tf }) };
            if (s < 0) return { tag: i18n.t('SUBLIMACIÓN INVERSA'), col: THEME.change,
                txt: i18n.t('Las partículas del gas pierden energía y se ordenan directamente en el sólido, sin pasar por líquido. La temperatura se mantiene en {tf}.', { tf }) };
            return { tag: i18n.t('EQUILIBRIO'), col: THEME.change,
                txt: i18n.t('Sólido y gas conviven a {tf}. Mientras no entre ni salga energía, la proporción no cambia.', { tf }) };
        case 'liquido':
            if (s > 0) return { tag: i18n.t('LÍQUIDO'), col: THEME.liquid,
                txt: i18n.t('El {s} se calienta: sus partículas se mueven y se deslizan cada vez más rápido.', { s: N.liquid }) };
            if (s < 0) return { tag: i18n.t('LÍQUIDO'), col: THEME.liquid,
                txt: i18n.t('El {s} se enfría: sus partículas se mueven cada vez más despacio.', { s: N.liquid }) };
            return { tag: i18n.t('LÍQUIDO'), col: THEME.liquid,
                txt: i18n.t('Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.') };
        case 'vaporizacion':
            if (s > 0) return { tag: i18n.t('EBULLICIÓN'), col: THEME.change,
                txt: i18n.t('Las partículas se separan del todo y escapan como gas (por eso salen burbujas). La energía se gasta en separarlas: la temperatura no pasa de {teb}.', { teb }) };
            if (s < 0) return { tag: i18n.t('CONDENSACIÓN'), col: THEME.change,
                txt: i18n.t('Las partículas del gas pierden energía, se juntan y vuelven a ser líquido (gotas en la tapa). La temperatura se mantiene en {teb}.', { teb }) };
            return { tag: i18n.t('EQUILIBRIO'), col: THEME.change,
                txt: i18n.t('Líquido y gas conviven a {teb}. Mientras no entre ni salga energía, la proporción no cambia.', { teb }) };
        case 'gas':
            if (s > 0) return { tag: i18n.t('GAS'), col: THEME.gas,
                txt: i18n.t('El {s} se calienta: sus partículas se mueven cada vez más rápido y ocupan todo el recipiente.', { s: N.gas }) };
            if (s < 0) return { tag: i18n.t('GAS'), col: THEME.gas,
                txt: i18n.t('El {s} se enfría: sus partículas se mueven cada vez más despacio.', { s: N.gas }) };
            return { tag: i18n.t('GAS'), col: THEME.gas,
                txt: i18n.t('Placa apagada: no entra ni sale energía y nada cambia. Mueve la potencia para calentar o enfriar.') };
    }
}

// ── Estilo juego: mascota, saltos y chispas ─────────────────────
const FUENTE_TEXTO = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// En el estilo juego los textos van en tipo frase («Lo que vemos»), no en mayúsculas.
function frase(t) {
    if (!THEME.fun) return t;
    const l = t.toLocaleLowerCase();
    return l.charAt(0).toLocaleUpperCase() + l.slice(1);
}
const MOV_REDUCIDO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let bannerTag = '', bannerDesde = -1e9, chispas = [];

function lanzarChispas(x, y, col, n) {
    if (MOV_REDUCIDO) return;
    for (let i = 0; i < n; i++) {
        const a = random(TWO_PI), v = random(1.5, 4);
        chispas.push({ x, y, vx: cos(a) * v, vy: sin(a) * v - 1, vida: 1, col, r: random(3, 6), estrella: random() < 0.5 });
    }
}

function drawChispas() {
    for (let i = chispas.length - 1; i >= 0; i--) {
        const c = chispas[i];
        c.x += c.vx; c.y += c.vy; c.vy += 0.12; c.vida -= 0.04;
        if (c.vida <= 0) { chispas.splice(i, 1); continue; }
        const col = color(c.col); col.setAlpha(255 * c.vida);
        noStroke(); fill(col);
        if (c.estrella) estrella(c.x, c.y, c.r * 1.3, c.r * 0.5);
        else circle(c.x, c.y, c.r * 2 * c.vida);
    }
}

function estrella(x, y, r1, r2) {
    beginShape();
    for (let i = 0; i < 10; i++) {
        const a = -HALF_PI + i * PI / 5, r = i % 2 ? r2 : r1;
        vertex(x + cos(a) * r, y + sin(a) * r);
    }
    endShape(CLOSE);
}

// Escala de un «salto» (pop) que dura ~0,45 s desde t0
function salto(t0) {
    if (MOV_REDUCIDO) return 1;
    const e = (millis() - t0) / 450;
    if (e >= 1) return 1;
    return 1 + 0.35 * sin(e * PI) * (1 - e);
}

// Mascota: una partícula sonriente del color del estado actual.
function drawMascota(cx, cy, r, col) {
    const bote = MOV_REDUCIDO ? 0 : sin(millis() / 260) * 1.5;
    const t = millis() % 4200;
    const parpadeo = t > 4050;
    push();
    translate(cx, cy + bote);
    const s = salto(bannerDesde);
    scale(s, 2 - s);
    noStroke(); fill(0, 0, 0, 45); ellipse(0, r + 3 - bote, r * 1.5, 5);
    stroke(THEME.ink); strokeWeight(2.5); fill(col);
    circle(0, 0, r * 2);
    noStroke(); fill(255, 255, 255, 150);
    ellipse(-r * 0.42, -r * 0.45, r * 0.55, r * 0.35);
    // Ojos y sonrisa
    fill(THEME.ink);
    if (parpadeo) { stroke(THEME.ink); strokeWeight(2); line(-r * 0.42, -r * 0.05, -r * 0.18, -r * 0.05); line(r * 0.18, -r * 0.05, r * 0.42, -r * 0.05); }
    else { ellipse(-r * 0.3, -r * 0.08, r * 0.2, r * 0.3); ellipse(r * 0.3, -r * 0.08, r * 0.2, r * 0.3); }
    noFill(); stroke(THEME.ink); strokeWeight(2.2);
    arc(0, r * 0.18, r * 0.6, r * 0.45, 0.15 * PI, 0.85 * PI);
    noStroke(); fill(255, 120, 150, 120);
    circle(-r * 0.58, r * 0.22, r * 0.3); circle(r * 0.58, r * 0.22, r * 0.3);
    pop();
}

function drawBannerJuego(m) {
    const { x, y, w, h } = BANNER;
    if (m.tag !== bannerTag) {
        if (bannerTag) lanzarChispas(x + 24, y + h / 2, m.col, 12);
        bannerTag = m.tag; bannerDesde = millis();
    }
    // En el tema Día los colores de estado son oscuros (para leerse): la mascota, más clara
    const cm = lightness(color(m.col)) > 55 ? color(m.col) : lerpColor(color(m.col), color(255), 0.45);
    drawMascota(x + 24, y + h / 2, 21, cm);

    // Bocadillo con pico hacia la mascota
    const bx = x + 58, my = y + h / 2;
    noStroke(); fill(THEME.ink); rect(bx, y + 3, w - 58, h, 16);
    stroke(THEME.border); strokeWeight(2); fill(THEME.panelBg);
    triangle(bx - 10, my, bx + 4, my - 8, bx + 4, my + 8);      // pico con su borde
    rect(bx, y, w - 58, h, 16);
    noStroke(); fill(THEME.panelBg);
    triangle(bx - 7, my, bx + 3, my - 6, bx + 3, my + 6);        // tapa la junta: una sola forma

    // Etiqueta que da un salto al cambiar
    textStyle(BOLD); textSize(16);
    const tw = textWidth(m.tag) + 26;
    push();
    translate(bx + 14 + tw / 2, y + h / 2);
    scale(salto(bannerDesde));
    noStroke(); fill(THEME.ink); rect(-tw / 2, -14, tw, 30, 15);
    fill(m.col); rect(-tw / 2, -16, tw, 30, 15);
    fill(lightness(color(m.col)) > 55 ? THEME.ink : '#ffffff'); textAlign(CENTER, CENTER);
    text(m.tag, 0, -1);
    pop();
    textStyle(NORMAL);

    textFont(FUENTE_TEXTO);
    fill(THEME.text); textSize(16); textAlign(LEFT, CENTER); textLeading(19);
    const tx = bx + 14 + tw + 14;
    text(m.txt, tx, y + 3, x + w - tx - 14, h - 6);
    textFont('Fredoka');
}

function drawBanner(m) {
    anunciar(m);
    if (THEME.fun) {
        drawBannerJuego(m);
        // Las chispas no salen de la franja del mensaje: nunca tapan texto de los tableros
        drawingContext.save();
        drawingContext.beginPath();
        drawingContext.rect(BANNER.x, BANNER.y - 6, 120, BANNER.h + 12);
        drawingContext.clip();
        drawChispas();
        drawingContext.restore();
        return;
    }
    const { x, y, w, h } = BANNER;
    const borde = color(m.col);
    const rad = THEME.fun ? 16 : 10;
    stroke(THEME.border); strokeWeight(THEME.fun ? 2 : 1); fill(THEME.panelBg);
    rect(x, y, w, h, rad);
    noStroke(); fill(borde);
    if (!THEME.fun) rect(x, y, 5, h, 10, 0, 0, 10);

    // Etiqueta del estado o del cambio
    textStyle(BOLD); textSize(13);
    const tw = textWidth(m.tag) + 22;
    const bg = color(m.col); bg.setAlpha(40);
    fill(bg); stroke(m.col); strokeWeight(1.5);
    rect(x + 16, y + h / 2 - 13, tw, 26, 13);
    noStroke(); fill(m.col); textAlign(CENTER, CENTER);
    text(m.tag, x + 16 + tw / 2, y + h / 2 + 1);
    textStyle(NORMAL);

    fill(THEME.text); textSize(THEME.fun ? 14 : 13); textAlign(LEFT, CENTER); textLeading(17);
    const tx = x + 16 + tw + 16;
    text(m.txt, tx, y + 4, x + w - tx - 14, h - 8);
}


// ═══════════════════════════════════════════════════════════════════
//  VISTA MACROSCÓPICA: "LO QUE VEMOS"
// ═══════════════════════════════════════════════════════════════════

function drawPanelFrame(r, titulo, sub) {
    if (THEME.fun) {
        // Tablero del juego: borde grueso y una «sombra» sólida debajo
        noStroke(); fill(THEME.ink); rect(r.x, r.y + 4, r.w, r.h, 18);
        stroke(THEME.border); strokeWeight(2); fill(THEME.panelBg);
        rect(r.x, r.y, r.w, r.h, 18);
        noStroke(); fill(THEME.textDim); circle(r.x + 18, r.y + 18, 8);
        titulo = frase(titulo);
        textAlign(LEFT, CENTER); textStyle(BOLD); textSize(15); fill(THEME.title);
        text(titulo, r.x + 30, r.y + 18);
        const w = textWidth(titulo);
        textStyle(NORMAL); textSize(12); fill(THEME.textDim);
        text('· ' + sub, r.x + 36 + w, r.y + 18);
        return;
    }
    stroke(THEME.border); strokeWeight(1); fill(THEME.panelBg);
    rect(r.x, r.y, r.w, r.h, 10);
    noStroke(); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(12); fill(THEME.accent);
    text(titulo, r.x + 14, r.y + 17);
    const w = textWidth(titulo);
    textStyle(NORMAL); textSize(11); fill(THEME.textDim);
    text('· ' + sub, r.x + 20 + w, r.y + 17);
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
let flotacion = 0;        // cuánto ha subido la red del sólido que flota (hielo)

function initParticles() {
    const P_SEP = sepRed();
    const x0 = LENS.x + LENS.w / 2 - (P_COLS - 1) * P_SEP / 2;
    const yb = LENS.y + LENS.h - P_R - 4;
    sitios = [];
    for (let i = 0; i < P_N; i++) {
        const fila = Math.floor(i / P_COLS), col = i % P_COLS;   // fila 0 = abajo
        // Se funden antes las partículas de arriba y de los bordes
        // (si el sólido flota, como el hielo, se funde antes por abajo, donde toca el líquido)
        const flota = currentMode === 'curva' && sus.flota;
        const orden = (flota ? P_ROWS - 1 - fila : fila) + abs(col - (P_COLS - 1) / 2) * 0.45 + ((i * 7919) % 13) / 40;
        // ang: orientación de la molécula en la red (alterna, como en un cristal)
        sitios.push({ x: x0 + col * P_SEP, y: yb - fila * P_SEP, y0: yb - fila * P_SEP, fila, col, orden, ocupa: i, ang: HALF_PI * ((fila + col) % 4) });
    }
    sitiosPorOrden = [...sitios].sort((a, b) => b.orden - a.orden);
    flotacion = 0;

    particulas = sitios.map((s, i) => ({
        x: s.x, y: s.y, vx: 0, vy: 0, st: 'solid', sitio: s,
        f1: random(TWO_PI), f2: random(TWO_PI), ang: s.ang, w: 0,
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

// Equilibrio dinámico: una partícula pasa del estado a al b y otra del b al a
// a la vez, así que las cantidades no cambian. Ambas se resaltan un momento.
function intercambiarEstados(a, b) {
    const tiene = (st) => particulas.some(p => p.st === st);
    if (!tiene(a) || !tiene(b)) return;
    const par = [a, b].sort().join('+');     // 'gas+liquid', 'liquid+solid', 'gas+solid'
    const ahora = millis();

    if (par === 'gas+liquid') {
        const liq = particulas.filter(p => p.st === 'liquid').reduce((m, p) => (p.y < m.y ? p : m));
        const gas = particulas.filter(p => p.st === 'gas').reduce((m, p) => (p.y > m.y ? p : m));
        liq.st = 'gas'; liq.vy = -3; liq.vx = random(-2, 2);
        gas.st = 'liquid';
        liq.flash = gas.flash = ahora;
        return;
    }
    // Con sólido: se suelta la partícula más exterior de la red y la partícula
    // libre (líquido o gas) más cercana ocupa su hueco
    const otro = par === 'liquid+solid' ? 'liquid' : 'gas';
    const cS = particulas.filter(p => p.st === 'solid').length;
    const s = sitiosPorOrden[P_N - cS];
    const sale = particulas[s.ocupa];
    let entra = null, dMin = Infinity;
    for (const p of particulas) {
        if (p.st !== otro) continue;
        const d = dist(p.x, p.y, s.x, s.y);
        if (d < dMin) { dMin = d; entra = p; }
    }
    sale.st = otro; sale.sitio = null;
    if (otro === 'gas') { sale.vy = -3; sale.vx = random(-2, 2); }
    else                { sale.vy = -0.8; sale.vx = random(-0.8, 0.8); }
    entra.st = 'solid'; entra.sitio = s; s.ocupa = particulas.indexOf(entra);
    sale.flash = entra.flash = ahora;
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
        p.vy = -0.8 * K_VEL; p.vx = random(-0.8, 0.8) * K_VEL;
        p.flash = millis();
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
        p.st = 'gas'; p.vy = -3 * K_VEL; p.vx = random(-2, 2) * K_VEL;
        p.flash = millis();
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
function updateParticles(est, ag) {
    asignarEstados(est);

    const ampSol = ag.ampSol * K_VEL, vLiq = ag.vLiq * K_VEL, vGas = ag.vGas * K_VEL;
    const t = millis() * 0.02;
    flotar();

    for (const p of particulas) {
        if (p.st === 'solid') {
            // Muelle hacia su hueco de la red + vibración
            const tx = p.sitio.x + ampSol * sin(t * 1.7 + p.f1);
            const ty = p.sitio.y + ampSol * cos(t * 1.3 + p.f2);
            p.vx = p.vx * 0.7 + (tx - p.x) * 0.12;
            p.vy = p.vy * 0.7 + (ty - p.y) * 0.12;
            const v = Math.hypot(p.vx, p.vy);
            if (v > 3 * K_VEL) { p.vx *= 3 * K_VEL / v; p.vy *= 3 * K_VEL / v; }
        } else if (p.st === 'liquid') {
            p.vy += 0.16 * K_VEL;                       // se quedan abajo
            p.vx += random(-0.25, 0.25) * K_VEL; p.vy += random(-0.25, 0.25) * K_VEL;
            termostato(p, vLiq);
        } else {
            p.vx += random(-0.05, 0.05) * K_VEL; p.vy += random(-0.05, 0.05) * K_VEL;
            termostato(p, vGas);
        }
        p.x += p.vx; p.y += p.vy;
        girar(p, ag.ampSol, ag.vLiq, ag.vGas, t);
    }

    for (let k = 0; k < 2; k++) colisiones();
    paredes();
}

// El sólido que flota (el hielo) descansa sobre su líquido: la red sube o baja
// para que su fila más baja toque la superficie del líquido, sin hueco entre ambos.
function flotar() {
    if (currentMode !== 'curva' || !sus.flota) return;
    let j0 = P_ROWS;
    for (const st of sitios) if (st.ocupa >= 0 && particulas[st.ocupa].st === 'solid') j0 = Math.min(j0, st.fila);
    if (j0 >= P_ROWS) return;
    const nL = particulas.filter(p => p.st === 'liquid').length;
    const porFila = Math.floor((LENS.w - 6) / (2 * P_R));
    const hLiq = nL / porFila * 2 * P_R * 0.9;
    const objetivo = hLiq - j0 * sepRed();
    flotacion += (objetivo - flotacion) * 0.06;
    for (const st of sitios) st.y = st.y0 - flotacion;
}

// Giro de las moléculas: en el sólido oscilan alrededor de su orientación en la
// red; en el líquido giran despacio y en el gas, más deprisa.
function girar(p, ampSol, vLiq, vGas, t) {
    if (p.st === 'solid') {
        const obj = p.sitio.ang + ampSol * 0.07 * sin(t * 1.1 + p.f1);
        p.ang += Math.atan2(Math.sin(obj - p.ang), Math.cos(obj - p.ang)) * 0.15;
        p.w = 0;
        return;
    }
    const wMax = p.st === 'liquid' ? 0.035 * vLiq : 0.03 * vGas;
    p.w = constrain(p.w * 0.98 + random(-0.012, 0.012), -wMax, wMax);
    p.ang += p.w;
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

// Estados (los usa también el diagrama de fases)
const LEYENDA = [
    { st: 'solid',  f: 'fs', titulo: 'SÓLIDO',  txt: 'Partículas muy juntas y ordenadas. Solo vibran en su sitio.' },
    { st: 'liquid', f: 'fl', titulo: 'LÍQUIDO', txt: 'Partículas juntas pero desordenadas. Se deslizan unas sobre otras.' },
    { st: 'gas',    f: 'fg', titulo: 'GAS',     txt: 'Partículas muy separadas. Se mueven libres y rápidas en todas direcciones.' },
];

// Forma de las partículas: el agua, el nitrógeno, el CO₂ y el yodo se dibujan como
// moléculas (átomos con sus colores habituales: O rojo, H blanco, N azul, C gris, I violeta);
// el resto, como esferas.
const COL_ATOMO = { O: '#e5484d', H: '#f4f6f8', N: '#5b84ff', C: '#8a929c', I: '#9b5bd6' };
function tipoMolecula() {
    if (currentMode === 'fases') return dg.molecula;
    return sus.molecula || 'esfera';
}

function dibujarParticulas() {
    const tipo = tipoMolecula();
    stroke(THEME.particleEdge); strokeWeight(THEME.fun ? 1.8 : 1.2);
    if (tipo === 'esfera') {
        strokeWeight(1.5); fill(currentMode === 'curva' && THEME.fun ? '#b9c2cc' : THEME.particle);
        if (currentMode === 'curva' && THEME.fun) { stroke(THEME.ink); strokeWeight(2); }
        for (const p of particulas) circle(p.x, p.y, P_R * 2 - 3);
        noStroke(); fill(255, 255, 255, 140);
        for (const p of particulas) circle(p.x - P_R * 0.3, p.y - P_R * 0.3, P_R * 0.55);
        return;
    }
    const R = P_R;
    for (const p of particulas) {
        push();
        translate(p.x, p.y);
        rotate(p.ang);
        if (tipo === 'h2o') {
            // H–O–H con un ángulo de unos 105°; los H, hacia abajo de la molécula
            // (se dibujan después del O para que se vean bien)
            const a = radians(52), d = R * 0.74, yO = -R * 0.2;
            fill(COL_ATOMO.O);
            circle(0, yO, R * 1.3);
            fill(COL_ATOMO.H);
            circle(-d * sin(a), yO + d * cos(a), R * 0.82);
            circle( d * sin(a), yO + d * cos(a), R * 0.82);
        } else if (tipo === 'n2') {
            fill(COL_ATOMO.N);
            circle(-R * 0.42, 0, R * 1.1);
            circle( R * 0.42, 0, R * 1.1);
        } else if (tipo === 'i2') {
            fill(COL_ATOMO.I);
            circle(-R * 0.4, 0, R * 1.15);
            circle( R * 0.4, 0, R * 1.15);
        } else if (tipo === 'co2') {
            fill(COL_ATOMO.O);
            circle(-R * 0.72, 0, R * 0.9);
            circle( R * 0.72, 0, R * 0.9);
            fill(COL_ATOMO.C);
            circle(0, 0, R * 0.95);
        }
        pop();
    }
}

function drawParticleWindow() {
    const circulo = currentMode === 'curva';
    drawingContext.save();
    if (circulo) {
        noStroke(); fill(THEME.modelBg || THEME.lensBg);
        circle(MODELO.cx, MODELO.cy, MODELO.r * 2);
        drawingContext.beginPath();
        drawingContext.arc(MODELO.cx, MODELO.cy, MODELO.r, 0, TWO_PI);
        drawingContext.clip();
    } else {
        stroke(THEME.border); strokeWeight(1); fill(THEME.lensBg);
        rect(LENS.x, LENS.y, LENS.w, LENS.h, THEME.fun ? 14 : 8);
        drawingContext.beginPath();
        drawingContext.rect(LENS.x, LENS.y, LENS.w, LENS.h);
        drawingContext.clip();
    }

    if (THEME.fun && !circulo) {
        stroke(THEME.grid); strokeWeight(1);
        for (let gx = LENS.x + 20; gx < LENS.x + LENS.w; gx += 20) line(gx, LENS.y, gx, LENS.y + LENS.h);
        for (let gy = LENS.y + 20; gy < LENS.y + LENS.h; gy += 20) line(LENS.x, gy, LENS.x + LENS.w, gy);
    }
    if (verUniones) drawUniones();

    if (verEstelas) {
        const c = color(THEME.particle); c.setAlpha(60);
        stroke(c); strokeWeight(P_R * 0.8);
        for (const p of particulas) {
            if (p.st === 'solid') continue;
            line(p.x, p.y, p.x - p.vx * 4, p.y - p.vy * 4);
        }
    }

    dibujarParticulas();

    // Contorno suave en las partículas que acaban de cambiar de estado
    noFill(); strokeWeight(1.6);
    drawingContext.setLineDash([3, 4]);
    const ahora = millis();
    for (const p of particulas) {
        const edad = ahora - (p.flash || -1e9);
        if (edad > 1400) continue;
        const c = color(THEME.text); c.setAlpha(200 * (1 - edad / 1400));
        stroke(c);
        circle(p.x, p.y, P_R * 2 + 8);
    }
    drawingContext.setLineDash([]);

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
        const meseta = m.tramo === 'fusion' || m.tramo === 'vaporizacion' || m.tramo === 'sublimacion';
        const clave = meseta ? m.tramo + m.signo : m.tramo;
        const ult = tramos[tramos.length - 1];
        if (ult && ult.clave === clave) { ult.fin = m; ult.iFin = i; }
        else tramos.push({ clave, tramo: m.tramo, signo: m.signo, ini: m, fin: m, iIni: i, iFin: i, meseta });
    });
    return tramos;
}

function colorTramo(tramo) {
    return { solido: THEME.solid, liquido: THEME.liquid, gas: THEME.gas,
             fusion: THEME.change, vaporizacion: THEME.change, sublimacion: THEME.change }[tramo];
}

function nombreMeseta(tr) {
    if (tr.tramo === 'sublimacion') {
        return i18n.t(tr.signo > 0 ? 'SUBLIMACIÓN' : tr.signo < 0 ? 'SUBLIMACIÓN INVERSA' : 'SÓLIDO + GAS');
    }
    if (tr.tramo === 'fusion') {
        return i18n.t(tr.signo > 0 ? 'FUSIÓN' : tr.signo < 0 ? 'SOLIDIFICACIÓN' : 'SÓLIDO + LÍQUIDO');
    }
    return i18n.t(tr.signo > 0 ? 'VAPORIZACIÓN' : tr.signo < 0 ? 'CONDENSACIÓN' : 'LÍQUIDO + GAS');
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
//  TAMAÑO DEL CANVAS Y ACCESIBILIDAD
// ═══════════════════════════════════════════════════════════════════

// Ajusta el canvas al hueco disponible sin deformarlo (proporción 3:2).
// En pantallas estrechas el panel va encima y el canvas ocupa todo el ancho.
function fitCanvas() {
    const cont = document.getElementById('canvas-container');
    const cv = cont.querySelector('canvas');
    if (!cv) return;
    if (currentMode === 'curva') { ajustarEscena(cv); return; }
    document.getElementById('escena').style.width = '';
    const cs = getComputedStyle(cont);
    const w = cont.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const apilado = window.matchMedia('(max-width: 1100px)').matches;
    const h = apilado ? Infinity : cont.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.max(0.1, Math.min(w / CV_W, h / CV_H));
    cv.style.width  = Math.floor(CV_W * s) + 'px';
    cv.style.height = Math.floor(CV_H * s) + 'px';
}

function windowResized() {
    if (currentMode === 'curva' && calcularEscena()) {
        resizeCanvas(CV_W, CV_H);
        LENS = LENS_CURVA;
        colocarParticulas(estado.fs === 1 ? 'solid' : estado.fl === 1 ? 'liquid' : estado.fg === 1 ? 'gas' : 'solid');
        asignarEstados(estado);
    }
    fitCanvas();
}

// Los lectores de pantalla anuncian el mensaje de la franja cuando cambia
// de estado o de cambio de estado (no en cada fotograma).
let ultimoAnuncio = '';
function anunciar(m) {
    if (m.tag === ultimoAnuncio) return;
    ultimoAnuncio = m.tag;
    document.getElementById('anuncio').textContent = `${m.tag}. ${m.txt}`;
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

    // Cada modo tiene su lienzo y su ventana de partículas
    if (mode === 'fases') {
        cerrarRetos();
        CV_W = FASES_W; CV_H = FASES_H;
        resizeCanvas(CV_W, CV_H);
        P_R = 9; K_VEL = 1; P_COLS = 16; P_ROWS = 4; P_N = P_COLS * P_ROWS;
        LENS = LENS_FASES;
        entrarFases();
    } else {
        calcularEscena();
        resizeCanvas(CV_W, CV_H);
        LENS = LENS_CURVA;
        colocarParticulas(estado.fs === 1 ? 'solid' : estado.fl === 1 ? 'liquid' : estado.fg === 1 ? 'gas' : 'solid');
        asignarEstados(estado);
    }
    fitCanvas();
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
            document.body.classList.remove('theme-light', 'theme-contrast', 'theme-marca');
            // El tema SimulaCiencia parte del claro y cambia sus colores por los de la marca.
            if (theme === 'marca') document.body.classList.add('theme-light', 'theme-marca');
            else if (theme !== 'dark') document.body.classList.add('theme-' + theme);
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
    const isMarca    = document.body.classList.contains('theme-marca');

    if (isMarca) {
        // Paleta SimulaCiencia (la de simulaciencia.es y la de los vídeos del canal).
        THEME = {
            cardBg: '#ffffff', cardEdge: '#e2e8f0', headBg: '#1e293b', headEdge: '#1e293b', headText: '#ffffff',
            pillBg: '#ffffff', modelBg: '#f1f5f9', hundido: '#e2e8f0', changeInk: '#ffffff',
            paper: '#eef4fa', paperGrid: '#d5e1ec', paperInk: '#1e293b', paperLine: '#1e293b', paperChange: '#6d28d9',
            paperSolid: '#0369a1', paperLiquid: '#0f766e', paperGas: '#c2410c', pen: '#dc2626',
            canvasBg:   '#f8fafc',
            panelBg:    '#ffffff',
            border:     '#e2e8f0',
            text:       '#1e293b',
            textDim:    '#64748b',
            accent:     '#0369a1',
            solid:      '#0369a1',
            liquid:     '#0f766e',
            gas:        '#c2410c',
            change:     '#6d28d9',
            thermoGlass:'#cbd5e1',
            thermoTube: '#ffffff',
            thermoTick: '#64748b',
            thermoFill: '#dc2626',
            jarWall:    '#475569',
            jarLid:     '#cbd5e1',
            jarShine:   'rgba(255,255,255,0.7)',
            plateBody:  '#334155',
            plateTop:   '#64748b',
            plateText:  '#f8fafc',
            heat:       '#dc2626',
            cold:       '#0284c7',
            lensBg:     '#f1f5f9',
            grid:       '#e2e8f0',
            axis:       '#64748b',
            particle:   '#334155',
            particleEdge:'#0f172a',
            bond:       'rgba(3,105,161,0.55)',
        };
    } else if (isLight) {
        // Día: azules de SimulaCiencia con el estilo del juego (piloto).
        THEME = {
            cardBg: '#e9f2fa', cardEdge: '#a9c6de', headBg: '#13304a', headEdge: '#13304a', headText: '#ffffff',
            pillBg: '#f7fbff', modelBg: '#e4eff8', hundido: '#d3e2ef', changeInk: '#ffffff',
            paper: '#d6e6f3', paperGrid: '#b9cfe2', paperInk: '#24323f', paperLine: '#13304a', paperChange: '#a5281b',
            paperSolid: '#1a5f99', paperLiquid: '#0a6b4c', paperGas: '#b4500e', pen: '#ff7a59',
            curveSolid: '#4aa8f0', curveLiquid: '#1fcf8f', curveGas: '#ff9a4a',
            canvasBg:   '#eef5fb',
            panelBg:    '#f7fbff',
            border:     '#a9c6de',
            text:       '#13304a',
            textDim:    '#3f5f7a',
            accent:     '#0369a1',
            title:      '#0b2236',
            solid:      '#1f5fbf',
            liquid:     '#0a7d58',
            gas:        '#c2410c',
            change:     '#b45309',
            thermoGlass:'#3f5f7a',
            thermoTube: '#ffffff',
            thermoTick: '#5d5280',
            thermoFill: '#e53950',
            jarWall:    '#13304a',
            jarLid:     '#bfe3f7',
            jarShine:   'rgba(255,255,255,0.8)',
            plateBody:  '#13304a',
            plateTop:   '#6f8ba3',
            plateText:  '#f7fbff',
            heat:       '#e0401e',
            cold:       '#1a72d0',
            lensBg:     '#e4eff8',
            grid:       '#d3e2ef',
            axis:       '#3f5f7a',
            particle:   '#fffaf0',
            particleEdge:'#13304a',
            bond:       'rgba(3,105,161,0.55)',
            ink:        '#13304a',
            jarInside:  '#dbe8f3',
            fun:        true,
        };
    } else if (isContrast) {
        THEME = {
            cardBg: '#000000', cardEdge: '#ffff00', headBg: '#000000', headEdge: '#ffffff', headText: '#ffffff',
            pillBg: '#000000', modelBg: '#000000', hundido: '#222222', changeInk: '#000000',
            paper: '#000000', paperGrid: '#333300', paperInk: '#ffffff', paperLine: '#ffffff', paperChange: '#ffff00',
            paperSolid: '#88aaff', paperLiquid: '#00ff88', paperGas: '#ffaa00', pen: '#ff5533',
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
        // Pizarra: azules de SimulaCiencia con el estilo del juego «Carga cero» (piloto).
        THEME = {
            cardBg: '#123a5c', cardEdge: '#2b5f88', headBg: '#0e2238', headEdge: '#9fb9cc', headText: '#ffffff',
            pillBg: '#0f2c45', modelBg: '#111e2a', hundido: '#0e2b45', changeInk: '#061523',
            paper: '#d6e6f3', paperGrid: '#b9cfe2', paperInk: '#24323f', paperLine: '#061523', paperChange: '#a5281b',
            paperSolid: '#1a5f99', paperLiquid: '#0a6b4c', paperGas: '#b4500e', pen: '#ff7a59',
            curveSolid: '#4aa8f0', curveLiquid: '#1fcf8f', curveGas: '#ff9a4a',
            canvasBg:   '#11314f',
            panelBg:    '#15395a',
            border:     '#2d6996',
            text:       '#eef7ff',
            textDim:    '#b5d3ec',
            accent:     '#00c8ff',
            title:      '#ffffff',
            solid:      '#9ec9ff',
            liquid:     '#34e3a8',
            gas:        '#ffa25a',
            change:     '#ffd84a',
            thermoGlass:'#b5d3ec',
            thermoTube: '#0b2236',
            thermoTick: '#b5d3ec',
            thermoFill: '#ff5d73',
            jarWall:    '#e6f4ff',
            jarLid:     '#2d6996',
            jarShine:   'rgba(255,255,255,0.35)',
            plateBody:  '#071a2b',
            plateTop:   '#2d6996',
            plateText:  '#eef7ff',
            heat:       '#ff7043',
            cold:       '#4aa8ff',
            lensBg:     '#0f2d49',
            grid:       '#1c4366',
            axis:       '#b5d3ec',
            particle:   '#f4fbff',
            particleEdge:'#071a2b',
            bond:       'rgba(0,200,255,0.6)',
            ink:        '#071a2b',
            jarInside:  '#0e2a44',
            fun:        true,
        };
    }
}
