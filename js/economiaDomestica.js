const URL_API = 'http://localhost:3000';

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

let resumenMostrado = false;

const formatoImporte = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
function crearInputPrecio() {
    const input = document.createElement('input');
    input.type = 'text'; // o 'number', según prefieras
    input.inputMode = 'decimal';
    input.placeholder = 'Inserta precio en €';
    return input;
}
const CONCEPTOS = [
    { nombre: 'Luz', inputPrecio: crearInputPrecio(), imagen: 'img/luz.png' },
    { nombre: 'Agua', inputPrecio: crearInputPrecio(), imagen: 'img/agua.png' },
    { nombre: 'Gas', inputPrecio: crearInputPrecio(), imagen: 'img/gas.png' },
    { nombre: 'Comunidad', inputPrecio: crearInputPrecio(), imagen: 'img/comunidad.png' },
    { nombre: 'Internet', inputPrecio: crearInputPrecio(), imagen: 'img/internet.png' },
    { nombre: 'Teléfono', inputPrecio: crearInputPrecio(), imagen: 'img/telefono.png' },
    { nombre: 'Seguro del hogar', inputPrecio: crearInputPrecio(), imagen: 'img/seguro.png' },
    { nombre: 'Alquiler', inputPrecio: crearInputPrecio(), imagen: 'img/alquiler.jpg' },
    { nombre: 'Limpieza', inputPrecio: crearInputPrecio(), imagen: 'img/limpieza.png' },
    { nombre: 'Basuras', inputPrecio: crearInputPrecio(), imagen: 'img/basuras.png' }
];

const contenedorConceptos = document.getElementById('conceptos');
const zonaContador = document.getElementById('contador');
const zonaAviso = document.getElementById('aviso');
const botonFinalizar = document.getElementById('btn-finalizar');
const zonaResumen = document.getElementById('resumen');

function leerPrecioInput(input) {
    const textoLimpio = input.value.trim().replace(',', '.');
    if (textoLimpio === '') {
        return Number.NaN;
    }
    return Number(textoLimpio);
}
function formatearEuros(importe) {
    return `${formatoImporte.format(importe)} €`;
}


function esPrecioValido(precio) {
    return typeof precio === 'number' && Number.isFinite(precio) && precio >= 0;
}


function obtenerIdConcepto(valor) {
    const id = Number.parseInt(valor, 10);
    if (!Number.isInteger(id) || id < 0 || id >= CONCEPTOS.length) {
        throw new RangeError('El concepto seleccionado no es válido.');
    }
    return id;
}


function calcularGastoMedio(total, numeroPagos) {
    if (numeroPagos <= 0) {
        throw new RangeError('No se puede calcular la media sin pagos.');
    }
    return total / numeroPagos;
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
    zonaContador.textContent = `Pagos registrados: ${pagos.length}`;
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


function registrarPago(id) {
    const concepto = CONCEPTOS[id];
    if (!esPrecioValido(leerPrecioInput(concepto.inputPrecio))) {
        throw new TypeError(`El precio de «${concepto.nombre}» no es válido.`);
    }
    pagos.push(id);
    gastoTotal += leerPrecioInput(concepto.inputPrecio);
    concepto.inputPrecio.value="";
    actualizarContador();
}

function reiniciarRegistro() {
    pagos = [];
    gastoTotal = 0;
    actualizarContador();
}


function contarPagosPorConcepto() {
    return CONCEPTOS
        .map((concepto, id) => ({
            nombre: concepto.nombre,
            cantidad: pagos.filter((idPago) => idPago === id).length
        }))
        .filter((item) => item.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
}


function construirLineasResumen() {
    const detalle = contarPagosPorConcepto().map(
        ({ nombre, cantidad }) => `${nombre} ---- ${cantidad} ${cantidad === 1 ? 'pago' : 'pagos'}`
    );
    const gastoMedio = calcularGastoMedio(gastoTotal, pagos.length);
    return [
        ...detalle,
        `Gasto final: ${formatearEuros(gastoTotal)}`,
        `Gasto medio: ${formatearEuros(gastoMedio)}/pago`
    ];
}


function manejarClickConcepto(evento) {
    const boton = evento.target.closest('button[data-id]');
    if (!boton) {
        return;
    }
    limpiarAviso();
    try {
        const id = obtenerIdConcepto(boton.dataset.id);
        if (resumenMostrado) {
            limpiarResumen();
            resumenMostrado = false;
        }
        registrarPago(id);
    } catch (error) {
        mostrarAviso(error.message);
    }
}

function finalizarTramite() {
    limpiarAviso();
    try {
        if (pagos.length === 0) {
            mostrarLineas(['No se ha registrado ningún pago']);
        } else {
            mostrarLineas(construirLineasResumen());
        }
        resumenMostrado = true;
        reiniciarRegistro();
    } catch (error) {
        mostrarAviso(error.message);
    }
    
}

function iniciar() {
    mostrarConceptos();
    actualizarContador();
    contenedorConceptos.addEventListener('click', manejarClickConcepto);
    botonFinalizar.addEventListener('click', finalizarTramite);
}

iniciar();
