import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clearToken } from '../session';
import { router } from 'expo-router';

export const MENU_DRAWER_WIDTH = Dimensions.get('window').width * 0.7;

interface Props {
  animation: Animated.Value;
  onClose: () => void;
  onNavigate: (route: string) => void;
  isAdmin?: boolean; 
}

export const MenuDrawer = ({ animation, onClose, onNavigate, isAdmin = false }: Props) => {
  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await clearToken();
            onClose();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Animated.View style={[styles.drawer, { left: animation }]}>
      <Text style={styles.title}>App incendios</Text>

      <TouchableOpacity style={styles.option} onPress={() => onNavigate('Mapa')}>
        <Ionicons name="map" size={20} color="#37474F" style={styles.icon} />
        <Text style={styles.optionText}>Mapa</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => onNavigate('Ayuda')}>
        <Ionicons name="information-circle" size={20} color="#37474F" style={styles.icon} />
        <Text style={styles.optionText}>Ayuda</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Otras opciones</Text>

      <TouchableOpacity style={styles.option} onPress={() => onNavigate('listaIncendios')}>
        <Ionicons name="flame" size={20} color="#37474F" style={styles.icon} />
        <Text style={styles.optionText}>Incendios</Text>
      </TouchableOpacity>

      {isAdmin && (
        <>
          <Text style={[styles.section, { marginTop: 18 }]}>Administración</Text>

          <TouchableOpacity style={styles.option} onPress={() => onNavigate('Catalogo Incendio')}>
            <Ionicons name="pricetags" size={20} color="#37474F" style={styles.icon} />
            <Text style={styles.optionText}>Catalogos genericos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onNavigate('Estados')}>
            <Ionicons name="list" size={20} color="#37474F" style={styles.icon} />
            <Text style={styles.optionText}>Estados</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onNavigate('Regiones')}>
            <Ionicons name="grid" size={20} color="#37474F" style={styles.icon} />
            <Text style={styles.optionText}>Regiones</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onNavigate('Roles')}>
            <Ionicons name="build" size={20} color="#37474F" style={styles.icon} />
            <Text style={styles.optionText}>Roles</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onNavigate('Usuarios')}>
            <Ionicons name="person" size={20} color="#37474F" style={styles.icon} />
            <Text style={styles.optionText}>Usuarios</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
        <Text style={styles.version}>v 0.0.0.0</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: MENU_DRAWER_WIDTH,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#37474F',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  optionText: {
    fontSize: 16,
    color: '#37474F',
  },
  icon: {
    marginRight: 10,
  },
  section: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    color: '#888',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#37474F',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  version: {
    fontSize: 10,
    color: '#999',
    marginTop: 10,
  },
});
