const params = new URLSearchParams(window.location.search);
const queryRaw = (params.get('q') || '').trim();
const query = queryRaw.toLowerCase();

const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');
const contenedor = document.getElementById('resultados');

const panel = document.getElementById('panel_detalle');
const detalle = document.getElementById('detalle_contenido');

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

function txt(el) {
  return (el && el.textContent ? el.textContent : '').trim();
}

function escapeHtml(str) {
  return (str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function extraerData(oferta, ciudadNombre) {
  const aTitulo = oferta.querySelector('h2 a') || oferta.querySelector('a[href]');
  const titulo = txt(aTitulo) || txt(oferta.querySelector('h2')) || 'Oferta';

  // empresa / ubicación / fecha: intentos flexibles
  let empresa = txt(oferta.querySelector('.company')) || '';
  let ubicacion = txt(oferta.querySelector('.mr10')) || txt(oferta.querySelector('.place')) || '';
  let fecha = txt(oferta.querySelector('.fc_aux')) || '';

  // si no encontró empresa, probamos primer <p> luego del h2
  if (!empresa) {
    const ps = Array.from(oferta.querySelectorAll('p'));
    if (ps.length) empresa = txt(ps[0]);
  }

  // descripción: si en tu HTML existe algo tipo .descripcion_scrapeada, lo usamos
  // (si no existe, mostramos placeholder)
  const descNode = oferta.querySelector('.descripcion_scrapeada') || oferta.querySelector('[data-desc]');
  const descripcionHtml = descNode ? (descNode.innerHTML || '').trim() : '';

  // también agrego una linea de "ciudad" para que sepas de dónde vino (podés borrarlo si no querés)
  const origen = ciudadNombre || '';

  return { titulo, empresa, ubicacion, fecha, descripcionHtml, origen };
}

function renderCard(data, id) {
  return `
    <article class="box_offer" data-id="${id}">
      <h2 class="fs18 fwB prB">
        <a class="fc_base t_ellipsis" href="#" role="button" data-no-nav="1">
          ${escapeHtml(data.titulo)}
        </a>
      </h2>

      <p class="dFlex vm_fx fs16 fc_base mt5">
        <span class="t_ellipsis">${escapeHtml(data.empresa || '')}</span>
      </p>

      <p class="fs16 fc_base mt5">
        <span class="mr10">${escapeHtml(data.ubicacion || '')}</span>
      </p>

      <p class="fs13 fc_aux mt15">
        ${escapeHtml(data.fecha || '')}
      </p>

      ${data.origen ? `<p class="fs13 fc_aux mt5">Origen: ${escapeHtml(data.origen)}</p>` : ''}

      <!-- Guardamos la descripción para el panel -->
      <div class="descripcion_scrapeada" style="display:none;">${data.descripcionHtml || ''}</div>
    </article>
  `;
}

function mostrarDetalle(card) {
  const desc = card.querySelector('.descripcion_scrapeada');
  const html = (desc && desc.innerHTML ? desc.innerHTML.trim() : '');

  if (html) {
    detalle.innerHTML = html;
  } else {
    detalle.innerHTML = `
      <div class="nores">
        No hay descripción disponible para esta oferta en el HTML guardado.
      </div>
    `;
  }
}

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
        const data = extraerData(oferta, ciudad.nombre);
        const id = `${ciudad.slug}_p${pagina}_${totalEncontrados + 1}`;

        contenedor.insertAdjacentHTML('beforeend', renderCard(data, id));
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
    detalle.innerHTML = 'No hay resultados para mostrar.';
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;
}

contenedor.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-no-nav="1"]');
  if (a) {
    e.preventDefault();
    e.stopPropagation();
  }

  const card = e.target.closest('.box_offer');
  if (!card) return;

  contenedor.querySelectorAll('.box_offer.sel').forEach(x => x.classList.remove('sel'));
  card.classList.add('sel');

  mostrarDetalle(card);
});

buscarGlobal();
