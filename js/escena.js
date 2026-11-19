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
        VASO_T = { tx: 22, ty: 30 - 56 * 0.8, s: 0.8 };
        MANDOS = { x: 40, y: 428, w: 330 };
        MODELO = { cx: 662, cy: 240, r: 182, rotulo: 17 };
        PANEL  = { x: 902, y: 30, w: 400, h: 480, compacto: false };
        GRAPH  = { x: 0, y: 552, w: 1330, h: 128 };
        PLOT   = { x0: 70, x1: 1330 - 190, y0: 552 + 16, y1: 552 + 128 - 28 };
    } else {
        CV_W = 370; CV_H = 1176;
        TARJETAS = [{ x: 0, y: 0, w: 370, h: 334 }, { x: 0, y: 712, w: 370, h: 300 }];
        VASO_T = { tx: -4, ty: 14 - 56 * 0.66, s: 0.66 };
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
        P_R = MODELO.r / 14;
        K_VEL = P_R / 9;
        P_COLS = 12; P_ROWS = 8; P_N = P_COLS * P_ROWS;
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

// ── El vaso, la placa y el termómetro ───────────────────────────────
// Se dibujan en sus propias coordenadas (las del boceto aprobado: placa de
// 352 de ancho, vaso de 264 × 286) y se colocan con VASO_T (traslación y escala).
const VASO = { x: 118, y: 176, w: 264, h: 286, r: 30 };
const LIQ_MAX = 185;              // altura del líquido con todo fundido
let VASO_T = { tx: 0, ty: 0, s: 1 };
let burbujasV = [], gotasV = [];

function aEscena(p) { return { x: VASO_T.tx + VASO_T.s * p.x, y: VASO_T.ty + VASO_T.s * p.y }; }

function caminoVaso(ctx, dy0 = 0) {
    const { x, y, w, h, r } = VASO;
    ctx.beginPath();
    ctx.moveTo(x, y - dy0);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
    ctx.lineTo(x + w - r, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, y - dy0);
}

function drawRecipiente() {
    const ctx = drawingContext;
    push();
    translate(VASO_T.tx, VASO_T.ty); scale(VASO_T.s);

    // Foco de luz detrás del vaso
    if (THEME.fun) {
        const g = ctx.createRadialGradient(250, 330, 0, 250, 330, 230);
        g.addColorStop(0, THEME.foco || 'rgba(45,119,173,0.55)'); g.addColorStop(1, 'rgba(45,119,173,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(250, 330, 230, 210, 0, 0, TWO_PI); ctx.fill();
    }
    drawPlaca();

    const fondo = VASO.y + VASO.h;
    const hLiq = LIQ_MAX * estado.fl;
    const ySup = fondo - hLiq;

    // Interior del vaso (recortado por su forma)
    ctx.save();
    caminoVaso(ctx); ctx.closePath(); ctx.clip();
    noStroke(); fill(255, 255, 255, THEME.fun ? 14 : 20); rect(VASO.x, VASO.y, VASO.w, VASO.h);
    drawAireTemblor(ySup);
    drawLiquido(ySup, hLiq);
    const sol = drawTrozos(ySup, hLiq);
    drawBurbujasV(ySup, hLiq);
    drawGotasV(ySup);
    ctx.restore();

    drawCristal();
    drawTermometro(estado.T);
    pop();

    PUNTO = aEscena(puntoAmpliado(ySup, hLiq, sol));
    if (!ESC_MOVIL) {
        noFill(); stroke(THEME.ink || '#000'); strokeWeight(6); circle(PUNTO.x, PUNTO.y, 22);
        stroke(THEME.accent); strokeWeight(3); circle(PUNTO.x, PUNTO.y, 22);
    }
}

function drawPlaca() {
    const ink = THEME.ink || '#000';
    stroke(ink); strokeWeight(3.5); fill('#2f4558');
    rect(74, 466, 352, 58, 16);
    noStroke(); fill('#46627a'); rect(76, 468, 348, 13, 7);
    // Resistencia: brilla según la potencia (rojo al calentar, azul al enfriar)
    const k = abs(potencia);
    const caliente = potencia > 0, fria = potencia < 0;
    const col = caliente ? color('#ff5a3c') : fria ? color('#4aa8ff') : color('#5b7183');
    if (k > 0) {
        const g = drawingContext.createRadialGradient(250, 466, 0, 250, 466, 175);
        const c0 = caliente ? `rgba(255,122,60,${0.85 * k})` : `rgba(74,168,255,${0.8 * k})`;
        g.addColorStop(0, c0); g.addColorStop(1, 'rgba(0,0,0,0)');
        drawingContext.fillStyle = g; drawingContext.beginPath();
        drawingContext.ellipse(250, 466, 175, 26, 0, 0, TWO_PI); drawingContext.fill();
    }
    stroke(ink); strokeWeight(2.5);
    fill(k > 0 ? lerpColor(color('#5b7183'), col, 0.35 + 0.65 * k) : col);
    ellipse(250, 468, 300, 18);
    // Piloto y rótulo
    fill(k > 0 ? (caliente ? THEME.heat || '#ff7a59' : '#4aa8ff') : '#3a4c5c'); strokeWeight(2);
    circle(102, 500, 14);
    noStroke(); fill('#dbe8f3'); textFont(FUENTE_TEXTO); textSize(17); textAlign(CENTER, CENTER);
    const pct = Math.round(k * 100);
    const enFrase = (t) => { const l = t.toLocaleLowerCase(); return l.charAt(0).toLocaleUpperCase() + l.slice(1); };
    text(enFrase(potencia > 0 ? i18n.t('CALIENTA {pct} % · entra energía', { pct })
       : potencia < 0 ? i18n.t('ENFRÍA {pct} % · sale energía', { pct })
       : i18n.t('PLACA APAGADA')), 262, 501);
    textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
}

function drawCristal() {
    const ink = THEME.ink || '#000';
    const ctx = drawingContext;
    noFill(); strokeJoin(ROUND);
    stroke(ink); strokeWeight(7); caminoVaso(ctx, 6); ctx.stroke();
    stroke(THEME.fun ? '#d8efff' : (THEME.jarWall || '#d8efff')); strokeWeight(3); caminoVaso(ctx, 6); ctx.stroke();
    // Reflejos del vidrio
    noStroke(); fill(255, 255, 255, 90);
    rect(VASO.x + 16, VASO.y + 14, 9, VASO.h - 80, 4.5);
    fill(255, 255, 255, 50);
    rect(VASO.x + 31, VASO.y + 30, 5, 70, 2.5);
    // Tapa móvil con su asa
    stroke(ink); strokeWeight(3); fill('#5f87a8');
    rect(VASO.x + 8, VASO.y + 6, VASO.w - 16, 16, 8);
    fill('#7ea6c6'); rect(VASO.x + VASO.w / 2 - 26 - 30, VASO.y - 10, 52, 18, 9);
    noStroke(); fill(255, 255, 255, 110); rect(VASO.x + 16, VASO.y + 9, VASO.w * 0.45, 4, 2);
    // Rótulo del recipiente (dentro, bajo la tapa)
    noStroke(); fill(THEME.textDim); textFont(FUENTE_TEXTO); textSize(15); textAlign(LEFT, BOTTOM); textLeading(18);
    text(i18n.t('recipiente cerrado · tapa móvil a 1 atm'), VASO.x - 12, VASO.y - 52, TH.x - 30 - VASO.x, 40);
    textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);
}

function drawLiquido(ySup, hLiq) {
    if (hLiq < 0.5) return;
    const hierro = sus === SUSTANCIAS.hierro;
    const ola = (x) => sin(x * 0.045 + frameCount * 0.05) * 3;
    const ctx = drawingContext;
    if (hierro) {
        const g = ctx.createLinearGradient(VASO.x, 0, VASO.x + VASO.w, 0);
        g.addColorStop(0, '#ff6a1a'); g.addColorStop(0.5, '#ffb02e'); g.addColorStop(1, '#ff6a1a');
        ctx.fillStyle = g;
    } else {
        const c = color(sus === SUSTANCIAS.agua ? '#3a9be0' : sus.col.liquid); c.setAlpha(215);
        ctx.fillStyle = c.toString();
    }
    ctx.beginPath(); ctx.moveTo(VASO.x, VASO.y + VASO.h);
    for (let x = 0; x <= VASO.w; x += 8) ctx.lineTo(VASO.x + x, ySup + ola(x));
    ctx.lineTo(VASO.x + VASO.w, VASO.y + VASO.h); ctx.closePath(); ctx.fill();
    // Superficie
    noFill(); stroke(hierro ? '#ffe08a' : '#bfe6ff'); strokeWeight(3);
    beginShape(); for (let x = 0; x <= VASO.w; x += 8) vertex(VASO.x + x, ySup + ola(x)); endShape();
}

// El gas no se ve: solo un leve temblor del aire cuando lo hay
function drawAireTemblor(ySup) {
    if (estado.fg <= 0.02 || MOV_REDUCIDO) return;
    noFill(); stroke(255, 255, 255, 34 * estado.fg); strokeWeight(2.5);
    for (let i = 0; i < 4; i++) {
        const x0 = VASO.x + 50 + i * 55, t = frameCount * 0.04 + i;
        beginShape();
        for (let y = VASO.y + 50; y < ySup - 12; y += 8) vertex(x0 + sin(y * 0.06 + t) * 4, y);
        endShape();
    }
}

// Trozos de sólido: cubitos irregulares con brillos (barras al rojo en el hierro).
// Cada trozo se funde a su ritmo (antes los de arriba y los pequeños), pierde
// tamaño despacio (como un volumen: raíz cúbica) y se redondea. Los trozos de
// arriba se apoyan en los de abajo y bajan cuando estos se funden. El hielo
// flota: cuando hay agua suficiente, cada cubito flota por su cuenta con casi
// todo su volumen sumergido y se balancea un poco.
// [x, y, ancho, giro, apoyos, orden de fusión]
const TROZOS = [
    [160, 430, 58, -4, [], 5], [222, 432, 58, 3, [], 6], [284, 430, 58, -2, [], 4],
    [190, 378, 56, 8, [0, 1], 2], [254, 376, 58, -6, [1, 2], 3], [222, 326, 54, -10, [3, 4], 0], [292, 384, 40, 12, [2], 1]];
const TROZOS_HIERRO = [
    [162, 436, 60, -4, [], 3], [226, 440, 54, 6, [], 4], [288, 438, 48, -8, [], 2],
    [196, 396, 50, 9, [0, 1], 0], [256, 398, 46, -5, [1, 2], 1]];
let trozosVivos = null;   // posición y giro actuales de cada trozo (se suavizan)

function masaTrozo(orden, n, fundido) {
    const ini = orden * (0.55 / (n - 1)), fin = ini + 0.45;
    return 1 - constrain((fundido - ini) / (fin - ini), 0, 1);
}

function drawTrozos(ySup, hLiq) {
    const hierro = sus === SUSTANCIAS.hierro;
    const lista = hierro ? TROZOS_HIERRO : TROZOS;
    if (!trozosVivos || trozosVivos.lista !== lista) {
        trozosVivos = { lista, t: lista.map(([x, y, w, rot]) => ({ x, y, rot })) };
    }
    if (estado.fs <= 0) return null;
    const fundido = 1 - estado.fs, n = lista.length;
    const fondo = VASO.y + VASO.h - 3;
    const flota = sus.flota && hLiq > 2;

    // Tamaño de cada trozo
    const T = lista.map(([x, y, w, rot, apoyos, orden], i) => {
        const m = masaTrozo(orden, n, fundido);
        const k = Math.cbrt(m);
        const w2 = w * k, h2 = (hierro ? w * 0.76 : w * 0.9) * Math.pow(m, 0.4);
        return { i, x, y, w: w2, h: h2, rot, apoyos, m, vivo: m > 0.02 };
    });

    // Posición objetivo: apilados (sobre sus apoyos o el fondo) o flotando
    const profundidad = fondo - ySup;
    const flotan = flota && T.some(t => t.vivo) && profundidad > 0.8 * Math.max(...T.filter(t => t.vivo).map(t => t.h));
    const vivos = T.filter(t => t.vivo);
    if (flotan) {
        // Flotan uno junto a otro en la superficie; si no caben, encima de los de abajo
        const orden = [...vivos].sort((a, b) => a.x - b.x);
        const x0 = VASO.x + 22, x1 = TH.x - TH.tubo / 2 - 8;
        let cursor = x0, capa = 0, techoCapa = [];
        orden.forEach((t) => {
            if (cursor + t.w > x1) { capa++; cursor = x0 + 18 * capa; }
            t.tx = cursor + t.w / 2;
            const yFlota = Math.min(fondo - t.h / 2, ySup + t.h * 0.38);
            if (capa === 0) { t.ty = yFlota; techoCapa.push([t.tx, yFlota - t.h / 2]); }
            else {
                const debajo = techoCapa.reduce((m, [x, y]) => Math.abs(x - t.tx) < m.d ? { d: Math.abs(x - t.tx), y } : m, { d: Infinity, y: yFlota - t.h / 2 });
                t.ty = debajo.y - t.h / 2 + 4;
            }
            cursor += t.w + 3;
        });
    } else {
        const techo = {};
        for (const t of T) {           // los trozos de abajo van primero en la lista
            let base = fondo;
            for (const a of t.apoyos) if (T[a].vivo) base = Math.min(base, techo[a]);
            t.tx = t.x; t.ty = base - t.h / 2;
            techo[t.i] = base - t.h;
        }
    }

    // Suavizado y dibujo
    const ink = THEME.ink || '#000';
    let solCol = color(sus.col.solid);
    if (hierro) solCol = lerpColor(color('#8a6a5a'), color('#c8402a'), constrain(map(estado.T, sus.tMin, sus.tf, 0, 1), 0, 1));
    let base = -Infinity, techoMin = Infinity;
    for (const t of T) {
        const v = trozosVivos.t[t.i];
        if (!t.vivo) { v.y = t.ty; continue; }
        const vel = MOV_REDUCIDO ? 1 : 0.035;
        v.x += (t.tx - v.x) * vel; v.y += (t.ty - v.y) * vel;
        const balanceo = flotan && !MOV_REDUCIDO ? sin(frameCount * 0.03 + t.i * 1.7) * 3 : 0;
        const giro = flotan ? t.rot * 0.4 + balanceo : t.rot;
        v.rot += (giro - v.rot) * 0.05;
        const yb = flotan && !MOV_REDUCIDO ? sin(frameCount * 0.04 + t.i) * 1.2 : 0;
        push(); translate(v.x, v.y + yb); rotate(radians(v.rot));
        const w = t.w, h = t.h, r = Math.min(w, h) * (0.12 + 0.3 * (1 - t.m));
        stroke(ink); strokeWeight(3);
        fill(sus === SUSTANCIAS.agua ? '#cfeaff' : solCol);
        rect(-w / 2, -h / 2, w, h, r);
        noFill(); strokeCap(ROUND);
        const bw = Math.max(0, w - 22);
        if (hierro) { stroke('#ff9a6a'); strokeWeight(3); line(-w / 2 + 7, -h / 2 + 7, -w / 2 + 7 + bw, -h / 2 + 7); }
        else if (w > 16) {
            stroke(255, 255, 255, 230); strokeWeight(Math.min(4, w / 10)); line(-w / 2 + 7, -h / 2 + 8, -w / 2 + 7 + bw, -h / 2 + 7);
            if (h > 26) { stroke(255, 255, 255, 170); strokeWeight(3); line(-w / 2 + 7, -h / 2 + 14, -w / 2 + 8, h / 2 - 10); }
            if (sus === SUSTANCIAS.agua && t.m > 0.5) { stroke('#9fd0f5'); strokeWeight(2); line(w / 2 - 12, h / 2 - 10, w / 2 - 6, h / 2 - 20); line(-4, 2, 4, 8); }
        }
        pop();
        base = Math.max(base, v.y + h / 2); techoMin = Math.min(techoMin, v.y - h / 2);
    }
    if (base === -Infinity) return null;
    return { base, techo: techoMin };
}

function drawBurbujasV(ySup, hLiq) {
    const hirviendo = estado.tramo === 'vaporizacion' && potencia > 0;
    if (hirviendo && random() < potencia * 0.9) burbujasV.push({ x: random(VASO.x + 20, TH.x - 24), y: VASO.y + VASO.h - 6, r: random(4, 9), v: random(1.2, 2.6) });
    noFill(); stroke(255, 255, 255, 200); strokeWeight(2.2);
    for (let i = burbujasV.length - 1; i >= 0; i--) {
        const b = burbujasV[i];
        b.y -= b.v; b.r += 0.03; b.x += random(-0.5, 0.5);
        if (b.y < ySup + 3 || hLiq < 3) { burbujasV.splice(i, 1); continue; }
        circle(b.x, b.y, b.r * 2);
        point(b.x - b.r * 0.35, b.y - b.r * 0.35);
    }
}

function drawGotasV(ySup) {
    const condensando = estado.tramo === 'vaporizacion' && potencia < 0;
    if (condensando && random() < -potencia * 0.5) gotasV.push({ x: random(VASO.x + 20, TH.x - 24), y: VASO.y + 24, r: 1.5, v: 0 });
    const c = color(sus === SUSTANCIAS.agua ? '#3a9be0' : sus.col.liquid);
    stroke(THEME.ink || '#000'); strokeWeight(1.5); fill(c);
    for (let i = gotasV.length - 1; i >= 0; i--) {
        const g = gotasV[i];
        if (g.r < 5.5) g.r += 0.05; else { g.v += 0.3; g.y += g.v; }
        if (g.y > ySup) { gotasV.splice(i, 1); continue; }
        ellipse(g.x, g.y + g.r * 0.4, g.r * 1.8, g.r * 2.3);
    }
}

// Dónde mira el modelo: el borde del sólido (donde toca al líquido), la
// superficie del líquido o el gas (en coordenadas del vaso).
function puntoAmpliado(ySup, hLiq, sol) {
    const cx = 222;
    if (sol) {
        if (hLiq > 2) return sus.flota ? { x: cx, y: sol.base } : { x: cx, y: sol.techo };
        return { x: cx, y: (sol.base + sol.techo) / 2 };
    }
    if (hLiq > 2) return { x: cx, y: ySup + min(18, hLiq / 2) };
    return { x: cx, y: VASO.y + VASO.h / 2 };
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
const TH = { x: 344, top: 70, bottom: 428, tubo: 26, bulbo: 18, lectura: 48 };
function drawTermometro(T) {
    const { x, top, bottom, tubo, bulbo } = TH;
    const ink = THEME.ink || '#000';
    const yOf = (t) => map(t, sus.tMin, sus.tMax, bottom - 4, top + 6);
    stroke(ink); strokeWeight(3.5); fill('#eef6fc');
    rect(x - tubo / 2, top - 14, tubo, bottom - top + 24, tubo / 2);
    const yT = yOf(T);
    noStroke(); fill('#ff4d5e');
    rect(x - 5, yT, 10, bottom - yT + 8, 5);
    stroke(ink); strokeWeight(3.5); circle(x, bottom + 20, bulbo * 2);
    noStroke(); fill(255, 255, 255, 170); ellipse(x - 6, bottom + 14, 7, 9);

    // Marcas: ebullición a la izquierda, fusión a la derecha
    textFont(FUENTE_TEXTO); textSize(17); textStyle(BOLD);
    const marca = (t, etiqueta, col, izq) => {
        const y = yOf(t);
        stroke(col); strokeWeight(3);
        if (izq) line(x - tubo / 2, y, x - tubo / 2 - 12, y);
        else     line(x + tubo / 2, y, x + tubo / 2 + 34, y);
        noStroke(); fill(col); textAlign(izq ? RIGHT : LEFT, CENTER);
        text(`${etiqueta} ${fmtT(t)} °C`, izq ? x - tubo / 2 - 17 : x + tubo / 2 + 38, y);
    };
    if (sus.sublima) marca(sus.tf, i18n.t('sublimación'), THEME.change, false);
    else {
        marca(sus.tf, i18n.t('fusión'), THEME.solid, false);
        marca(sus.teb, i18n.t('ebullición'), THEME.gas, true);
    }
    textStyle(NORMAL); textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO);

    // Lectura digital: la cabeza del termómetro
    const L = TH.lectura;
    textSize(L); textStyle(BOLD);
    const txt = fmtT(T) + ' °C';
    const hw = textWidth(txt) + 34, hh = 70;
    const hx = x + tubo / 2, hy = top - 14;
    stroke(THEME.headEdge || THEME.border); strokeWeight(2); fill(THEME.headBg || THEME.panelBg);
    rect(hx, hy, hw, hh, 0, 12, 12, 12);
    noStroke(); fill(THEME.headText || THEME.text); textAlign(LEFT, CENTER);
    text(txt, hx + 16, hy + hh / 2 + 3);
    textStyle(NORMAL);

    const meseta = ['fusion', 'vaporizacion', 'sublimacion'].includes(estado.tramo);
    if (meseta && potencia !== 0) {
        const et = i18n.t('temperatura constante');
        textSize(19); textStyle(BOLD);
        const pw = textWidth(et) + 32, ph = 34, py = hy + hh + 10;
        const limite = (CV_W - 8 - VASO_T.tx) / VASO_T.s;
        const px = Math.min(hx, limite - pw);
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
    if (THEME.fun) { stroke(THEME.ink); strokeWeight(2.5); } else noStroke();
    fill(m.col); rect(-tw / 2, -th / 2, tw, th, th / 2); noStroke();
    fill(lightness(color(m.col)) > 55 ? (THEME.ink || '#000') : '#ffffff');
    textAlign(CENTER, CENTER); text(m.tag, 0, 1);
    pop();
    textStyle(NORMAL);

    // Mensaje didáctico
    const fsMsg = compacto ? 16 : 18, lead = fsMsg * 1.32;
    if (!THEME.fun) textFont(FUENTE_TEXTO);
    textSize(fsMsg); textLeading(lead); textAlign(LEFT, TOP);
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
    if (compacta) { textAlign(LEFT, TOP); text('T (°C)', x0 + 6, y0 - 12); }
    else { push(); translate(G.x + 16, (y0 + y1) / 2); rotate(-HALF_PI); textAlign(CENTER, CENTER); text('T (°C)', 0, 0); pop(); }

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
