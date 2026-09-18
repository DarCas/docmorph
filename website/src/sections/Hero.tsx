import { CoffeeButton } from '../components/CoffeeButton';
import { GITHUB_URL } from '../components/Nav';
import { TransformationVisual } from './TransformationVisual';

export function Hero() {
	return (
		<section className="hero section--flush" aria-labelledby="hero-title">
			<div className="container hero__grid">
				<div className="hero__copy">
					<p className="eyebrow">
						<span>Open source</span> · <span>Self-hosted</span> · <span>DOCX → PDF</span>
					</p>

					<h1 className="hero__title" id="hero-title">
						DOCX in.
						<br />
						<span className="accent">PDF out.</span>
					</h1>

					<p className="hero__sub">
						DocMorph is a stateless HTTP microservice that converts DOCX documents to PDF using headless
						LibreOffice. Docker-ready, concurrency-safe and built to do one thing well.
					</p>

					<div className="btn-row">
						<a className="btn btn--primary" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
							View on GitHub <span className="btn__arrow">↗</span>
						</a>
						<a className="btn" href="#deploy">
							Run with Docker
						</a>
						<a className="btn btn--quiet" href="#api">
							Read the API
						</a>
					</div>

					<div className="hero__meta">
						<span>MIT License</span>
						<span>One endpoint</span>
						<span>Node ≥ 22</span>
						<span>Docker-ready</span>
					</div>

					<div className="hero__support">
						<CoffeeButton />
					</div>
				</div>

				<TransformationVisual />
			</div>
		</section>
	);
}
