import { GITHUB_URL } from '../components/Nav';
import { useReveal } from '../hooks/useReveal';

export function FinalCTA() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section final" aria-labelledby="final-title">
			<div className="container">
				<div className="final__inner" ref={ref}>
					<p className="eyebrow">Ship the endpoint</p>
					<h2 className="final__title" id="final-title">
						Give your backend a DOCX → PDF endpoint.
					</h2>
					<p className="final__sub">
						Clone it, run it in a container, and let it do exactly what it says on the box.
					</p>
					<div className="btn-row">
						<a className="btn btn--primary" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
							View DocMorph on GitHub <span className="btn__arrow">↗</span>
						</a>
						<a className="btn" href="#api">
							Read the API
						</a>
					</div>
				</div>
			</div>
			<span className="final__ghost" aria-hidden="true">
				DOCX→PDF
			</span>
		</section>
	);
}
