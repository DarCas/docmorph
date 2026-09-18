import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHighlighter } from 'shiki';
import { snippets } from './snippets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'src', 'generated');

const THEME = 'vitesse-dark';

const highlighter = await createHighlighter({
	themes: [THEME],
	langs: ['bash', 'typescript', 'python', 'yaml']
});

const output = {};

for (const [id, snippet] of Object.entries(snippets)) {
	output[id] = {
		lang: snippet.lang,
		code: snippet.code,
		html: highlighter.codeToHtml(snippet.code, {
			lang: snippet.lang,
			theme: THEME
		})
	};
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'snippets.json'), `${JSON.stringify(output, null, 4)}\n`);

console.log(`highlight: wrote ${Object.keys(output).length} snippets (${THEME})`);
