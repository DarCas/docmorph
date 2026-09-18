/*
 * Dario Casertano <dario@casertano.name>
 * Copyright (c) 2026 Casertano Dario – All rights reserved.
 * Licensed under the MIT License.
 */

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { usePrefersReducedMotion } from '../hooks/useReveal';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { BrandMark } from './BrandMark';

export const GITHUB_URL = 'https://github.com/DarCas/docmorph';

const SECTIONS = [
	{ id: 'transform', label: 'Transformation' },
	{ id: 'guardrails', label: 'Guardrails' },
	{ id: 'api', label: 'API' },
	{ id: 'operations', label: 'Operations' },
	{ id: 'deploy', label: 'Deploy' }
] as const;

const SECTION_IDS = SECTIONS.map((section) => section.id);

export function Nav() {
	const active = useScrollSpy(SECTION_IDS);
	const reduced = usePrefersReducedMotion();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		const previous = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('keydown', onKey);
		return () => {
			document.documentElement.style.overflow = previous;
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	const onBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		setOpen(false);
		window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
		window.history.replaceState(null, '', '/');
	};

	return (
		<header className={['nav', open ? 'is-open' : ''].filter(Boolean).join(' ')}>
			<div className="container nav__inner">
				<a className="nav__brand" href="/" onClick={onBrandClick} aria-label="DocMorph — back to top">
					<BrandMark className="nav__mark" />
					<span className="nav__wordmark">DOCMORPH</span>
				</a>

				<nav className="nav__panel" aria-label="Primary" id="nav-menu">
					<ul className="nav__links">
						{SECTIONS.map((section) => (
							<li key={section.id}>
								<a
									className={['nav__link', active === section.id ? 'is-active' : ''].filter(Boolean).join(' ')}
									href={`#${section.id}`}
									aria-current={active === section.id ? 'true' : undefined}
									onClick={() => setOpen(false)}
								>
									{section.label}
								</a>
							</li>
						))}
					</ul>

					<div className="nav__actions">
						<a className="btn" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
							GitHub <span className="btn__arrow">↗</span>
						</a>
					</div>
				</nav>

				<button
					type="button"
					className="nav-toggle"
					aria-expanded={open}
					aria-controls="nav-menu"
					aria-label={open ? 'Close menu' : 'Open menu'}
					onClick={() => setOpen((value) => !value)}
				>
					<span className="nav-toggle__bars" />
				</button>
			</div>

			{open ? <div className="nav__scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
		</header>
	);
}
