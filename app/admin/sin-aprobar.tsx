// app/admin/sin-aprobar.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Appbar,
  TextInput,
  Text,
  ActivityIndicator,
  Button,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { listIncendiosSinAprobar, aprobarIncendio, rechazarIncendio, Incendio } from '@/services/incendios';
import { showToast } from '@/hooks/uiStore';

export default function IncendiosSinAprobar() {
  const router = useRouter();

  const [items, setItems] = useState<Incendio[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const hasMore = page * pageSize < total;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, replace = false) => {
      try {
        if (nextPage === 1) setLoading(true);
        const resp = await listIncendiosSinAprobar({ q, page: nextPage, pageSize });

        setTotal(resp.total);
        if (replace) {
          setItems(resp.items);
        } else {
          setItems((prev) => (nextPage === 1 ? resp.items : [...prev, ...resp.items]));
        }
        setPage(nextPage);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.error?.message || 'No se pudieron cargar incendios');
      } finally {
        if (nextPage === 1) setLoading(false);
      }
    },
    [q, pageSize]
  );

  const schedule = (fn: () => void, ms = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  useEffect(() => {
    schedule(() => loadPage(1, true));
  }, [q]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage(1, true);
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadPage(page + 1, false);
  }, [hasMore, loading, loadPage, page]);

  const handleAprobar = useCallback(
    async (item: Incendio) => {
      try {
        await aprobarIncendio(item.id);
        showToast({ type: 'success', message: 'Incendio aprobado' });
        await loadPage(1, true);
      } catch {
        Alert.alert('Error', 'No se pudo aprobar');
      }
    },
    [loadPage]
  );

  const handleRechazar = useCallback(
    (item: Incendio) => {
      Alert.prompt(
        'Rechazar incendio',
        `¿Por qué rechazas "${item.titulo}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Rechazar',
            style: 'destructive',
            onPress: async (motivo) => {
              const motivoFinal = motivo?.trim() || 'Sin motivo especificado';
              try {
                await rechazarIncendio(item.id, motivoFinal);
                showToast({ type: 'info', message: 'Incendio rechazado' });
                await loadPage(1, true);
              } catch {
                Alert.alert('Error', 'No se pudo rechazar');
              }
            },
          },
        ],
        'plain-text'
      );
    },
    [loadPage]
  );

  const renderItem = ({ item }: { item: Incendio }) => {
    const fecha = item.creadoEn ? new Date(item.creadoEn).toLocaleString() : '—';
    const creador = [item.creadoPor?.nombre, item.creadoPor?.apellido].filter(Boolean).join(' ') || 'Desconocido';

    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={() => router.push(`/incendios/detalles?id=${item.id}` as any)}
          style={{ flex: 1 }}
        >
          <Text style={styles.titulo}>{item.titulo}</Text>
          <Text style={styles.meta}>Creado por: {creador}</Text>
          <Text style={styles.meta}>Fecha: {fecha}</Text>
          {item.descripcion && <Text style={styles.desc} numberOfLines={2}>{item.descripcion}</Text>}
        </TouchableOpacity>

        <View style={styles.actions}>
          <Button
            mode="contained"
            buttonColor="#2E7D32"
            textColor="#FFF"
            compact
            onPress={() => handleAprobar(item)}
          >
            Aprobar
          </Button>
          <Button
            mode="outlined"
            textColor="#C62828"
            style={{ borderColor: '#C62828' }}
            compact
            onPress={() => handleRechazar(item)}
          >
            Rechazar
          </Button>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Appbar.Header mode="small">
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Incendios sin aprobar" />
      </Appbar.Header>

      <View style={styles.searchBox}>
        <TextInput
          mode="outlined"
          placeholder="Buscar por título"
          value={q}
          onChangeText={setQ}
          right={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <Divider />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
              <Text style={{ marginTop: 8, fontSize: 16, color: '#666' }}>
                No hay incendios pendientes de aprobación
              </Text>
            </View>
          }
          renderItem={renderItem}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchBox: { padding: 16, paddingBottom: 8 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  card: {
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  titulo: { fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: '#333' },
  meta: { fontSize: 12, color: '#666', marginBottom: 2 },
  desc: { fontSize: 14, color: '#555', marginTop: 6 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
});
