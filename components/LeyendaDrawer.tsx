import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface LeyendaDrawerProps {
  animation: Animated.Value;
}

const legends = [
  {
    title: 'Incidente activo',
    description: 'El incendio se encuentra activo',
    //icon: require('@/assets/legend/activo.png'),
  },
  {
    title: 'Incidente contenido',
    description: 'El incendio fue controlado y ya fue apagado',
    //icon: require('@/assets/legend/contenido.png'),
  },
  {
    title: 'Incidente en proceso',
    description: 'El incendio fue reportado y las autoridades están trabajando para apagarlo',
    //icon: require('@/assets/legend/proceso.png'),
  },
  {
    title: 'Incidente crítico',
    description: 'El incendio ya es demasiado grande tener precaución y evacuar',
    //icon: require('@/assets/legend/critico.png'),
  },
  {
    title: 'Incidente silencioso',
    description: 'Este incendio representa que no hay alertas asociadas al incendio',
    //icon: require('@/assets/legend/silencioso.png'),
  },
  {
    title: 'Area roja',
    description: 'Advertencias del servicio meteorológico indican riesgo menor de incendio',
    //icon: require('@/assets/legend/roja.png'),
  },
  {
    title: 'Area naranja',
    description: 'Advertencias de mayor riesgo indicando una mayor posibilidad de incendio',
    //icon: require('@/assets/legend/naranja.png'),
  },
  {
    title: 'Perímetro de incendio',
    description: 'Area que se encuentra en incendio sin trabajar o protección por parte de bomberos',
    //icon: require('@/assets/legend/perimetro1.png'),
  },
  {
    title: 'Perímetro de incendio',
    description: 'Perímetro de incendio activo',
    //icon: require('@/assets/legend/perimetro2.png'),
  },
];

export const LeyendaDrawer = ({ animation }: LeyendaDrawerProps) => {
  return (
    <Animated.View style={[styles.drawer, { left: animation }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Incendios y Mapa</Text>
        {legends.map((item, idx) => (
          <View key={idx} style={styles.item}>
               {/* <Image source={item.icon} style={styles.icon} />   */} 
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  icon: {
    width: 40,
    height: 40,
    marginRight: 12,
    resizeMode: 'contain',
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemDescription: {
    fontSize: 14,
    color: '#444',
  },
});
