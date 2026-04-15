import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#d93025', fontWeight: 500 }}>
            {this.props.name || 'Section'} failed to load
          </p>
          <p className="dim" style={{ fontSize: '0.8rem', margin: '8px 0' }}>
            {this.state.error?.message}
          </p>
          <button className="btn btn-outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
