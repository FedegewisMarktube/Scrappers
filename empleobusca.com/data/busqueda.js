const params = new URLSearchParams(window.location.search);
const queryRaw = (params.get('q') || '').trim();
const query = queryRaw.toLowerCase();

const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');
const contenedor = document.getElementById('resultados');

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

/* ====== Helpers para sacar data de una box_offer ====== */
function txt(el) {
  return (el && el.textContent ? el.textContent : '').trim();
}

function extraerDataDesdeBoxOffer(oferta) {
  // Título (normalmente está en h2 a)
  const aTitulo = oferta.querySelector('h2 a') || oferta.querySelector('a[href]');
  const titulo = txt(aTitulo) || txt(oferta.querySelector('h2')) || 'Oferta';

  // Empresa: intentamos varias opciones comunes
  let empresa =
    txt(oferta.querySelector('.company')) ||
    txt(oferta.querySelector('[data-company]')) ||
    '';

  // Si no encontró, probamos tomar el primer <p> después del título
  if (!empresa) {
    const pList = Array.from(oferta.querySelectorAll('p'));
    if (pList.length) empresa = txt(pList[0]);
  }

  // Ubicación: muchas veces está en un span con mr10 o similar
  let ubicacion =
    txt(oferta.querySelector('.mr10')) ||
    txt(oferta.querySelector('.place')) ||
    '';

  // Fecha: suele estar con fc_aux
  let fecha =
    txt(oferta.querySelector('.fc_aux')) ||
    '';

  return { titulo, empresa, ubicacion, fecha };
}

/* ====== Render de card con el look correcto ====== */
function renderCard({ titulo, empresa, ubicacion, fecha }) {
  // OJO: dejamos href="#" para bloquear detalle
  return `
    <article class="box_offer">
      <h2 class="fs18 fwB prB">
        <a class="fc_base t_ellipsis" href="#" role="button" data-no-detail="1">
          ${escapeHtml(titulo)}
        </a>
      </h2>

      <p class="dFlex vm_fx fs16 fc_base mt5">
        <span class="t_ellipsis">${escapeHtml(empresa || '')}</span>
      </p>

      <p class="fs16 fc_base mt5">
        <span class="mr10">${escapeHtml(ubicacion || '')}</span>
      </p>

      <p class="fs13 fc_aux mt15">
        ${escapeHtml(fecha || '')}
      </p>
    </article>
  `;
}

/* ====== Escape básico para no romper HTML si viene algo raro ====== */
function escapeHtml(str) {
  return (str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ====== Bloqueo de detalle (una sola vez, por delegación) ====== */
contenedor.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-no-detail="1"]');
  if (a) {
    e.preventDefault();
    e.stopPropagation();
    alert('Detalle no disponible en este sitio.');
  }

  // marcar seleccionada la card (sin “cambiar raro”)
  const card = e.target.closest('.box_offer');
  if (card) {
    contenedor.querySelectorAll('.box_offer.sel').forEach(x => x.classList.remove('sel'));
    card.classList.add('sel');
  }
});

/* ====== Buscar por ciudad/página ====== */
async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `./${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

    let res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      break; // fallo red
    }

    if (!res.ok) break; // no existe la pagina

    const html = await res.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const ofertas = temp.querySelectorAll('.box_offer');
    if (ofertas.length === 0) break;

    ofertas.forEach(oferta => {
      const texto = (oferta.innerText || '').toLowerCase();
      if (texto.includes(query)) {
        const data = extraerDataDesdeBoxOffer(oferta);

        // ✅ renderizamos una NUEVA card (queda igual, sin basura/hrefs/handlers)
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
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;
}

buscarGlobal();
