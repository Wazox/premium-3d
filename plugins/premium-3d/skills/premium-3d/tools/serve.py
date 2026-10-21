#!/usr/bin/env python3
"""Serveur local du dossier courant : python3 tools/serve.py [port]  (par défaut 5180)"""
import http.server, socketserver, sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
handler = http.server.SimpleHTTPRequestHandler
handler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml"})
with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
    print(f"http://127.0.0.1:{port}")
    httpd.serve_forever()
