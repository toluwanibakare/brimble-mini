import { useEffect, useState, useRef } from 'react';

interface Log {
  id?: number;
  message: string;
  timestamp: string;
}

interface LogsViewerProps {
  deploymentId: string;
  status?: string;
}

export const LogsViewer = ({ deploymentId, status }: LogsViewerProps) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deploymentId) return;

    setLogs([]);
    setConnected(false);

    const eventSource = new EventSource(`/api/deployments/${deploymentId}/logs/stream`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      const newLog = JSON.parse(event.data);
      setLogs((prev) => {
        if (typeof newLog.id === 'number' && prev.some((log) => log.id === newLog.id)) {
          return prev;
        }
        return [...prev, newLog];
      });
    };

    eventSource.onerror = () => {
      setConnected(false);
      // Retry after 3 seconds
      setTimeout(() => {
        eventSource.close();
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [deploymentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Determine status label and color
  const getStatusLabel = () => {
    if (!connected) return 'Connecting...';
    if (status === 'building' || status === 'pending') return 'Building...';
    if (status === 'deploying') return 'Deploying...';
    if (status === 'failed') return 'Build Failed';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'running') return 'Live';
    return 'Active';
  };

  const getStatusColor = () => {
    if (!connected) return '#f85149';
    if (status === 'failed') return '#f85149';
    if (status === 'cancelled') return '#d29922';
    if (status === 'building' || status === 'deploying') return '#d29922';
    return '#3fb950';
  };

  const statusLabel = getStatusLabel();
  const statusColor = getStatusColor();

  return (
    <div style={{
      width: '100%',
      background: '#0d1117',
      color: '#c9d1d9',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #30363d',
    }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#161b22',
        borderBottom: '1px solid #30363d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#8b949e' }}>Build Logs</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          color: statusColor,
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            animation: (status === 'building' || status === 'deploying' || status === 'pending') ? 'pulse 2s infinite' : 'none',
          }} />
          {statusLabel}
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        style={{
          height: '350px',
          overflowY: 'auto',
          padding: '16px',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: '0.82rem',
          lineHeight: '1.6',
        }}
      >
        {logs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#484f58' }}>
            <div className="clock-loader" />
            <span style={{ fontStyle: 'italic' }}>Waiting for build output...</span>
          </div>
        )}
        {logs.map((log, index) => {
          const isLast = index === logs.length - 1;
          const isError = log.message.includes('[ERROR]') || (status === 'failed' && isLast);
          const isHeartbeat = log.message.startsWith('... still working');
          
          return (
            <div key={index} style={{
              wordBreak: 'break-all',
              color: isError ? '#f85149' : isHeartbeat ? '#6e7681' : '#c9d1d9',
              marginBottom: '2px',
              opacity: isLast ? 1 : 0.85,
              display: 'flex',
              gap: '12px',
              fontStyle: isHeartbeat ? 'italic' : 'normal',
              animation: isLast && (status === 'building' || status === 'deploying') ? 'log-entry 0.3s ease-out' : 'none',
            }}>
              <span style={{ 
                color: '#484f58', 
                minWidth: '28px', 
                textAlign: 'right',
                userSelect: 'none',
                fontSize: '0.75rem',
              }}>
                {index + 1}
              </span>
              <div style={{ flex: 1, position: 'relative' }}>
                {log.message}
                {isLast && (status === 'building' || status === 'deploying') && (
                  <span className="log-cursor" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes log-entry {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .log-cursor {
          display: inline-block;
          width: 8px;
          height: 14px;
          background: #58a6ff;
          margin-left: 8px;
          vertical-align: middle;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from, to { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes clock-roll {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(90deg); }
          25% { transform: rotate(90deg); }
          45% { transform: rotate(180deg); }
          50% { transform: rotate(180deg); }
          70% { transform: rotate(270deg); }
          75% { transform: rotate(270deg); }
          95% { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
        .clock-loader {
          width: 14px;
          height: 14px;
          border: 1.5px solid #484f58;
          border-radius: 50%;
          position: relative;
        }
        .clock-loader::after {
          content: '';
          position: absolute;
          width: 1.5px;
          height: 6px;
          background: #484f58;
          left: 50%;
          top: 1px;
          transform-origin: bottom center;
          margin-left: -0.75px;
          animation: clock-roll 4s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
