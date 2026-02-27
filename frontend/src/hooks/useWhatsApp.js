import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = window.location.origin;

export function useWhatsApp() {
  const { user } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [phone, setPhone] = useState(null);
  const [waName, setWaName] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('whatsapp:status', ({ status, phone, name }) => {
      setStatus(status);
      if (phone) { setPhone(phone); localStorage.setItem('wa_phone', phone); }
      if (name) { setWaName(name); }
      if (status === 'connected') setQrCode(null);
    });

    socket.on('whatsapp:qr', ({ qr }) => {
      setQrCode(qr);
      setStatus('qr');
    });

    return () => socket.disconnect();
  }, []);

  const connect = () => {
    socketRef.current?.emit('whatsapp:connect', { userId: user?.id || 'default' });
    setStatus('connecting');
    setQrCode(null);
  };

  const disconnect = () => {
    socketRef.current?.emit('whatsapp:disconnect');
  };

  return { status, qrCode, phone, waName, connect, disconnect };
}
