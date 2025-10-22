import React from 'react';
import { Snackbar, Text } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { hideToast, useUIStore } from '@/hooks/uiStore';

export default function GlobalToast() {
  const { toast } = useUIStore();
  
  const getConfig = () => {
    switch (toast.type) {
      case 'success':
        return { bg: '#16a34a', icon: 'check-circle' as const, iconColor: '#fff' };
      case 'error':
        return { bg: '#dc2626', icon: 'alert-circle' as const, iconColor: '#fff' };
      case 'info':
        return { bg: '#2563eb', icon: 'information' as const, iconColor: '#fff' };
      case 'warning':
        return { bg: '#f59e0b', icon: 'alert' as const, iconColor: '#fff' };
      default:
        return { bg: '#2563eb', icon: 'information' as const, iconColor: '#fff' };
    }
  };

  const config = getConfig();

  return (
    <Snackbar
      visible={toast.visible}
      onDismiss={hideToast}
      duration={toast.durationMs}
      style={{ backgroundColor: config.bg }}
    >
      <View style={styles.container}>
        <MaterialCommunityIcons 
          name={config.icon} 
          size={20} 
          color={config.iconColor} 
          style={styles.icon}
        />
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: 'white',
    flex: 1,
  },
});