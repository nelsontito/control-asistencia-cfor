import React from 'react';
import { TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './src/screens/LoginScreen';
import SeleccionarInstructorScreen from './src/screens/SeleccionarInstructorScreen';
import SeleccionarCarreraScreen from './src/screens/SeleccionarCarreraScreen';
import AsistenciaScreen from './src/screens/AsistenciaScreen';
import EstudiantesScreen from './src/screens/EstudiantesScreen';
import ReporteScreen from './src/screens/ReporteScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route, navigation }) {
  const { instructor, carrera, rol } = route.params || {};
  const esComando = rol === 'COMANDO' || instructor?.es_comando === true;

  const nombreCarrera = carrera?.nombre || (esComando ? 'Compañía CFOR' : 'Carrera Asignada');
  const codigoCarrera = carrera?.codigo || 'TODAS';

  return (
    <Tab.Navigator
      key={esComando ? 'tab-comando' : 'tab-seccion'}
      initialRouteName={esComando ? "Reportes" : "Asistencia"}
      screenOptions={({ route: tabRoute }) => ({
        headerStyle: { backgroundColor: '#141810' },
        headerTintColor: '#dda15e',
        headerRight: () => (
          <TouchableOpacity
            style={{ marginRight: 16 }}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            }
          >
            <Ionicons name="log-out-outline" size={22} color="#f87171" />
          </TouchableOpacity>
        ),
        tabBarStyle: { backgroundColor: '#141810', height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: '#dda15e',
        tabBarInactiveTintColor: '#6c757d',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (tabRoute.name === 'Asistencia') iconName = 'checkbox-outline';
          else if (tabRoute.name === 'Estudiantes') iconName = 'people-outline';
          else if (tabRoute.name === 'Reportes') iconName = 'document-text-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Asistencia"
        component={AsistenciaScreen}
        initialParams={{ instructor, carrera, carreraInicial: codigoCarrera }}
        options={{
          title: `Pase: ${nombreCarrera}`,
          tabBarItemStyle: esComando ? { display: 'none' } : {},
        }}
      />

      <Tab.Screen
        name="Estudiantes"
        component={EstudiantesScreen}
        initialParams={{ instructor, carrera, carreraInicial: codigoCarrera }}
        options={{ title: esComando ? 'Efectivos Compañía' : 'Efectivos Bloque' }}
      />

      <Tab.Screen
        name="Reportes"
        component={ReporteScreen}
        initialParams={{ instructor, carrera }}
        options={{
          title: 'Parte Diario',
          tabBarItemStyle: !esComando ? { display: 'none' } : {},
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: { backgroundColor: '#141810' },
            headerTintColor: '#dda15e',
            headerTitleStyle: { fontWeight: '800' },
          }}
        >
          {/* Pantalla Inicial con Estilo MultiCam */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SeleccionarInstructor"
            component={SeleccionarInstructorScreen}
            options={{ title: 'Seleccionar Instructor' }}
          />
          <Stack.Screen
            name="SeleccionarCarrera"
            component={SeleccionarCarreraScreen}
            options={{ title: 'Seleccionar Carrera' }}
          />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}