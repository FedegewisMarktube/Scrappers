const params = new URLSearchParams(window.location.search);
const queryRaw = (params.get('q') || '').trim();
const query = queryRaw.toLowerCase();

const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');
const contenedor = document.getElementById('resultados');

// ✅ Igual que las páginas: escribir acá
const detailBox = document.querySelector('[data-offers-grid-box-detail]');
const detailContainer =
  (detailBox && detailBox.querySelector('[data-offers-grid-detail-container]'))
  || document.getElementById('detalle_contenido'); // fallback por si cambia el HTML

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

/* Construye el HTML de la descripción EXACTO como tu script de páginas */
function buildDescripcionHtml(descripcionHtml) {
  if (!descripcionHtml) return '';

  const tmp = document.createElement('div');
  tmp.innerHTML = descripcionHtml;

  const lines = Array.from(tmp.querySelectorAll('p'))
    .map(p => (p.textContent || '').trim())
    .filter(p => p.length > 0);

  let html = '';
  lines.forEach(line => {
    // bullets con - o *
    if (/^\s*[-*]\s+/.test(line)) {
      const t = line.replace(/^\s*[-*]\s+/, '');
      html += `<p style="margin:0 0 8px 0;">• ${escapeHtml(t)}</p>`;
    } else {
      html += `<p style="margin:0 0 10px 0;">${escapeHtml(line)}</p>`;
    }
  });

  return html;
}

/* Saca datos de la oferta original */
function extraerData(oferta) {
  const t =
    txt(oferta.querySelector('h2 a')) ||
    txt(oferta.querySelector('h2')) ||
    'Oferta';

  const ps = Array.from(oferta.querySelectorAll('p'))
    .map(p => txt(p))
    .filter(Boolean);

  const empresa = ps[0] || '';
  const ubicacion = ps[1] || '';
  const fecha = ps[2] || '';

  // ✅ En tus páginas existe esto
  const descDiv = oferta.querySelector('.descripcion_scrapeada');
  const descripcionHtml = descDiv ? (descDiv.innerHTML || '').trim() : '';

  return { titulo: t, empresa, ubicacion, fecha, descripcionHtml };
}

/* Render card (lista izquierda) */
function renderCard(data) {
  const payload = encodeURIComponent(JSON.stringify(data));

  return `
    <article class="box_offer" data-detail="${payload}">
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

/* Render panel derecho (igual a páginas) */
function renderDetalle(data) {
  if (!detailContainer) return;

  const desc = buildDescripcionHtml(data.descripcionHtml);

  // Si no hay desc, mostramos un fallback más prolijo
  const cuerpo = desc
    ? `<div style="font-size:15px; line-height:1.5;">${desc}</div>`
    : `<p class="fc_aux" style="margin:0;">Sin descripción disponible.</p>`;

  // ✅ misma estructura que el script original de buenos_aires_p1
  detailContainer.innerHTML = `
    <div class="box_border" style="padding:20px;">
      <h1 class="fs22 fwB" style="margin-bottom:5px;">
        ${escapeHtml(data.titulo)}
      </h1>

      <p class="fwB" style="margin:0;">${escapeHtml(data.empresa)}</p>
      <p style="margin:0 0 15px 0;">${escapeHtml(data.ubicacion)}</p>

      <div style="margin:15px 0;">
        <button style="
          background:#0D3878;
          color:#fff;
          padding:10px 20px;
          border-radius:25px;
          border:none;
          font-weight:bold;
          cursor:pointer;">
          Postularme
        </button>
      </div>

      ${cuerpo}
    </div>
  `;
}

/* ===== Click delegado: abrir panel + marcar sel ===== */
contenedor.addEventListener('click', (e) => {
  const card = e.target.closest('.box_offer');
  if (!card) return;

  // bloquear navegación de links
  const anyLink = e.target.closest('a');
  if (anyLink) {
    e.preventDefault();
    e.stopPropagation();
  }

  // 🚫 si ya está seleccionada, no hacer nada (como tus páginas)
  if (card.classList.contains('sel')) return;

  contenedor.querySelectorAll('.box_offer.sel').forEach(x => x.classList.remove('sel'));
  card.classList.add('sel');

  let data;
  try {
    data = JSON.parse(decodeURIComponent(card.getAttribute('data-detail') || '{}'));
  } catch {
    data = null;
  }

  if (!data) {
    if (detailContainer) detailContainer.innerHTML = `<div class="nores">No se pudo cargar el detalle.</div>`;
    return;
  }

  renderDetalle(data);
});

/* ===== Buscar ===== */
async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `./${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch {
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
      if (!texto.includes(query)) return;

      const data = extraerData(oferta);
      contenedor.insertAdjacentHTML('beforeend', renderCard(data));
      totalEncontrados++;
    });
  }
}

async function buscarGlobal() {
  for (const ciudad of ciudades) {
    await buscarCiudad(ciudad);
  }

  if (totalEncontrados === 0) {
    contenedor.innerHTML = '<div class="nores">No se encontraron resultados.</div>';
    if (detailContainer) detailContainer.innerHTML = 'No hay resultados para mostrar.';
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;

  // ✅ auto-seleccionar primera oferta (como las páginas)
  const first = contenedor.querySelector('.box_offer');
  if (first) first.click();
}

buscarGlobal();
