import React, { useMemo, useState } from 'react';
import { View, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Button, Text, ActivityIndicator, IconButton } from 'react-native-paper';

type Picked = { uri: string; name?: string; mime?: string };

type Props = {
  value: Picked[];
  onChange: (arr: Picked[]) => void;
  max?: number;
  maxSizeMB?: number;        // tamaño máximo por foto (post-procesado)
  maxDim?: number;           // dimensión máxima (lado mayor)
};

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];

export default function PhotoPickerRow({
  value,
  onChange,
  max = 4,
  maxSizeMB = 6,
  maxDim = 1600,
}: Props) {
  const [busy, setBusy] = useState(false);

  const remaining = useMemo(() => Math.max(0, max - value.length), [max, value.length]);

  const ensurePerm = async (camera = false) => {
    if (camera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const processAndAdd = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const out: Picked[] = [];

    // Limitar a lo que falta
    const slice = assets.slice(0, remaining);

    for (const a of slice) {
      // Validación de tipo
      const mime = a.mimeType || guessMime(a.uri);
      if (!mime || !ALLOWED.includes(mime.toLowerCase())) {
        // Saltar archivos no permitidos
        continue;
      }

      // Redimensionar / convertir a JPEG, compresión ~0.7, lado máx maxDim
      const { width, height } = a;
      const { w, h } = boundSize(width ?? 0, height ?? 0, maxDim);
      const manip = await ImageManipulator.manipulateAsync(
        a.uri,
        w && h ? [{ resize: { width: w, height: h } }] : [],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Validar tamaño final
      const info = await FileSystem.getInfoAsync(manip.uri);
      const sizeOk = !info.exists || !('size' in info) || info.size <= maxSizeMB * 1024 * 1024;
      if (!sizeOk) {
        // Si sigue grande, un segundo intento de compresión más agresiva
        const manip2 = await ImageManipulator.manipulateAsync(
          manip.uri,
          [],
          { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG }
        );
        const info2 = await FileSystem.getInfoAsync(manip2.uri);
        if (!info2.exists || !('size' in info2) || info2.size > maxSizeMB * 1024 * 1024) {
          // Demasiado grande, la omitimos
          continue;
        }
        out.push({
          uri: manip2.uri,
          name: makeName('jpg'),
          mime: 'image/jpeg',
        });
      } else {
        out.push({
          uri: manip.uri,
          name: makeName('jpg'),
          mime: 'image/jpeg',
        });
      }
    }

    if (!out.length) return;
    onChange([...value, ...out].slice(0, max));
  };

  const pickFromLibrary = async () => {
    if (remaining <= 0 || busy) return;
    const ok = await ensurePerm(false);
    if (!ok) return;

    try {
      setBusy(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 1, // usamos compresión propia
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        selectionLimit: remaining, // iOS respeta; Android ignora (se recorta igual)
      });
      if (res.canceled) return;
      await processAndAdd(res.assets);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    if (remaining <= 0 || busy) return;
    const ok = await ensurePerm(true);
    if (!ok) return;

    try {
      setBusy(true);
      const res = await ImagePicker.launchCameraAsync({
        quality: 1,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (res.canceled) return;
      await processAndAdd([res.assets[0]]);
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (i: number) => {
    const copy = value.slice();
    copy.splice(i, 1);
    onChange(copy);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const arr = value.slice();
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
    onChange(arr);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.actionsRow}>
        <Button mode="outlined" onPress={takePhoto} disabled={busy || remaining <= 0} icon="camera">
          Cámara
        </Button>
        <Button mode="outlined" onPress={pickFromLibrary} disabled={busy || remaining <= 0} icon="image-multiple">
          Galería
        </Button>

        <View style={{ flex: 1 }} />
        <Text>{value.length}/{max}</Text>
      </View>

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator />
          <Text style={{ marginLeft: 8 }}>Procesando imágenes…</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 6 }}>
        {value.map((f, i) => (
          <View key={`${f.uri}-${i}`} style={styles.thumbWrap}>
            <Image source={{ uri: f.uri }} style={styles.thumb} />
            <View style={styles.thumbOverlay}>
              <IconButton icon="close" size={16} onPress={() => removeAt(i)} style={styles.overlayBtn} />
              <View style={{ flexDirection: 'row' }}>
                <IconButton icon="chevron-left" size={16} onPress={() => move(i, i - 1)} />
                <IconButton icon="chevron-right" size={16} onPress={() => move(i, i + 1)} />
              </View>
            </View>
          </View>
        ))}
        {!value.length && <Text>Sin fotos</Text>}
      </ScrollView>
    </View>
  );
}

/* Utils */

function boundSize(w: number, h: number, maxDim: number): { w?: number; h?: number } {
  if (!w || !h || w <= 0 || h <= 0) return {};
  const maxSide = Math.max(w, h);
  if (maxSide <= maxDim) return {};
  const scale = maxDim / maxSide;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function makeName(ext: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `photo_${stamp}.${ext}`;
}

function guessMime(uri: string): string | undefined {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return undefined;
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  busyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#eee' },
  thumbOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center'
  },
  overlayBtn: { margin: 0 },
});
