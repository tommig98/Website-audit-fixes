#!/usr/bin/env python3
"""
Lighthouse Report Generator
Genera report prima/dopo per confronto performance
"""

import os
import json
import subprocess
from datetime import datetime

class LighthouseRunner:
    def __init__(self, url):
        self.url = url
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def run_lighthouse(self, output_name):
        """Esegue Lighthouse e salva il report"""
        cmd = [
            'lighthouse',
            self.url,
            '--output=json',
            '--output=html',
            f'--output-path={output_name}',
            '--chrome-flags="--headless --no-sandbox"',
            '--quiet'
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Lighthouse report generato: {output_name}")
                return True
            else:
                print(f"❌ Errore Lighthouse: {result.stderr}")
                return False
        except FileNotFoundError:
            print("❌ Lighthouse CLI non trovato. Installa con: npm install -g lighthouse")
            return False

    def compare_reports(self, before_file, after_file):
        """Confronta due report Lighthouse"""
        try:
            with open(before_file, 'r') as f:
                before_data = json.load(f)
            with open(after_file, 'r') as f:
                after_data = json.load(f)

            categories = ['performance', 'accessibility', 'best-practices', 'seo']
            improvements = {}

            for category in categories:
                before_score = before_data['categories'][category]['score'] * 100
                after_score = after_data['categories'][category]['score'] * 100
                improvement = after_score - before_score
                improvements[category] = improvement

                status = "✅" if improvement >= 0 else "❌"
                print(f"{status} {category.title()}: {before_score:.1f} → {after_score:.1f} ({improvement:+.1f})")

            return improvements

        except Exception as e:
            print(f"❌ Errore nel confronto: {e}")
            return None

def main():
    import sys

    if len(sys.argv) != 2:
        print("Uso: python lighthouse_compare.py <URL>")
        sys.exit(1)

    url = sys.argv[1]
    runner = LighthouseRunner(url)

    before_file = f"lighthouse-before-{runner.timestamp}"
    print("📊 Generazione report PRIMA delle ottimizzazioni...")
    runner.run_lighthouse(before_file)

    after_file = f"lighthouse-after-{runner.timestamp}"
    print("📊 Generazione report DOPO le ottimizzazioni...")
    runner.run_lighthouse(after_file)

    if os.path.exists(f"{before_file}.json") and os.path.exists(f"{after_file}.json"):
        runner.compare_reports(f"{before_file}.json", f"{after_file}.json")

if __name__ == "__main__":
    main()
