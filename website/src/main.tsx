import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
	throw new Error('DocMorph website: #root container not found');
}

if (container.hasChildNodes()) {
	hydrateRoot(container, <App />);
} else {
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>
	);
}
