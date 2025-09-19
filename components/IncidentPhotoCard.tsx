import React, { useEffect, useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { getFirstPhotoUrl } from '@/services/photos';

const placeholder = require('../assets/images/placeholder_incendio.png');

type Props = {
  incendioId: string;
  title?: string;
  subtitle?: string;
  onPressDetail?: () => void;
};

export default function IncidentPhotoCard({ incendioId, title, subtitle, onPressDetail }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = await getFirstPhotoUrl(encendioIdSafe(incendioId));
        if (mounted) setPhotoUrl(url);
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [incendioId]);

  return (
    <Card style={{ borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ height: 180, backgroundColor: '#eee' }}>
        {busy ? (
          <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <Image
            source={photoUrl ? { uri: photoUrl } : placeholder}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        )}
      </View>

      {(title || subtitle) && (
        <Card.Content style={{ paddingVertical: 10 }}>
          {title ? <Text variant="titleMedium">{title}</Text> : null}
          {subtitle ? <Text variant="bodyMedium" style={{ color: '#666' }}>{subtitle}</Text> : null}
        </Card.Content>
      )}

      {onPressDetail && (
        <Card.Actions>
          <TouchableOpacity onPress={onPressDetail} style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
            <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>Ver detalle</Text>
          </TouchableOpacity>
        </Card.Actions>
      )}
    </Card>
  );
}

function encendioIdSafe(id: string) {
  return String(id).trim();
}
