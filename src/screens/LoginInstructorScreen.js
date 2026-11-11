import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const CARRERAS = [
  { id: 'ING_COMERCIAL', label: 'Ing. Comercial', icono: 'briefcase-outline' },
  { id: 'CIENCIAS_BASICAS', label: 'Ciencias Básicas', icono: 'calculator-outline' },
  { id: 'TECNOLOGICO', label: 'Tecnológico', icono: 'hardware-chip-outline' },
];

export default function LoginInstructorScreen({ navigation }) {
  const [instructores, setInstructores] = useState([]);
  const [instructorSeleccionado, setInstructorSeleccionado] = useState(null);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarInstructores();
  }, []);

  const cargarInstructores = async () => {
    try {
      const { data, error } = await supabase
        .from('instructores')
        .select('*')
        .eq('activo', true)
        .order('apellidos', { ascending: true });

      if (error) throw error;
      setInstructores(data || []);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los instructores: ' + err.message);
    } finally {
      setCargando(false);
    }
  };

  const iniciarJornada = () => {
    if (!instructorSeleccionado) {
      Alert.alert('Atención', 'Seleccione al instructor responsable.');
      return;
    }
    if (!carreraSeleccionada) {
      Alert.alert('Atención', 'Seleccione la carrera que va a formar y controlar.');
      return;
    }

    // Navega a las pestañas pasando los parámetros del instructor y la carrera
    navigation.replace('MainTabs', {
      instructor: instructorSeleccionado,
      carreraInicial: carreraSeleccionada,
    });
  };

  const volverAlLoginPrincipal = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#dda15e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#141810" />

      {/* Franja Camuflada MultiCam Superior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1.2 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.6 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 1.1 }]} />
      </View>

      {/* Barra Superior con Botón Volver al Login Principal */}
      <View style={styles.topBarVolver}>
        <TouchableOpacity
          style={styles.btnVolver}
          activeOpacity={0.7}
          onPress={volverAlLoginPrincipal}
        >
          <Ionicons name="arrow-back-outline" size={18} color="#dda15e" style={{ marginRight: 6 }} />
          <Text style={styles.txtBtnVolver}>Volver al Login</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.emblemaCirculo}>
            <Ionicons name="shield-checkmark" size={38} color="#dda15e" />
          </View>
          <Text style={styles.titulo}>CONTROL CFOR</Text>
          <Text style={styles.subtitulo}>Acceso y Asignación de Bloque Táctico</Text>
        </View>

        {/* 1. Selección de Instructor */}
        <Text style={styles.seccionLabel}>1. Seleccione Instructor Responsable:</Text>
        <View style={styles.listaOpciones}>
          {instructores.map((inst) => {
            const activo = instructorSeleccionado?.id === inst.id;
            return (
              <TouchableOpacity
                key={inst.id}
                style={[styles.cardOpcion, activo && styles.cardActivo]}
                onPress={() => setInstructorSeleccionado(inst)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={activo ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={activo ? '#dda15e' : '#6c757d'}
                />
                <Text style={[styles.textoOpcion, activo && styles.textoActivo]}>
                  {inst.grado} {inst.apellidos}, {inst.nombres}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. Selección de Carrera */}
        <Text style={[styles.seccionLabel, { marginTop: 24 }]}>2. Seleccione Carrera a Controlar:</Text>
        <View style={styles.listaOpciones}>
          {CARRERAS.map((c) => {
            const activa = carreraSeleccionada === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.cardOpcion, activa && styles.cardActivo]}
                onPress={() => setCarreraSeleccionada(c.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={c.icono}
                  size={22}
                  color={activa ? '#dda15e' : '#a3b18a'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.textoOpcion, activa && styles.textoActivo]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Botón de Entrada */}
        <TouchableOpacity style={styles.btnIngresar} onPress={iniciarJornada} activeOpacity={0.8}>
          <Text style={styles.btnIngresarTxt}>INICIAR FORMACIÓN</Text>
          <Ionicons name="arrow-forward" size={18} color="#fefae0" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </ScrollView>

      {/* Franja Camuflada MultiCam Inferior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 0.9 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.7 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1.3 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141810' },
  camoStripeContainer: {
    height: 6,
    flexDirection: 'row',
    width: '100%',
  },
  camoBlock: {
    height: '100%',
  },
  topBarVolver: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  btnVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2217',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#414833',
  },
  txtBtnVolver: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dda15e',
    letterSpacing: 0.5,
  },
  scroll: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141810' },
  header: { alignItems: 'center', marginBottom: 22, marginTop: 4 },
  emblemaCirculo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#283618',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#dda15e',
    marginBottom: 8,
  },
  titulo: { fontSize: 22, fontWeight: '900', color: '#fefae0', letterSpacing: 1.5, marginTop: 4 },
  subtitulo: { fontSize: 12, color: '#a3b18a', marginTop: 4, letterSpacing: 0.5 },
  seccionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dda15e',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  listaOpciones: { gap: 8 },
  cardOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2217',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  cardActivo: {
    borderColor: '#dda15e',
    backgroundColor: '#283618',
  },
  textoOpcion: { fontSize: 14, fontWeight: '600', color: '#a3b18a', marginLeft: 10 },
  textoActivo: { color: '#fefae0', fontWeight: '800' },
  btnIngresar: {
    flexDirection: 'row',
    backgroundColor: '#606c38',
    marginTop: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dda15e',
    elevation: 4,
  },
  btnIngresarTxt: { color: '#fefae0', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});