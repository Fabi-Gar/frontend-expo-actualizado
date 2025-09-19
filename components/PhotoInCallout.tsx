import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { getFirstPhotoUrl } from '@/services/photos';
import { getPhotoCache, setPhotoCache } from '@/hooks/photoCache';

const placeholder = require('@/assets/placeholder_incendio.png');

export default function PhotoInCallout({ incendioId, width = 210, height = 110, rounded = 8 }:{
  incendioId: string;
  width?: number;
  height?: number;
  rounded?: number;
}) {
  const [url, setUrl] = useState<string | null | undefined>(() => getPhotoCache(incendioId));
  const [busy, setBusy] = useState(url === undefined);

  useEffect(() => {
    let mounted = true;
    if (url === undefined) {
      (async () => {
        try {
          const u = await getFirstPhotoUrl(incendioId);
          if (!mounted) return;
          setUrl(u);
          setPhotoCache(incendioId, u);
        } finally {
          if (mounted) setBusy(false);
        }
      })();
    } else {
      setBusy(false);
    }
    return () => { mounted = false; };
  }, [incendioId, url]);

  if (busy) {
    return (
      <View style={{ width, height, alignItems:'center', justifyContent:'center', borderRadius: rounded, overflow:'hidden', backgroundColor:'#eee' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Image
      source={url ? { uri: url } : placeholder}
      style={{ width, height, borderRadius: rounded, overflow: 'hidden' }}
      resizeMode="cover"
    />
  );
}
