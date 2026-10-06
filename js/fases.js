// ═══════════════════════════════════════════════════════════════════
//  MODO DIAGRAMA DE FASES (presión y temperatura)
//
//  Diagrama esquemático para la ESO. Las curvas se calculan con una
//  aproximación sencilla (tipo Clausius-Clapeyron) ajustada a valores
//  reales conocidos: punto triple, 100 °C a 1 atm, 70 °C en el Everest,
//  −78 °C para el hielo seco… La escala de presión es logarítmica
//  ("comprimida") para que quepan valores muy pequeños y muy grandes.
// ═══════════════════════════════════════════════════════════════════

const DIAGRAMAS = {
    agua: {
        nombre: 'agua',
        tMin: -40, tMax: 160, pMin: 0.003, pMax: 5,
        tt: 0.01,                          // temperatura del punto triple (°C)
        vap: { T: 100, P: 1, k: 4900 },    // curva de vaporización: pasa por (100 °C, 1 atm)
        kSub: 6140,                        // pendiente de la curva de sublimación
        pendFus: -0.0075,                  // °C por atm de la línea de fusión
        rotuloSub: null,                   // la curva de sublimación apenas se ve: sin rótulo
        marcasP: [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
        rotulos: { solid: { T: -24, P: 0.6 }, liquid: { T: 48, P: 2.4 }, gas: { T: 104, P: 0.03 } },
        ejemplos: [
            { txt: 'Nivel del mar',    sub: '1 atm · 20 °C',    T: 20, P: 1 },
            { txt: 'Cima del Everest', sub: '0.33 atm · 20 °C', T: 20, P: 0.33 },
            { txt: 'Olla a presión',   sub: '2 atm · 20 °C',    T: 20, P: 2 },
            { txt: 'Punto triple',     sub: '0.006 atm · 0 °C', triple: true },
        ],
        hint: 'A 1 atm el agua funde a 0 °C y hierve a 100 °C. ¿Y si cambia la presión?',
    },
    co2: {
        nombre: 'CO₂',
        tMin: -120, tMax: 30, pMin: 0.3, pMax: 100,
        tt: -56.6,
        vap: { T: -56.6, P: 5.11, k: 2000 },   // llega al punto crítico (31 °C, 73 atm)
        kSub: 3135,                            // pasa por (−78.5 °C, 1 atm)
        pendFus: 0.02,
        rotuloSub: 0.84,                   // posición (0–1) del rótulo sobre la curva de sublimación
        marcasP: [0.5, 1, 2, 5, 10, 20, 50, 100],
        rotulos: { solid: { T: -98, P: 20 }, liquid: { T: -12, P: 55 }, gas: { T: -2, P: 1.6 } },
        ejemplos: [
            { txt: 'Hielo seco',      sub: '1 atm · −100 °C', T: -100, P: 1 },
            { txt: 'Aire libre',      sub: '1 atm · 20 °C',   T: 20, P: 1 },
            { txt: 'Extintor de CO₂', sub: '65 atm · 20 °C',  T: 20, P: 65 },
            { txt: 'Punto triple',    sub: '5.1 atm · −57 °C', triple: true },
        ],
        hint: 'A 1 atm el CO₂ nunca es líquido: el hielo seco pasa directamente a gas a −78 °C.',
    },
};

// Panel y área del diagrama en el canvas
const DIAG = { x: 20, y: 72, w: 612, h: 616 };
const DPLOT = { x0: 100, x1: 612, y0: 108, y1: 624 };

let dg = DIAGRAMAS.agua;   // diagrama actual
let fT = 20, fP = 1;       // punto actual
let arrastrando = false;
let rastro = [];           // camino recorrido por el punto


// ─── Curvas del diagrama ─────────────────────────────────────────
const K0 = 273.15;
function pVap(T, d = dg) { return d.vap.P * Math.exp(d.vap.k * (1 / (d.vap.T + K0) - 1 / (T + K0))); }
function pTriple(d = dg) { return pVap(d.tt, d); }
function pSub(T, d = dg) { return pTriple(d) * Math.exp(d.kSub * (1 / (d.tt + K0) - 1 / (T + K0))); }
function tFus(P, d = dg) { return d.tt + d.pendFus * (P - pTriple(d)); }

// Inversas: temperatura de ebullición / sublimación a una presión dada
function tVap(P, d = dg) { return 1 / (1 / (d.vap.T + K0) - Math.log(P / d.vap.P) / d.vap.k) - K0; }
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


// ═══════════════════════════════════════════════════════════════════
//  CONTROLES
// ═══════════════════════════════════════════════════════════════════
function setupFasesControls() {
    document.getElementById('select-fases-sustancia')
        .addEventListener('change', (e) => cambiarDiagrama(e.target.value));

    const slT = document.getElementById('slider-fases-T');
    const slP = document.getElementById('slider-fases-P');
    slT.addEventListener('input', () => { fijarPunto(parseFloat(slT.value), fP, false); marcarEjemplo(-1); });
    slP.addEventListener('input', () => { fijarPunto(fT, presionDeSlider(slP.value), false); marcarEjemplo(-1); });

    cambiarDiagrama('agua');
}

function cambiarDiagrama(clave) {
    dg = DIAGRAMAS[clave];
    document.getElementById('fases-hint').textContent = dg.hint;

    const slT = document.getElementById('slider-fases-T');
    slT.min = dg.tMin; slT.max = dg.tMax;
    document.getElementById('min-fases-T').textContent = fmtT(dg.tMin) + ' °C';
    document.getElementById('max-fases-T').textContent = fmtT(dg.tMax) + ' °C';
    document.getElementById('min-fases-P').textContent = fmtP(dg.pMin) + ' atm';
    document.getElementById('max-fases-P').textContent = fmtP(dg.pMax) + ' atm';

    const caja = document.getElementById('fases-ejemplos');
    caja.innerHTML = '';
    dg.ejemplos.forEach((ej, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'preset-btn';
        b.innerHTML = `${ej.txt}<small>${ej.sub}</small>`;
        b.addEventListener('click', () => aplicarEjemplo(i));
        caja.appendChild(b);
    });

    rastro = [];
    aplicarEjemplo(0);
}

function aplicarEjemplo(i) {
    const ej = dg.ejemplos[i];
    if (ej.triple) fijarPunto(dg.tt, pTriple(), true);
    else fijarPunto(ej.T, ej.P, true);
    marcarEjemplo(i);
}

function marcarEjemplo(i) {
    document.querySelectorAll('#fases-ejemplos .preset-btn')
        .forEach((b, k) => b.classList.toggle('active', k === i));
}

// Fija el punto del diagrama. "salto" indica que no viene de un movimiento continuo.
function fijarPunto(T, P, salto) {
    fT = constrain(T, dg.tMin, dg.tMax);
    fP = constrain(P, dg.pMin, dg.pMax);
    if (salto) rastro = [];

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
    document.getElementById('metric-fases-T').textContent = fmtT(fT);
    document.getElementById('metric-fases-P').textContent = fmtP(fP);

    const f = faseEn(fT, fP);
    const el = document.getElementById('metric-fases-estado');
    el.textContent = { solid: 'Sólido', liquid: 'Líquido', gas: 'Gas' }[f];
    el.className = 'estado-value st-' + f;

    document.getElementById('fases-a-esta-presion').innerHTML = textoAEstaPresion();
}

// Explicación de qué cambios de estado ocurren a la presión actual.
function textoAEstaPresion() {
    const pt = pTriple();
    const P = fmtP(fP) + ' atm';
    if (Math.abs(Math.log(fP / pt)) < 0.03) {
        return `A ${P} estás en el <strong>punto triple</strong>: a ${fmtT(dg.tt)} °C pueden existir a la vez sólido, líquido y gas.`;
    }
    if (fP < pt) {
        return `A ${P} <strong>no puede ser líquida</strong>: al calentarla pasa directamente de sólido a gas ` +
               `(sublimación) a <strong>${fmtT(tSub(fP))} °C</strong>.`;
    }
    const teb = tVap(fP);
    const hierve = teb > dg.tMax ? `por encima de <strong>${fmtT(dg.tMax)} °C</strong>`
                                 : `a <strong>${fmtT(teb)} °C</strong>`;
    return `A ${P} funde a <strong>${fmtT(tFus(fP))} °C</strong> y hierve ${hierve}.`;
}

function fmtP(P) {
    if (P < 0.1)  return P.toFixed(3);
    if (P < 10)   return P.toFixed(2);
    return P.toFixed(0);
}


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

function moverPuntoAlRaton() {
    fijarPunto(tDeX(mouseX), pDeY(mouseY), false);
    marcarEjemplo(-1);
}


// ═══════════════════════════════════════════════════════════════════
//  DIBUJO DEL DIAGRAMA
// ═══════════════════════════════════════════════════════════════════
function drawFasesMode() {
    drawPanelFrame(DIAG, 'DIAGRAMA DE FASES', `del ${dg.nombre} (esquemático)`);

    const { x0, x1, y0, y1 } = DPLOT;
    const pt = pTriple();

    // Curvas como listas de puntos (en píxeles, recortadas al área del diagrama)
    const sub = [], vap = [], fus = [];
    for (let T = dg.tMin; T <= dg.tt; T += (dg.tt - dg.tMin) / 60) sub.push([dx(T), dyc(pSub(T))]);
    sub.push([dx(dg.tt), dyc(pt)]);
    for (let T = dg.tt; T <= dg.tMax; T += (dg.tMax - dg.tt) / 80) vap.push([dx(T), dyc(pVap(T))]);
    vap.push([dx(dg.tMax), dyc(pVap(dg.tMax))]);
    for (let i = 0; i <= 40; i++) {
        const P = Math.exp(lerp(Math.log(pt), Math.log(dg.pMax), i / 40));
        fus.push([dx(tFus(P)), dyc(P)]);
    }

    // Regiones coloreadas
    noStroke();
    fill(conAlfa(THEME.gas, 45));
    poligono([[x0, y1], ...sub, ...vap, [x1, y1]]);
    fill(conAlfa(THEME.solid, 45));
    poligono([[x0, y0], [x0, sub[0][1]], ...sub, ...fus]);
    fill(conAlfa(THEME.liquid, 45));
    poligono([...fus, [x1, y0], ...[...vap].reverse()]);

    drawEjesFases();

    // Línea de 1 atm
    const y1atm = dy(1);
    stroke(THEME.textDim); strokeWeight(1.2);
    drawingContext.setLineDash([6, 5]);
    line(x0, y1atm, x1, y1atm);
    drawingContext.setLineDash([]);
    // El rótulo va justo a la derecha del primer cruce con 1 atm, donde siempre hay sitio
    const xRot = dx(1 > pt ? tFus(1) : tSub(1)) + 8;
    noStroke(); fill(THEME.textDim); textSize(11); textAlign(LEFT, BOTTOM);
    text('1 atm (nivel del mar)', xRot, y1atm - 4);

    // Fronteras
    noFill(); stroke(THEME.text); strokeWeight(2.5);
    polilinea(sub); polilinea(vap); polilinea(fus);

    drawRotulosFases();
    drawPuntosNotables();
    drawRastroYPunto();
}

function drawEjesFases() {
    const { x0, x1, y0, y1 } = DPLOT;
    textSize(11);
    const paso = escalaPaso(dg.tMax - dg.tMin);
    for (let T = Math.ceil(dg.tMin / paso) * paso; T <= dg.tMax; T += paso) {
        stroke(THEME.grid); strokeWeight(1);
        line(dx(T), y0, dx(T), y1);
        noStroke(); fill(THEME.textDim); textAlign(CENTER, TOP);
        text(fmtT(T), dx(T), y1 + 6);
    }
    for (const P of dg.marcasP) {
        stroke(THEME.grid); strokeWeight(1);
        line(x0, dy(P), x1, dy(P));
        noStroke(); fill(THEME.textDim); textAlign(RIGHT, CENTER);
        text(fmtP(P), x0 - 8, dy(P));
    }
    stroke(THEME.axis); strokeWeight(1.5);
    line(x0, y0, x0, y1); line(x0, y1, x1, y1);

    noStroke(); fill(THEME.textDim); textSize(12);
    textAlign(CENTER, TOP);
    text('Temperatura (°C)', (x0 + x1) / 2, y1 + 24);
    push();
    translate(DIAG.x + 16, (y0 + y1) / 2);
    rotate(-HALF_PI);
    textAlign(CENTER, CENTER);
    text('Presión (atm) · escala comprimida', 0, 0);
    pop();
}

function drawRotulosFases() {
    // Nombre de cada región
    textStyle(BOLD); textSize(20); textAlign(CENTER, CENTER); noStroke();
    for (const st of ['solid', 'liquid', 'gas']) {
        const r = dg.rotulos[st];
        fill(THEME[st]);
        text({ solid: 'SÓLIDO', liquid: 'LÍQUIDO', gas: 'GAS' }[st], dx(r.T), dy(r.P));
    }
    textStyle(NORMAL);

    // Nombre de cada frontera, girado según la curva
    rotuloCurva('fusión ⇄ solidificación',
        (u) => { const P = Math.exp(lerp(Math.log(pTriple()), Math.log(dg.pMax), u)); return [dx(tFus(P)), dy(P)]; }, 0.62, 10);
    rotuloCurva('vaporización ⇄ condensación',
        (u) => { const T = lerp(dg.tt, dg.tMax, u); return [dx(T), dy(pVap(T))]; }, dg === DIAGRAMAS.agua ? 0.5 : 0.55, -10);
    if (dg.rotuloSub) rotuloCurva('sublimación ⇄ sublimación inversa',
        (u) => { const T = lerp(dg.tMin, dg.tt, u); return [dx(T), dy(pSub(T))]; }, dg.rotuloSub, -10);
}

// Escribe un texto paralelo a una curva paramétrica, en la posición u (0–1).
function rotuloCurva(txt, curva, u, desplaz) {
    const [xa, ya] = curva(u - 0.02), [xb, yb] = curva(u + 0.02), [xm, ym] = curva(u);
    if (ym < DPLOT.y0 + 10 || ym > DPLOT.y1 - 10) return;
    let ang = Math.atan2(yb - ya, xb - xa);
    if (ang > HALF_PI) ang -= PI;
    if (ang < -HALF_PI) ang += PI;
    push();
    translate(xm, ym);
    rotate(ang);
    textSize(11); textAlign(CENTER, CENTER); textStyle(BOLD);
    stroke(THEME.canvasBg); strokeWeight(4); fill(THEME.text);
    text(txt, 0, desplaz);
    pop();
    textStyle(NORMAL);
}

function drawPuntosNotables() {
    const pt = pTriple();
    // Punto triple
    stroke(THEME.canvasBg); strokeWeight(2); fill(THEME.change);
    circle(dx(dg.tt), dy(pt), 10);
    noStroke(); fill(THEME.change); textSize(11); textAlign(LEFT, TOP); textStyle(BOLD);
    text('punto triple', dx(dg.tt) + 8, dy(pt) + 4);
    textStyle(NORMAL);

    // Cruces con la línea de 1 atm
    const marcas = 1 > pt
        ? [[tFus(1), 'funde'], [tVap(1), 'hierve']]
        : [[tSub(1), 'sublima']];
    for (const [T, verbo] of marcas) {
        if (T < dg.tMin || T > dg.tMax) continue;
        stroke(THEME.canvasBg); strokeWeight(2); fill(THEME.text);
        circle(dx(T), dy(1), 8);
        noStroke(); fill(THEME.text); textSize(11); textAlign(LEFT, TOP);
        text(`${verbo} a ${fmtT(T)} °C`, dx(T) + 6, dy(1) + 5);
    }
}

function drawRastroYPunto() {
    const x = dx(fT), y = dy(fP);
    const ult = rastro[rastro.length - 1];
    if (!ult || dist(ult[0], ult[1], x, y) > 2) {
        rastro.push([x, y]);
        if (rastro.length > 300) rastro.shift();
    }

    // Camino recorrido
    noFill(); strokeWeight(2);
    for (let i = 1; i < rastro.length; i++) {
        stroke(conAlfa(THEME.accent, 40 + 160 * i / rastro.length));
        line(rastro[i - 1][0], rastro[i - 1][1], rastro[i][0], rastro[i][1]);
    }

    // Guías hasta los ejes
    stroke(conAlfa(THEME.accent, 150)); strokeWeight(1);
    drawingContext.setLineDash([3, 4]);
    line(x, y, x, DPLOT.y1); line(x, y, DPLOT.x0, y);
    drawingContext.setLineDash([]);

    // Punto
    const col = THEME[faseEn(fT, fP)];
    noStroke(); fill(conAlfa(col, 70));
    circle(x, y, 30);
    stroke(THEME.canvasBg); strokeWeight(2.5); fill(THEME.accent);
    circle(x, y, 14);

    // Etiquetas de los valores en los ejes
    etiquetaEje(fmtT(fT) + ' °C', x, DPLOT.y1 - 12, CENTER);
    etiquetaEje(fmtP(fP) + ' atm', DPLOT.x0 + 4, y - 11, LEFT);

    cursor(dist(mouseX, mouseY, x, y) < 18 || arrastrando ? 'grab' : (dentroDiagrama(mouseX, mouseY) ? 'crosshair' : ARROW));
}

function etiquetaEje(txt, x, y, alin) {
    textSize(11); textStyle(BOLD);
    const w = textWidth(txt) + 10;
    const xr = alin === CENTER ? x - w / 2 : x;
    noStroke(); fill(THEME.accent);
    rect(xr, y - 8, w, 17, 4);
    fill(THEME.canvasBg); textAlign(CENTER, CENTER);
    text(txt, xr + w / 2, y + 1);
    textStyle(NORMAL);
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
