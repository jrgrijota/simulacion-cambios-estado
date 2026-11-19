// ═══════════════════════════════════════════════════════════════════
//  ESCENA DEL MODO «PRESIÓN Y TEMPERATURA»
//
//  Misma retícula que «Calentar y enfriar»: a la izquierda el cilindro con
//  émbolo (el vaso del otro modo con su tapa convertida en émbolo), con
//  manómetro, termómetro y termostato, y bajo él los mandos (HTML); en el
//  centro el diagrama de fases, protagonista, sobre papel azul; a la derecha
//  el panel de estado, el modelo de moléculas y «Piensa y comprueba».
//  Cruzar una línea (y sobre todo hervir sin calentar) se celebra: el tramo
//  de línea se ilumina y aparece un sello.
//  Las medidas salen del boceto aprobado (boceto-fases, 2026-11-19).
// ═══════════════════════════════════════════════════════════════════

let FX = null;             // composición activa del modo
let embY = null;           // posición del émbolo (se mueve con suavidad)
let burbujasF = [];        // burbujas del líquido al hervir
let celebraClave = '', celebraDesde = -1e9;

function calcularFases() {
    const movil = window.matchMedia(`(max-width: ${ANCHO_MOVIL}px)`).matches;
    ESC_MOVIL = movil;
    if (!movil) {
        CV_W = 1330; CV_H = 652;
        FX = {
            movil: false,
            tarjeta: { x: 0, y: 0, w: 420, h: 652 },
            cil: { tx: 12, ty: 10, s: 1 },
            mandos: { x: 24, y: 380, w: 372 },
            diag: { x: 436, y: 0, w: 470, h: 652 },
            panel: { x: 922, y: 0, w: 408, h: 226 },
            modelo: { cx: 1022, cy: 344, r: 100 },
            leyenda: { x: 1138, y: 276, w: 186, fs: 14.5 },
            rotulo: { x: 928, y: 458, w: 396, h: 34, fs: 16 },
            piensa: { x: 922, y: 508, w: 408, h: 144 },
        };
    } else {
        CV_W = 370; CV_H = 1862;
        FX = {
            movil: true,
            diag: { x: 0, y: 0, w: 370, h: 480 },
            mandos: { x: 10, y: 502, w: 350 },
            panel: { x: 0, y: 778, w: 370, h: 214 },
            tarjeta: { x: 0, y: 1008, w: 370, h: 370 },
            cil: { tx: 4, ty: 1018, s: 0.9 },
            modelo: { cx: 100, cy: 1494, r: 94 },
            leyenda: { x: 212, y: 1442, w: 154, fs: 13.5 },
            rotulo: { x: 4, y: 1598, w: 362, h: 34, fs: 15 },
            piensa: { x: 0, y: 1648, w: 370, h: 214 },
        };
    }
    const d = FX.diag, m = FX.movil;
    DPLOT = { x0: d.x + (m ? 54 : 62), x1: d.x + d.w - (m ? 16 : 22), y0: d.y + (m ? 78 : 76), y1: d.y + d.h - (m ? 54 : 62) };
    MODELO = { cx: FX.modelo.cx, cy: FX.modelo.cy, r: FX.modelo.r, rotulo: FX.rotulo.fs };
    LENS_FASES = { x: MODELO.cx - MODELO.r, y: MODELO.cy - MODELO.r, w: 2 * MODELO.r, h: 2 * MODELO.r };
    LENS = LENS_FASES;
    P_R = MODELO.r / 14; K_VEL = P_R / 9;
    P_COLS = 12; P_ROWS = 8; P_N = P_COLS * P_ROWS;
    colocarMandosFases();
}

function colocarMandosFases() {
    const el = document.querySelector('.mandos-fases');
    if (!el || !FX) return;
    el.style.left  = (100 * FX.mandos.x / CV_W) + '%';
    el.style.top   = (100 * FX.mandos.y / CV_H) + '%';
    el.style.width = (100 * FX.mandos.w / CV_W) + '%';
}

// ── Colores del papel del diagrama ───────────────────────────────
function papelClaro() { return brightness(color(THEME.paper || '#d6e6f3')) > 50; }
function colRegion(st) {
    if (papelClaro()) return { solid: '#c2dcf6', liquid: '#bfeedd', gas: '#f6d9bd' }[st];
    return lerpColor(color(THEME.paper), color(THEME[st]), 0.25);
}
function colRotulo(st) {
    if (papelClaro()) return { solid: '#1d5e98', liquid: '#0b6b4a', gas: '#9a4708' }[st];
    return THEME[st];
}

// ── Lo que se celebra: llegar a una línea o cruzarla ─────────────
// Devuelve { tipo, de, causa, T, P } o null.
function celebracion() {
    const sit = situacion();
    if (sit.tipo && llegada) return { tipo: sit.tipo, de: llegada.de, causa: llegada.causa, T: fT, P: fP, t: llegada.t };
    if (ultimoCambio && millis() - ultimoCambio.t < 3500) {
        const par = [ultimoCambio.de, ultimoCambio.a].sort().join('-');
        const tipo = { 'liquid-solid': 'fusion', 'gas-liquid': 'vaporizacion', 'gas-solid': 'sublimacion' }[par];
        return { tipo, de: ultimoCambio.de, causa: ultimoCambio.causa, T: ultimoCambio.T, P: ultimoCambio.P, t: ultimoCambio.t };
    }
    return null;
}

// Nombre del cambio según el estado de partida
function nombreCambio(c) {
    if (c.tipo === 'triple') return i18n.t('PUNTO TRIPLE');
    const otro = { fusion: { solid: 'liquid', liquid: 'solid' }, vaporizacion: { liquid: 'gas', gas: 'liquid' },
                   sublimacion: { solid: 'gas', gas: 'solid' } }[c.tipo][c.de];
    return otro ? i18n.t(NOMBRE_CAMBIO[c.de + '>' + otro]) : i18n.t(NOMBRE_CAMBIO[{ fusion: 'solid>liquid', vaporizacion: 'liquid>gas', sublimacion: 'solid>gas' }[c.tipo]]);
}

// Frase corta del cambio a esta temperatura (termómetro y sello)
function fraseCambio(c) {
    const T = fmtT(c.T);
    if (c.tipo === 'triple') return i18n.t('conviven los tres estados');
    if (c.tipo === 'vaporizacion') {
        if (c.de === 'gas') return i18n.t('se condensa a {T} °C', { T });
        if (c.causa === 'descomprimir' && c.T < tVap(1) - 2) return i18n.t('¡hierve a solo {T} °C!', { T });
        return i18n.t('¡hierve a {T} °C!', { T });
    }
    if (c.tipo === 'fusion') return c.de === 'liquid' ? i18n.t('se solidifica a {T} °C', { T }) : i18n.t('funde a {T} °C', { T });
    return c.de === 'gas' ? i18n.t('pasa a sólido a {T} °C', { T }) : i18n.t('sublima a {T} °C', { T });
}

// ═══════════════════════════════════════════════════════════════════
//  DIBUJO
// ═══════════════════════════════════════════════════════════════════
function drawFasesEscena() {
    detectarCambio();
    const sit = situacion();
    if (avanzarFracciones(sit)) equilibrioDinamico(sit);
    updateParticles(fasesFr, agitacionFases());

    const c = celebracion();
    const clave = c ? c.tipo + c.t : '';
    if (clave !== celebraClave) { celebraClave = clave; celebraDesde = millis(); }

    tarjetaF(FX.tarjeta, THEME.cardBg || THEME.panelBg);
    drawCilindro(sit, c);
    drawDiagramaFases(sit, c);
    const m = mensajeFases();
    drawPanelFases(m);
    drawModeloFases(sit);
    drawPiensa();
    if (frameCount % 4 === 0) {
        anunciar(m);
        if (typeof retosFasesComprobar === 'function') retosFasesComprobar();
    }
}

function tarjetaF(t, relleno) {
    if (THEME.fun) { noStroke(); fill(THEME.ink); rect(t.x + 4, t.y + 5, t.w, t.h, 24); }
    stroke(THEME.cardEdge || THEME.border); strokeWeight(1.5); fill(relleno);
    rect(t.x, t.y, t.w, t.h, 24);
}

function fuenteJuego() { textFont(THEME.fun ? 'Fredoka' : FUENTE_TEXTO); }

// Parte un texto en líneas que caben en «w» (con la fuente y el tamaño actuales)
function partirLineas(txt, w) {
    // El número y su unidad no se separan
    const palabras = String(txt).replace(/ (°C|atm)/g, '\u00a0$1').split(/[ \t\n]+/);
    const lineas = [];
    let l = '';
    for (const p of palabras) {
        const prueba = l ? l + ' ' + p : p;
        if (l && textWidth(prueba) > w) { lineas.push(l); l = p; } else l = prueba;
    }
    if (l) lineas.push(l);
    return lineas;
}

// ── Cilindro con émbolo (coordenadas del boceto: 400 × 364) ───────
const CIL = { gx: 80, gy: 40, gw: 180, gh: 272, hMax: 136 };

const MATERIA_F = {
    agua: { solido: '#d6ecff', brillo: '#ffffff', liquido: '#3a9be0', gas: [255, 255, 255], gasA: [20, 50] },
    co2:  { solido: '#eef2f6', brillo: '#ffffff', liquido: '#cfe3f3', gas: [255, 255, 255], gasA: [20, 50] },
    // El vapor de yodo sí es visible: violeta
    yodo: { solido: '#4b3a63', brillo: '#a796c4', liquido: '#6b2d5c', gas: [150, 95, 225], gasA: [40, 95] },
};

function drawCilindro(sit, cel) {
    const t = FX.cil;
    const { gx, gy, gw, gh, hMax } = CIL;
    const base = gy + gh;
    const ink = THEME.ink || '#061523';
    const mat = MATERIA_F[claveDiagrama()];
    const ctx = drawingContext;
    push();
    translate(t.tx, t.ty); scale(t.s);

    // Foco de luz
    if (THEME.fun) {
        const g = ctx.createRadialGradient(170, 200, 0, 170, 200, 190);
        g.addColorStop(0, 'rgba(45,119,173,0.55)'); g.addColorStop(1, 'rgba(45,119,173,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(170, 200, 190, 180, 0, 0, TWO_PI); ctx.fill();
    }

    // Termostato: mantiene la temperatura elegida (es una condición, como la presión)
    stroke(ink); strokeWeight(3.5); fill('#2f4558'); rect(40, 316, 260, 44, 14);
    noStroke(); fill('#46627a'); rect(42, 318, 256, 10, 5);
    stroke(ink); strokeWeight(2); fill('#2ee6a6'); circle(62, 343, 12);
    noStroke(); fill('#e3edf5'); textFont(FUENTE_TEXTO); textStyle(NORMAL); textSize(14); textAlign(CENTER, CENTER);
    text(i18n.t('Termostato · mantiene {T} °C', { T: fmtT(fT) }), 178, 342);

    // Cantidades: altura de lo condensado y posición del émbolo
    const fs = fasesFr.fs, fl = fasesFr.fl, fg = fasesFr.fg;
    const hS = hMax * fs, hL = hMax * fl;
    const top = base - hS - hL;
    const objetivo = fg > 0.004 ? lerp(top - 16, 58, min(1, fg * 4)) : top - 16;
    if (embY === null) embY = objetivo;
    embY += (objetivo - embY) * 0.12;
    const yp = embY;
    const flota = claveDiagrama() === 'agua';

    // Interior (recortado por la forma del cilindro)
    ctx.save();
    caminoCilindro(ctx); ctx.closePath(); ctx.clip();
    noStroke(); fill(191, 227, 255, 26); rect(gx, gy, gw, gh);
    // Gas: velo liso que llena el espacio libre (en el yodo, violeta: sí se ve)
    if (fg > 0.004) {
        const [r, g2, b] = mat.gas;
        fill(r, g2, b, mat.gasA[0] + mat.gasA[1] * fg);
        rect(gx, yp + 16, gw, top - yp - 16 + 8);
    }
    // Líquido y sólido
    const conGas = fg > 0.004;
    let yLiq0, yLiq1, ySol0, ySol1;
    if (flota && hL > 1) { yLiq1 = base; yLiq0 = base - hL; ySol1 = yLiq0 + hS * 0.25; ySol0 = ySol1 - hS; }
    else { ySol1 = base; ySol0 = base - hS; yLiq1 = ySol0; yLiq0 = ySol0 - hL; }
    if (hL > 0.5) {
        const ola = (x) => conGas ? sin(x * 0.05 + frameCount * 0.06) * 3 : 0;
        fill(mat.liquido); noStroke();
        beginShape(); vertex(gx, yLiq1 + 2);
        for (let x = 0; x <= gw; x += 6) vertex(gx + x, yLiq0 + ola(x));
        vertex(gx + gw, yLiq1 + 2); endShape(CLOSE);
        if (conGas) {
            noFill(); stroke(claveDiagrama() === 'yodo' ? '#c08ab8' : '#bfe6ff'); strokeWeight(3);
            beginShape(); for (let x = 0; x <= gw; x += 6) vertex(gx + x, yLiq0 + ola(x)); endShape();
        }
        drawBurbujasF(sit, yLiq0, yLiq1);
    } else burbujasF = [];
    if (hS > 0.5) drawSolidoF(mat, ySol0, ySol1, ink);
    ctx.restore();

    // Émbolo: vástago, asa y pistón
    stroke(ink); strokeWeight(2.5); fill('#9fb6c8'); rect(146, yp - 46, 10, 46);
    strokeWeight(3); fill('#b8cad8'); rect(112, yp - 58, 78, 14, 7);
    fill('#8fa9be'); rect(gx + 5, yp, gw - 10, 18, 6);
    stroke('#d6e4ef'); strokeWeight(3); line(gx + 12, yp + 6, gx + gw - 40, yp + 6);

    // Vidrio
    noFill(); strokeJoin(ROUND);
    stroke(ink); strokeWeight(7); caminoCilindro(ctx); ctx.stroke();
    stroke('#d8efff'); strokeWeight(3); caminoCilindro(ctx); ctx.stroke();
    noStroke(); fill(255, 255, 255, 72); rect(gx + 12, gy + 12, 8, gh - 70, 4);

    drawTermometroF(yp, sit, cel, ink);
    drawManometro(ink);
    drawRotulosCilindro(yp, fg, cel, mat);
    pop();
}

function caminoCilindro(ctx) {
    const { gx, gy, gw, gh } = CIL, r = 26;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh - r);
    ctx.quadraticCurveTo(gx, gy + gh, gx + r, gy + gh);
    ctx.lineTo(gx + gw - r, gy + gh);
    ctx.quadraticCurveTo(gx + gw, gy + gh, gx + gw, gy + gh - r);
    ctx.lineTo(gx + gw, gy);
}

// Trozos de sólido apilados (cubitos de hielo, hielo seco o cristales de yodo)
function drawSolidoF(mat, y0, y1, ink) {
    const { gx, gw } = CIL;
    const lado = 42, n = 4, sep = (gw - 8) / n;
    const filas = Math.ceil((y1 - y0) / lado - 0.15);
    for (let f = 0; f < filas; f++) {
        const yb = y1 - f * lado;
        const h = Math.min(lado - 4, yb - y0 - 2);
        if (h < 6) continue;
        for (let i = 0; i < n; i++) {
            const x = gx + 4 + i * sep + ((f + i) % 2 ? 2 : -1);
            const giro = ((i * 7 + f * 3) % 5 - 2) * 0.03;
            push();
            translate(x + sep / 2, yb - h / 2 - 2); rotate(giro);
            stroke(ink); strokeWeight(2); fill(mat.solido);
            rect(-sep / 2 + 2, -h / 2, sep - 4, h, 7);
            noStroke(); fill(mat.brillo); rect(-sep / 2 + 7, -h / 2 + 5, (sep - 4) * 0.4, 4, 2);
            pop();
        }
    }
}

function drawBurbujasF(sit, y0, y1) {
    const hierve = (sit.tipo === 'vaporizacion' || sit.tipo === 'triple') && !MOV_REDUCIDO;
    const { gx, gw } = CIL;
    if (hierve && burbujasF.length < 14 && random() < 0.25) {
        burbujasF.push({ x: random(gx + 14, gx + gw - 46), y: y1 - 6, r: random(3, 9), v: random(0.6, 1.4) });
    }
    noFill(); stroke('#e8f7ff'); strokeWeight(2);
    for (let i = burbujasF.length - 1; i >= 0; i--) {
        const b = burbujasF[i];
        b.y -= b.v; b.r += 0.02;
        if (b.y < y0 + b.r || !hierve && b.y < y0 + 30) { burbujasF.splice(i, 1); continue; }
        fill(217, 241, 255, 64); circle(b.x, b.y, 2 * b.r);
    }
}

// Termómetro: atraviesa el émbolo y llega a la sustancia
function drawTermometroF(yp, sit, cel, ink) {
    const tx = 222, tTop = 14, tBot = 282;
    const yT = (t) => tBot - (t - dg.tMin) / (dg.tMax - dg.tMin) * (tBot - tTop - 10);
    stroke(ink); strokeWeight(3); fill('#eef6fc'); rect(tx - 11, tTop, 22, tBot - tTop + 6, 11);
    noStroke(); fill('#ff4d5e'); rect(tx - 4, yT(fT), 8, tBot - yT(fT) + 6, 4);
    stroke(ink); strokeWeight(3); fill('#ff4d5e'); circle(tx, tBot + 12, 28);
    noStroke(); fill(255, 255, 255, 128); circle(tx - 5, tBot + 7, 8);
    stroke(ink); strokeWeight(2); fill('#5d7488'); rect(tx - 15, yp + 3, 30, 12, 4);

    // Lectura en la cabeza (como en «Calentar y enfriar»)
    const hx = tx + 11;
    stroke('#9fb9cc'); strokeWeight(2); fill('#0e2238');
    beginShape(); vertex(hx, 2); vertex(hx + 112, 2); quadraticVertex(hx + 124, 2, hx + 124, 14);
    vertex(hx + 124, 40); quadraticVertex(hx + 124, 52, hx + 112, 52); vertex(hx, 52); endShape(CLOSE);
    textFont('Fredoka'); textStyle(BOLD);
    const txt = fmtT(fT) + ' °C';
    textSize(36); textSize(min(36, 36 * 104 / textWidth(txt)));
    noStroke(); fill('#ffffff'); textAlign(LEFT, CENTER); text(txt, hx + 12, 27);

    // Etiqueta del cambio que está ocurriendo
    if (sit.tipo && cel) {
        const f = fraseCambio(cel);
        textSize(16);
        const w = textWidth(f) + 28;
        stroke(ink); strokeWeight(2); fill(THEME.change || '#ffd84a'); rect(hx, 58, w, 28, 14);
        noStroke(); fill(ink); textAlign(CENTER, CENTER); text(f, hx + w / 2, 72);
    }
    textStyle(NORMAL);
}

// Manómetro conectado por debajo del émbolo
function drawManometro(ink) {
    const { gx, gw } = CIL;
    const mx = 344, my = 196, mr = 34;
    const fr = (Math.log(fP) - Math.log(dg.pMin)) / (Math.log(dg.pMax) - Math.log(dg.pMin));
    noFill(); strokeJoin(ROUND);
    stroke(ink); strokeWeight(9); beginShape(); vertex(gx + gw, 292); vertex(mx, 292); vertex(mx, my + mr); endShape();
    stroke('#9fb9cc'); strokeWeight(4); beginShape(); vertex(gx + gw, 292); vertex(mx, 292); vertex(mx, my + mr); endShape();
    stroke(ink); strokeWeight(3); fill('#5d7488'); circle(mx, my, 2 * (mr + 5));
    strokeWeight(2); fill('#eef6fc'); circle(mx, my, 2 * mr);
    noFill(); stroke('#b9cfe2'); strokeWeight(3);
    arc(mx, my, 2 * (mr - 9), 2 * (mr - 9), 2.572, 6.852);
    stroke(ink); strokeWeight(2.5);
    dg.marcasP.filter((p, i) => i % 2 === 0).forEach(p => {
        const f = (Math.log(p) - Math.log(dg.pMin)) / (Math.log(dg.pMax) - Math.log(dg.pMin));
        const a = radians(-135 + 270 * f - 90);
        line(mx + cos(a) * (mr - 3), my + sin(a) * (mr - 3), mx + cos(a) * (mr - 11), my + sin(a) * (mr - 11));
    });
    push(); translate(mx, my); rotate(radians(-135 + 270 * fr));
    stroke(ink); strokeWeight(1.5); fill('#c0392b'); triangle(-3, 0, 0, -mr + 8, 3, 0);
    pop();
    noStroke(); fill(ink); circle(mx, my, 10);
    fill('#24323f'); textFont(FUENTE_TEXTO); textStyle(BOLD); textSize(11); textAlign(CENTER, CENTER); text('atm', mx, my + 18);

    // Lectura de la presión
    const pTxt = fmtP(fP);
    textFont('Fredoka'); textStyle(BOLD); textSize(27);
    const wN = textWidth(pTxt); textSize(15); const wU = textWidth(' atm');
    const bw = max(112, wN + wU + 28), bx = 400 - bw;
    stroke('#9fb9cc'); strokeWeight(2); fill('#0e2238'); rect(bx, 104, bw, 48, 12);
    noStroke(); fill('#ffffff'); textAlign(LEFT, BASELINE);
    const x0 = bx + (bw - wN - wU) / 2;
    textSize(27); text(pTxt, x0, 138); textSize(15); text(' atm', x0 + wN, 138);
    textStyle(NORMAL);
}

function drawRotulosCilindro(yp, fg, cel, mat) {
    const { gx } = CIL;
    const mut = THEME.textDim, ink = THEME.ink || '#061523';
    textFont(FUENTE_TEXTO); textStyle(NORMAL); textAlign(LEFT, BASELINE);
    // Lo que acaba de hacer el émbolo (si el cambio vino de la presión)
    const causa = cel ? cel.causa : null;
    if (causa === 'descomprimir' || causa === 'comprimir') {
        const sube = causa === 'descomprimir';
        stroke(THEME.change); strokeWeight(4); strokeCap(ROUND); noFill();
        line(44, 220, 44, 120);
        if (sube) { line(34, 132, 44, 116); line(54, 132, 44, 116); } else { line(34, 208, 44, 224); line(54, 208, 44, 224); }
        noStroke(); fill(THEME.text); textStyle(BOLD); textSize(13.5);
        const ls = sube ? ['tiras del', 'émbolo:', 'baja la', 'presión'] : ['empujas el', 'émbolo:', 'sube la', 'presión'];
        ls.forEach((l, i) => text(i18n.t(l), 4, 240 + i * 17));
        textStyle(NORMAL);
    } else if (fg <= 0.004) {
        stroke(mut); strokeWeight(2); line(gx - 2, yp + 9, 46, yp + 9);
        noStroke(); fill(mut); textSize(14); text(i18n.t('émbolo'), 4, yp + 14);
    }
    // Leyenda del gas
    if (fg > 0.004) {
        const yodo = claveDiagrama() === 'yodo';
        const [r, g, b] = mat.gas;
        stroke(ink); strokeWeight(1); fill(r, g, b, yodo ? 200 : 150); rect(2, 63, 10, 10, 2);
        noStroke(); fill(mut); textSize(11);
        const ls = yodo ? ['gas: vapor', 'violeta,', 'sí se ve'] : ['gas: en', 'realidad', 'es invisible'];
        ls.forEach((l, i) => text(i18n.t(l), 17, 72 + i * 14));
    }
}

// ── Diagrama de fases (protagonista) ─────────────────────────────
function drawDiagramaFases(sit, cel) {
    const { x: X, y: Y, w: W, h: H } = FX.diag, m = FX.movil;
    const { x0, x1, y0, y1 } = DPLOT;
    const ink = THEME.ink || '#061523', pInk = THEME.paperInk || '#24323f';
    const pt = pTriple();
    const ctx = drawingContext;

    if (THEME.fun) { noStroke(); fill(red(color(ink)), green(color(ink)), blue(color(ink)), 140); rect(X + 4, Y + 5, W, H, 16); }
    stroke(ink); strokeWeight(3); fill(THEME.paper || '#d6e6f3'); rect(X, Y, W, H, 16);
    textFont('Fredoka'); textStyle(BOLD); noStroke(); fill(pInk); textAlign(LEFT, BASELINE); textSize(m ? 17 : 20);
    text(i18n.t('Diagrama de fases del {s}', { s: i18n.t(dg.nombre) }), X + 18, Y + 32);
    if (!m) {
        textFont(FUENTE_TEXTO); textStyle(NORMAL); textSize(13); fill(papelClaro() ? '#3d5568' : THEME.textDim); textAlign(RIGHT, BASELINE);
        text(i18n.t('esquemático'), X + W - 18, Y + 32);
    }

    // Regiones
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    noStroke(); fill(colRegion('liquid')); rect(x0, y0, x1 - x0, y1 - y0);
    const pasoT = (dg.tMax - dg.tMin) / 200;
    const borde = [];
    for (let T = dg.tMin; T <= dg.tMax + 1e-9; T += pasoT) borde.push([dx(T), dyc(T < dg.tt ? pSub(T) : pVap(T))]);
    fill(colRegion('gas'));
    beginShape(); for (const [a, b] of borde) vertex(a, b); vertex(x1, y1); vertex(x0, y1); endShape(CLOSE);
    fill(colRegion('solid'));
    beginShape();
    vertex(dx(dg.tMin) - 2, y0); vertex(dx(tFus(dg.pMax)), y0); vertex(dx(tFus(pt)), dy(pt));
    for (let T = dg.tt; T >= dg.tMin - 1e-9; T -= pasoT) vertex(dx(T), dyc(pSub(T)));
    vertex(dx(dg.tMin) - 2, dyc(pSub(dg.tMin)));
    endShape(CLOSE);

    // Cuadrícula
    const paso = escalaPaso(dg.tMax - dg.tMin);
    const marcasT = [];
    for (let T = Math.ceil(dg.tMin / paso) * paso; T <= dg.tMax; T += paso) marcasT.push(T);
    const marcasP = m ? dg.marcasP.filter(p => /^[15]/.test(p.toExponential())) : dg.marcasP;
    stroke(THEME.paperGrid || '#b9cfe2'); strokeWeight(1);
    marcasT.forEach(T => line(dx(T), y0, dx(T), y1));
    marcasP.forEach(P => line(x0, dy(P), x1, dy(P)));
    // Línea de 1 atm
    if (1 > dg.pMin && 1 < dg.pMax) {
        stroke(pInk); strokeWeight(1.6); ctx.setLineDash([7, 6]);
        line(x0, dy(1), x1, dy(1)); ctx.setLineDash([]);
    }

    // Momento clave: se ilumina el tramo de línea que se cruza
    if (cel && cel.tipo && cel.tipo !== 'triple') {
        const tramo = tramoLinea(cel.tipo, cel.T, cel.P);
        const a = min(1, (millis() - cel.t) / 250);
        const c = color(THEME.change || '#ffd84a'); c.setAlpha(215 * a);
        noFill(); stroke(c); strokeWeight(18); strokeCap(ROUND); strokeJoin(ROUND);
        beginShape(); for (const [a2, b] of tramo) vertex(a2, b); endShape();
    }

    // Líneas de cambio de estado
    noFill(); stroke(ink); strokeWeight(m ? 3.5 : 4); strokeJoin(ROUND); strokeCap(ROUND);
    beginShape();
    for (let T = dg.tt; T <= dg.tMax; T += pasoT) vertex(dx(T), dy(pVap(T)));
    endShape();
    beginShape();
    for (let T = dg.tt; T >= dg.tMin - 1e-9; T -= pasoT / 2) vertex(dx(T), dy(pSub(T)));
    endShape();
    line(dx(tFus(pt)), dy(pt), dx(tFus(dg.pMax)), y0);
    ctx.restore();

    noFill(); stroke(pInk); strokeWeight(1.5); rect(x0, y0, x1 - x0, y1 - y0);

    // Rótulos de las regiones
    textFont('Fredoka'); textStyle(BOLD); noStroke(); textAlign(CENTER, CENTER);
    for (const st of ['solid', 'liquid', 'gas']) {
        const r = dg.rotulos[st];
        textSize(st === 'solid' ? (m ? 14 : 17) : (m ? 20 : 26));
        fill(colRotulo(st));
        text(i18n.t({ solid: 'SÓLIDO', liquid: 'LÍQUIDO', gas: 'GAS' }[st]), dx(r.T), dy(r.P));
    }

    // Rótulos de las líneas, paralelos a la curva
    const fsL = m ? 11.5 : 13.5;
    rotuloLinea(i18n.t('fusión ⇄ solidificación'), (u) => { const P = Math.exp(lerp(Math.log(pt), Math.log(dg.pMax), u)); return [dx(tFus(P)), dy(P)]; },
        0.3, -9, fsL, colRegion('solid'));
    rotuloLinea(i18n.t('vaporización ⇄ condensación'), (u) => { const T = lerp(dg.tt, dg.tMax, u); return [dx(T), dy(pVap(T))]; },
        (m && dg === DIAGRAMAS.agua) ? 0.42 : dg.rotuloVap, -11, fsL, colRegion('liquid'));
    if (dg.rotuloSub) rotuloLinea(i18n.t('sublimación ⇄ sublimación inversa'), (u) => { const T = lerp(dg.tMin, dg.tt, u); return [dx(T), dy(pSub(T))]; },
        dg.rotuloSub, -11, fsL, colRegion('solid'));

    // 1 atm y puntos notables
    textFont(FUENTE_TEXTO); textStyle(NORMAL);
    const sombra = (c) => { stroke(c); strokeWeight(5); strokeJoin(ROUND); };
    if (1 > dg.pMin && 1 < dg.pMax) {
        const xRot = dx(1 > pt ? tFus(1) : tSub(1)) + 0.13 * (DPLOT.x1 - DPLOT.x0);
        textSize(m ? 11 : 12.5); textAlign(LEFT, BASELINE); fill(papelClaro() ? '#33475a' : THEME.textDim);
        sombra(colRegion(1 > pt ? 'liquid' : 'gas'));
        text(i18n.t('1 atm (nivel del mar)'), xRot, dy(1) - 8);
        noStroke();
        if (!m) {
            const marcas = 1 > pt ? [[tFus(1), 'funde a {T} °C', 'izq'], [tVap(1), 'hierve a {T} °C', 'der']] : [[tSub(1), 'sublima a {T} °C', 'der']];
            for (const [T, txt, lado] of marcas) {
                if (T < dg.tMin || T > dg.tMax) continue;
                stroke(ink); strokeWeight(2); fill('#ffffff'); circle(dx(T), dy(1), 10);
                const s = i18n.t(txt, { T: fmtT(T) });
                textSize(13); fill(papelClaro() ? '#33475a' : THEME.textDim);
                if (lado === 'izq') {
                    // En dos líneas («funde» / «a 0 °C»): la región del sólido es estrecha
                    const pal = s.split(' '), k = max(1, pal.findIndex(w => /\d/.test(w)) - 1);
                    textAlign(RIGHT, BASELINE); sombra(colRegion('solid'));
                    text(pal.slice(0, k).join(' '), dx(T) - 8, dy(1) - 24);
                    text(pal.slice(k).join(' '), dx(T) - 8, dy(1) - 9);
                }
                else {
                    sombra(colRegion('gas'));
                    if (dx(T) + 4 + textWidth(s) > DPLOT.x1 - 4) { textAlign(RIGHT, BASELINE); text(s, dx(T) - 4, dy(1) + 20); }
                    else { textAlign(LEFT, BASELINE); text(s, dx(T) + 4, dy(1) + 20); }
                }
                noStroke();
            }
        }
    }
    // Punto triple
    const brilla = cel && cel.tipo === 'triple';
    if (brilla) { noStroke(); fill(255, 216, 74, 120); circle(dx(dg.tt), dy(pt), 34 + 4 * sin(millis() / 200)); }
    stroke(ink); strokeWeight(2.5); fill(THEME.change || '#ffd84a'); circle(dx(dg.tt), dy(pt), m ? 14 : 16);
    textFont('Fredoka'); textStyle(BOLD); textSize(m ? 12 : 14); textAlign(LEFT, BASELINE);
    fill(papelClaro() ? '#6b4e00' : THEME.change); sombra(colRegion('gas'));
    text(i18n.t('punto triple'), dx(dg.tt) + 12, dy(pt) + (m ? -8 : 5));
    noStroke();

    // Ejes
    textFont(FUENTE_TEXTO); textStyle(NORMAL); fill(pInk); textSize(m ? 11.5 : 13);
    textAlign(CENTER, BASELINE); marcasT.forEach(T => text(fmtT(T), dx(T), y1 + 18));
    textAlign(RIGHT, BASELINE); marcasP.forEach(P => text(fmtP(P), x0 - 6, dy(P) + 4));
    textStyle(BOLD); textSize(m ? 13 : 14); textAlign(CENTER, BASELINE);
    text(i18n.t('Temperatura (°C)'), (x0 + x1) / 2, y1 + (m ? 38 : 42));
    textAlign(LEFT, BASELINE); textSize(m ? 13 : 14);
    const t1 = i18n.t('↑ Presión (atm) · '), t2 = i18n.t('escala comprimida');
    text(t1, X + 18, y0 - 14);
    fill(papelClaro() ? '#8a2d1d' : THEME.heat || '#ff7a59'); text(t2, X + 18 + textWidth(t1), y0 - 14);
    textStyle(NORMAL);

    drawRastroYPuntoF(sit, cel);
}

// Tramo de una línea alrededor de (T, P), en píxeles
function tramoLinea(tipo, T, P) {
    const pts = [], pt = pTriple();
    if (tipo === 'fusion') {
        const lr = Math.log(dg.pMax / dg.pMin) * 0.1;
        for (let k = -1; k <= 1.0001; k += 0.1) {
            const p = Math.exp(Math.log(P) + k * lr);
            if (p < pt || p > dg.pMax) continue;
            pts.push([dx(tFus(p)), dy(p)]);
        }
        return pts;
    }
    const r = (dg.tMax - dg.tMin) * 0.075;
    const [a, b] = tipo === 'vaporizacion' ? [dg.tt, dg.tMax] : [dg.tMin, dg.tt];
    for (let k = -1; k <= 1.0001; k += 0.05) {
        const t = T + k * r;
        if (t < a || t > b) continue;
        const p = tipo === 'vaporizacion' ? pVap(t) : pSub(t);
        if (p < dg.pMin || p > dg.pMax) continue;
        pts.push([dx(t), dy(p)]);
    }
    return pts;
}

function rotuloLinea(txt, curva, u, desplaz, fs, halo) {
    const [xa, ya] = curva(u - 0.02), [xb, yb] = curva(u + 0.02), [xm, ym] = curva(u);
    if (ym < DPLOT.y0 + 10 || ym > DPLOT.y1 - 10 || xm < DPLOT.x0 + 10 || xm > DPLOT.x1 - 10) return;
    let ang = Math.atan2(yb - ya, xb - xa);
    if (ang > HALF_PI) ang -= PI;
    if (ang < -HALF_PI) ang += PI;
    push();
    translate(xm, ym); rotate(ang);
    textFont('Fredoka'); textStyle(BOLD); textSize(fs); textAlign(CENTER, CENTER);
    stroke(halo); strokeWeight(5); strokeJoin(ROUND); fill(THEME.paperInk || '#24323f');
    text(txt, 0, desplaz);
    pop();
    textStyle(NORMAL);
}

function chispa(x, y, r) {
    stroke(THEME.ink || '#061523'); strokeWeight(1.8); fill(THEME.change || '#ffd84a');
    beginShape();
    for (let i = 0; i < 8; i++) { const a = i * PI / 4, rr = i % 2 ? r * 0.42 : r; vertex(x + cos(a) * rr, y + sin(a) * rr); }
    endShape(CLOSE);
}

function drawRastroYPuntoF(sit, cel) {
    const { x0, x1, y0, y1 } = DPLOT, m = FX.movil;
    const X = FX.diag.x;
    const x = dx(fT), y = dy(fP);
    const ult = rastro[rastro.length - 1];
    if (!ult || dist(ult[0], ult[1], x, y) > 2) {
        rastro.push([x, y]);
        if (rastro.length > 300) rastro.shift();
    }
    const ctx = drawingContext;

    // Camino recorrido: punteado, con círculo de salida y flecha
    if (rastro.length > 1) {
        let fin = rastro.length - 1;
        while (fin > 0 && dist(rastro[fin][0], rastro[fin][1], x, y) < 26) fin--;
        if (fin > 0) {
            noFill(); stroke('#1d6fa5'); strokeWeight(1.6 + 1.9);
            ctx.setLineDash([2, 6]); strokeCap(ROUND);
            beginShape(); for (let i = 0; i <= fin; i++) vertex(rastro[i][0], rastro[i][1]); endShape();
            ctx.setLineDash([3, 3]); strokeWeight(2.5);
            circle(rastro[0][0], rastro[0][1], 18);
            ctx.setLineDash([]);
            const [ax, ay] = rastro[fin], [bx, by] = rastro[max(0, fin - 3)];
            const ang = Math.atan2(ay - by, ax - bx);
            push(); translate(ax, ay); rotate(ang); noStroke(); fill('#1d6fa5'); triangle(6, 0, -5, -5, -5, 5); pop();
        }
    }

    // Guías hasta los ejes
    const pw = m ? 80 : 92;
    stroke('#0a6d8f'); strokeWeight(1.6); ctx.setLineDash([5, 5]);
    line(x, y, x, y1); line(x, y, X + 6 + pw, y);
    ctx.setLineDash([]);

    // Celebración: anillo y chispas
    if (cel) {
        const r = m ? 24 : 30, k = salto(celebraDesde);
        push(); translate(x, y); scale(k);
        noFill(); stroke(THEME.change || '#ffd84a'); strokeWeight(4); circle(0, 0, 2 * r);
        stroke(THEME.ink || '#061523'); strokeWeight(1.5); ctx.setLineDash([4, 4]); circle(0, 0, 2 * r); ctx.setLineDash([]);
        chispa(r, -(m ? 16 : 20), m ? 8 : 10);
        chispa(-(m ? 22 : 28), m ? 18 : 22, m ? 6 : 8);
        pop();
    }

    // Punto arrastrable
    noStroke(); fill(0, 200, 255, 72); circle(x, y, m ? 38 : 44);
    stroke(THEME.ink || '#061523'); strokeWeight(3); fill(THEME.accent || '#00c8ff'); circle(x, y, m ? 24 : 28);
    noStroke(); fill(255, 255, 255, 204); circle(x - 4, y - 4, 7);

    // Insignias en los ejes
    insigniaF(fmtT(fT) + ' °C', x, y1, CENTER, 68);
    insigniaF(fmtP(fP) + ' atm', X + 6, y, LEFT, pw);

    // Sello del cambio
    if (cel) drawSelloF(cel, x, y);

    cursor(dist(mouseX, mouseY, x, y) < 22 || arrastrando ? 'grab' : (dentroDiagrama(mouseX, mouseY) ? 'crosshair' : ARROW));
}

function insigniaF(txt, x, y, alin, wMin) {
    textFont('Fredoka'); textStyle(BOLD); textSize(FX.movil ? 13 : 14);
    const w = max(wMin, textWidth(txt) + 20);
    const xr = alin === CENTER ? x - w / 2 : x;
    stroke(THEME.ink || '#061523'); strokeWeight(2); fill(THEME.accent || '#00c8ff');
    rect(xr, y - 13, w, 26, 13);
    noStroke(); fill(THEME.ink || '#061523'); textAlign(CENTER, CENTER); text(txt, xr + w / 2, y + 1);
    textStyle(NORMAL);
}

function drawSelloF(cel, px, py) {
    const { x0, x1, y0, y1 } = DPLOT, m = FX.movil;
    const titulo = nombreCambio(cel), sub = fraseCambio(cel);
    textFont('Fredoka'); textStyle(BOLD); textSize(m ? 18 : 22);
    const wT = textWidth(titulo);
    textFont(FUENTE_TEXTO); textStyle(BOLD); textSize(m ? 13 : 15);
    const sw = max(m ? 160 : 224, wT + 40, textWidth(sub) + 36), sh = m ? 56 : 64;
    // A la derecha y algo por debajo del punto; si no cabe, al otro lado
    let sx = px + 150, sy = py + 44;
    if (sx + sw / 2 > x1 - 6) sx = px - 150;
    sx = constrain(sx, x0 + sw / 2 + 6, x1 - sw / 2 - 6);
    sy = constrain(sy, y0 + sh / 2 + 8, y1 - sh / 2 - 8);
    if (dist(sx, sy, px, py) < 70) sy = py + (py > (y0 + y1) / 2 ? -90 : 90);
    const k = salto(celebraDesde);
    push();
    translate(sx, sy); rotate(radians(-5)); scale(k);
    stroke('#a5281b'); strokeWeight(3.5); fill('#fff6d6'); rect(-sw / 2, -sh / 2, sw, sh, 10);
    noStroke(); fill('#a5281b'); textFont('Fredoka'); textStyle(BOLD); textSize(m ? 18 : 22); textAlign(CENTER, BASELINE);
    text(titulo, 0, m ? 0 : 2);
    fill('#5a1a10'); textFont(FUENTE_TEXTO); textSize(m ? 13 : 15);
    text(sub, 0, m ? 20 : 24);
    pop();
    textStyle(NORMAL);
}

// ── Panel de estado + «A esta presión…» ──────────────────────────
function drawPanelFases(msg) {
    const { x, y, w, h } = FX.panel, m = FX.movil;
    const ink = THEME.ink || '#061523';
    if (THEME.fun) { noStroke(); fill(ink); rect(x + 4, y + 5, w, h, 20); }
    stroke(THEME.border); strokeWeight(1.5); fill(THEME.hundido || THEME.panelBg); rect(x, y, w, h, 20);
    const px = x + 24, aw = w - 48;

    // Rótulo (da un pequeño salto al cambiar)
    if (msg.tag !== rotuloTag) { rotuloTag = msg.tag; rotuloDesde = millis(); }
    textFont('Fredoka'); textStyle(BOLD); textSize(16);
    const tw = textWidth(msg.tag) + 34;
    push(); translate(px + tw / 2, y + 33); scale(salto(rotuloDesde));
    stroke(ink); strokeWeight(2.5); fill(msg.col); rect(-tw / 2, -15, tw, 30, 15);
    noStroke(); fill(lightness(color(msg.col)) > 55 ? ink : '#ffffff'); textAlign(CENTER, CENTER); text(msg.tag, 0, 1);
    pop();

    // Mensaje y «A esta presión…»: se reduce la letra si no cabe
    const rico = trozosRicos(textoAEstaPresion());
    let fs = m ? 17 : 19, fr = m ? 16 : 17, lin, linR;
    for (let i = 0; i < 6; i++) {
        textFont('Fredoka'); textStyle(NORMAL); textSize(fs); lin = partirLineas(msg.txt, aw);
        textFont(FUENTE_TEXTO); textSize(fr); linR = partirRico(rico, aw);
        const alto = 62 + lin.length * fs * 1.36 + 10 + 22 + linR.length * fr * 1.3 + 8;
        if (alto <= h) break;
        fs -= 1.2; fr -= 0.8;
    }
    textFont('Fredoka'); textStyle(NORMAL); textSize(fs); noStroke(); fill(THEME.text); textAlign(LEFT, TOP);
    let yy = y + 60;
    lin.forEach(l => { text(l, px, yy); yy += fs * 1.36; });
    yy += 6;
    stroke(THEME.border); strokeWeight(1.5); line(px, yy, x + w - 24, yy);
    yy += 10;
    noStroke(); fill(THEME.textDim); textFont(FUENTE_TEXTO); textSize(14);
    text(i18n.t('A esta presión, la sustancia…'), px, yy);
    yy += 22;
    textSize(fr); fill(THEME.text);
    linR.forEach(l => {
        let xx = px;
        for (const t of l) { textStyle(t.b ? BOLD : NORMAL); text(t.s, xx, yy); xx += textWidth(t.s); }
        yy += fr * 1.3;
    });
    textStyle(NORMAL);
}

// Texto con <strong> → trozos { s, b }
function trozosRicos(html) {
    const out = [];
    String(html).split(/(<strong>|<\/strong>)/).reduce((neg, parte) => {
        if (parte === '<strong>') return true;
        if (parte === '</strong>') return false;
        if (parte) out.push({ s: parte.replace(/<[^>]+>/g, ''), b: neg });
        return neg;
    }, false);
    return out;
}
// Parte los trozos en líneas (palabra a palabra)
function partirRico(trozos, w) {
    const palabras = [];
    trozos.forEach(t => t.s.replace(/ (°C|atm)/g, '\u00a0$1').split(/([ \t\n]+)/).forEach(p => { if (p) palabras.push({ s: p, b: t.b }); }));
    const lineas = []; let l = [], ancho = 0;
    for (const p of palabras) {
        textStyle(p.b ? BOLD : NORMAL);
        const wp = textWidth(p.s);
        if (/^[ \t\n]+$/.test(p.s)) { if (l.length) { l.push(p); ancho += wp; } continue; }
        if (ancho + wp > w && l.length) {
            while (l.length && /^[ \t\n]+$/.test(l[l.length - 1].s)) l.pop();
            lineas.push(l); l = []; ancho = 0;
        }
        l.push(p); ancho += wp;
    }
    if (l.length) lineas.push(l);
    textStyle(NORMAL);
    return lineas;
}

// ── Modelo de moléculas + leyenda ────────────────────────────────
function drawModeloFases(sit) {
    drawParticleWindow();
    const { cx, cy, r } = MODELO;
    noFill();
    stroke(THEME.ink || '#061523'); strokeWeight(8); circle(cx, cy, 2 * r);
    stroke(THEME.fun ? '#3e6688' : THEME.border); strokeWeight(2.5); circle(cx, cy, 2 * r);

    // Rótulo del modelo
    const R = FX.rotulo;
    stroke(THEME.accent); strokeWeight(2.5); fill(THEME.hundido || THEME.panelBg); rect(R.x, R.y, R.w, R.h, R.h / 2);
    noStroke(); fill(THEME.text); textFont('Fredoka'); textStyle(BOLD); textSize(R.fs); textAlign(CENTER, CENTER);
    text(i18n.t('Modelo: así imaginamos las moléculas'), R.x + R.w / 2, R.y + R.h / 2 + 1);
    textStyle(NORMAL);

    // Leyenda
    const L = FX.leyenda, fs = L.fs;
    const items = [];
    const largo = { solid: 'Moléculas ordenadas, solo vibran.', liquid: 'Moléculas juntas, pero se deslizan.', gas: 'Moléculas separadas, libres y rápidas.' };
    const corto = { solid: 'Ordenadas, solo vibran.', liquid: 'Juntas, pero se deslizan.', gas: 'Separadas, libres, rápidas.' };
    const nombre = { solid: 'Sólido', liquid: 'Líquido', gas: 'Gas' };
    if (sit.tipo) {
        sit.fases.forEach(f => items.push({ col: THEME[f], on: true, n: nombre[f], d: largo[f] }));
        items.push({ anillo: true, on: true, n: 'Cambian de estado', d: sit.tipo === 'vaporizacion' || sit.tipo === 'sublimacion' ? 'Unas escapan, otras vuelven.' : 'Unas cambian, otras vuelven.' });
    } else {
        const f = sit.fases[0];
        items.push({ col: THEME[f], on: true, n: nombre[f], d: largo[f] });
        ['liquid', 'solid', 'gas'].filter(s => s !== f).forEach(s => items.push({ on: false, n: nombre[s], d: corto[s] }));
    }
    const paso = items.length > 3 ? fs * 3.5 : fs * 4.3;
    let yy = L.y;
    for (const it of items) {
        if (it.anillo) {
            noFill(); stroke(THEME.change); strokeWeight(3); drawingContext.setLineDash([4, 3]);
            circle(L.x + 8, yy - 5, 16); drawingContext.setLineDash([]);
        } else {
            stroke(it.on ? (THEME.ink || '#061523') : THEME.textDim); strokeWeight(2);
            if (it.on) fill(it.col); else noFill();
            circle(L.x + 8, yy - 5, 16);
        }
        noStroke(); textFont('Fredoka'); textStyle(BOLD); textSize(fs + 2); textAlign(LEFT, BASELINE);
        fill(it.anillo ? THEME.change : it.on ? it.col : THEME.textDim);
        text(i18n.t(it.n), L.x + 24, yy);
        textFont(FUENTE_TEXTO); textStyle(NORMAL); textSize(fs - 1.5); fill(it.on ? THEME.text : THEME.textDim);
        partirLineas(i18n.t(it.d), L.w - 24).slice(0, 2).forEach((l, i) => text(l, L.x + 24, yy + fs + 5 + i * (fs + 3)));
        yy += paso;
    }
    textStyle(NORMAL);
}

// ── «Piensa y comprueba» ─────────────────────────────────────────
function drawPiensa() {
    const { x, y, w, h } = FX.piensa, m = FX.movil;
    tarjetaF({ x, y, w, h }, THEME.panelBg);
    textFont('Fredoka'); textStyle(BOLD); textSize(18); noStroke(); fill(THEME.text); textAlign(LEFT, BASELINE);
    text(i18n.t('Piensa y comprueba'), x + 22, y + 30);
    textStyle(NORMAL);
    const lista = RETOS_TXT[claveDiagrama()].map(t => i18n.t(t));
    let fs = m ? 15 : 14, bloques;
    for (let i = 0; i < 5; i++) {
        textFont(FUENTE_TEXTO); textSize(fs);
        bloques = lista.map(t => partirLineas(t, w - 52 - 16));
        const alto = (m ? 50 : 46) + bloques.reduce((a, b) => a + b.length * fs * 1.25 + (m ? 12 : 8), 0);
        if (alto <= h) break;
        fs -= 0.7;
    }
    const lh = fs * 1.25;
    let yy = y + (m ? 58 : 54);
    bloques.forEach((ls, i) => {
        noFill(); stroke(THEME.textDim); strokeWeight(2); circle(x + 32, yy - 5, 20);
        noStroke(); fill(THEME.textDim); textFont('Fredoka'); textStyle(BOLD); textSize(13); textAlign(CENTER, BASELINE);
        text(String(i + 1), x + 32, yy);
        textFont(FUENTE_TEXTO); textStyle(NORMAL); textSize(fs); fill(THEME.text); textAlign(LEFT, BASELINE);
        ls.forEach((l, k) => text(l, x + 52, yy + k * lh));
        yy += ls.length * lh + (m ? 12 : 8);
    });
}
