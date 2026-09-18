import { Background } from './components/Background';
import { Footer } from './components/Footer';
import { Nav } from './components/Nav';
import { ApiSection } from './sections/ApiSection';
import { DeploymentSection } from './sections/DeploymentSection';
import { FinalCTA } from './sections/FinalCTA';
import { Guardrails } from './sections/Guardrails';
import { Hero } from './sections/Hero';
import { OperationsSection } from './sections/OperationsSection';
import { SmallByDesign } from './sections/SmallByDesign';
import { Transformation } from './sections/Transformation';

export function App() {
	return (
		<>
			<Background />
			<Nav />
			<main className="main">
				<Hero />
				<Transformation />
				<SmallByDesign />
				<Guardrails />
				<ApiSection />
				<OperationsSection />
				<DeploymentSection />
				<FinalCTA />
			</main>
			<Footer />
		</>
	);
}
