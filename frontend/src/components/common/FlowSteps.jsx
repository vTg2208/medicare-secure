import './FlowSteps.css';

export default function FlowSteps({ label, steps, currentStep }) {
    return (
        <nav className="mc-flow-steps" aria-label={label}>
            <ol>
                {steps.map((step, index) => (
                    <li key={step.label} aria-current={index === currentStep ? 'step' : undefined}
                        data-state={index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming'}>
                        <span className="mc-flow-marker" aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>
                        <span className="mc-flow-label">{step.label}
                            {step.optional && <small>Optional</small>}
                            {index < currentStep && <span className="sr-only"> — completed</span>}
                        </span>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
