import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

export default function SeleccionarCarreraScreen({ route, navigation }) {
  const { instructor, rol } = route.params || {};
  const [carreras, setCarreras] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Obtener solo el primer apellido
  const primerApellido = instructor?.apellidos
    ? instructor.apellidos.trim().split(' ')[0]
    : '';

  // Modal CRUD Carrera
  const [modalVisible, setModalVisible] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      cargarCarreras();
    }, [])
  );

  const cargarCarreras = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from('carreras')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setCarreras(data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
    }
  };

  const guardarCarrera = async () => {
    if (!codigo.trim() || !nombre.trim()) {
      Alert.alert('Atención', 'Complete código y nombre de la carrera');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from('carreras').insert([
        {
          codigo: codigo.trim().toUpperCase().replace(/\s+/g, '_'),
          nombre: nombre.trim(),
          activo: true,
        },
      ]);
      if (error) throw error;
      setCodigo('');
      setNombre('');
      setModalVisible(false);
      cargarCarreras();
    } catch (err) {
      Alert.alert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarCarrera = (id, nombreCarrera) => {
    Alert.alert('Confirmar Baja', `¿Desactivar la carrera ${nombreCarrera}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('carreras')
            .update({ activo: false })
            .eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else cargarCarreras();
        },
      },
    ]);
  };

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

      {/* Banner Superior: Grado y Primer Apellido */}
      <View style={styles.bannerInstructor}>
        <Ionicons name="shield-checkmark" size={18} color="#dda15e" style={{ marginRight: 6 }} />
        <Text style={styles.bannerTxt}>
          Instructor:{' '}
          <Text style={styles.bannerBold}>
            {instructor ? `${instructor.grado} ${primerApellido}` : 'Sin asignar'}
          </Text>
        </Text>
      </View>

      {/* Cabecera Centrada */}
      <View style={styles.headerCentrado}>
        <View style={styles.circuloIcono}>
          <Ionicons name="school" size={34} color="#dda15e" />
        </View>
        <Text style={styles.titulo}>ASIGNACIÓN DE BLOQUE</Text>
        <Text style={styles.subtitulo}>Seleccione la carrera que pasará lista este sábado</Text>
      </View>

      {/* Listado de Carreras */}
      {cargando ? (
        <ActivityIndicator size="large" color="#dda15e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={carreras}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={styles.vacioContainer}>
              <Ionicons name="school-outline" size={48} color="#414833" />
              <Text style={styles.vacio}>No hay carreras disponibles.</Text>
              <Text style={styles.vacioSub}>Presione el botón inferior para registrar una.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() =>
                navigation.replace('MainTabs', {
                  instructor,
                  carrera: item,
                  rol: rol || 'SECCION',
                })
              }
            >
              <View style={styles.avatarBox}>
                <Ionicons name="ribbon-outline" size={22} color="#dda15e" />
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
                <Text style={styles.codigo}>Código: {item.codigo}</Text>
              </View>

              <View style={styles.accionesCard}>
                <TouchableOpacity
                  onPress={() => eliminarCarrera(item.id, item.nombre)}
                  style={styles.btnTrash}
                >
                  <Ionicons name="trash-outline" size={16} color="#fca5a5" />
                </TouchableOpacity>

                <Ionicons name="chevron-forward" size={18} color="#a3b18a" style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Botón Inferior: Añadir Carrera */}
      <View style={styles.footerCentrado}>
        <TouchableOpacity style={styles.btnAgregarCentrado} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={19} color="#fefae0" style={{ marginRight: 8 }} />
          <Text style={styles.btnAgregarTxt}>Añadir Carrera</Text>
        </TouchableOpacity>
      </View>

      {/* Modal para Crear Carrera */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="school-outline" size={22} color="#dda15e" style={{ marginRight: 6 }} />
              <Text style={styles.modalTitulo}>Registrar Nueva Carrera</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nombre completo (Ej: Ing. Comercial / Bioquímica)"
              placeholderTextColor="#6c757d"
              value={nombre}
              onChangeText={setNombre}
            />

            <TextInput
              style={styles.input}
              placeholder="Código corto (Ej: ING_COMERCIAL / BIOQ)"
              placeholderTextColor="#6c757d"
              autoCapitalize="characters"
              value={codigo}
              onChangeText={setCodigo}
            />

            <View style={styles.modalAcciones}>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnCancelar]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnTxtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnGuardar]}
                onPress={guardarCarrera}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#fefae0" />
                ) : (
                  <Text style={styles.btnTxtGuardar}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  camoBlock: { height: '100%' },
  bannerInstructor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c2217',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  bannerTxt: { color: '#a3b18a', fontSize: 13 },
  bannerBold: { color: '#fefae0', fontWeight: '800' },
  headerCentrado: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  circuloIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#283618',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#dda15e',
  },
  titulo: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fefae0',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 12,
    color: '#a3b18a',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#1c2217',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141810',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#414833',
  },
  infoCol: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: '700', color: '#fefae0' },
  codigo: { fontSize: 11, color: '#a3b18a', marginTop: 2 },
  accionesCard: { flexDirection: 'row', alignItems: 'center' },
  btnTrash: { padding: 6, borderRadius: 6, backgroundColor: '#3e1f1d' },
  vacioContainer: { alignItems: 'center', marginTop: 40 },
  vacio: { color: '#dda15e', fontSize: 14, fontWeight: '600', marginTop: 10 },
  vacioSub: { color: '#a3b18a', fontSize: 12, marginTop: 4 },
  footerCentrado: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  btnAgregarCentrado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#606c38',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#dda15e',
    elevation: 4,
  },
  btnAgregarTxt: { color: '#fefae0', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1c2217',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: '#fefae0' },
  input: {
    borderWidth: 1.5,
    borderColor: '#414833',
    borderRadius: 8,
    padding: 11,
    marginBottom: 10,
    fontSize: 13,
    color: '#fefae0',
    backgroundColor: '#141810',
  },
  modalAcciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btnAccion: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnCancelar: { backgroundColor: '#414833' },
  btnGuardar: { backgroundColor: '#606c38', borderWidth: 1, borderColor: '#dda15e' },
  btnTxtCancelar: { fontWeight: '700', fontSize: 13, color: '#fefae0' },
  btnTxtGuardar: { fontWeight: '800', fontSize: 13, color: '#fefae0' },
});