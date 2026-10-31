import React from 'react';
export default class ErrorBoundary extends React.Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed) return <main role="alert" className="p-8 text-center">
            <h1>Unable to display this page</h1>
            <p>Please reload the page and try again.</p>
            <button onClick={() => window.location.reload()}>Reload</button>
        </main>;
        return this.props.children;
    }
}
