
const URL_API = 'http://localhost:3000';
const MS_LIMPIEZA = 10000;

const CATEGORIAS = {
    CULT: 'Cultura',
    ALI: 'Alimentación',
    DEP: 'Deportes',
    OC: 'Ocio',
    S_BAS: 'Servicios Básicos'
};

const PATRON_MES_ANIO = /^(0?[1-9]|1[0-2])[/-](\d{4})$/;



let pagos = [];
let gastoTotal = 0;

let fechaTramite = null;
let tramiteFinalizado = false;
let ventanaInfo = null;

const formatoImporte = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
const formatoMedia = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
});
const formatoEntero = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0
});

function crearInputPrecio() {
    const input = document.createElement('input');
    input.type = 'text'; // o 'number', según prefieras
    input.inputMode = 'decimal';
    input.placeholder = 'Inserta precio en €';
    return input;
}


const CONCEPTOS = [];

const contenedorConceptos = document.getElementById('conceptos');
const zonaContador = document.getElementById('contador');
const zonaAviso = document.getElementById('aviso');
const botonFinalizar = document.getElementById('btn-finalizar');
const zonaResumen = document.getElementById('resumen');

const estilos = document.createElement('style');
estilos.textContent = ESTILOS_V2;
document.head.appendChild(estilos);
function crearPanelHistorial() {
    const estilos = document.createElement('style');
    estilos.textContent = ESTILOS_V2;
    document.head.appendChild(estilos);

    const panel = document.createElement('aside');
    panel.id = 'historial';
    panel.setAttribute('aria-label', 'Historial de pagos');

    const titulo = document.createElement('h2');
    titulo.textContent = 'Pagos realizados';

    const lista = document.createElement('div');
    lista.id = 'lista-pagos';

    panel.append(titulo, lista);
    document.body.appendChild(panel);
    return lista;
}

const zonaHistorial = crearPanelHistorial();


function normalizarRutaImagen(ruta) {
    return ruta.replace(/^(\.\.\/)+/, '');
}

async function cargarConceptos() {
    const respuesta = await fetch(`${URL_API}/conceptos`);
    if (!respuesta.ok) {
        throw new Error(`Error ${respuesta.status} al cargar los conceptos.`);
    }
    const conceptos = await respuesta.json();

    return conceptos.map((concepto) => ({
        ...concepto,
        imagen: normalizarRutaImagen(concepto.img),
        inputPrecio: crearInputPrecio()
    }));
}

async function guardarTramite(registro) {
    const respuesta = await fetch(`${URL_API}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro)
    });
    if (!respuesta.ok) {
        throw new Error(`Error ${respuesta.status} al guardar el trámite.`);
    }
}


function leerPrecioInput(input) {
    const textoLimpio = input.value.trim().replace(',', '.');
    if (textoLimpio === '') {
        return Number.NaN;
    }
    return Number(textoLimpio);
}

function redondear(importe) {
    return Math.round(importe * 100) / 100;
}

function formatearEuros(importe) {
    return `${formatoImporte.format(importe)}€`;
}

function formatearFechaHora(fecha) {
    const dos = (numero) => String(numero).padStart(2, '0');
    return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ` +
        `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}


function esPrecioValido(precio) {
    return typeof precio === 'number' && Number.isFinite(precio) && precio > 0;
}

function obtenerIdConcepto(valor) {
    const id = Number.parseInt(valor, 10);
    if (!Number.isInteger(id) || id < 0 || id >= CONCEPTOS.length) {
        throw new RangeError('El concepto seleccionado no es válido.');
    }
    return id;
}

function calcularGastoMedio(total, cantidad) {
    if (cantidad <= 0) {
        throw new RangeError('No se puede calcular la media sin pagos.');
    }
    return total / cantidad;
}


function crearTarjetaConcepto(concepto, id) {
    const figura = document.createElement('figure');

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.dataset.id = id;
    const imagen = document.createElement('img');
    imagen.src = concepto.imagen;
    imagen.alt = concepto.nombre;
    boton.appendChild(imagen);

    const pie = document.createElement('figcaption');
    const nombre = document.createElement('strong');
    nombre.textContent = concepto.nombre;

    pie.append(nombre, concepto.inputPrecio);

    figura.append(boton, pie);
    return figura;
}

function mostrarConceptos() {
    contenedorConceptos.replaceChildren(...CONCEPTOS.map(crearTarjetaConcepto));
}

function actualizarContador() {
    const tramite = fechaTramite ? `Trámite ${fechaTramite} — ` : '';
    zonaContador.textContent = `${tramite}Pagos registrados: ${pagos.length}`;
}

function mostrarAviso(mensaje) {
    zonaAviso.textContent = mensaje;
}

function limpiarAviso() {
    zonaAviso.textContent = '';
}

function limpiarResumen() {
    zonaResumen.replaceChildren();
}

function mostrarLineas(lineas) {
    const parrafos = lineas.map((texto) => {
        const parrafo = document.createElement('p');
        parrafo.textContent = texto;
        return parrafo;
    });
    zonaResumen.replaceChildren(...parrafos);
}


function resaltarConcepto(id) {
    zonaHistorial.querySelectorAll('.resaltado')
        .forEach((linea) => linea.classList.remove('resaltado'));
    zonaHistorial.querySelectorAll(`[data-concepto="${id}"]`)
        .forEach((linea) => linea.classList.add('resaltado'));
}

function agregarLineaHistorial(id, importe) {
    const linea = document.createElement('p');
    linea.className = 'linea-pago';
    linea.dataset.concepto = id;
    linea.textContent = `${CONCEPTOS[id].nombre} ${formatearEuros(importe)}`;
    zonaHistorial.appendChild(linea);
    resaltarConcepto(id);
    zonaHistorial.scrollTop = zonaHistorial.scrollHeight;
}

function limpiarHistorial() {
    zonaHistorial.replaceChildren();
}


function pedirMesAnio() {
    const hoy = new Date();
    const porDefecto = `${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    let mensaje = 'Nuevo trámite. Indica el mes y el año (MM/AAAA):';
    while (true) {
        const texto = prompt(mensaje, porDefecto);
        if (texto === null) {
            return null;
        }
        const coincidencia = texto.trim().match(PATRON_MES_ANIO);
        if (coincidencia) {
            return `${coincidencia[1].padStart(2, '0')}/${coincidencia[2]}`;
        }
        mensaje = 'Formato no válido. Escribe el mes y el año así: MM/AAAA (por ejemplo, 05/2023).';
    }
}

function iniciarTramite() {
    const fecha = pedirMesAnio();
    if (fecha === null) {
        mostrarAviso('Para registrar pagos tienes que indicar el mes y el año del trámite.');
        return false;
    }
    fechaTramite = fecha;
    limpiarAviso();
    actualizarContador();
    return true;
}


function registrarPago(id) {
    const concepto = CONCEPTOS[id];
    const importe = leerPrecioInput(concepto.inputPrecio);
    if (!esPrecioValido(importe)) {
        throw new TypeError(
            `No puede registrarse un pago sin importe en «${concepto.nombre}»: indica una cantidad mayor que 0.`
        );
    }
    pagos.push({ id, importe });
    gastoTotal += importe;
    concepto.inputPrecio.value = '';
    actualizarContador();
    agregarLineaHistorial(id, importe);
}

function reiniciarRegistro() {
    pagos = [];
    gastoTotal = 0;
    fechaTramite = null;
    CONCEPTOS.forEach((concepto) => { concepto.inputPrecio.value = ''; });
    actualizarContador();
}


function contarPagosPorConcepto() {
    return CONCEPTOS
        .map((concepto, id) => {
            const pagosConcepto = pagos.filter((pago) => pago.id === id);
            return {
                concepto,
                idConcepto: concepto.id,
                nombre: concepto.nombre,
                cantidad: pagosConcepto.length,
                total: redondear(pagosConcepto.reduce((suma, pago) => suma + pago.importe, 0))
            };
        })
        .filter((item) => item.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
}


function construirLineasResumen(fecha, conceptos) {
    const detalle = conceptos.map(
        ({ nombre, cantidad, total }) =>
            `${nombre} ---- ${cantidad} ${cantidad === 1 ? 'pago' : 'pagos'} ---- ` +
            `${formatearEuros(total / cantidad)} ---- ${formatearEuros(total)}`
    );
    const montante = Math.floor(redondear(gastoTotal));
    const gastoMedio = calcularGastoMedio(gastoTotal, conceptos.length);
    return [
        `Fecha: ${formatearFechaHora(fecha)}`,
        ...detalle,
        `Gasto final: ${formatoEntero.format(montante)} €`,
        `Gasto medio: ${formatoMedia.format(gastoMedio)} €/concepto`
    ];
}

function abrirVentanaInfo(conceptos) {
    const ventana = window.open('', 'detalleTramite', 'width=480,height=360');
    if (!ventana) {
        mostrarAviso('El navegador ha bloqueado la ventana emergente: permítela para ver el detalle.');
        return null;
    }
    const doc = ventana.document;
    doc.title = 'Detalle del trámite';
    doc.body.style.fontFamily = 'Arial, sans-serif';

    const titulo = doc.createElement('h2');
    titulo.textContent = `Conceptos pagados (${fechaTramite})`;

    const lista = doc.createElement('ul');
    lista.append(...conceptos.map(({ concepto }) => {
        const elemento = doc.createElement('li');
        elemento.textContent =
            `${concepto.nombre}: gasto ${concepto.imprescindible ? 'imprescindible' : 'prescindible'} ` +
            `de categoría ${CATEGORIAS[concepto.categoria] ?? concepto.categoria}.`;
        return elemento;
    }));

    doc.body.replaceChildren(titulo, lista);
    return ventana;
}

function manejarClickConcepto(evento) {
    const boton = evento.target.closest('button[data-id]');
    if (!boton) {
        return;
    }
    limpiarAviso();
    try {
        if (tramiteFinalizado) {
            throw new Error('El trámite ya está finalizado: espera a que se limpie la pantalla para empezar otro.');
        }
        if (fechaTramite === null && !iniciarTramite()) {
            return;
        }
        const id = obtenerIdConcepto(boton.dataset.id);
        limpiarResumen();
        registrarPago(id);
    } catch (error) {
        mostrarAviso(error.message);
    }
}

function finalizarTramite() {
    limpiarAviso();
    if (tramiteFinalizado) {
        return;
    }
    if (pagos.length === 0) {
        mostrarLineas(['No se ha registrado ningún pago']);
        return;
    }
    try {
        const conceptos = contarPagosPorConcepto();

        const registro = {
            fecha: fechaTramite,
            pagos: conceptos.map(({ idConcepto, cantidad, total }) => ({
                idConcepto,
                importeTotal: total,
                numPagos: cantidad
            }))
        };
        mostrarLineas(construirLineasResumen(new Date(), conceptos));
        ventanaInfo = abrirVentanaInfo(conceptos);
        tramiteFinalizado = true;
        botonFinalizar.disabled = true;
        setTimeout(() => cerrarTramite(registro), MS_LIMPIEZA);
    } catch (error) {
        mostrarAviso(error.message);
    }
}


async function cerrarTramite(registro) {
    if (ventanaInfo && !ventanaInfo.closed) {
        ventanaInfo.close();
    }
    ventanaInfo = null;
    limpiarHistorial();
    limpiarResumen();
    reiniciarRegistro();
    tramiteFinalizado = false;
    botonFinalizar.disabled = false;
    try {
        await guardarTramite(registro);
    } catch (error) {
        mostrarAviso(`No se pudo guardar el trámite: ${error.message}`);
    }

    setTimeout(iniciarTramite, 100);
}

async function iniciar() {
    actualizarContador();
    contenedorConceptos.addEventListener('click', manejarClickConcepto);
    botonFinalizar.addEventListener('click', finalizarTramite);
    try {
        CONCEPTOS.push(...await cargarConceptos());
    } catch (error) {
        mostrarAviso(`No se pudieron cargar los conceptos. ¿Está arrancado json-server? (${error.message})`);
        return;
    }
    mostrarConceptos();
    setTimeout(iniciarTramite, 100);
}

iniciar();
