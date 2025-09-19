import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useUIStore } from '@/hooks/uiStore';

export default function GlobalLoader() {
  const { loading } = useUIStore();
  const active = Object.values(loading).some(Boolean);
  if (!active) return null;
  return (
    <View style={{ position:'absolute', left:0, right:0, top:0, bottom:0, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.15)' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
