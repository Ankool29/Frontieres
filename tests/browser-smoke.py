"""Contrôle des deux pages dans Chromium avec viewport/tactile mobile."""
import json
import functools
import http.server
import threading
import os
import shutil
import sys
from playwright.sync_api import sync_playwright

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[1])
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_BIN') or shutil.which('chromium'),
        headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    try:
        for name in ['index.html', 'exploration.html']:
            context = browser.new_context(viewport={'width':393, 'height':851},
                                          is_mobile=True, has_touch=True)
            context.add_init_script("Math.random = () => 28.5 / 999999;")
            page = context.new_page()
            cdp = context.new_cdp_session(page)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate':4})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/{name}', timeout=30000)
            page.wait_for_selector('#smoke-result', timeout=60000)
            result = json.loads(page.locator('#smoke-result').text_content())
            assert result['ok'], result
            assert not errors, errors
            print(f"{name}: {len(result['results'])} vérifications navigateur réussies (CPU ×4) ; {result['metrics']}")
            context.close()
    finally:
        browser.close()
        server.shutdown()
