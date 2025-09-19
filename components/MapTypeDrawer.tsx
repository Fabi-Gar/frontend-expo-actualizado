import React from 'react';
import {
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';

export const DRAWER_WIDTH = Dimensions.get('window').width * 0.7;

interface Props {
  animation: Animated.Value;
  onSelectType: (type: 'standard' | 'satellite' | 'hybrid' | 'terrain') => void;
}

export const MapTypeDrawer = ({ animation, onSelectType }: Props) => {
  const types: ('standard' | 'satellite' | 'hybrid' | 'terrain')[] = [
    'standard',
    'satellite',
    'hybrid',
    'terrain',
  ];

  return (
    <Animated.View style={[styles.drawer, { left: animation }]}>
      <Text style={styles.drawerTitle}>Tipo de mapa</Text>
      {types.map((type) => (
        <TouchableOpacity
          key={type}
          onPress={() => onSelectType(type)}
          style={styles.drawerOption}
        >
          <Text style={styles.drawerText}>{type.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    elevation: 8,
    paddingTop: 50,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  drawerOption: {
    paddingVertical: 10,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  drawerText: {
    fontSize: 16,
    color: '#333',
  },
});
