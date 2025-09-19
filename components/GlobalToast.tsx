import React from 'react';
import { Snackbar, Text } from 'react-native-paper';
import { hideToast, useUIStore } from '@/hooks/uiStore';

export default function GlobalToast() {
  const { toast } = useUIStore();
  const bg =
    toast.type === 'success' ? '#16a34a' :
    toast.type === 'error' ? '#dc2626' :
    '#2563eb';

  return (
    <Snackbar
      visible={toast.visible}
      onDismiss={hideToast}
      duration={toast.durationMs}
      style={{ backgroundColor: bg }}
    >
      <Text style={{ color: 'white' }}>{toast.message}</Text>
    </Snackbar>
  );
}
