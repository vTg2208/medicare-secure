import { useCallback, useEffect, useRef, useState } from 'react';
import './ScrollableNav.css';

export default function ScrollableNav({ children, className = '', label = 'Patient navigation' }) {
    const navigation = useRef(null);
    const [position, setPosition] = useState({ overflow: false, start: true, end: false });
    const update = useCallback(() => {
        const element = navigation.current;
        if (!element) return;
        const next = { overflow: element.scrollWidth > element.clientWidth + 2, start: element.scrollLeft <= 2,
            end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 };
        setPosition(previous => Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
    }, []);
    useEffect(() => {
        const frame = requestAnimationFrame(update);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        if (navigation.current) observer?.observe(navigation.current);
        window.addEventListener('resize', update);
        return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', update); };
    }, [update]);
    const move = direction => navigation.current?.scrollBy({ left: direction * navigation.current.clientWidth * .75, behavior: 'auto' });

    return <div className="mc-overflow-navigation">
        <nav ref={navigation} className={className} aria-label={label} onScroll={update}>{children}</nav>
        {position.overflow && <div className="mc-navigation-controls">
            <button type="button" aria-label="Previous navigation options" disabled={position.start} onClick={() => move(-1)}>←</button>
            <span>Swipe or use arrows for more</span>
            <button type="button" aria-label="Next navigation options" disabled={position.end} onClick={() => move(1)}>→</button>
        </div>}
    </div>;
}
