import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import re
import time

BASE_URL = "https://www.desmoinesfencingclub.org"
ARCHIVE_DIR = r"C:\Users\Jfree\source\Fencing Website\Archive Site"

visited = set()
to_visit = [BASE_URL + "/"]

def sanitize_filename(url):
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        path = "index"
    path = re.sub(r'[<>:"/\\|?*]', '_', path)
    if not path.endswith(".html"):
        path = path.rstrip("/") + ".html"
    return path

def download_page(url):
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text, resp.headers.get("content-type", "")
    except Exception as e:
        print(f"  ERROR fetching {url}: {e}")
        return None, None

def get_internal_links(html, current_url):
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for tag in soup.find_all("a", href=True):
        href = tag["href"]
        full = urljoin(current_url, href)
        parsed = urlparse(full)
        if parsed.netloc in ("www.desmoinesfencingclub.org", "desmoinesfencingclub.org"):
            clean = parsed._replace(fragment="", query="").geturl()
            links.add(clean)
    return links

os.makedirs(ARCHIVE_DIR, exist_ok=True)

while to_visit:
    url = to_visit.pop(0)
    if url in visited:
        continue
    visited.add(url)

    print(f"Downloading: {url}")
    html, ctype = download_page(url)
    if html is None or "text/html" not in ctype:
        continue

    filename = sanitize_filename(url)
    filepath = os.path.join(ARCHIVE_DIR, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  Saved -> {filename}")

    new_links = get_internal_links(html, url)
    for link in new_links:
        if link not in visited:
            to_visit.append(link)

    time.sleep(0.5)

print(f"\nDone. Downloaded {len(visited)} pages to: {ARCHIVE_DIR}")
