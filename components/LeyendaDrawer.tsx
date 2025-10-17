import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface LeyendaDrawerProps {
  animation: Animated.Value;
  statesInUse?: string[];
  getColor?: (estado: string) => string;
}

const FIRMS_GRADIENT = ['#2196F3', '#03A9F4', '#8BC34A', '#FFC107', '#F44336'];

type LegendKind = 'dot' | 'gradient';

type LegendItem = {
  title: string;
  description: string;
  kind: LegendKind;
  color?: string;
  colors?: string[];
};

// Función para obtener colores específicos
const getEstadoColor = (estado: string): string => {
  switch (estado) {
    case 'Pendiente':
      return '#F44336'; // Rojo
    case 'En atención':
      return '#FF9800'; // Naranja
    case 'Extinguido':
      return '#4CAF50'; // Verde
    case 'Detectado':
      return '#FF5722'; // Naranja oscuro
    case 'En verificación':
      return '#FFC107'; // Amarillo
    case 'Activo':
      return '#F44336'; // Rojo
    case 'Controlado':
      return '#2196F3'; // Azul
    case 'Liquidado':
      return '#4CAF50'; // Verde
    case 'Cerrado':
      return '#9E9E9E'; // Gris
    case 'Falso positivo':
      return '#607D8B'; // Gris azulado
    case 'Reactivado':
      return '#E91E63'; // Rosa
    default:
      return '#9E9E9E'; // Gris por defecto
  }
};

const Dot = ({ color }: { color: string }) => (
  <View style={styles.dotWrap}>
    <View style={[styles.dotCore, { backgroundColor: color }]} />
  </View>
);

const GradientRow = ({ colors }: { colors: string[] }) => (
  <View style={styles.gradRow}>
    {colors.map((c, i) => (
      <View key={i} style={[styles.gradSwatch, { backgroundColor: c }]} />
    ))}
  </View>
);

export const LeyendaDrawer = ({ animation, statesInUse = [], getColor }: LeyendaDrawerProps) => {
  const ORDER = [
    'Pendiente',        // Nuevo - Rojo
    'En atención',      // Nuevo - Naranja  
    'Extinguido',       // Nuevo - Verde
    'Detectado',
    'En verificación',
    'Activo',
    'Controlado',
    'Liquidado',
    'Cerrado',
    'Falso positivo',
    'Reactivado',
  ];

  const present = Array.from(new Set(statesInUse)).filter(Boolean);
  const source = present.length ? present : [];

  const ordered = source.length
    ? ORDER.filter(s => source.includes(s))
    : ORDER; // Mostrar todos si no hay estados en uso

  const stateLegends: LegendItem[] = ordered.map(s => ({
    title: s,
    description:
      s === 'Pendiente' ? 'Incendio reportado, pendiente de atención.' :
      s === 'En atención' ? 'Equipos trabajando en el incendio.' :
      s === 'Extinguido' ? 'Incendio completamente apagado.' :
      s === 'Detectado' ? 'Incendio reportado recientemente.' :
      s === 'En verificación' ? 'Validación en curso.' :
      s === 'Activo' ? 'Incendio confirmado y en desarrollo.' :
      s === 'Controlado' ? 'Confinado; bajo observación.' :
      s === 'Liquidado' ? 'Extinguido por completo.' :
      s === 'Cerrado' ? 'Cierre administrativo.' :
      s === 'Falso positivo' ? 'No hubo incendio real.' :
      s === 'Reactivado' ? 'Reavivamiento de un evento.' :
      '',
    kind: 'dot',
    color: typeof getColor === 'function' ? getColor(s) : getEstadoColor(s),
  }));

  const legends: LegendItem[] = [
    ...stateLegends,
    { title: 'FIRMS – Heatmap', description: 'Densidad de detecciones satelitales recientes.', kind: 'gradient', colors: FIRMS_GRADIENT },
    { title: 'FIRMS – Puntos', description: 'Detecciones individuales (zoom cercano).', kind: 'dot', color: '#FF5722' },
  ];

  return (
    <Animated.View style={[styles.drawer, { left: animation }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Leyenda</Text>

        {legends.map((item, idx) => (
          <View key={idx} style={styles.item}>
            <View style={styles.iconCol}>
              {item.kind === 'dot' && item.color ? <Dot color={item.color} /> : null}
              {item.kind === 'gradient' && item.colors ? <GradientRow colors={item.colors} /> : null}
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.note}>
          Nota: El color del pin indica el estado del incendio. El heatmap FIRMS resume densidad; los puntos FIRMS aparecen al hacer zoom.
        </Text>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: '#fff',
    elevation: 10,
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 19,
  },
  content: {
    paddingBottom: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  iconCol: {
    width: 44,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: '#444',
  },
  dotWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000014',
  },
  dotCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fff',
    elevation: 2,
  },
  gradRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gradSwatch: {
    width: 9,
    height: 18,
    borderRadius: 2,
  },
  note: {
    marginTop: 12,
    fontSize: 11,
    color: '#666',
  },
});