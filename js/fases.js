// ═══════════════════════════════════════════════════════════════════
//  MODO DIAGRAMA DE FASES (presión y temperatura)
//
//  Diagrama esquemático para la ESO. Las curvas se calculan con
//  aproximaciones sencillas (ecuación de Antoine para la vaporización del
//  agua, tipo Clausius-Clapeyron para el resto) ajustadas a valores reales
//  conocidos: punto triple, 100 °C a 1 atm, 72 °C en el Everest, −78 °C
//  para el hielo seco… La escala de presión es logarítmica
//  ("comprimida") para que quepan valores muy pequeños y muy grandes.
// ═══════════════════════════════════════════════════════════════════

const DIAGRAMAS = {
    agua: {
        nombre: 'agua', sujeto: 'El agua', molecula: 'h2o',
        tMin: -40, tMax: 160, pMin: 0.003, pMax: 5,
        tt: 0.01,                          // temperatura del punto triple (°C)
        // Curva de vaporización con la ecuación de Antoine (P en mmHg):
        // da 0.006 atm en el punto triple, 100 °C a 1 atm y 72 °C en el Everest
        vap: { A: 8.07131, B: 1730.63, C: 233.426 },
        kSub: 6140,                        // pendiente de la curva de sublimación
        pendFus: -0.0075,                  // °C por atm de la línea de fusión
        rotuloSub: null,                   // la curva de sublimación apenas se ve: sin rótulo
        rotuloVap: 0.35,
        marcasP: [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
        rotulos: { solid: { T: -24, P: 0.6 }, liquid: { T: 48, P: 2.4 }, gas: { T: 104, P: 0.03 } },
        ejemplos: [
            { txt: 'Nivel del mar',    sub: '1 atm · 20 °C',    T: 20, P: 1 },
            { txt: 'Cima del Everest', corto: 'Everest', sub: '0,33 atm · 20 °C', T: 20, P: 0.33 },
            { txt: 'Olla a presión',   sub: '2 atm · 20 °C',    T: 20, P: 2 },
            { txt: 'Punto triple',     sub: '0,006 atm · 0 °C', triple: true },
        ],
        hint: 'A 1 atm el agua funde a 0 °C y hierve a 100 °C. ¿Y si cambia la presión?',
    },
    co2: {
        nombre: 'CO₂', sujeto: 'El CO₂', molecula: 'co2',
        tMin: -120, tMax: 30, pMin: 0.3, pMax: 100,
        tt: -56.6,
        vap: { T: -56.6, P: 5.11, k: 2000 },   // llega al punto crítico (31 °C, 73 atm)
        kSub: 3146,                            // pasa por (−78,46 °C, 1 atm): sublima a −78 °C
        pendFus: 0.02,
        rotuloSub: 0.84,
        rotuloVap: 0.62,                   // posición (0–1) del rótulo sobre la curva de sublimación
        marcasP: [0.5, 1, 2, 5, 10, 20, 50, 100],
        rotulos: { solid: { T: -98, P: 20 }, liquid: { T: -12, P: 55 }, gas: { T: -2, P: 1.6 } },
        ejemplos: [
            { txt: 'Hielo seco',      sub: '1 atm · −100 °C', T: -100, P: 1 },
            { txt: 'Aire libre',      sub: '1 atm · 20 °C',   T: 20, P: 1 },
            { txt: 'Extintor de CO₂', corto: 'Extintor', sub: '65 atm · 20 °C',  T: 20, P: 65 },
            { txt: 'Punto triple',    sub: '5,1 atm · −57 °C', triple: true },
        ],
        hint: 'A 1 atm el CO₂ nunca es líquido: el hielo seco pasa directamente a gas a −78 °C.',
    },
    yodo: {
        nombre: 'yodo', sujeto: 'El yodo', molecula: 'i2',
        tMin: 20, tMax: 220, pMin: 0.0003, pMax: 5,
        tt: 113.5,                             // punto triple: 113,5 °C y 0,12 atm
        vap: { T: 184.3, P: 1, k: 5296 },      // hierve a 184 °C a 1 atm
        kSub: 7396,                            // presión de vapor del sólido: 0,0004 atm a 25 °C
        pendFus: 0.03,
        rotuloSub: 0.55,
        rotuloVap: 0.5,
        marcasP: [0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
        rotulos: { solid: { T: 55, P: 0.6 }, liquid: { T: 150, P: 2.5 }, gas: { T: 175, P: 0.004 } },
        ejemplos: [
            { txt: 'En el laboratorio', corto: 'Laboratorio', sub: '1 atm · 80 °C',     T: 80, P: 1 },
            { txt: 'Con poca presión', corto: 'Poca presión', sub: '0,01 atm · 80 °C',  T: 80, P: 0.01 },
            { txt: 'Yodo fundido',      sub: '1 atm · 130 °C',    T: 130, P: 1 },
            { txt: 'Punto triple',      sub: '0,12 atm · 114 °C', triple: true },
        ],
        hint: 'A 1 atm el yodo funde a 114 °C y hierve a 184 °C. Por debajo de 0,12 atm pasa directamente de sólido a gas.',
    },
};

// Área del diagrama y ventana de partículas (las fija calcularFases)
let DPLOT = { x0: 100, x1: 612, y0: 108, y1: 624 };
let LENS_FASES = { x: 660, y: 100, w: 356, h: 276 };

let dg = DIAGRAMAS.agua;   // diagrama actual
let fT = 20, fP = 1;       // punto actual
let arrastrando = false;
let rastro = [];           // camino recorrido por el punto

// Las partículas cambian de estado poco a poco al cruzar una frontera
let fasesFr = { fs: 0, fl: 1, fg: 0 };
let faseAnterior = null;   // para detectar cuándo se cruza una frontera
let prevT = 20, prevP = 1;
let ultimoCambio = null;   // { de, a, causa, t }
let llegada = null;        // al llegar a una línea: { tipo, de, causa, t }
let porEjemplo = false;    // el punto se ha colocado con un botón de ejemplo


// ─── Curvas del diagrama ─────────────────────────────────────────
const K0 = 273.15;
function pVap(T, d = dg) {
    if (d.vap.A !== undefined) return Math.pow(10, d.vap.A - d.vap.B / (d.vap.C + T)) / 760;
    return d.vap.P * Math.exp(d.vap.k * (1 / (d.vap.T + K0) - 1 / (T + K0)));
}
function pTriple(d = dg) { return pVap(d.tt, d); }
function pSub(T, d = dg) { return pTriple(d) * Math.exp(d.kSub * (1 / (d.tt + K0) - 1 / (T + K0))); }
function tFus(P, d = dg) { return d.tt + d.pendFus * (P - pTriple(d)); }

// Inversas: temperatura de ebullición / sublimación a una presión dada
function tVap(P, d = dg) {
    if (d.vap.A !== undefined) return d.vap.B / (d.vap.A - Math.log10(P * 760)) - d.vap.C;
    return 1 / (1 / (d.vap.T + K0) - Math.log(P / d.vap.P) / d.vap.k) - K0;
}
function tSub(P, d = dg) { return 1 / (1 / (d.tt + K0) - Math.log(P / pTriple(d)) / d.kSub) - K0; }

function faseEn(T, P, d = dg) {
    const pBorde = T < d.tt ? pSub(T, d) : pVap(T, d);
    if (P <= pBorde) return 'gas';
    return T < tFus(P, d) ? 'solid' : 'liquid';
}

// ─── Coordenadas ─────────────────────────────────────────────────
function dx(T) { return map(T, dg.tMin, dg.tMax, DPLOT.x0, DPLOT.x1); }
function dy(P) { return map(Math.log(P), Math.log(dg.pMin), Math.log(dg.pMax), DPLOT.y1, DPLOT.y0); }
function dyc(P) { return constrain(dy(P), DPLOT.y0, DPLOT.y1); }
function tDeX(x) { return map(x, DPLOT.x0, DPLOT.x1, dg.tMin, dg.tMax); }
function pDeY(y) { return Math.exp(map(y, DPLOT.y1, DPLOT.y0, Math.log(dg.pMin), Math.log(dg.pMax))); }

// ─── Coexistencia: punto triple y líneas ─────────────────────────
// Una línea del diagrama es justo donde conviven dos estados, y el punto
// triple, donde conviven los tres. Como son líneas y puntos (sin grosor),
// se considera que el punto está sobre ellos si queda a pocos píxeles.
const TRIPLE_PX = 12;
const LINEA_PX  = 5;

// Distancia (px) del punto (T, P) a cada frontera, solo en su tramo válido.
function distanciasFronteras(T, P) {
    const pt = pTriple();
    const d = { fusion: Infinity, vaporizacion: Infinity, sublimacion: Infinity };
    if (P >= pt) d.fusion = abs(dx(T) - dx(tFus(P)));
    if (T >= dg.tt && P >= pt) d.vaporizacion = min(abs(dy(P) - dy(pVap(T))), abs(dx(T) - dx(tVap(P))));
    if (T <= dg.tt && P <= pt) d.sublimacion = min(abs(dy(P) - dy(pSub(T))), abs(dx(T) - dx(tSub(P))));
    return d;
}

const FASES_LINEA = {
    fusion:       ['solid', 'liquid'],
    vaporizacion: ['liquid', 'gas'],
    sublimacion:  ['solid', 'gas'],
};

// Devuelve qué estados hay en el punto: { tipo, fases }.
// tipo: 'triple', 'fusion', 'vaporizacion', 'sublimacion' o null (un solo estado).
function situacion(T = fT, P = fP) {
    if (dist(dx(T), dy(P), dx(dg.tt), dy(pTriple())) < TRIPLE_PX) {
        return { tipo: 'triple', fases: ['solid', 'liquid', 'gas'] };
    }
    const d = distanciasFronteras(T, P);
    const linea = Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
    if (d[linea] < LINEA_PX) return { tipo: linea, fases: FASES_LINEA[linea] };
    return { tipo: null, fases: [faseEn(T, P)] };
}

// Fracciones objetivo: a partes iguales entre los estados que conviven.
function fraccionesObjetivo(sit) {
    const n = sit.fases.length;
    return {
        fs: sit.fases.includes('solid')  ? 1 / n : 0,
        fl: sit.fases.includes('liquid') ? 1 / n : 0,
        fg: sit.fases.includes('gas')    ? 1 / n : 0,
    };
}


// ═══════════════════════════════════════════════════════════════════
//  CONTROLES
// ═══════════════════════════════════════════════════════════════════
function setupFasesControls() {
    document.querySelectorAll('[data-fsus]').forEach(b =>
        b.addEventListener('click', () => cambiarDiagrama(b.dataset.fsus)));

    const slT = document.getElementById('slider-fases-T');
    const slP = document.getElementById('slider-fases-P');
    slT.addEventListener('input', () => { fijarPunto(parseFloat(slT.value), fP, false); marcarEjemplo(-1); });
    slP.addEventListener('input', () => { fijarPunto(fT, presionDeSlider(slP.value), false); marcarEjemplo(-1); });

    // «Cómo leer el diagrama»
    iniciarPopover('btn-leer', 'panel-leer');

    cambiarDiagrama('agua');
}

function claveDiagrama() { return Object.keys(DIAGRAMAS).find(k => DIAGRAMAS[k] === dg); }

function cambiarDiagrama(clave) {
    dg = DIAGRAMAS[clave];
    document.querySelectorAll('[data-fsus]').forEach(b => {
        const on = b.dataset.fsus === clave;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', String(on));
    });
    document.getElementById('fases-hint').textContent = i18n.t(dg.hint);

    const slT = document.getElementById('slider-fases-T');
    slT.min = dg.tMin; slT.max = dg.tMax;
    document.getElementById('min-fases-T').textContent = fmtT(dg.tMin) + ' °C';
    document.getElementById('max-fases-T').textContent = fmtT(dg.tMax) + ' °C';
    document.getElementById('min-fases-P').textContent = fmtP(dg.pMin) + ' atm';
    document.getElementById('max-fases-P').textContent = fmtP(dg.pMax) + ' atm';
    // Marca de 1 atm en la pista de la presión (el tirador mide 22 px)
    const f1 = (Math.log(1) - Math.log(dg.pMin)) / (Math.log(dg.pMax) - Math.log(dg.pMin));
    document.getElementById('marca-1atm').style.left = `calc(${f1 * 100}% + ${11 - 22 * f1}px)`;

    const caja = document.getElementById('fases-ejemplos');
    caja.innerHTML = '';
    dg.ejemplos.forEach((ej, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'boton-ej';
        const pTxt = i18n.t(ej.sub).split(' · ')[0];
        b.innerHTML = `<span></span><small>${pTxt}</small>`;
        b.querySelector('span').textContent = i18n.t(ej.corto || ej.txt);
        b.title = i18n.t(ej.txt) + ' · ' + i18n.t(ej.sub);
        b.setAttribute('aria-label', b.title);
        b.addEventListener('click', () => aplicarEjemplo(i));
        caja.appendChild(b);
    });

    rastro = [];
    aplicarEjemplo(0);
    if (currentMode === 'fases') colocarParticulas(situacion().fases[0]);
    if (typeof pintarRetos === 'function') pintarRetos();
}

function aplicarEjemplo(i) {
    const ej = dg.ejemplos[i];
    if (ej.triple) fijarPunto(dg.tt, pTriple(), true);
    else fijarPunto(ej.T, ej.P, true);
    porEjemplo = true;
    marcarEjemplo(i);
}

function marcarEjemplo(i) {
    document.querySelectorAll('#fases-ejemplos .boton-ej')
        .forEach((b, k) => b.classList.toggle('active', k === i));
}

// Fija el punto del diagrama. "salto" indica que no viene de un movimiento continuo.
function fijarPunto(T, P, salto) {
    fT = constrain(T, dg.tMin, dg.tMax);
    fP = constrain(P, dg.pMin, dg.pMax);
    if (salto) {
        // Un ejemplo o un cambio de sustancia no es "cruzar una línea"
        rastro = [];
        faseAnterior = faseEn(fT, fP);
        ultimoCambio = null;
        llegada = null;
        tipoAnterior = situacion(fT, fP).tipo;
        prevT = fT; prevP = fP;
    } else porEjemplo = false;

    const slT = document.getElementById('slider-fases-T');
    const slP = document.getElementById('slider-fases-P');
    slT.value = Math.round(fT);
    slP.value = Math.round(1000 * (Math.log(fP) - Math.log(dg.pMin)) / (Math.log(dg.pMax) - Math.log(dg.pMin)));
    setFill(slT); setFill(slP);
    updateFasesUI();
}

function presionDeSlider(v) {
    return Math.exp(lerp(Math.log(dg.pMin), Math.log(dg.pMax), v / 1000));
}

function setFill(sl) {
    const pct = 100 * (sl.value - sl.min) / (sl.max - sl.min);
    sl.style.setProperty('--fill', pct + '%');
}

function updateFasesUI() {
    document.getElementById('val-fases-T').textContent = fmtT(fT) + ' °C';
    document.getElementById('val-fases-P').textContent = fmtP(fP) + ' atm';
}

// Explicación de qué cambios de estado ocurren a la presión actual.
function textoAEstaPresion() {
    const pt = pTriple();
    const P = fmtP(fP) + ' atm';
    if (situacion().tipo === 'triple') {
        return i18n.t('A {P} estás en el <strong>punto triple</strong>: a {T} °C pueden existir a la vez sólido, líquido y gas.', { P, T: fmtT(dg.tt) });
    }
    if (fP < pt) {
        return i18n.t('A {P} <strong>no puede ser líquida</strong>: al calentarla pasa directamente de sólido a gas ' +
                      '(sublimación) a <strong>{T} °C</strong>.', { P, T: fmtT(tSub(fP)) });
    }
    const teb = tVap(fP);
    const hierve = teb > dg.tMax ? i18n.t('por encima de <strong>{T} °C</strong>', { T: fmtT(dg.tMax) })
                                 : i18n.t('a <strong>{T} °C</strong>', { T: fmtT(teb) });
    return i18n.t('A {P} funde a <strong>{T} °C</strong> y hierve {hierve}.', { P, T: fmtT(tFus(fP)), hierve });
}

function fmtP(P) {
    // Con coma decimal, como se escribe en clase (punto en inglés)
    if (P < 0.001) return i18n.num(P, 4);
    if (P < 0.1)  return i18n.num(P, 3);
    if (P < 10)   return i18n.num(P, 2);
    return P.toFixed(0);
}


// ═══════════════════════════════════════════════════════════════════
//  PARTÍCULAS Y CAMBIOS DE ESTADO EN EL DIAGRAMA
// ═══════════════════════════════════════════════════════════════════
const NOMBRE_CAMBIO = {
    'solid>liquid': 'FUSIÓN',
    'liquid>solid': 'SOLIDIFICACIÓN',
    'liquid>gas':   'VAPORIZACIÓN',
    'gas>liquid':   'CONDENSACIÓN',
    'solid>gas':    'SUBLIMACIÓN',
    'gas>solid':    'SUBLIMACIÓN INVERSA',
};
const NOMBRE_ESTADO = { solid: 'sólido', liquid: 'líquido', gas: 'gas' };

function entrarFases() {
    const sit = situacion();
    fasesFr = fraccionesObjetivo(sit);
    faseAnterior = faseEn(fT, fP);
    ultimoCambio = null;
    llegada = null;
    tipoAnterior = sit.tipo;
    colocarParticulas(sit.fases[0]);
}

// Causa de un movimiento del punto: lo que más ha cambiado (en proporción)
function causaMovimiento() {
    const dT = abs(fT - prevT) / (dg.tMax - dg.tMin);
    const dP = abs(Math.log(fP / prevP)) / Math.log(dg.pMax / dg.pMin);
    return dT >= dP ? (fT > prevT ? 'calentar' : 'enfriar') : (fP > prevP ? 'comprimir' : 'descomprimir');
}

// Dónde se cruzó la frontera entre dos posiciones (bisección en T y log P)
function puntoCruce(T0, P0, T1, P1, f0) {
    let a = 0, b = 1;
    const en = (u) => [lerp(T0, T1, u), Math.exp(lerp(Math.log(P0), Math.log(P1), u))];
    for (let i = 0; i < 24; i++) {
        const m = (a + b) / 2, [T, P] = en(m);
        if (faseEn(T, P) === f0) a = m; else b = m;
    }
    return en(b);
}

// Detecta si el punto ha cruzado una frontera y si ha sido por la temperatura o
// por la presión. Al llegar a una línea se anota la llegada (es el momento que
// se celebra); el cambio se anuncia al salir al otro lado (y no se anuncia si
// vuelve al mismo estado).
let tipoAnterior = null;
function detectarCambio() {
    const sit = situacion();
    if (sit.tipo) {
        if (sit.tipo !== tipoAnterior && (fT !== prevT || fP !== prevP)) {
            llegada = { tipo: sit.tipo, de: faseAnterior, causa: causaMovimiento(), t: millis(), T: fT, P: fP };
            if (typeof retosFasesEvento === 'function') retosFasesEvento('llegada', llegada);
        }
        tipoAnterior = sit.tipo;
        return;
    }
    tipoAnterior = null;
    const f = faseEn(fT, fP);
    if (faseAnterior && f !== faseAnterior) {
        const [cT, cP] = puntoCruce(prevT, prevP, fT, fP, faseAnterior);
        ultimoCambio = { de: faseAnterior, a: f, t: millis(), T: cT, P: cP, causa: llegada && llegada.de === faseAnterior ? llegada.causa : causaMovimiento() };
        if (typeof retosFasesEvento === 'function') retosFasesEvento('cambio', ultimoCambio);
    }
    llegada = null;
    faseAnterior = f;
    prevT = fT; prevP = fP;
}

// Las fracciones avanzan a ritmo constante hacia el estado (o estados) del punto.
// Devuelve true cuando ya han llegado.
function avanzarFracciones(sit) {
    const obj = fraccionesObjetivo(sit);
    const dif = max(abs(obj.fs - fasesFr.fs), abs(obj.fl - fasesFr.fl), abs(obj.fg - fasesFr.fg));
    if (dif === 0) return true;
    const k = min(1, 0.018 / dif);
    for (const c of ['fs', 'fl', 'fg']) fasesFr[c] = lerp(fasesFr[c], obj[c], k);
    return false;
}

// Equilibrio dinámico: cada cierto tiempo dos partículas intercambian su estado
// entre dos de los estados que conviven. La sublimación, más rara, sale menos.
let ultimoIntercambio = 0;
function equilibrioDinamico(sit) {
    if (!sit.tipo || millis() - ultimoIntercambio < 650) return;
    ultimoIntercambio = millis();
    let par = sit.fases;
    if (sit.tipo === 'triple') {
        par = random() < 0.2 ? ['solid', 'gas'] : random([['solid', 'liquid'], ['liquid', 'gas']]);
    }
    intercambiarEstados(par[0], par[1]);
}

function agitacionFases() {
    const pt = pTriple();
    const tF = fP > pt ? tFus(fP) : tSub(fP);
    let tE = fP > pt ? min(tVap(fP), dg.tMax - 1) : tSub(fP);
    if (tE <= tF + 1) tE = tF + 1;            // sin líquido posible (sublimación)
    return agitacion(fT, dg.tMin, tF, tE, dg.tMax);
}

function textoPlano(html) { return html.replace(/<[^>]+>/g, ''); }

const TXT_COEXISTENCIA = {
    triple: (T, P) => i18n.t('A {T} y {P} conviven sólido, líquido y gas. Las partículas pasan continuamente de un estado a otro, pero las cantidades no cambian: es un equilibrio dinámico.', { T, P }),
    fusion: (T, P) => i18n.t('Estás sobre la línea de fusión: a {T} y {P} el sólido y el líquido conviven. Unas partículas se sueltan de la red y otras se ordenan, al mismo ritmo.', { T, P }),
    vaporizacion: (T, P) => i18n.t('Estás sobre la línea de vaporización: a {T} y {P} el líquido y el gas conviven. Unas partículas escapan del líquido y otras vuelven a él, al mismo ritmo.', { T, P }),
    sublimacion: (T, P) => i18n.t('Estás sobre la línea de sublimación: a {T} y {P} el sólido y el gas conviven. Unas partículas escapan del sólido y otras se depositan en él, al mismo ritmo.', { T, P }),
};

function mensajeFases() {
    const f = faseEn(fT, fP);
    const P = fmtP(fP) + ' atm';
    const sit = situacion();
    if (sit.tipo) {
        const tag = sit.tipo === 'triple' ? i18n.t('PUNTO TRIPLE')
                  : sit.fases.map(s => i18n.t(NOMBRE_ESTADO[s]).toUpperCase()).join(' + ');
        if (sit.tipo === 'vaporizacion' && llegada && llegada.de === 'liquid' && llegada.causa === 'descomprimir') {
            return { tag, col: THEME.change, txt: i18n.t('¡Al bajar la presión, el líquido hierve sin calentarlo! A {P} hierve a solo {T} °C.', { P, T: fmtT(fT) }) };
        }
        return { tag, col: THEME.change, txt: TXT_COEXISTENCIA[sit.tipo](fmtT(fT) + ' °C', P) };
    }
    if (ultimoCambio && millis() - ultimoCambio.t < 8000) {
        const { de, a, causa } = ultimoCambio;
        const clave = de + '>' + a;
        let txt;
        switch (clave) {
            case 'liquid>gas':
                txt = causa === 'descomprimir'
                    ? i18n.t('¡Al bajar la presión, el líquido hierve sin calentarlo! A {P} hierve a solo {T} °C.', { P, T: fmtT(tVap(fP)) })
                    : i18n.t('Al calentar, el líquido llega a su temperatura de ebullición, que a {P} es {T} °C. Sus partículas se separan del todo.', { P, T: fmtT(tVap(fP)) });
                break;
            case 'gas>liquid':
                txt = causa === 'comprimir'
                    ? i18n.t('Al comprimir el gas, sus partículas se juntan tanto que se convierte en líquido.')
                    : i18n.t('Al enfriar, las partículas del gas pierden energía, se juntan y forman un líquido.');
                break;
            case 'solid>liquid':
                txt = i18n.t('Las partículas abandonan su red ordenada: el sólido se funde a {T} °C.', { T: fmtT(tFus(fP)) });
                break;
            case 'liquid>solid':
                txt = i18n.t('Las partículas pierden energía y se ordenan en una red: el líquido se solidifica a {T} °C.', { T: fmtT(tFus(fP)) });
                break;
            case 'solid>gas':
                txt = i18n.t('A {P} no puede existir el líquido: el sólido pasa directamente a gas (como el hielo seco).', { P: fmtP(ultimoCambio.P) + ' atm' });
                break;
            case 'gas>solid':
                txt = i18n.t('El gas pasa directamente a sólido sin ser líquido (así se forma la escarcha).');
                break;
        }
        return { tag: i18n.t(NOMBRE_CAMBIO[clave]), col: THEME.change, txt };
    }
    const sust = i18n.t(dg.sujeto);
    return {
        tag: i18n.t(NOMBRE_ESTADO[f]).toUpperCase(), col: THEME[f],
        txt: i18n.t('{sust} está en estado {estado}. Mueve el punto del diagrama hasta cruzar una línea.',
                    { sust, estado: i18n.t(NOMBRE_ESTADO[f]) }),
    };
}

const RETOS_TXT = {
    agua: [
        '¿A qué temperatura hierve el agua en la cima del Everest? Pulsa el ejemplo y sube la temperatura.',
        '¿Por qué en una olla a presión los alimentos se cocinan antes?',
        '¿Puedes hacer que el agua hierva sin calentarla?',
    ],
    yodo: [
        'Al calentar yodo en un tubo abierto salen vapores violetas sin que se vea líquido. ¿Por qué, si a 1 atm funde?',
        '¿Por debajo de qué presión sublima el yodo sin fundirse?',
        '¿Qué temperatura hace falta para tener yodo líquido a 1 atm?',
    ],
    co2: [
        '¿Por qué el hielo seco no deja charco cuando «se derrite»?',
        '¿Qué hace falta para tener CO₂ líquido, como en un extintor?',
        '¿Qué estados conviven en el punto triple?',
    ],
};

// ═══════════════════════════════════════════════════════════════════
//  INTERACCIÓN: arrastrar el punto
// ═══════════════════════════════════════════════════════════════════
function dentroDiagrama(x, y) {
    return x >= DPLOT.x0 - 10 && x <= DPLOT.x1 + 10 && y >= DPLOT.y0 - 10 && y <= DPLOT.y1 + 10;
}

function fasesPressed() {
    if (!dentroDiagrama(mouseX, mouseY)) return;
    arrastrando = true;
    moverPuntoAlRaton();
}

function fasesDragged() {
    if (arrastrando) moverPuntoAlRaton();
}

// Al arrastrar, el punto se "pega" al punto triple y a las líneas cuando pasa
// cerca, para que sea fácil situarse justo donde conviven los estados.
function moverPuntoAlRaton() {
    let T = tDeX(mouseX), P = pDeY(mouseY);
    const sit = situacion(T, P);
    if (sit.tipo === 'triple') {
        T = dg.tt; P = pTriple();
    } else if (sit.tipo === 'fusion') {
        T = tFus(P);
    } else if (sit.tipo === 'vaporizacion' || sit.tipo === 'sublimacion') {
        const pCurva = sit.tipo === 'vaporizacion' ? pVap(T) : pSub(T);
        const tCurva = sit.tipo === 'vaporizacion' ? tVap(P) : tSub(P);
        // Se ajusta la coordenada que menos hay que mover
        if (abs(dy(P) - dy(pCurva)) <= abs(dx(T) - dx(tCurva))) P = pCurva;
        else T = tCurva;
    }
    fijarPunto(T, P, false);
    marcarEjemplo(-1);
}


// ─── Utilidades de dibujo ────────────────────────────────────────
function poligono(pts) {
    beginShape();
    for (const [x, y] of pts) vertex(x, y);
    endShape(CLOSE);
}

function polilinea(pts) {
    beginShape();
    for (const [x, y] of pts) vertex(x, y);
    endShape();
}

function conAlfa(c, a) {
    const col = color(c);
    col.setAlpha(a);
    return col;
}
