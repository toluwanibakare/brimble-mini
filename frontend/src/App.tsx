import { useState, useEffect } from 'react'

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setBackendStatus(data.status))
      .catch(() => setBackendStatus('error'))
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <h1>Brimble Mini Platform</h1>
      <p style={{ color: '#666' }}>Frontend: Running (Vite + React)</p>
      
      <div style={{ 
        padding: '20px', 
        borderRadius: '8px', 
        background: backendStatus === 'ok' ? '#e6fffa' : '#fff5f5',
        border: `1px solid ${backendStatus === 'ok' ? '#38b2ac' : '#feb2b2'}`,
        marginTop: '20px'
      }}>
        <p>Backend Status: <strong>{backendStatus === 'ok' ? 'Connected' : 'Error / Disconnected'}</strong></p>
      </div>

      {window.location.port === '5173' && (
        <p style={{ color: '#e53e3e', marginTop: '20px', fontSize: '0.9rem' }}>
          ⚠️ You are accessing the app directly via Vite (port 5173). <br />
          API calls will fail. Please visit <strong><a href="http://localhost">http://localhost</a></strong> instead.
        </p>
      )}
    </div>
  )
}

export default App
