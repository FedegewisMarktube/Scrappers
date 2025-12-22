const params = new URLSearchParams(window.location.search);
const query = (params.get('q') || '').trim().toLowerCase();

const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');
const contenedor = document.getElementById('resultados');

if (!query) {
  titulo.innerText = 'Búsqueda global';
  subtitulo.innerText = 'Volvé al Home e ingresá un término.';
  throw new Error('Sin búsqueda');
}

titulo.innerText = `Resultados para: "${query}"`;
subtitulo.innerText = 'Buscando en todas las ciudades y páginas…';

const ciudades = [
  { nombre: 'Buenos Aires', slug: 'buenos_aires' },
  { nombre: 'Córdoba', slug: 'cordoba' },
  { nombre: 'Mendoza', slug: 'mendoza' }
];

const MAX_PAGINAS = 50;
let totalEncontrados = 0;

// base dinámica: /Scrappers/empleobusca.com/data/
const BASE_DATA = window.location.pathname.replace(/\/[^\/]*$/, '/');

function safeText(el) {
  return (el && el.textContent ? el.textContent : '').trim();
}

function buildOfferCard({ title, company, place, time, href }) {
  const art = document.createElement('article');
  art.className = 'box_offer';

  art.innerHTML = `
    <h2 class="fs18 fwB prB">
      <a class="js-o-link fc_base" href="${href || '#'}">
        ${title || 'Oferta'}
      </a>
    </h2>

    ${company ? `<p class="fs14 fc_aux">${company}</p>` : ''}
    ${place ? `<p class="fs14 fc_aux">${place}</p>` : ''}
    ${time ? `<span class="fs12 fc_aux">${time}</span>` : ''}

    <div class="mt10">
      <span class="tag b_primary_inv tiny">Ver oferta</span>
    </div>
  `;

  return art;
}

function extractOfferData(ofertaEl, ciudadSlug) {
  // título
  const aTitle =
    ofertaEl.querySelector('h2 a') ||
    ofertaEl.querySelector('a[href]');

  const title = safeText(aTitle) || safeText(ofertaEl.querySelector('h2')) || '';

  // empresa / lugar / fecha (depende tu HTML, esto es flexible)
  const pTags = Array.from(ofertaEl.querySelectorAll('p')).map(p => safeText(p)).filter(Boolean);

  const company = pTags[0] || '';
  const place   = pTags[1] || '';
  const time =
    safeText(ofertaEl.querySelector('time')) ||
    safeText(ofertaEl.querySelector('.fs12')) ||
    (ofertaEl.innerText.match(/Hace\s+\d+\s+\w+/i)?.[0] || '');

  // link
  let href = aTitle ? aTitle.getAttribute('href') : '';

  // normalizar href a local dentro de /data/{ciudad}/...
  if (href) {
    if (/^https?:\/\//i.test(href)) {
      // ok
    } else if (href.startsWith('/')) {
      href = `${BASE_DATA}${ciudadSlug}${href}`;
    } else if (href.startsWith('./')) {
      // relativo local ya ok, lo hacemos relativo a /data/
      href = `${BASE_DATA}${href.replace(/^\.\//, '')}`;
    } else {
      // relativo sin ./ ni /
      href = `${BASE_DATA}${ciudadSlug}/${href}`;
    }
  } else {
    href = '#';
  }

  return { title, company, place, time, href };
}

async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `${BASE_DATA}${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) break;

      const html = await res.text();
      const temp = document.createElement('div');
      temp.innerHTML = html;

      // ojo: si en tus páginas no existe .box_offer, podés cambiar a "article" o ".offer"
      const ofertas = temp.querySelectorAll('.box_offer, article');
      if (ofertas.length === 0) break;

      ofertas.forEach(oferta => {
        const texto = (oferta.innerText || '').toLowerCase();
        if (texto.includes(query)) {
          const data = extractOfferData(oferta, ciudad.slug);
          contenedor.appendChild(buildOfferCard(data));
          totalEncontrados++;
        }
      });

    } catch (e) {
      break;
    }
  }
}

async function buscarGlobal() {
  for (const ciudad of ciudades) {
    await buscarCiudad(ciudad);
  }

  if (totalEncontrados === 0) {
    contenedor.innerHTML = '<p class="fc_aux">No se encontraron resultados.</p>';
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;
}

buscarGlobal();
