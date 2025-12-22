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

async function buscarCiudad(ciudad) {
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `./${ciudad.slug}/${ciudad.slug}_p${pagina}.html`;

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
          contenedor.appendChild(oferta.cloneNode(true));
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
    contenedor.innerHTML = '<p>No se encontraron resultados.</p>';
  }

  subtitulo.innerText = `Resultados encontrados: ${totalEncontrados}`;
}

buscarGlobal();
