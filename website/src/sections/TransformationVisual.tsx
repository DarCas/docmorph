import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/useReveal';

const STAGES = [
	{ label: 'Validate', note: 'PK magic bytes' },
	{ label: 'Queue', note: 'semaphore slot' },
	{ label: 'Convert', note: 'soffice headless' },
	{ label: 'Verify', note: '%PDF header' }
] as const;

export function TransformationVisual() {
	const reduced = usePrefersReducedMotion();
	const [step, setStep] = useState(0);

	useEffect(() => {
		if (reduced) return;
		const timer = window.setInterval(() => {
			setStep((value) => (value + 1) % STAGES.length);
		}, 1500);
		return () => window.clearInterval(timer);
	}, [reduced]);

	return (
		<div
			className="machine"
			role="img"
			aria-label="A DOCX document enters DocMorph and passes through validate, queue, convert and verify, then exits as a PDF."
		>
			<div className="machine__bar">
				<span>docmorph · conversion pipeline</span>
				<span className="machine__status">
					<span className="machine__dot" /> operational
				</span>
			</div>

			<div className="machine__body">
				<div className="machine__lane">
					<div className="doc-chip doc-chip--in">
						<span className="doc-chip__label">.docx</span>
						<span className="doc-chip__lines">
							<i />
							<i />
							<i />
							<i />
						</span>
					</div>

					<div className="machine__core">
						<div className="machine__core-label">[ morph ]</div>
						<div className="machine__core-sub">soffice --headless</div>
					</div>

					<div className="doc-chip doc-chip--pdf doc-chip--out">
						<span className="doc-chip__label">.pdf</span>
						<span className="doc-chip__lines">
							<i />
							<i />
							<i />
							<i />
						</span>
					</div>
				</div>

				<div className="machine__stages">
					{STAGES.map((stage, index) => (
						<div
							key={stage.label}
							className={['machine__stage', index === step ? 'is-live' : ''].filter(Boolean).join(' ')}
						>
							<b>{stage.label}</b>
							<span>{stage.note}</span>
						</div>
					))}
				</div>
			</div>

			<div className="machine__foot">
				<span>POST /convert</span>
				<span>
					application/pdf <span className="machine__cursor" />
				</span>
			</div>
		</div>
	);
}
