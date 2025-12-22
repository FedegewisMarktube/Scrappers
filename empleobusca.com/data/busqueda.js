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

// 🔧 CONFIGURACIÓN
const ciudades = [
  { nombre: 'Buenos Aires', slug: 'buenos_aires' },
  { nombre: 'Córdoba', slug: 'cordoba' },
  { nombre: 'Mendoza', slug: 'mendoza' }
];

const MAX_PAGINAS = 50; // límite de seguridad

let totalEncontrados = 0;

/**
 * Convierte href relativos del HTML clonado (ej: "/ofertas-de-trabajo/...")
 * para que apunten al archivo local dentro de cada carpeta de ciudad.
 *
 * Si tus ofertas locales están en:
 *   ./buenos_aires/ofertas-de-trabajo/xxxxx.html
 * ajustá el mapping acá abajo.
 */
function fixLinksDentroDeOferta(clone, ciudadSlug) {
  // 1) Links a ofertas en Computrabajo suelen venir como:
  // href="/ofertas-de-trabajo/....#lc=..."
  // Los pasamos a local:
  // ./{ciudadSlug}/ofertas-de-trabajo/....
  clone.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) return;

    // si es absoluto (http, https) lo dejamos
    if (/^https?:\/\//i.test(href)) return;

    // si ya es relativo local "./..." lo dejamos
    if (href.startsWith('./')) return;

    // si es anchor "#..." lo dejamos
    if (href.startsWith('#')) return;

    // Computrabajo suele usar paths que empiezan con "/"
    if (href.startsWith('/')) {
      a.setAttribute('href', `./${ciudadSlug}${href}`);
      return;
    }

    // caso raro: "ofertas-de-trabajo/..." sin barra inicial
    if (href.startsWith('ofertas-de-trabajo/')) {
      a.setAttribute('href', `./${ciudadSlug}/${href}`);
      return;
    }
  });
}

/**
 * Evita IDs duplicados al clonar nodos desde múltiples páginas.
 * (No siempre rompe, pero es buena práctica.)
 */
function removeDuplicateIds(node) {
  node.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
}

async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `/data/${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

    try {
      const res = await fetch(url, { cache: 'no-store' });

      // si no existe la página, cortamos esta ciudad
      if (!res.ok) break;

      const html = await res.text();
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const ofertas = temp.querySelectorAll('.box_offer');

      // si la página existe pero no tiene ofertas → cortamos
      if (ofertas.length === 0) break;

      ofertas.forEach(oferta => {
        const texto = (oferta.innerText || '').toLowerCase();

        if (texto.includes(query)) {
          const clone = oferta.cloneNode(true);

          // limpiar IDs duplicados
          removeDuplicateIds(clone);

          // arreglar href dentro del clon para que funcionen localmente
          fixLinksDentroDeOferta(clone, ciudad.slug);

          // opcional: marcar de qué ciudad vino
          clone.setAttribute('data-ciudad', ciudad.slug);

          contenedor.appendChild(clone);
          totalEncontrados++;
        }
      });

    } catch (e) {
      // error = cortamos esta ciudad
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
