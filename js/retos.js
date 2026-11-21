// ═══════════════════════════════════════════════════════════════════
//  RETOS Y ÁLBUM DE CAMBIOS (opcionales)
//
//  Ocultos por defecto: el botón «★ Retos» los despliega (o ?retos=1 en la
//  dirección). Al volver a abrir la simulación aparecen otra vez ocultos.
//  Lo conseguido se guarda en este navegador con localStorage (sin cookies y
//  sin enviar nada a ningún sitio). «Borrar lo conseguido» lo vacía.
// ═══════════════════════════════════════════════════════════════════

const RETOS_CLAVE = 'simulaciencia-cambios-estado-retos';

// Sellos del álbum: un cambio de estado de una sustancia, visto de verdad
const ALBUM_SUSTANCIAS = ['agua', 'alcohol', 'nitrogeno', 'hierro'];
const ALBUM_CAMBIOS = [
    { id: 'fusion',         nombre: 'Fusión',         corto: 'S→L', col: '#ffd84a' },
    { id: 'solidificacion', nombre: 'Solidificación', corto: 'L→S', col: '#86c8ff' },
    { id: 'vaporizacion',   nombre: 'Vaporización',   corto: 'L→G', col: '#ff9a4a' },
    { id: 'condensacion',   nombre: 'Condensación',   corto: 'G→L', col: '#2ee6a6' },
];
const ALBUM_HIELO_SECO = [
    { id: 'sublimacion',         nombre: 'Sublimación',         corto: 'S→G', col: '#d7c6ff' },
    { id: 'sublimacionInversa', nombre: 'Sublimación inversa', corto: 'G→S', col: '#b9a3f5' },
];
// El yodo solo aparece en «Presión y temperatura»
const ALBUM_YODO = ALBUM_HIELO_SECO;
const ALBUM_TOTAL = ALBUM_SUSTANCIAS.length * ALBUM_CAMBIOS.length + ALBUM_HIELO_SECO.length + ALBUM_YODO.length;
function nombreAlbum(sc) { return sc === 'yodo' ? i18n.t('Yodo (I₂)') : i18n.t(SUSTANCIAS[sc].nombre); }

// Retos del modo «Presión y temperatura» (se guardan juntos, con la clave 'fases')
const RETOS_FASES = [
    'Haz que el agua hierva sin calentarla',
    'Busca a qué temperatura hierve el agua en la cima del Everest',
    'Lleva el agua justo al punto triple (sin el botón de ejemplo)',
    'Consigue CO₂ líquido, como en un extintor',
    'Sublima yodo sin que llegue a fundirse',
];

// Temperatura objetivo del reto «déjalo justo a…» (dentro del tramo líquido;
// en el hielo seco, del gas)
const RETO_OBJETIVO = { agua: 50, alcohol: 20, nitrogeno: -200, hierro: 2000, hieloSeco: -20 };

const ALMACEN = crearAlmacen(RETOS_CLAVE, () => ({ retos: {}, sellos: {} }));   // js/escena-comun.js
let retosDatos = ALMACEN.leer();
let retosSesion = null;   // seguimiento de la partida actual (se reinicia con la sustancia)

function guardarRetos() { ALMACEN.guardar(retosDatos); }

// Textos de los tres retos de la sustancia actual
function retosDe(s) {
    const N = { solid: i18n.t(s.nombres.solid), liquid: i18n.t(s.nombres.liquid), gas: i18n.t(s.nombres.gas) };
    const clave = s.clave;
    const obj = fmtT(RETO_OBJETIVO[clave]) + ' °C';
    if (s.sublima) return [
        i18n.t('Sublima todo el {s} sin que el termómetro pase de {t}', { s: N.solid, t: fmtT(s.tf) + ' °C' }),
        i18n.t('Deja el {g} justo a {t} y apaga la placa', { g: N.gas, t: obj }),
        i18n.t('Sublima el {s} y vuelve a tenerlo todo sólido', { s: N.solid }),
        retoMinima(s),
    ];
    return [
        i18n.t('Funde todo el {s} sin que el termómetro pase de {t}', { s: N.solid, t: fmtT(s.tf) + ' °C' }),
        i18n.t('Deja el {l} justo a {t} y apaga la placa', { l: N.liquid, t: obj }),
        i18n.t('Haz que el {l} hierva y vuelve a tenerlo todo líquido', { l: N.liquid }),
        retoMinima(s),
    ];
}

// 4 · ¿Hasta qué temperatura se puede enfriar? (es la misma para todas: el cero absoluto)
function retoMinima(s) {
    const hecho = (retosDatos.retos[s.clave] || [])[3];
    const txt = i18n.t('Descubre la temperatura más baja a la que se puede enfriar el {s}', { s: i18n.t(s.nombres.solid) });
    return hecho ? txt + ': ' + fmtT(CERO_ABS) + ' °C' : txt;
}

function retosReiniciar() {
    retosSesion = { tramo: estado ? estado.tramo : null, hervido: false };
    pintarRetos();
}

// Se llama unas 15 veces por segundo desde la simulación
function retosComprobar() {
    if (!sus || !estado) return;
    if (!retosSesion) retosReiniciar();
    const clave = sus.clave;
    const hechos = retosDatos.retos[clave] || [false, false, false, false];
    let cambio = false;
    const ganar = (i) => { if (!hechos[i]) { hechos[i] = true; cambio = true; } };
    const apagada = potencia === 0;

    // 1 · Fundir (o sublimar) todo sin pasarse de la temperatura del cambio
    if (sus.sublima) { if (estado.fg >= 1 && estado.T <= sus.tf + 0.5 && apagada) ganar(0); }
    else if (estado.fl >= 1 && estado.T <= sus.tf + 0.5 && apagada) ganar(0);
    // 2 · Justo a la temperatura objetivo, con la placa apagada
    const tramoObj = sus.sublima ? 'gas' : 'liquido';
    const tol = Math.max(1, (sus.tMax - sus.tRef) * 0.004);
    if (estado.tramo === tramoObj && apagada && Math.abs(estado.T - RETO_OBJETIVO[clave]) <= tol) ganar(1);
    // 3 · Ida y vuelta por un cambio de estado
    if (sus.sublima) {
        if (estado.tramo === 'sublimacion' && potencia > 0) retosSesion.hervido = true;
        if (retosSesion.hervido && estado.fs >= 1) ganar(2);
    } else {
        if (estado.tramo === 'vaporizacion' && potencia > 0) retosSesion.hervido = true;
        if (retosSesion.hervido && estado.fl >= 1) ganar(2);
    }

    // 4 · Llegar a la temperatura más baja posible
    if (energia <= 0) ganar(3);

    // Sellos: al terminar un cambio de estado
    const antes = retosSesion.tramo, ahora = estado.tramo;
    if (antes && antes !== ahora) {
        const sello = {
            'fusion>liquido': 'fusion', 'fusion>solido': 'solidificacion',
            'vaporizacion>gas': 'vaporizacion', 'vaporizacion>liquido': 'condensacion',
            'sublimacion>gas': 'sublimacion', 'sublimacion>solido': 'sublimacionInversa',
        }[antes + '>' + ahora];
        if (sello && !retosDatos.sellos[clave + '-' + sello]) { retosDatos.sellos[clave + '-' + sello] = true; cambio = true; }
    }
    retosSesion.tramo = ahora;

    if (cambio) { retosDatos.retos[clave] = hechos; guardarRetos(); pintarRetos(); }
    else if (frameCount % 30 === 0) pintarProgreso();
}

// ── «Presión y temperatura»: llegadas a una línea y cruces ─────────
function ganarFases(i) {
    const hechos = retosDatos.retos.fases || [false, false, false, false, false];
    if (hechos[i]) return false;
    hechos[i] = true; retosDatos.retos.fases = hechos;
    return true;
}
function retosFasesEvento(tipo, ev) {
    const k = claveDiagrama();
    let cambio = false;
    if (tipo === 'llegada') {
        if (k === 'agua' && ev.tipo === 'vaporizacion' && ev.de === 'liquid' && ev.causa === 'descomprimir') cambio = ganarFases(0) || cambio;
        if (k === 'agua' && ev.tipo === 'triple' && !porEjemplo) cambio = ganarFases(2) || cambio;
    } else {
        if (k === 'agua' && ev.de === 'liquid' && ev.a === 'gas' && ev.causa === 'descomprimir') cambio = ganarFases(0) || cambio;
        if (k === 'co2' && ev.a === 'liquid') cambio = ganarFases(3) || cambio;
        if (k === 'yodo' && ev.de === 'solid' && ev.a === 'gas') cambio = ganarFases(4) || cambio;
        // Sellos: cruzar una línea del agua, del CO₂ (fila del hielo seco) o del yodo
        const id = { 'solid>liquid': 'fusion', 'liquid>solid': 'solidificacion', 'liquid>gas': 'vaporizacion',
                     'gas>liquid': 'condensacion', 'solid>gas': 'sublimacion', 'gas>solid': 'sublimacionInversa' }[ev.de + '>' + ev.a];
        const fila = { agua: ['agua', ALBUM_CAMBIOS], co2: ['hieloSeco', ALBUM_HIELO_SECO], yodo: ['yodo', ALBUM_YODO] }[k];
        if (fila && fila[1].some(c => c.id === id) && !retosDatos.sellos[fila[0] + '-' + id]) {
            retosDatos.sellos[fila[0] + '-' + id] = true; cambio = true;
        }
    }
    if (cambio) { guardarRetos(); pintarRetos(); }
}
// Se llama unas 15 veces por segundo: el reto del Everest se comprueba sobre la línea
function retosFasesComprobar() {
    if (claveDiagrama() !== 'agua') return;
    if (situacion().tipo === 'vaporizacion' && Math.abs(fP - 0.33) < 0.025) {
        if (ganarFases(1)) { guardarRetos(); pintarRetos(); }
    }
}

// Progreso del reto 1 mientras dura el cambio de estado
function progresoReto(i) {
    if (currentMode === 'fases') return (retosDatos.retos.fases || [])[i] ? 1 : 0;
    const hechos = retosDatos.retos[sus.clave] || [];
    if (hechos[i]) return 1;
    if (i === 0) return estado.tramo === (sus.sublima ? 'sublimacion' : 'fusion') ? (sus.sublima ? estado.fg : estado.fl) : 0;
    if (i === 2) return retosSesion && retosSesion.hervido ? 0.5 : 0;
    return 0;
}

function pintarProgreso() {
    document.querySelectorAll('#lista-retos li').forEach((li, i) => {
        const p = progresoReto(i);
        li.style.setProperty('--progreso', String(Math.max(0, Math.min(1, p || 0))));
    });
}

function pintarRetos() {
    const lista = document.getElementById('lista-retos');
    if (!lista || !sus) return;
    const fases = currentMode === 'fases';
    const hechos = retosDatos.retos[fases ? 'fases' : sus.clave] || [];
    const modo = document.getElementById('retos-modo');
    if (modo) modo.textContent = '· ' + (fases ? i18n.t('Presión y temperatura') : i18n.t(sus.nombre));
    lista.innerHTML = '';
    (fases ? RETOS_FASES.map(t => i18n.t(t)) : retosDe(sus)).forEach((txt, i) => {
        const li = document.createElement('li');
        li.className = hechos[i] ? 'hecho' : '';
        li.innerHTML = `<span class="anillo" aria-hidden="true"></span><span class="reto-txt"></span><span class="reto-estrella" aria-hidden="true">${hechos[i] ? '★' : '☆'}</span>`;
        li.querySelector('.reto-txt').textContent = txt;
        if (hechos[i]) li.setAttribute('aria-label', txt + ' · ' + i18n.t('conseguido'));
        lista.appendChild(li);
    });
    pintarProgreso();

    // Álbum en miniatura
    const mini = document.getElementById('album-mini');
    mini.innerHTML = '';
    let n = 0;
    const sello = (susClave, c) => {
        const ok = !!retosDatos.sellos[susClave + '-' + c.id];
        if (ok) n++;
        const el = document.createElement('span');
        el.className = 'sello' + (ok ? ' ganado' : '');
        el.style.setProperty('--col', c.col);
        el.textContent = ok ? c.corto : '';
        el.title = nombreAlbum(susClave) + ' · ' + i18n.t(c.nombre) + (ok ? '' : ' · ' + i18n.t('pendiente'));
        return el;
    };
    ALBUM_SUSTANCIAS.forEach(sc => ALBUM_CAMBIOS.forEach(c => mini.appendChild(sello(sc, c))));
    ALBUM_HIELO_SECO.forEach(c => mini.appendChild(sello('hieloSeco', c)));
    ALBUM_YODO.forEach(c => mini.appendChild(sello('yodo', c)));
    document.getElementById('album-cuenta').textContent = `${n} / ${ALBUM_TOTAL}`;
}

function pintarAlbum() {
    const tabla = document.getElementById('album-tabla');
    let h = '<table><thead><tr><th></th>';
    ALBUM_CAMBIOS.forEach(c => { h += `<th scope="col">${i18n.t(c.nombre)}</th>`; });
    h += '</tr></thead><tbody>';
    const celda = (sc, c) => {
        const ok = !!retosDatos.sellos[sc + '-' + c.id];
        return `<td><span class="sello grande${ok ? ' ganado' : ''}" style="--col:${c.col}" title="${i18n.t(c.nombre)}">${ok ? c.corto : '?'}</span></td>`;
    };
    ALBUM_SUSTANCIAS.forEach(sc => {
        h += `<tr><th scope="row">${i18n.t(SUSTANCIAS[sc].nombre)}</th>`;
        ALBUM_CAMBIOS.forEach(c => { h += celda(sc, c); });
        h += '</tr>';
    });
    [['hieloSeco', ALBUM_HIELO_SECO], ['yodo', ALBUM_YODO]].forEach(([sc, lista]) => {
        h += `<tr><th scope="row">${nombreAlbum(sc)}</th>`;
        lista.forEach(c => { h += celda(sc, c).replace('<td>', `<td><small>${i18n.t(c.nombre)}</small>`); });
        h += '<td></td><td></td></tr>';
    });
    h += '</tbody></table>';
    tabla.innerHTML = h;
}

// Abrir y cerrar el panel y el álbum, «Borrar lo conseguido» con
// confirmación y Escape: en js/escena-comun.js
document.addEventListener('DOMContentLoaded', () => iniciarPanelRetos({
    pintar: pintarRetos,
    pintarAlbum,
    alBorrar: () => { retosDatos = ALMACEN.vacio(); retosReiniciar(); },
}, ALMACEN));
