export const snippets = {
	'curl-convert': {
		lang: 'bash',
		code: `curl -o out.pdf \\
  -H "x-api-key: your-secret-key" \\
  -F "file=@document.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document" \\
  http://localhost:8080/convert`
	},
	'typescript-convert': {
		lang: 'typescript',
		code: `import { readFile, writeFile } from 'node:fs/promises';

const docx = await readFile('document.docx');
const form = new FormData();
form.append('file', new Blob([docx], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}), 'document.docx');

const res = await fetch('http://localhost:8080/convert', {
  method: 'POST',
  headers: { 'x-api-key': process.env.DOCMORPH_API_KEY! },
  body: form,
});

if (!res.ok) throw new Error(\`convert failed: \${res.status}\`);
await writeFile('out.pdf', Buffer.from(await res.arrayBuffer()));`
	},
	'python-convert': {
		lang: 'python',
		code: `import os
import requests

with open('document.docx', 'rb') as f:
    res = requests.post(
        'http://localhost:8080/convert',
        headers={'x-api-key': os.environ['DOCMORPH_API_KEY']},
        files={'file': ('document.docx', f,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document')},
        timeout=90,
    )
res.raise_for_status()

with open('out.pdf', 'wb') as f:
    f.write(res.content)`
	},
	'docker-run': {
		lang: 'bash',
		code: `docker run -d --name docmorph \\
  -p 8080:8080 \\
  -e API_KEYS="your-secret-key" \\
  ghcr.io/darcas/docmorph:latest`
	},
	'docker-compose': {
		lang: 'yaml',
		code: `name: docmorph

services:
  api:
    image: ghcr.io/darcas/docmorph:latest
    restart: unless-stopped
    environment:
      API_KEYS: "your-secret-key"
      MAX_CONCURRENT: "3"
    ports:
      - "8080:8080"`
	},
	'health-check': {
		lang: 'bash',
		code: `curl http://localhost:8080/health

# {
#   "status": "ok",
#   "authEnabled": true,
#   "concurrency": { "active": 0, "queued": 0, "max": 3 },
#   "maxFileSize": 10485760,
#   "rateLimit": { "max": 60, "windowMs": 60000 },
#   "timeoutMs": 60000
# }`
	}
};
