import './LoadingSkeleton.css';

export function SkeletonLine() {
    return <span className="mc-skeleton-line" aria-hidden="true" />;
}

export default function LoadingSkeleton({ label = 'Loading page', rows = 5 }) {
    return <div role="status" aria-busy="true" className="mc-skeleton">
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }, (_, index) => <div className="mc-skeleton-row" key={index} aria-hidden="true">
            <SkeletonLine /><SkeletonLine /><SkeletonLine />
        </div>)}
    </div>;
}
