// ═══════════════════════════════════════════════════════════════════
//  ESCENA DEL MODO «CALENTAR Y ENFRIAR»
//
//  Una sola escena: el vaso sobre la placa con el termómetro metido en la
//  sustancia, el modelo de partículas (un círculo que amplía lo que pasa
//  dentro del vaso), el panel de estado y la gráfica en una tira abajo.
//  Hay dos composiciones: portátil/pizarra (apaisada) y móvil (vertical).
//  Los mandos de la placa son botones HTML colocados encima del lienzo,
//  en la posición que marca MANDOS (en unidades del lienzo).
// ═══════════════════════════════════════════════════════════════════

let ESC_MOVIL = null;       // composición activa: false (apaisada) · true (móvil)
let MODELO, PANEL, MANDOS, TARJETAS;
let PUNTO = { x: 0, y: 0 }; // punto del vaso que amplía el modelo

const ANCHO_MOVIL = 760;    // por debajo, composición vertical

// Fija el tamaño del lienzo y la posición de cada elemento. Devuelve true si
// ha cambiado de composición (hay que redimensionar el lienzo).
function calcularEscena() {
    const movil = window.matchMedia(`(max-width: ${ANCHO_MOVIL}px)`).matches;
    const cambia = movil !== ESC_MOVIL;
    ESC_MOVIL = movil;
    if (!movil) {
        // Retícula de tres columnas iguales de 400 (márgenes y calles de 40):
        // vaso 22–422 · modelo 462–862 · panel 902–1302
        CV_W = 1330; CV_H = 680;
        TARJETAS = [{ x: 0, y: 0, w: 1330, h: 540 }];
        JAR    = { x: 62, y: 156, w: 250, h: 214 };
        PLATE  = { x: 44, y: 378, w: 286, h: 26 };
        TH     = { x: 284, top: 54, bottom: 340, tubo: 14, bulbo: 16, lectura: 40 };
        LIQ_MAX_H = 112;
        MANDOS = { x: 40, y: 428, w: 330 };
        MODELO = { cx: 662, cy: 240, r: 182, rotulo: 17 };
        PANEL  = { x: 902, y: 30, w: 400, h: 480, compacto: false };
        GRAPH  = { x: 0, y: 552, w: 1330, h: 128 };
        PLOT   = { x0: 70, x1: 1330 - 190, y0: 552 + 16, y1: 552 + 128 - 28 };
    } else {
        CV_W = 370; CV_H = 1176;
        TARJETAS = [{ x: 0, y: 0, w: 370, h: 334 }, { x: 0, y: 712, w: 370, h: 300 }];
        JAR    = { x: 30, y: 120, w: 206, h: 170 };
        PLATE  = { x: 16, y: 296, w: 234, h: 22 };
        TH     = { x: 214, top: 34, bottom: 268, tubo: 12, bulbo: 13, lectura: 30 };
        LIQ_MAX_H = 90;
        MANDOS = { x: 0, y: 346, w: 370 };
        PANEL  = { x: 0, y: 444, w: 370, h: 256, compacto: true };
        MODELO = { cx: 185, cy: 846, r: 122, rotulo: 15 };
        GRAPH  = { x: 0, y: 1024, w: 370, h: 152 };
        PLOT   = { x0: 52, x1: 370 - 18, y0: 1024 + 16, y1: 1024 + 152 - 30 };
    }
    // Las partículas se mueven en un cuadrado que rodea el círculo del modelo:
    // el círculo es una ventana sobre la sustancia (sus esquinas no se ven).
    LENS_CURVA = { x: MODELO.cx - MODELO.r, y: MODELO.cy - MODELO.r, w: 2 * MODELO.r, h: 2 * MODELO.r };
    if (currentMode === 'curva') {
        LENS = LENS_CURVA;
        P_R = MODELO.r / 11;
        K_VEL = P_R / 9;
        P_COLS = 10; P_ROWS = 5; P_N = P_COLS * P_ROWS;
    }
    colocarMandos();
    return cambia;
}

function colocarMandos() {
    const m = document.querySelector('.mandos-placa');
    if (!m) return;
    m.style.left  = (100 * MANDOS.x / CV_W) + '%';
    m.style.top   = (100 * MANDOS.y / CV_H) + '%';
    m.style.width = (100 * MANDOS.w / CV_W) + '%';
}

// Escala la escena para que quepa entera (apaisada) o a lo ancho (móvil).
function ajustarEscena(cv) {
    const esc = document.getElementById('escena');
    const main = esc.parentElement;
    const cs = getComputedStyle(main);
    const w = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let s = w / CV_W;
    if (!ESC_MOVIL) {
        const top = esc.getBoundingClientRect().top + window.scrollY;
        const h = window.innerHeight - top - 40;
        s = Math.min(s, h / CV_H);
    }
    s = Math.max(0.2, s);
    esc.style.width = Math.floor(CV_W * s) + 'px';
    esc.style.setProperty('--u', s + 'px');
    cv.style.width = '100%';
    cv.style.height = 'auto';
}

function setupEscenaControles() {
    // Botones «?» (ayuda) y cierre de paneles
    const ayuda = document.getElementById('panel-ayuda');
    const bAyuda = document.getElementById('btn-ayuda');
    bAyuda.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = ayuda.hidden;
        ayuda.hidden = !abrir;
        bAyuda.setAttribute('aria-expanded', String(abrir));
        bAyuda.classList.toggle('active', abrir);
    });
    document.addEventListener('click', (e) => {
        if (!ayuda.hidden && !ayuda.contains(e.target) && e.target !== bAyuda) {
            ayuda.hidden = true; bAyuda.setAttribute('aria-expanded', 'false'); bAyuda.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!ayuda.hidden) { ayuda.hidden = true; bAyuda.setAttribute('aria-expanded', 'false'); bAyuda.classList.remove('active'); bAyuda.focus(); }
    });
    document.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.cerrar;
        if (id === 'panel-retos') cerrarRetos();
        else if (id === 'album') cerrarAlbum();
        else { document.getElementById(id).hidden = true; bAyuda.setAttribute('aria-expanded', 'false'); bAyuda.classList.remove('active'); }
    }));
    window.addEventListener('load', () => fitCanvas());
    if (document.fonts) document.fonts.ready.then(() => fitCanvas());
    new ResizeObserver(() => fitCanvas()).observe(document.querySelector('.barra-sus'));
}

// ── Dibujo de la escena ──────────────────────────────────────────
function drawEscena() {
    for (const t of TARJETAS) tarjeta(t);
    drawRecipiente();
    if (!ESC_MOVIL) drawCono();
    drawParticleWindow();
    drawMarcoModelo();
    drawPanelEstado(mensajeDidactico());
    drawGrafica();
}

function tarjeta(t) {
    if (THEME.fun) { noStroke(); fill(THEME.ink); rect(t.x, t.y + 5, t.w, t.h, 24); }
    stroke(THEME.cardEdge || THEME.border); strokeWeight(1.5); fill(THEME.cardBg || THEME.panelBg);
    rect(t.x + 1, t.y + 1, t.w - 2, t.h - 2, 24);
}

function drawRecipiente() {
    if (THEME.fun) { noStroke(); fill(THEME.jarInside); rect(JAR.x, JAR.y, JAR.w, JAR.h, 0, 0, 10, 10); }
    const fondo = JAR.y + JAR.h;
    const hLiq  = LIQ_MAX_H * estado.fl;
    const ySup  = fondo - hLiq;
    drawGas(ySup);
    drawLiquid(ySup, hLiq);
    const solido = drawSolid(ySup, hLiq);
    drawBubbles(ySup, hLiq);
    drawDroplets(ySup);
    drawJarGlass();
    drawPlate();
    drawTermometro(estado.T);
    PUNTO = puntoAmpliado(ySup, hLiq, solido);
    if (!ESC_MOVIL) {
        noFill(); stroke(THEME.ink || '#000'); strokeWeight(6); circle(PUNTO.x, PUNTO.y, 22);
        stroke(THEME.accent); strokeWeight(3); circle(PUNTO.x, PUNTO.y, 22);
    }
}

// Dónde mira el modelo: el borde del sólido (donde toca al líquido), la
// superficie del líquido o el gas.
function puntoAmpliado(ySup, hLiq, sol) {
    const cx = JAR.x + JAR.w / 2;
    if (sol) {
        if (hLiq > 2) return sus.flota ? { x: cx, y: sol.base } : { x: cx, y: sol.techo };
        return { x: cx, y: (sol.base + sol.techo) / 2 };
    }
    if (hLiq > 2) return { x: cx, y: ySup + min(18, hLiq / 2) };
    return { x: cx, y: JAR.y + JAR.h / 2 };
}

// Cono suave que une el punto del vaso con el círculo del modelo
function drawCono() {
    const { cx, cy, r } = MODELO;
    const dx = PUNTO.x - cx, dy = PUNTO.y - cy, d = Math.hypot(dx, dy);
    if (d <= r) return;
    const th = Math.atan2(dy, dx), a = Math.acos(r / d);
    const c = color(THEME.accent); c.setAlpha(28);
    noStroke(); fill(c);
    triangle(PUNTO.x, PUNTO.y, cx + r * cos(th + a), cy + r * sin(th + a), cx + r * cos(th - a), cy + r * sin(th - a));
}

function drawMarcoModelo() {
    const { cx, cy, r } = MODELO;
    noFill();
    if (THEME.fun) { stroke(THEME.ink); strokeWeight(10); circle(cx, cy, 2 * r); }
    stroke(THEME.accent); strokeWeight(4);
    drawingContext.setLineDash([14, 8]);
    circle(cx, cy, 2 * r);
    drawingContext.setLineDash([]);

    const hierro = sus === SUSTANCIAS.hierro;
    const txt = ESC_MOVIL
        ? i18n.t(hierro ? 'Modelo de átomos' : 'Modelo de moléculas')
        : i18n.t(hierro ? 'Modelo: así imaginamos los átomos de hierro' : 'Modelo: así imaginamos las moléculas');
    const fs = MODELO.rotulo;
    textSize(fs); textStyle(BOLD);
    const w = min(2 * r + 48, textWidth(txt) + 56), h = fs * 2.1;
    const y = cy + r - h * 0.45;
    stroke(THEME.accent); strokeWeight(2.5); fill(THEME.pillBg || THEME.panelBg);
    rect(cx - w / 2, y, w, h, h / 2);
    noStroke(); fill(THEME.text); textAlign(CENTER, CENTER);
    text(txt, cx, y + h / 2 + 1);
    textStyle(NORMAL);
}

// ── Termómetro metido en la sustancia, con su lectura en la cabeza ──
function drawTermometro(T) {
    const { x, top, bottom, tubo, bulbo } = TH;
    const yOf = (t) => map(t, sus.tMin, sus.tMax, bottom - 6, top + 10);

    stroke(THEME.fun ? THEME.ink : THEME.thermoGlass); strokeWeight(THEME.fun ? 3 : 2); fill(THEME.thermoTube);
    rect(x - tubo / 2, top, tubo, bottom - top, tubo / 2);
    circle(x, bottom + bulbo - 4, bulbo * 2);
    const yT = yOf(T);
    noStroke(); fill(THEME.thermoFill);
    rect(x - 3.5, yT, 7, bottom - yT + 4, 3);
    circle(x, bottom + bulbo - 4, bulbo * 2 - 9);
    if (THEME.fun) { fill(255, 255, 255, 150); rect(x - tubo / 2 + 2.5, top + 8, 2.5, bottom - top - 18, 2); }

    // Marcas de los cambios de estado: ebullición a la izquierda, fusión a la derecha
    const fs = ESC_MOVIL ? 12.5 : 15;
    textSize(fs); textStyle(BOLD);
    const marca = (t, etiqueta, col, izq) => {
        const y = yOf(t);
        stroke(col); strokeWeight(2);
        if (izq) line(x - tubo / 2 - 10, y, x - tubo / 2 - 1, y);
        else     line(x + tubo / 2 + 1, y, x + tubo / 2 + 10, y);
        noStroke(); fill(col); textAlign(izq ? RIGHT : LEFT, CENTER);
        text(`${etiqueta} ${fmtT(t)} °C`, izq ? x - tubo / 2 - 14 : x + tubo / 2 + 14, y);
    };
    if (sus.sublima) marca(sus.tf, i18n.t('sublimación'), THEME.change, false);
    else {
        marca(sus.tf, i18n.t('fusión'), THEME.solid, false);
        marca(sus.teb, i18n.t('ebullición'), THEME.gas, true);
    }
    textStyle(NORMAL);

    // Lectura digital: la cabeza del termómetro (sin marco llamativo)
    const L = TH.lectura;
    textSize(L); textStyle(BOLD);
    const txt = fmtT(T) + ' °C';
    const hw = textWidth(txt) + L * 0.8, hh = L * 1.45;
    const hx = x + tubo / 2 - 2, hy = top - 6;
    stroke(THEME.headEdge || THEME.border); strokeWeight(2); fill(THEME.headBg || THEME.panelBg);
    rect(hx, hy, hw, hh, 0, 12, 12, 12);
    noStroke(); fill(THEME.headText || THEME.text); textAlign(LEFT, CENTER);
    text(txt, hx + L * 0.4, hy + hh / 2 + 2);
    textStyle(NORMAL);

    const meseta = ['fusion', 'vaporizacion', 'sublimacion'].includes(estado.tramo);
    if (meseta && potencia !== 0) {
        const et = i18n.t('temperatura constante');
        const f2 = ESC_MOVIL ? 13 : 16;
        textSize(f2); textStyle(BOLD);
        const pw = textWidth(et) + 26, ph = f2 * 1.9, py = hy + hh + 8;
        const px = Math.min(hx, CV_W - 8 - pw);
        noStroke(); fill(THEME.change);
        rect(px, py, pw, ph, ph / 2);
        fill(THEME.changeInk || '#061523'); textAlign(CENTER, CENTER);
        text(et, px + pw / 2, py + ph / 2 + 1);
        textStyle(NORMAL);
    }
}

// ── Panel de estado: rótulo del tramo, mensaje y reparto S/L/G ──────
const FILAS_ESTADO = [
    { st: 'solid',  f: 'fs', nombre: 'Sólido',  txt: 'Partículas muy juntas y ordenadas. Solo vibran en su sitio.' },
    { st: 'liquid', f: 'fl', nombre: 'Líquido', txt: 'Partículas juntas pero desordenadas. Se deslizan unas sobre otras.' },
    { st: 'gas',    f: 'fg', nombre: 'Gas',     txt: 'Partículas muy separadas. Se mueven libres y rápidas en todas direcciones.' },
];

let rotuloTag = '', rotuloDesde = -1e9;
function drawPanelEstado(m) {
    const { x, y, w, h, compacto } = PANEL;
    const pad = compacto ? 20 : 26;
    if (THEME.fun) { noStroke(); fill(THEME.ink); rect(x, y + 5, w, h, 22); }
    stroke(THEME.border); strokeWeight(1.5); fill(THEME.panelBg);
    rect(x, y, w, h, 22);

    // Rótulo del tramo (da un pequeño salto al cambiar)
    if (m.tag !== rotuloTag) { rotuloTag = m.tag; rotuloDesde = millis(); }
    const fsTag = compacto ? 15 : 17;
    textSize(fsTag); textStyle(BOLD);
    const tw = textWidth(m.tag) + 30, th = fsTag * 2;
    push();
    translate(x + pad + tw / 2, y + pad + th / 2);
    scale(salto(rotuloDesde));
    if (THEME.fun) { noStroke(); fill(THEME.ink); rect(-tw / 2, -th / 2 + 3, tw, th, th / 2); }
    noStroke(); fill(m.col); rect(-tw / 2, -th / 2, tw, th, th / 2);
    fill(lightness(color(m.col)) > 55 ? (THEME.ink || '#000') : '#ffffff');
    textAlign(CENTER, CENTER); text(m.tag, 0, 1);
    pop();
    textStyle(NORMAL);

    // Mensaje didáctico
    const fsMsg = compacto ? 15 : 16.5, lead = fsMsg * 1.36;
    textFont(FUENTE_TEXTO); textSize(fsMsg); textLeading(lead); textAlign(LEFT, TOP);
    noStroke(); fill(THEME.text);
    const yMsg = y + pad + th + 14;
    const hMsg = 4 * lead;
    text(m.txt, x + pad, yMsg, w - 2 * pad, hMsg + 4);
    textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);

    let yy = yMsg + hMsg + 12;
    stroke(THEME.border); strokeWeight(1.2); line(x + pad, yy, x + w - pad, yy);
    yy += compacto ? 22 : 24;
    noStroke(); fill(THEME.textDim); textSize(compacto ? 13.5 : 15); textAlign(LEFT, CENTER);
    textFont(FUENTE_TEXTO); text(i18n.t('Estado de la sustancia'), x + pad, yy); textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
    yy += compacto ? 16 : 18;

    // Barra apilada
    const bw = w - 2 * pad, bh = compacto ? 14 : 16;
    noStroke(); fill(THEME.hundido || THEME.lensBg); rect(x + pad, yy, bw, bh, bh / 2);
    let bx = x + pad;
    for (const F of FILAS_ESTADO) {
        const fw = bw * estado[F.f];
        if (fw <= 0.5) continue;
        fill(THEME[F.st]); rect(bx, yy, fw, bh, bh / 2);
        bx += fw;
    }
    yy += bh;

    if (compacto) {
        yy += 22;
        textSize(15); textStyle(BOLD);
        const col = (w - 2 * pad) / 3;
        FILAS_ESTADO.forEach((F, i) => {
            const frac = estado[F.f];
            fill(frac > 0 ? THEME[F.st] : THEME.textDim); textAlign(LEFT, CENTER);
            text(`${i18n.t(F.nombre)} ${Math.round(frac * 100)} %`, x + pad + i * col, yy);
        });
        textStyle(NORMAL);
        return;
    }

    yy += 18;
    const fila = (y + h - pad - yy) / 3;
    FILAS_ESTADO.forEach((F, i) => {
        const fy = yy + i * fila;
        const frac = estado[F.f], activo = frac > 0;
        const col = activo ? THEME[F.st] : THEME.textDim;
        stroke(col); strokeWeight(2.5);
        if (activo) fill(col); else noFill();
        circle(x + pad + 8, fy + 11, 14);
        noStroke(); fill(col); textSize(19); textStyle(BOLD); textAlign(LEFT, CENTER);
        text(i18n.t(F.nombre), x + pad + 26, fy + 10);
        textAlign(RIGHT, CENTER); text(Math.round(frac * 100) + ' %', x + w - pad, fy + 10);
        textStyle(NORMAL);
        textFont(FUENTE_TEXTO); textSize(14); textLeading(18); textAlign(LEFT, TOP);
        fill(activo ? THEME.text : THEME.textDim);
        text(i18n.t(F.txt), x + pad + 26, fy + 24, w - 2 * pad - 26, 40);
        textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
    });
}

// ── Gráfica temperatura–tiempo en una tira ────────────────────────
function drawGrafica() {
    const G = GRAPH, compacta = ESC_MOVIL;
    if (THEME.fun) { noStroke(); fill(THEME.ink); rect(G.x + 4, G.y + 5, G.w - 4, G.h - 5, 16); }
    stroke(THEME.fun ? THEME.ink : THEME.border); strokeWeight(THEME.fun ? 3 : 1.5); fill(THEME.paper);
    rect(G.x + 1, G.y + 1, G.w - 5, G.h - 7, 16);

    const { x0, x1, y0, y1 } = PLOT;
    const tMax = ejeTiempoMax();
    const xOf = (t) => map(t, 0, tMax, x0, x1);
    const yOf = (T) => map(T, sus.tMin, sus.tMax, y1, y0);
    const tinta = THEME.paperInk;

    textFont(FUENTE_TEXTO);
    textSize(compacta ? 12 : 13);
    const pasoT = escalaPaso(sus.tMax - sus.tMin) * (compacta || G.h < 140 ? 2 : 1);
    for (let T = Math.ceil(sus.tMin / pasoT) * pasoT; T <= sus.tMax; T += pasoT) {
        stroke(THEME.paperGrid); strokeWeight(1); line(x0, yOf(T), x1, yOf(T));
        noStroke(); fill(tinta); textAlign(RIGHT, CENTER); text(fmtT(T), x0 - 7, yOf(T));
    }
    const pasoX = tMax / (compacta ? 4 : 10);
    for (let t = 0; t <= tMax + 1e-6; t += pasoX) {
        stroke(THEME.paperGrid); strokeWeight(1); line(xOf(t), y0, xOf(t), y1);
        noStroke(); fill(tinta); textAlign(CENTER, TOP); text(Math.round(t), xOf(t), y1 + 5);
    }
    noStroke(); fill(tinta); textAlign(RIGHT, TOP);
    if (!compacta) text(i18n.t('tiempo (min)'), G.x + G.w - 22, y1 + 5);
    push(); translate(G.x + 16, (y0 + y1) / 2); rotate(-HALF_PI); textAlign(CENTER, CENTER); text('T (°C)', 0, 0); pop();

    const ref = (T, nombre) => {
        stroke(tinta); strokeWeight(1.3); drawingContext.setLineDash([6, 6]);
        line(x0, yOf(T), x1, yOf(T)); drawingContext.setLineDash([]);
        if (!compacta) { noStroke(); fill(tinta); textStyle(BOLD); textAlign(RIGHT, CENTER); text(`${nombre} ${fmtT(T)} °C`, G.x + G.w - 22, yOf(T)); textStyle(NORMAL); }
    };
    if (sus.sublima) ref(sus.tf, i18n.t('sublimación'));
    else { ref(sus.tf, i18n.t('fusión')); ref(sus.teb, i18n.t('ebullición')); }
    textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);

    if (historial.length < 1) return;
    const tramos = tramosHistorial();

    // Curva: contorno de tinta y color del tramo (las mesetas, con halo amarillo)
    strokeJoin(ROUND); strokeCap(ROUND); noFill();
    const trazo = (tr, prev, peso, col) => {
        stroke(col); strokeWeight(peso);
        beginShape();
        if (prev) vertex(xOf(prev.t), yOf(prev.T));
        for (let i = tr.iIni; i <= tr.iFin; i++) vertex(xOf(historial[i].t), yOf(historial[i].T));
        endShape();
    };
    let prev = null;
    for (const tr of tramos) { if (tr.meseta) { const c = color(THEME.change); c.setAlpha(110); trazo(tr, prev, compacta ? 14 : 18, c); } prev = tr.fin; }
    prev = null;
    for (const tr of tramos) { trazo(tr, prev, compacta ? 7 : 9, THEME.paperLine); prev = tr.fin; }
    prev = null;
    for (const tr of tramos) { trazo(tr, prev, compacta ? 3.5 : 5, colorCurva(tr.tramo)); prev = tr.fin; }

    // Rótulos de mesetas y de rampas
    let finRotulo = -Infinity, pisoAnterior = 0;
    for (const tr of tramos) {
        const xm = xOf((tr.ini.t + tr.fin.t) / 2);
        if (tr.meseta && xOf(tr.fin.t) - xOf(tr.ini.t) > 40) {
            let nombre = nombreMeseta(tr);
            if (!compacta && tr.signo !== 0) nombre = i18n.t('MESETA DE {n}', { n: nombre });
            textStyle(BOLD); textSize(compacta ? 13 : 16);
            const ancho = textWidth(nombre);
            const piso = (xm - ancho / 2 < finRotulo + 8) ? 1 - pisoAnterior : 0;
            const yb = yOf(tr.ini.T) - 14 - piso * 20;
            noStroke(); fill(THEME.paperChange); textAlign(CENTER, BOTTOM);
            text(nombre, xm, yb);
            textStyle(NORMAL);
            if (!compacta && yOf(tr.ini.T) + 26 < y1) {
                textFont(FUENTE_TEXTO); textSize(13); fill(tinta); textAlign(CENTER, TOP);
                text(i18n.t('temperatura constante'), xm, yOf(tr.ini.T) + 10);
                textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
            }
            finRotulo = xm + ancho / 2; pisoAnterior = piso;
        } else if (!tr.meseta && (tr.fin.t - tr.ini.t) > tMax * 0.06 && abs(tr.fin.T - tr.ini.T) > 0) {
            const nombre = i18n.t({ solido: 'sólido', liquido: 'líquido', gas: 'gas' }[tr.tramo]);
            const ym = yOf((tr.ini.T + tr.fin.T) / 2);
            noStroke(); fill(colorCurvaTexto(tr.tramo)); textStyle(BOLD); textSize(compacta ? 12.5 : 14); textAlign(LEFT, TOP);
            text(nombre, xm + 6, ym + 8);
            textStyle(NORMAL);
        }
    }
    // Estrella donde empieza cada cambio de estado
    for (const tr of tramos) {
        if (!tr.meseta || tr.iIni === 0) continue;
        stroke(THEME.paperLine); strokeWeight(2); fill(THEME.change);
        estrella(xOf(tr.ini.t), yOf(tr.ini.T), compacta ? 8 : 10, compacta ? 3.5 : 4.5);
    }
    // Plumilla que escribe la curva
    const u = historial[historial.length - 1];
    const px = xOf(u.t), py = yOf(u.T);
    stroke(THEME.paperLine); strokeWeight(2.5); strokeJoin(ROUND); fill(THEME.pen);
    const k = compacta ? 0.8 : 1;
    beginShape(); vertex(px, py); vertex(px + 13 * k, py - 38 * k); vertex(px + 23 * k, py - 34 * k); endShape(CLOSE);
    noStroke(); fill(THEME.paperLine); circle(px, py, 11 * k);
}

function colorCurva(tramo) {
    return { solido: THEME.curveSolid || THEME.solid, liquido: THEME.curveLiquid || THEME.liquid, gas: THEME.curveGas || THEME.gas,
             fusion: THEME.change, vaporizacion: THEME.change, sublimacion: THEME.change }[tramo];
}
function colorCurvaTexto(tramo) {
    return { solido: THEME.paperSolid, liquido: THEME.paperLiquid, gas: THEME.paperGas }[tramo] || THEME.paperInk;
}
