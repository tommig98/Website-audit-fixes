#!/usr/bin/env python3
"""
Script di audit automatizzato per siti web
Esegue un'analisi completa di funzionalità, SEO, accessibilità e sicurezza
"""

import requests
import re
import json
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime
import time
import base64

class WebsiteAuditor:
    def __init__(self, url):
        self.base_url = url
        self.domain = urlparse(url).netloc
        self.audit_results = {
            "metadata": {
                "url": url,
                "audit_date": datetime.now().isoformat(),
                "audit_version": "1.0"
            }
        }
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; WebAuditor/1.0)'
        })

    def download_page(self):
        """Scarica la pagina principale e analizza la struttura"""
        try:
            response = self.session.get(self.base_url, timeout=10)
            response.raise_for_status()
            self.html_content = response.text
            self.soup = BeautifulSoup(self.html_content, 'html.parser')
            return True
        except Exception as e:
            print(f"❌ Errore durante il download: {e}")
            return False

    def audit_links_and_routes(self):
        """Analizza tutti i link e le route"""
        results = {
            "internal_links": [],
            "external_links": [],
            "broken_links": [],
            "status_codes": {}
        }

        links = self.soup.find_all('a', href=True)
        for link in links:
            href = link['href']
            full_url = urljoin(self.base_url, href)

            if self.domain in full_url:
                results["internal_links"].append({
                    "href": href,
                    "full_url": full_url,
                    "text": link.get_text(strip=True)[:100]
                })
            else:
                results["external_links"].append({
                    "href": href,
                    "full_url": full_url,
                    "text": link.get_text(strip=True)[:100]
                })

            # Test connettività (limitiamo per performance)
            if len(results["status_codes"]) < 20:  # Limita i test
                try:
                    test_response = self.session.head(full_url, timeout=5)
                    results["status_codes"][full_url] = test_response.status_code
                    if test_response.status_code >= 400:
                        results["broken_links"].append({
                            "url": full_url,
                            "status": test_response.status_code,
                            "element": str(link)[:200]
                        })
                except:
                    results["broken_links"].append({
                        "url": full_url,
                        "status": "unreachable",
                        "element": str(link)[:200]
                    })

        return results

    def audit_broken_anchors(self):
        """Trova anchor con href vuoti o ID non esistenti"""
        results = {
            "empty_href": [],
            "missing_targets": [],
            "selectors": []
        }

        anchors = self.soup.find_all('a')
        existing_ids = set([elem.get('id') for elem in self.soup.find_all() if elem.get('id')])

        for i, anchor in enumerate(anchors):
            href = anchor.get('href', '')

            # Anchor con href vuoti o solo #
            if href in ['', '#', 'javascript:void(0)', 'javascript:;']:
                results["empty_href"].append({
                    "element": str(anchor)[:200],
                    "selector": f"a:nth-child({i+1})",
                    "text": anchor.get_text(strip=True)[:50]
                })
                results["selectors"].append(f"a:nth-child({i+1})")

            # Anchor che puntano a ID non esistenti
            elif href.startswith('#') and len(href) > 1:
                target_id = href[1:]
                if target_id not in existing_ids:
                    results["missing_targets"].append({
                        "href": href,
                        "target_id": target_id,
                        "element": str(anchor)[:200],
                        "selector": f"a[href='{href}']"
                    })

        return results

    def audit_buttons(self):
        """Trova pulsanti senza handler funzionanti"""
        results = {
            "buttons_without_handlers": [],
            "css_selectors": []
        }

        buttons = self.soup.find_all(['button', 'input'])
        for button in buttons:
            if button.name == 'input' and button.get('type') not in ['button', 'submit']:
                continue

            onclick = button.get('onclick', '')
            href = button.get('href', '') if button.name == 'a' else ''
            form_parent = button.find_parent('form')

            # Pulsante senza azione
            if not onclick and not href and not form_parent:
                results["buttons_without_handlers"].append({
                    "element": str(button)[:200],
                    "text": button.get_text(strip=True)[:50] or button.get('value', '')[:50],
                    "type": button.get('type', 'button'),
                    "class": button.get('class', [])
                })

                # Genera CSS selector
                classes = ' '.join(button.get('class', []))
                selector = f"{button.name}"
                if classes:
                    selector += f".{'.'.join(button.get('class', []))}"
                results["css_selectors"].append(selector)

        return results

    def audit_forms(self):
        """Analizza i form e la loro validazione"""
        results = {
            "forms_with_empty_action": [],
            "unreachable_endpoints": [],
            "validation_issues": []
        }

        forms = self.soup.find_all('form')
        for form in forms:
            action = form.get('action', '')
            method = form.get('method', 'get').lower()

            if not action or action in ['', '#']:
                results["forms_with_empty_action"].append({
                    "element": str(form)[:300],
                    "method": method,
                    "fields": [inp.get('name') for inp in form.find_all(['input', 'select', 'textarea']) if inp.get('name')]
                })

            # Test raggiungibilità endpoint (se HTTP/HTTPS)
            elif action.startswith(('http', '/')):
                full_action = urljoin(self.base_url, action)
                try:
                    # Test con method appropriato
                    if method == 'post':
                        test_response = self.session.post(full_action, timeout=5, data={})
                    else:
                        test_response = self.session.get(full_action, timeout=5)

                    if test_response.status_code == 404:
                        results["unreachable_endpoints"].append({
                            "action": action,
                            "full_url": full_action,
                            "method": method,
                            "status": test_response.status_code
                        })
                except Exception as e:
                    results["unreachable_endpoints"].append({
                        "action": action,
                        "full_url": full_action,
                        "method": method,
                        "error": str(e)
                    })

        return results

    def audit_assets(self):
        """Verifica la disponibilità di tutti gli asset"""
        results = {
            "css_files": [],
            "js_files": [],
            "images": [],
            "other_assets": [],
            "total_size_kb": 0
        }

        # CSS files
        for link in self.soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                full_url = urljoin(self.base_url, href)
                asset_info = self._test_asset(full_url, 'css')
                results["css_files"].append(asset_info)

        # JavaScript files
        for script in self.soup.find_all('script', src=True):
            src = script.get('src')
            if src:
                full_url = urljoin(self.base_url, src)
                asset_info = self._test_asset(full_url, 'js')
                results["js_files"].append(asset_info)

        # Images
        for img in self.soup.find_all('img', src=True):
            src = img.get('src')
            if src:
                full_url = urljoin(self.base_url, src)
                asset_info = self._test_asset(full_url, 'image')
                results["images"].append(asset_info)

        # Calculate total size
        for category in ['css_files', 'js_files', 'images', 'other_assets']:
            for asset in results[category]:
                if asset.get('size_kb'):
                    results["total_size_kb"] += asset['size_kb']

        return results

    def _test_asset(self, url, asset_type):
        """Test singolo asset"""
        try:
            response = self.session.head(url, timeout=5)
            size_bytes = int(response.headers.get('content-length', 0))
            return {
                "url": url,
                "status": response.status_code,
                "size_kb": round(size_bytes / 1024, 2),
                "content_type": response.headers.get('content-type', ''),
                "accessible": response.status_code == 200
            }
        except Exception as e:
            return {
                "url": url,
                "status": "error",
                "size_kb": 0,
                "error": str(e),
                "accessible": False
            }

    def audit_security(self):
        """Cerca problemi di sicurezza"""
        results = {
            "exposed_secrets": [],
            "api_keys": [],
            "security_headers": {},
            "csp_violations": []
        }

        # Pattern per secrets comuni
        secret_patterns = [
            (r'api[_-]?key["']?\s*[:=]\s*["']([^"'\s]{20,})', 'API Key'),
            (r'secret[_-]?key["']?\s*[:=]\s*["']([^"'\s]{20,})', 'Secret Key'),
            (r'password["']?\s*[:=]\s*["']([^"'\s]{8,})', 'Password'),
            (r'token["']?\s*[:=]\s*["']([^"'\s]{20,})', 'Token'),
            (r'sk-[a-zA-Z0-9]{48}', 'OpenAI API Key'),
            (r'AIza[0-9A-Za-z\-_]{35}', 'Google API Key')
        ]

        # Scan del contenuto HTML e JS
        content_to_scan = self.html_content
        for script in self.soup.find_all('script'):
            if script.string:
                content_to_scan += script.string

        for pattern, secret_type in secret_patterns:
            matches = re.findall(pattern, content_to_scan, re.IGNORECASE)
            for match in matches:
                results["exposed_secrets"].append({
                    "type": secret_type,
                    "value": match[:10] + "..." if len(match) > 10 else match,
                    "severity": "CRITICAL"
                })

        return results

    def audit_console_errors(self):
        """Cerca console.log e errori JS nel codice"""
        results = {
            "js_errors": [],
            "console_logs": [],
            "stack_traces": []
        }

        scripts = self.soup.find_all('script')
        for script in scripts:
            if script.string:
                content = script.string

                # Console logs
                console_matches = re.findall(r'console\.(log|error|warn|debug)\s*\([^)]*\)', content)
                for match in console_matches:
                    results["console_logs"].append({
                        "type": match,
                        "script": content[:100] + "...",
                        "severity": "LOW"
                    })

                # Possibili errori/try-catch
                if 'try' in content and 'catch' in content:
                    error_patterns = re.findall(r'catch\s*\([^)]*\)\s*{[^}]*}', content)
                    for pattern in error_patterns:
                        results["js_errors"].append({
                            "pattern": pattern[:150] + "...",
                            "severity": "MEDIUM"
                        })

        return results

    def audit_placeholders(self):
        """Trova testi placeholder e TODO"""
        results = {
            "placeholder_texts": [],
            "todo_items": [],
            "warning_elements": [],
            "selectors": []
        }

        # Pattern per placeholder comuni
        placeholder_patterns = [
            r'caricamento\.\.\.?',
            r'loading\.\.\.?',
            r'todo',
            r'⚠️',
            r'placeholder',
            r'lorem ipsum',
            r'test\s+content',
            r'coming\s+soon',
            r'under\s+construction'
        ]

        all_text = self.soup.get_text()
        for pattern in placeholder_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            if matches:
                results["placeholder_texts"].extend(matches)

        # Cerca elementi con classi/ID specifici
        placeholder_elements = self.soup.find_all(attrs={
            'class': re.compile(r'(placeholder|loading|todo)', re.I)
        })

        for elem in placeholder_elements:
            results["warning_elements"].append({
                "tag": elem.name,
                "class": elem.get('class', []),
                "text": elem.get_text(strip=True)[:100],
                "selector": self._generate_css_selector(elem)
            })
            results["selectors"].append(self._generate_css_selector(elem))

        return results

    def _generate_css_selector(self, element):
        """Genera un CSS selector per l'elemento"""
        if element.get('id'):
            return f"#{element['id']}"
        elif element.get('class'):
            return f"{element.name}.{'.'.join(element['class'])}"
        else:
            return element.name

    def audit_policy_links(self):
        """Verifica presenza e funzionalità dei link di policy"""
        results = {
            "privacy_policy": {"exists": False, "url": "", "accessible": False},
            "terms_of_service": {"exists": False, "url": "", "accessible": False},
            "cookie_policy": {"exists": False, "url": "", "accessible": False}
        }

        policy_patterns = {
            "privacy_policy": [r'privacy', r'privac', r'riservatezza'],
            "terms_of_service": [r'terms', r'termini', r'conditions', r'condizioni'],
            "cookie_policy": [r'cookie', r'biscotti']
        }

        all_links = self.soup.find_all('a', href=True)
        for link in all_links:
            link_text = link.get_text().lower()
            href = link.get('href')

            for policy_type, patterns in policy_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, link_text):
                        results[policy_type]["exists"] = True
                        results[policy_type]["url"] = urljoin(self.base_url, href)

                        # Test accessibilità
                        try:
                            resp = self.session.head(results[policy_type]["url"], timeout=5)
                            results[policy_type]["accessible"] = resp.status_code == 200
                        except:
                            results[policy_type]["accessible"] = False
                        break

        return results

    def audit_seo(self):
        """Analizza elementi SEO"""
        results = {
            "meta_title": {"exists": False, "content": "", "length": 0},
            "meta_description": {"exists": False, "content": "", "length": 0},
            "h1_tags": {"count": 0, "content": []},
            "og_tags": {"count": 0, "complete": False},
            "json_ld": {"exists": False, "valid": False}
        }

        # Title tag
        title_tag = self.soup.find('title')
        if title_tag:
            results["meta_title"] = {
                "exists": True,
                "content": title_tag.get_text(),
                "length": len(title_tag.get_text())
            }

        # Meta description
        meta_desc = self.soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            content = meta_desc.get('content', '')
            results["meta_description"] = {
                "exists": True,
                "content": content,
                "length": len(content)
            }

        # H1 tags
        h1_tags = self.soup.find_all('h1')
        results["h1_tags"] = {
            "count": len(h1_tags),
            "content": [h1.get_text(strip=True) for h1 in h1_tags]
        }

        # Open Graph tags
        og_tags = self.soup.find_all('meta', property=re.compile(r'og:'))
        results["og_tags"] = {
            "count": len(og_tags),
            "complete": len(og_tags) >= 4  # title, description, image, url
        }

        # JSON-LD
        json_scripts = self.soup.find_all('script', type='application/ld+json')
        if json_scripts:
            results["json_ld"]["exists"] = True
            try:
                # Prova a parsare il primo JSON-LD trovato
                json.loads(json_scripts[0].string)
                results["json_ld"]["valid"] = True
            except:
                results["json_ld"]["valid"] = False

        return results

    def run_full_audit(self):
        """Esegue l'audit completo"""
        print("🔍 Iniziando audit completo...")

        if not self.download_page():
            return None

        print("📄 Pagina scaricata, iniziando analisi...")

        # Esegui tutte le verifiche
        self.audit_results.update({
            "routes_and_links": self.audit_links_and_routes(),
            "broken_anchors": self.audit_broken_anchors(),
            "non_functional_buttons": self.audit_buttons(),
            "broken_forms": self.audit_forms(),
            "missing_assets": self.audit_assets(),
            "security_issues": self.audit_security(),
            "console_errors": self.audit_console_errors(),
            "placeholder_content": self.audit_placeholders(),
            "policy_links": self.audit_policy_links(),
            "seo_analysis": self.audit_seo()
        })

        return self.audit_results

    def save_audit(self, filename='audit.json'):
        """Salva i risultati dell'audit"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.audit_results, f, indent=2, ensure_ascii=False)
        print(f"✅ Audit salvato in {filename}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Uso: python audit_script.py <URL>")
        sys.exit(1)

    url = sys.argv[1]
    auditor = WebsiteAuditor(url)

    results = auditor.run_full_audit()
    if results:
        auditor.save_audit()

        # Genera report esecutivo
        print("\n" + "="*50)
        print("📊 EXECUTIVE SUMMARY")
        print("="*50)

        # Conta problemi per severità
        critical = len(results.get('security_issues', {}).get('exposed_secrets', []))
        high = (len(results.get('broken_forms', {}).get('unreachable_endpoints', [])) + 
                len(results.get('missing_assets', {}).get('css_files', [])))
        medium = (len(results.get('broken_anchors', {}).get('empty_href', [])) +
                  len(results.get('console_errors', {}).get('console_logs', [])))
        low = len(results.get('placeholder_content', {}).get('placeholder_texts', []))

        print(f"🚨 CRITICI: {critical}")
        print(f"⚠️  ALTI: {high}")  
        print(f"📋 MEDI: {medium}")
        print(f"💡 BASSI: {low}")

        if critical > 0:
            print("\n❌ ATTENZIONE: Trovati problemi di sicurezza CRITICI!")
        if high > 0:
            print(f"\n⚠️  {high} problemi ad ALTA priorità richiedono correzione immediata")

        print(f"\n✅ Audit completato. Controlla audit.json per i dettagli completi.")
    else:
        print("❌ Audit fallito. Impossibile accedere al sito.")
