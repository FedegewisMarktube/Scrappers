import os
import time
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ================== CONFIGURACIÓN ==================

BASE_URL = "https://ar.computrabajo.com"

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
OFERTAS_DIR = os.path.join(DATA_DIR, "ofertas_detalle")

os.makedirs(OFERTAS_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
}

REQUEST_DELAY_SECONDS = 2.0  # tiempo entre requests al sitio
MAX_OFERTAS = 20             # por ahora probamos con 20 ofertas


# ========== 1) SACAR LINKS DESDE TUS LISTADOS LOCALES ==========

def es_link_oferta(href: str) -> bool:
    return href and "/ofertas-de-trabajo/oferta-de-trabajo-de-" in href


def obtener_links_desde_listados() -> list[str]:
    """
    Recorre los buenos_aires_pX.html y devuelve una lista
    de links de ofertas únicos (sin el #lc=...).
    """
    urls: list[str] = []
    vistos = set()

    for archivo in sorted(os.listdir(DATA_DIR)):
        if not (archivo.startswith("buenos_aires_p") and archivo.endswith(".html")):
            continue

        ruta = os.path.join(DATA_DIR, archivo)
        print(f"📄 Leyendo {archivo}...")
        with open(ruta, "r", encoding="utf-8") as f:
            html = f.read()

        soup = BeautifulSoup(html, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not es_link_oferta(href):
                continue

            href_base = href.split("#")[0]
            if href_base not in vistos:
                vistos.add(href_base)
                urls.append(href_base)

    print(f"✅ Encontradas {len(urls)} ofertas únicas en los listados.")
    return urls


# ========== 2) BAJAR DETALLE Y EXTRAER DESCRIPCIÓN (CON CACHÉ) ==========

def ruta_cache_para_href(href: str) -> str:
    nombre = re.sub(r"[^a-zA-Z0-9_]", "_", href) + ".html"
    return os.path.join(OFERTAS_DIR, nombre)


def descargar_html_detalle(href: str) -> str | None:
    """
    Devuelve el HTML de detalle de una oferta.
    - Si ya fue descargado, lo lee desde disco.
    - Si no, lo baja y lo guarda.
    """
    ruta_archivo = ruta_cache_para_href(href)

    if os.path.exists(ruta_archivo):
        print(f"📁 Usando caché local para {href}")
        with open(ruta_archivo, "r", encoding="utf-8") as f:
            return f.read()

    url = urljoin(BASE_URL, href)
    print(f"⬇️  Descargando detalle: {url}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=25)
    except requests.RequestException as e:
        print(f"   ❌ Error de red: {e}")
        return None

    if resp.status_code != 200:
        print(f"   ❌ HTTP {resp.status_code}, no guardo.")
        return None

    html = resp.text
    with open(ruta_archivo, "w", encoding="utf-8") as f:
        f.write(html)

    return html


def adivinar_div_descripcion(soup: BeautifulSoup):
    """
    Heurística: buscamos el <div> con más texto que parezca cuerpo de la oferta.
    Así evitamos tocar clases/ids del sitio.
    """
    candidatos = []

    for div in soup.find_all("div"):
        texto = div.get_text(" ", strip=True)
        if len(texto) < 300:
            continue
        tlow = texto.lower()
        if "cookies" in tlow or "política de privacidad" in tlow:
            continue
        candidatos.append((len(texto), div))

    if not candidatos:
        return None

    candidatos.sort(key=lambda x: x[0], reverse=True)
    return candidatos[0][1]


def extraer_descripcion(html_detalle: str) -> str:
    soup = BeautifulSoup(html_detalle, "html.parser")
    div_desc = adivinar_div_descripcion(soup)
    if not div_desc:
        return ""
    return div_desc.get_text("\n", strip=True)


def construir_diccionario_descripciones(links: list[str]) -> dict[str, str]:
    """
    Devuelve un dict {href_base: descripcion}.
    Solo procesa hasta MAX_OFERTAS si está configurado.
    """
    descripciones: dict[str, str] = {}

    links_a_procesar = links
    if MAX_OFERTAS is not None:
        links_a_procesar = links[:MAX_OFERTAS]

    total = len(links_a_procesar)
    for i, href in enumerate(links_a_procesar, start=1):
        print(f"\n[{i}/{total}] Procesando {href}...")
        html_detalle = descargar_html_detalle(href)
        if not html_detalle:
            continue

        desc = extraer_descripcion(html_detalle)
        if desc:
            print(f"   ✅ Descripción encontrada ({len(desc)} caracteres).")
        else:
            print("   ⚠ Sin descripción (heurística no encontró nada).")

        descripciones[href] = desc

        time.sleep(REQUEST_DELAY_SECONDS)

    return descripciones


# ========== 3) LIMPIAR Y RELLENAR PANEL DERECHO ==========

def limpiar_descripciones_previas(soup: BeautifulSoup) -> None:
    """
    Si en algún momento metimos <div class="descripcion_scrapeada"> en las cards,
    acá las borramos para dejar limpia la columna izquierda.
    """
    for old in soup.select("div.descripcion_scrapeada"):
        old.decompose()


def inyectar_en_panel_derecho(descripciones: dict[str, str]) -> None:
    """
    Para cada buenos_aires_pX.html:
    - encuentra la oferta seleccionada (article.box_offer.sel)
    - busca su descripción en el dict (o la descarga si falta)
    - reemplaza el contenido de <div class="description_offer"> por
      título, empresa, ubicación y texto de la oferta.
    """
    for archivo in sorted(os.listdir(DATA_DIR)):
        if not (archivo.startswith("buenos_aires_p") and archivo.endswith(".html")):
            continue

        ruta = os.path.join(DATA_DIR, archivo)
        print(f"\n🛠 Modificando {archivo}...")
        with open(ruta, "r", encoding="utf-8") as f:
            html = f.read()

        soup = BeautifulSoup(html, "html.parser")

        # 1) limpiamos cualquier cosa vieja que hayamos metido en las cards
        limpiar_descripciones_previas(soup)

        # 2) buscamos la oferta seleccionada
        card_sel = soup.find("article", class_="box_offer sel")
        if not card_sel:
            print("   ⚠ No encontré .box_offer.sel en esta página, la dejo igual.")
            continue

        link_tag = card_sel.find("a", href=True)
        if not link_tag:
            print("   ⚠ La oferta seleccionada no tiene <a href>, la dejo igual.")
            continue

        href = link_tag["href"].strip().split("#")[0]

        # 3) buscamos la descripción; si no está en el dict, la bajamos ahora
        desc = descripciones.get(href)
        if not desc:
            html_detalle = descargar_html_detalle(href)
            if html_detalle:
                desc = extraer_descripcion(html_detalle)

        if not desc:
            print("   ⚠ No tengo descripción para esta oferta, no toco el panel derecho.")
            continue

        # 4) sacamos título / empresa / ubicación de la card seleccionada
        title = ""
        company = ""
        location = ""

        h2 = card_sel.find("h2")
        if h2:
            title = h2.get_text(strip=True)

        ps = card_sel.find_all("p")
        if len(ps) >= 1:
            company = ps[0].get_text(strip=True)
        if len(ps) >= 2:
            # normalmente el último p es la ubicación
            location = ps[-1].get_text(strip=True)

        # 5) encontramos el contenedor del panel derecho
        panel = soup.find("div", class_="description_offer")
        if not panel:
            print("   ⚠ No encontré <div class=\"description_offer\">, no puedo rellenar.")
            continue

        # por dentro suele haber un <div> más; si no, lo creamos
        inner = panel.find("div")
        if inner is None:
            inner = soup.new_tag("div")
            panel.clear()
            panel.append(inner)
        else:
            inner.clear()

        # 6) construimos el contenido "como en la página"
        if title:
            h_title = soup.new_tag("h2")
            h_title.string = title
            inner.append(h_title)

        if company or location:
            p_header = soup.new_tag("p")
            texto_header = company
            if company and location:
                texto_header += " · " + location
            elif location:
                texto_header = location
            p_header.string = texto_header
            inner.append(p_header)

        # línea separadora
        hr = soup.new_tag("hr")
        inner.append(hr)

        # descripción en párrafos
        for linea in desc.split("\n"):
            linea = linea.strip()
            if not linea:
                continue
            p = soup.new_tag("p")
            p.string = linea
            inner.append(p)

        # 7) guardamos cambios
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(str(soup))

        print("   ✅ Panel derecho rellenado con la oferta seleccionada.")


# ========== MAIN ==========

def main():
    print("1️⃣ Buscando links de ofertas en tus páginas locales...")
    links = obtener_links_desde_listados()

    print("\n2️⃣ Descargando y extrayendo descripciones (máx. 20 ofertas)...")
    descripciones = construir_diccionario_descripciones(links)

    print("\n3️⃣ Rellenando panel derecho en cada buenos_aires_pX.html...")
    inyectar_en_panel_derecho(descripciones)

    print("\n🎉 Listo. Revisá tus archivos buenos_aires_pX.html en la carpeta data/.")


if __name__ == "__main__":
    main()
