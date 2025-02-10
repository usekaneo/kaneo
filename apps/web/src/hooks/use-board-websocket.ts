import { API_URL } from '@/constants/urls';
import useProjectStore from '@/store/project';
import { useEffect, useRef } from 'react';

type WebSocketHook = {
  ws: WebSocket | null;
};

function useBoardWebSocket(): WebSocketHook {
  const wsRef = useRef<WebSocket | null>(null);
  const { project, setProject } = useProjectStore();

  useEffect(() => {
    if (!project?.id) return;

    const socket = new WebSocket(`${API_URL}/task/ws/${project.id}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProject(data);
      } catch (error) {
        console.error('WebSocket message parsing error', error);
      }
    };

    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [project?.id, setProject]);

  return {
    ws: wsRef.current,
  };
}

export default useBoardWebSocket;
