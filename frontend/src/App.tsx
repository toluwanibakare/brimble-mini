import { useState, useEffect, useRef } from 'react'
import { LogsViewer } from './components/LogsViewer'

interface DeploymentInfo {
  id: string;
  repoUrl: string;
  status: string;
  createdAt: string;
}

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...')
  const [repoUrl, setRepoUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [activeDeployment, setActiveDeployment] = useState<DeploymentInfo | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setBackendStatus(data.status))
      .catch(() => setBackendStatus('error'))
  }, [])

  // Poll the active deployment's status so the UI stays in sync
  useEffect(() => {
    if (!activeDeployment) return;

    const isTerminal = activeDeployment.status === 'running'
      || activeDeployment.status === 'failed'
      || activeDeployment.status === 'cancelled';

    if (isTerminal) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deployments/${activeDeployment.id}`);
        if (res.ok) {
          const data = await res.json();
          setActiveDeployment(prev => prev ? { ...prev, status: data.status } : prev);
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeDeployment?.id, activeDeployment?.status]);

  const handleDeploy = async (url: string) => {
    if (!url) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDeployment(data);
        setRepoUrl('');
      } else {
        alert('Failed to trigger deployment');
      }
    } catch (err) {
      alert('Error connecting to backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleDeploy(repoUrl);
  };

  const handleCancel = async () => {
    if (!activeDeployment || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/deployments/${activeDeployment.id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('cancel failed');
      }
      if (pollRef.current) clearInterval(pollRef.current);
      setActiveDeployment(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    } catch (err) {
      alert('Failed to cancel deployment');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRestart = () => {
    if (!activeDeployment) return;
    handleDeploy(activeDeployment.repoUrl);
  };

  // Status badge helpers
  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      running:   { bg: 'rgba(63,185,80,0.15)',   color: '#3fb950' },
      failed:    { bg: 'rgba(248,81,73,0.15)',    color: '#f85149' },
      cancelled: { bg: 'rgba(210,153,34,0.15)',   color: '#d29922' },
    };
    return map[status] || { bg: 'rgba(210,153,34,0.15)', color: '#d29922' };
  };

  const statusColor = backendStatus === 'ok' ? '#3fb950' : '#f85149';
  const badge = activeDeployment ? getStatusBadge(activeDeployment.status) : null;

  const isActive = activeDeployment?.status === 'building' || activeDeployment?.status === 'pending' || activeDeployment?.status === 'deploying';
  const isStopped = activeDeployment?.status === 'failed' || activeDeployment?.status === 'cancelled';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
      color: '#c9d1d9',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #58a6ff, #bc8cff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
            paddingBottom: '4px',
            lineHeight: '1.2',
          }}>
            Brimble
          </h1>
          <p style={{ color: '#8b949e', fontSize: '0.95rem', margin: '0 0 12px 0' }}>
            Mini Deployment Platform
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: '#21262d',
            border: '1px solid #30363d',
            fontSize: '0.8rem',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor,
            }} />
            <span style={{ color: statusColor }}>
              {backendStatus === 'ok' ? 'System Online' : 'System Offline'}
            </span>
          </div>
        </div>

        {/* Deploy form */}
        <div style={{
          background: '#161b22',
          borderRadius: '12px',
          border: '1px solid #30363d',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#e6edf3' }}>
            New Deployment
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting || backendStatus !== 'ok'}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSubmitting ? '#30363d' : 'linear-gradient(135deg, #238636, #2ea043)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
          </form>
        </div>

        {/* Active deployment */}
        {activeDeployment && badge && (
          <div style={{
            background: '#161b22',
            borderRadius: '12px',
            border: '1px solid #30363d',
            overflow: 'hidden',
            marginBottom: '24px',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #30363d' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '20px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: '0.85rem',
                    color: '#58a6ff',
                    wordBreak: 'break-all',
                    marginBottom: '8px',
                  }}>
                    {activeDeployment.repoUrl}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '0.78rem',
                    color: '#8b949e',
                  }}>
                    <span>ID: {activeDeployment.id.slice(0, 8)}</span>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: badge.bg,
                      color: badge.color,
                    }}>
                      {activeDeployment.status}
                    </span>
                    {(activeDeployment as any).url && activeDeployment.status === 'running' && (
                      <a 
                        href={(activeDeployment as any).url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          color: '#58a6ff',
                          textDecoration: 'none',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Visit Site ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Cancel button — visible during active build */}
                  {isActive && (
                    <button
                      onClick={handleCancel}
                      disabled={isCancelling}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #f85149',
                        background: 'transparent',
                        color: '#f85149',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: isCancelling ? 'not-allowed' : 'pointer',
                        opacity: isCancelling ? 0.7 : 1,
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (!isCancelling) e.currentTarget.style.background = 'rgba(248,81,73,0.1)';
                      }}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}

                  {/* Restart button — visible after failed or cancelled */}
                  {isStopped && (
                    <button
                      onClick={handleRestart}
                      disabled={isSubmitting}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSubmitting ? '#30363d' : '#238636',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'opacity 0.2s',
                      }}
                    >
                      Restart
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Logs viewer */}
            <div style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              <LogsViewer deploymentId={activeDeployment.id} status={activeDeployment.status} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          color: '#484f58',
          fontSize: '0.78rem',
        }}>
          Built with Vite + React | Powered by Railpack and Caddy
        </div>
      </div>
    </div>
  )
}

export default App
