const params = new URLSearchParams(window.location.search);
const queryRaw = (params.get('q') || '').trim();
const query = queryRaw.toLowerCase();

const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');
const contenedor = document.getElementById('resultados');

const detalle = document.getElementById('detalle_contenido'); // panel derecho

if (!query) {
  titulo.innerText = 'Búsqueda global';
  subtitulo.innerText = 'Volvé al Home e ingresá un término.';
  throw new Error('Sin búsqueda');
}

titulo.innerText = `Resultados para: "${queryRaw}"`;
subtitulo.innerText = 'Buscando en todas las ciudades y páginas…';

const ciudades = [
  { nombre: 'Buenos Aires', slug: 'buenos_aires' },
  { nombre: 'Córdoba', slug: 'cordoba' },
  { nombre: 'Mendoza', slug: 'mendoza' }
];

const MAX_PAGINAS = 50;
let totalEncontrados = 0;

/* ===== helpers ===== */
function escapeHtml(str) {
  return (str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function txt(el) {
  return (el && el.textContent ? el.textContent : '').trim();
}

/* Sacamos datos + “detalle HTML” de la oferta original */
function extraerData(oferta) {
  const aTitulo = oferta.querySelector('h2 a') || oferta.querySelector('a[href]');
  const t = txt(aTitulo) || txt(oferta.querySelector('h2')) || 'Oferta';

  // Empresa / ubicación / fecha (más tolerante)
  const ps = Array.from(oferta.querySelectorAll('p')).map(p => txt(p)).filter(Boolean);

  const empresa = ps[0] || '';
  const ubicacion = ps[1] || '';
  const fecha = ps[2] || '';

  // ✅ Intentamos agarrar una descripción real si existe en el HTML
  // (probamos varias clases típicas)
  const descNode =
    oferta.querySelector('.descripcion_scrapeada') ||
    oferta.querySelector('.box_description') ||
    oferta.querySelector('.description') ||
    oferta.querySelector('[data-desc]') ||
    null;

  const descripcionHtml = descNode ? (descNode.innerHTML || '').trim() : '';

  // Si no hay bloque de descripción, como fallback mostramos el contenido entero de la oferta (sin links activos)
  // Esto te asegura que “se vea parecido” a lo que guardaste.
  const fallbackHtml = oferta.innerHTML || '';

  return { titulo: t, empresa, ubicacion, fecha, descripcionHtml, fallbackHtml };
}

/* Render card limpia (mismo formato) y guardamos el detalle en data-attrs */
function renderCard(data) {
  // guardamos el detalle como string en atributos (escapeado) para abrirlo en el panel
  const detailPayload = encodeURIComponent(data.descripcionHtml || data.fallbackHtml || '');

  return `
    <article class="box_offer" data-detail="${detailPayload}">
      <h2 class="fs18 fwB prB">
        <a class="fc_base t_ellipsis" href="#" data-no-nav="1">${escapeHtml(data.titulo)}</a>
      </h2>

      <p class="dFlex vm_fx fs16 fc_base mt5">
        <span class="t_ellipsis">${escapeHtml(data.empresa)}</span>
      </p>

      <p class="fs16 fc_base mt5">
        <span class="mr10">${escapeHtml(data.ubicacion)}</span>
      </p>

      <p class="fs13 fc_aux mt15">
        ${escapeHtml(data.fecha)}
      </p>
    </article>
  `;
}

/* ====== Click delegado: bloquear links + abrir panel ====== */
contenedor.addEventListener('click', (e) => {
  // 1) bloquear CUALQUIER link dentro de resultados (sin alert)
  const anyLink = e.target.closest('a');
  if (anyLink) {
    e.preventDefault();
    e.stopPropagation();
  }

  // 2) si clickeó una card, selecciona + abre detalle
  const card = e.target.closest('.box_offer');
  if (!card) return;

  contenedor.querySelectorAll('.box_offer.sel').forEach(x => x.classList.remove('sel'));
  card.classList.add('sel');

  if (!detalle) return;

  const payload = card.getAttribute('data-detail') || '';
  const html = decodeURIComponent(payload);

  // Limpieza: desactivar links dentro del panel para que no navegue
  const safeHtml = html
    .replace(/<a\b/gi, '<a data-no-nav="1"')
    .replace(/href\s*=\s*(['"]).*?\1/gi, 'href="#"');

  detalle.innerHTML = safeHtml || `<div class="nores">No hay detalle disponible para esta oferta.</div>`;
});

/* ====== Buscar ====== */
async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `./${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      break;
    }

    if (!res.ok) break;

    const html = await res.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const ofertas = temp.querySelectorAll('.box_offer');
    if (ofertas.length === 0) break;

    ofertas.forEach(oferta => {
      const texto = (oferta.innerText || '').toLowerCase();
      if (texto.includes(query)) {
        const data = extraerData(oferta);

        // ✅ IMPORTANTÍSIMO:
        // NO clonamos la oferta original, renderizamos card limpia
        contenedor.insertAdjacentHTML('beforeend', renderCard(data));
        totalEncontrados++;
      }
    });
  }
}

async function buscarGlobal() {
  for (const ciudad of ciudades) {
    await buscarCiudad(ciudad);
  }

  if (totalEncontrados === 0) {
    contenedor.innerHTML = '<div class="nores">No se encontraron resultados.</div>';
    if (detalle) detalle.innerHTML = 'No hay resultados para mostrar.';
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;
}

buscarGlobal();
