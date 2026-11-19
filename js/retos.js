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
const ALBUM_TOTAL = ALBUM_SUSTANCIAS.length * ALBUM_CAMBIOS.length + ALBUM_HIELO_SECO.length;

// Temperatura objetivo del reto «déjalo justo a…» (dentro del tramo líquido;
// en el hielo seco, del gas)
const RETO_OBJETIVO = { agua: 50, alcohol: 20, nitrogeno: -200, hierro: 2000, hieloSeco: -20 };

let retosDatos = cargarRetos();
let retosSesion = null;   // seguimiento de la partida actual (se reinicia con la sustancia)

function cargarRetos() {
    try {
        const d = JSON.parse(localStorage.getItem(RETOS_CLAVE));
        if (d && typeof d === 'object') return { retos: d.retos || {}, sellos: d.sellos || {} };
    } catch (e) { /* sin almacenamiento: se juega igual, sin guardar */ }
    return { retos: {}, sellos: {} };
}
function guardarRetos() {
    try { localStorage.setItem(RETOS_CLAVE, JSON.stringify(retosDatos)); } catch (e) { /* nada */ }
}

// Textos de los tres retos de la sustancia actual
function retosDe(s) {
    const N = { solid: i18n.t(s.nombres.solid), liquid: i18n.t(s.nombres.liquid), gas: i18n.t(s.nombres.gas) };
    const clave = s.clave;
    const obj = fmtT(RETO_OBJETIVO[clave]) + ' °C';
    if (s.sublima) return [
        i18n.t('Sublima todo el {s} sin que el termómetro pase de {t}', { s: N.solid, t: fmtT(s.tf) + ' °C' }),
        i18n.t('Deja el {g} justo a {t} y apaga la placa', { g: N.gas, t: obj }),
        i18n.t('Sublima el {s} y vuelve a tenerlo todo sólido', { s: N.solid }),
    ];
    return [
        i18n.t('Funde todo el {s} sin que el termómetro pase de {t}', { s: N.solid, t: fmtT(s.tf) + ' °C' }),
        i18n.t('Deja el {l} justo a {t} y apaga la placa', { l: N.liquid, t: obj }),
        i18n.t('Haz que el {l} hierva y vuelve a tenerlo todo líquido', { l: N.liquid }),
    ];
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
    const hechos = retosDatos.retos[clave] || [false, false, false];
    let cambio = false;
    const ganar = (i) => { if (!hechos[i]) { hechos[i] = true; cambio = true; } };
    const apagada = potencia === 0;

    // 1 · Fundir (o sublimar) todo sin pasarse de la temperatura del cambio
    if (sus.sublima) { if (estado.fg >= 1 && estado.T <= sus.tf + 0.5 && apagada) ganar(0); }
    else if (estado.fl >= 1 && estado.T <= sus.tf + 0.5 && apagada) ganar(0);
    // 2 · Justo a la temperatura objetivo, con la placa apagada
    const tramoObj = sus.sublima ? 'gas' : 'liquido';
    const tol = Math.max(1, (sus.tMax - sus.tMin) * 0.004);
    if (estado.tramo === tramoObj && apagada && Math.abs(estado.T - RETO_OBJETIVO[clave]) <= tol) ganar(1);
    // 3 · Ida y vuelta por un cambio de estado
    if (sus.sublima) {
        if (estado.tramo === 'sublimacion' && potencia > 0) retosSesion.hervido = true;
        if (retosSesion.hervido && estado.fs >= 1) ganar(2);
    } else {
        if (estado.tramo === 'vaporizacion' && potencia > 0) retosSesion.hervido = true;
        if (retosSesion.hervido && estado.fl >= 1) ganar(2);
    }

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

// Progreso del reto 1 mientras dura el cambio de estado
function progresoReto(i) {
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
    const hechos = retosDatos.retos[sus.clave] || [];
    lista.innerHTML = '';
    retosDe(sus).forEach((txt, i) => {
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
        el.title = i18n.t(SUSTANCIAS[susClave].nombre) + ' · ' + i18n.t(c.nombre) + (ok ? '' : ' · ' + i18n.t('pendiente'));
        return el;
    };
    ALBUM_SUSTANCIAS.forEach(sc => ALBUM_CAMBIOS.forEach(c => mini.appendChild(sello(sc, c))));
    ALBUM_HIELO_SECO.forEach(c => mini.appendChild(sello('hieloSeco', c)));
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
    h += `<tr><th scope="row">${i18n.t(SUSTANCIAS.hieloSeco.nombre)}</th>`;
    ALBUM_HIELO_SECO.forEach(c => { h += celda('hieloSeco', c).replace('<td>', `<td><small>${i18n.t(c.nombre)}</small>`); });
    h += '<td></td><td></td></tr></tbody></table>';
    tabla.innerHTML = h;
}

function abrirRetos() {
    const p = document.getElementById('panel-retos'), b = document.getElementById('btn-retos');
    pintarRetos();
    p.hidden = false;
    document.body.classList.add('retos-abiertos');
    b.setAttribute('aria-expanded', 'true'); b.classList.add('active');
    b.querySelector('.btn-retos-txt').textContent = i18n.t('Ocultar');
}
function cerrarRetos() {
    const p = document.getElementById('panel-retos'), b = document.getElementById('btn-retos');
    if (!p) return;
    p.hidden = true;
    document.getElementById('confirmar-borrar').hidden = true;
    document.body.classList.remove('retos-abiertos');
    b.setAttribute('aria-expanded', 'false'); b.classList.remove('active');
    b.querySelector('.btn-retos-txt').textContent = i18n.t('Retos');
}
function abrirAlbum() {
    pintarAlbum();
    const a = document.getElementById('album');
    a.hidden = false;
    a.querySelector('.boton-cerrar').focus();
}
function cerrarAlbum() {
    document.getElementById('album').hidden = true;
    document.getElementById('btn-ver-album').focus();
}

document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('btn-retos');
    b.addEventListener('click', () => { if (document.getElementById('panel-retos').hidden) abrirRetos(); else cerrarRetos(); });
    document.getElementById('btn-ver-album').addEventListener('click', abrirAlbum);
    document.getElementById('album').addEventListener('click', (e) => { if (e.target.id === 'album') cerrarAlbum(); });
    const conf = document.getElementById('confirmar-borrar');
    document.getElementById('btn-borrar').addEventListener('click', () => { conf.hidden = false; document.getElementById('btn-borrar-no').focus(); });
    document.getElementById('btn-borrar-no').addEventListener('click', () => { conf.hidden = true; document.getElementById('btn-borrar').focus(); });
    document.getElementById('btn-borrar-si').addEventListener('click', () => {
        retosDatos = { retos: {}, sellos: {} };
        try { localStorage.removeItem(RETOS_CLAVE); } catch (e) { /* nada */ }
        conf.hidden = true;
        retosReiniciar();
        document.getElementById('btn-borrar').focus();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!document.getElementById('album').hidden) cerrarAlbum();
        else if (!document.getElementById('panel-retos').hidden) { cerrarRetos(); b.focus(); }
    });
});
