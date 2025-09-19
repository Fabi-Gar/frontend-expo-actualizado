import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function Index() {
    useEffect(() => {
        const checkAuth = async () => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            router.replace('/mapa');
        } else {
            router.replace('/login');
        }
        };
    checkAuth();
    }, []);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#4CAF50" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
