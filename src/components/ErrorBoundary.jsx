import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Render error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 520, textAlign: 'center' }}>
            <h2 style={{ color: 'var(--navy)', marginBottom: 10 }}>Something went wrong</h2>
            <p style={{ color: 'var(--g600)', marginBottom: 16, fontSize: 13.5 }}>{String(this.state.error.message || this.state.error)}</p>
            <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
