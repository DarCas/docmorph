import { DocRail } from '../components/DocRail';
import { useReveal } from '../hooks/useReveal';

const STEPS = [
	{
		n: '01',
		title: 'Validate',
		desc: 'The extension is checked, then the upload is read for the OOXML ZIP signature. Bad files never reach the converter.',
		code: '.docx · PK\\x03\\x04'
	},
	{
		n: '02',
		title: 'Isolate',
		desc: 'Every job gets its own temp directory and a dedicated LibreOffice user profile, so concurrent conversions never share state.',
		code: '/tmp/lo-<uuid>/profile'
	},
	{
		n: '03',
		title: 'Convert',
		desc: 'soffice runs headless under a per-conversion timeout, while a semaphore bounds how many jobs run at the same time.',
		code: 'soffice --headless --convert-to pdf'
	},
	{
		n: '04',
		title: 'Verify',
		desc: 'The result must begin with the PDF header. Only then is it streamed back as application/pdf.',
		code: '%PDF-1.7'
	}
] as const;

export function Transformation() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section section--transform" id="transform" aria-labelledby="transform-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">01</span> / The transformation
					</p>
					<h2 className="section-title" id="transform-title">
						A document enters. A PDF comes out.
					</h2>
					<p className="section-lead">
						Nothing else gets in the way. Four deterministic stages, no hidden state, no queues you have to
						operate.
					</p>
				</header>

				<div className="pipeline" ref={ref}>
					<div className="pipeline__rule" aria-hidden="true">
						<span className="pipeline__fill" />
					</div>

					{STEPS.map((step) => (
						<article className="pipeline__step" key={step.n}>
							<span className="pipeline__node" aria-hidden="true">
								{step.n}
							</span>
							<h3 className="pipeline__title">{step.title}</h3>
							<p className="pipeline__desc">{step.desc}</p>
							<code className="pipeline__code">{step.code}</code>
						</article>
					))}
				</div>

				<div className="transform__foot">
					<DocRail from="document.docx" label="[ 4 stages ]" to="document.pdf" />
				</div>
			</div>
		</section>
	);
}
