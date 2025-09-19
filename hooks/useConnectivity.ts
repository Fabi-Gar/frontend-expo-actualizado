import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useConnectivity() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sub = NetInfo.addEventListener(s => {
      const isOnline = !!(s.isConnected && s.isInternetReachable !== false);
      setOnline(isOnline);
    });
    NetInfo.fetch().then(s => {
      const isOnline = !!(s.isConnected && s.isInternetReachable !== false);
      setOnline(isOnline);
    });
    return () => sub();
  }, []);
  return online;
}
