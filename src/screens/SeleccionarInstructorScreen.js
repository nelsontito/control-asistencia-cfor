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

const PIN_SUPERADMIN = '6789';

export default function SeleccionarInstructorScreen({ navigation }) {
  const [instructores, setInstructores] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Modo Superadmin
  const [modoAdmin, setModoAdmin] = useState(false);
  const [modalPinVisible, setModalPinVisible] = useState(false);
  const [pinIngresado, setPinIngresado] = useState('');

  // Modal Crear / Editar
  const [modalVisible, setModalVisible] = useState(false);
  const [instructorAEditar, setInstructorAEditar] = useState(null);
  const [grado, setGrado] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nombres, setNombres] = useState('');
  const [ci, setCi] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modal Función Táctica
  const [modalRolVisible, setModalRolVisible] = useState(false);
  const [instructorSeleccionado, setInstructorSeleccionado] = useState(null);

  useFocusEffect(
    useCallback(() => {
      cargarInstructores();
    }, [])
  );

  const cargarInstructores = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from('instructores')
        .select('*')
        .eq('activo', true)
        .order('apellidos', { ascending: true });

      if (error) throw error;
      setInstructores(data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
    }
  };

  const validarPinAdmin = () => {
    if (pinIngresado === PIN_SUPERADMIN) {
      setModoAdmin(true);
      setModalPinVisible(false);
      setPinIngresado('');
      Alert.alert('Modo Administrador', 'Se han habilitado las funciones de gestión y cierre anual.');
    } else {
      Alert.alert('PIN Incorrecto', 'Acceso denegado. Solo personal autorizado.');
      setPinIngresado('');
    }
  };

  const abrirModalCrear = () => {
    setInstructorAEditar(null);
    setGrado('');
    setApellidos('');
    setNombres('');
    setCi('');
    setModalVisible(true);
  };

  const abrirModalEditar = (item) => {
    setInstructorAEditar(item);
    setGrado(item.grado || '');
    setApellidos(item.apellidos || '');
    setNombres(item.nombres || '');
    setCi(item.ci || '');
    setModalVisible(true);
  };

  const guardarInstructor = async () => {
    if (!grado.trim() || !apellidos.trim() || !nombres.trim() || !ci.trim()) {
      Alert.alert('Atención', 'Complete todos los campos obligatorios');
      return;
    }

    setGuardando(true);
    try {
      if (instructorAEditar) {
        const { error } = await supabase
          .from('instructores')
          .update({
            grado: grado.trim(),
            apellidos: apellidos.trim().toUpperCase(),
            nombres: nombres.trim().toUpperCase(),
            ci: ci.trim(),
          })
          .eq('id', instructorAEditar.id);

        if (error) throw error;
        Alert.alert('Éxito', 'Datos del instructor actualizados correctamente.');
      } else {
        const { error } = await supabase.from('instructores').insert([
          {
            grado: grado.trim(),
            apellidos: apellidos.trim().toUpperCase(),
            nombres: nombres.trim().toUpperCase(),
            ci: ci.trim(),
            activo: true,
          },
        ]);
        if (error) throw error;
        Alert.alert('Éxito', 'Instructor registrado correctamente.');
      }

      setGrado('');
      setApellidos('');
      setNombres('');
      setCi('');
      setInstructorAEditar(null);
      setModalVisible(false);
      cargarInstructores();
    } catch (err) {
      Alert.alert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarInstructor = (id, nombreCompleto) => {
    if (!modoAdmin) return;

    Alert.alert('Confirmar Baja', `¿Dar de baja al instructor ${nombreCompleto}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dar de baja',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('instructores')
            .update({ activo: false })
            .eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else cargarInstructores();
        },
      },
    ]);
  };

  // Cierre Anual de Gestión (Exclusivo Superadmin)
  const archivarGestionAnual = () => {
    const anioActual = new Date().getFullYear();

    Alert.alert(
      'Cierre Anual de Instrucción',
      `¿Desea archivar la gestión ${anioActual}? Los cadetes actuales pasarán a egresados archivados y el patio quedará listo para la nueva promoción.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Cierre Anual',
          style: 'destructive',
          onPress: async () => {
            try {
              setCargando(true);
              const { error } = await supabase
                .from('estudiantes')
                .update({ activo: false })
                .eq('gestion', anioActual);

              if (error) throw error;
              Alert.alert('Gestión Archivada', `La gestión ${anioActual} ha sido archivada con éxito.`);
            } catch (e) {
              Alert.alert('Error al archivar', e.message);
            } finally {
              setCargando(false);
            }
          },
        },
      ]
    );
  };

  const volverAlLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const accederComoSeccion = () => {
    setModalRolVisible(false);
    if (!instructorSeleccionado) return;
    navigation.navigate('SeleccionarCarrera', {
      instructor: instructorSeleccionado,
      rol: 'SECCION',
    });
  };

  const accederComoComando = () => {
    setModalRolVisible(false);
    if (!instructorSeleccionado) return;
    navigation.replace('MainTabs', {
      instructor: instructorSeleccionado,
      carrera: { codigo: 'TODAS', nombre: 'Compañía CFOR' },
      rol: 'COMANDO',
    });
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

      {/* Cabecera Centrada con Emblema y Controles */}
      <View style={styles.headerCentrado}>
        <View style={styles.topBarAdmin}>
          {/* Botón Volver al Login Principal */}
          <TouchableOpacity style={styles.btnVolverLogin} onPress={volverAlLogin}>
            <Ionicons name="arrow-back-outline" size={15} color="#dda15e" style={{ marginRight: 4 }} />
            <Text style={styles.txtVolverLogin}>Login</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {modoAdmin && (
              <TouchableOpacity style={styles.btnArchivarGestion} onPress={archivarGestionAnual}>
                <Ionicons name="archive-outline" size={14} color="#fca5a5" style={{ marginRight: 4 }} />
                <Text style={styles.txtArchivarGestion}>Cerrar Gestión</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btnCandadoAdmin, modoAdmin && styles.btnCandadoActivo]}
              onPress={() => {
                if (modoAdmin) {
                  setModoAdmin(false);
                  Alert.alert('Modo Seguro', 'Modo Administrador desactivado.');
                } else {
                  setModalPinVisible(true);
                }
              }}
            >
              <Ionicons
                name={modoAdmin ? 'lock-open' : 'lock-closed'}
                size={16}
                color={modoAdmin ? '#dda15e' : '#a3b18a'}
              />
              <Text style={[styles.txtCandado, modoAdmin && { color: '#dda15e' }]}>
                {modoAdmin ? 'Admin Activo' : 'Admin'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.circuloIcono}>
          <Ionicons name="shield-checkmark" size={38} color="#dda15e" />
        </View>
        <Text style={styles.titulo}>COMPAÑÍA CFOR</Text>
        <Text style={styles.subtitulo}>Seleccione el instructor responsable de la formación</Text>
      </View>

      {/* Listado */}
      {cargando ? (
        <ActivityIndicator size="large" color="#dda15e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={instructores}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={styles.vacioContainer}>
              <Ionicons name="people-outline" size={48} color="#414833" />
              <Text style={styles.vacio}>No hay instructores registrados.</Text>
              <Text style={styles.vacioSub}>Active el modo Admin para registrar uno.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                setInstructorSeleccionado(item);
                setModalRolVisible(true);
              }}
            >
              <View style={styles.avatarBox}>
                <Ionicons name="person" size={22} color="#dda15e" />
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {item.grado} {item.apellidos}, {item.nombres}
                </Text>
                <Text style={styles.ci}>CI: {item.ci}</Text>
              </View>

              <View style={styles.accionesCard}>
                {modoAdmin && (
                  <>
                    <TouchableOpacity
                      onPress={() => abrirModalEditar(item)}
                      style={[styles.btnAccionMini, styles.btnEditar]}
                    >
                      <Ionicons name="pencil-outline" size={15} color="#fefae0" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => eliminarInstructor(item.id, `${item.grado} ${item.apellidos}`)}
                      style={[styles.btnAccionMini, styles.btnTrash]}
                    >
                      <Ionicons name="trash-outline" size={15} color="#fca5a5" />
                    </TouchableOpacity>
                  </>
                )}

                <Ionicons name="chevron-forward" size={18} color="#a3b18a" style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Botón Añadir Instructor */}
      {modoAdmin && (
        <View style={styles.footerCentrado}>
          <TouchableOpacity style={styles.btnAgregarCentrado} onPress={abrirModalCrear}>
            <Ionicons name="person-add" size={18} color="#fefae0" style={{ marginRight: 8 }} />
            <Text style={styles.btnAgregarTxt}>Añadir Instructor</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal PIN */}
      <Modal visible={modalPinVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentSmall}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={22} color="#dda15e" style={{ marginRight: 6 }} />
              <Text style={styles.modalTituloSmall}>Clave Superadmin</Text>
            </View>
            <Text style={styles.modalSubAdmin}>
              Ingrese el PIN para habilitar la edición de instructores y cierre anual:
            </Text>

            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 20, letterSpacing: 8 }]}
              placeholder="••••"
              placeholderTextColor="#6c757d"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              value={pinIngresado}
              onChangeText={setPinIngresado}
            />

            <View style={styles.modalAcciones}>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnCancelar]}
                onPress={() => {
                  setModalPinVisible(false);
                  setPinIngresado('');
                }}
              >
                <Text style={styles.btnTxtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnGuardar]}
                onPress={validarPinAdmin}
              >
                <Text style={styles.btnTxtGuardar}>Desbloquear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Rol */}
      <Modal visible={modalRolVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalRolCard}>
            <View style={styles.modalHeaderRol}>
              <Ionicons name="options-outline" size={24} color="#dda15e" style={{ marginRight: 6 }} />
              <Text style={styles.modalTituloRol}>Función del Día</Text>
            </View>

            <Text style={styles.modalSubtituloRol}>
              Instructor: <Text style={{ fontWeight: '800', color: '#fefae0' }}>
                {instructorSeleccionado ? `${instructorSeleccionado.grado} ${instructorSeleccionado.apellidos}` : ''}
              </Text>
            </Text>

            <TouchableOpacity
              style={[styles.btnOpcionRol, styles.btnOpcionSeccion]}
              activeOpacity={0.8}
              onPress={accederComoSeccion}
            >
              <Ionicons name="checkbox-outline" size={22} color="#dda15e" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloOpcion}>Comandante de Sección</Text>
                <Text style={styles.descOpcion}>Control de pase de lista y efectivos por carrera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOpcionRol, styles.btnOpcionComando]}
              activeOpacity={0.8}
              onPress={accederComoComando}
            >
              <Ionicons name="shield-outline" size={22} color="#a3b18a" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloOpcion}>Comandante de Compañía</Text>
                <Text style={styles.descOpcion}>Centralizador general, rectificación y cierre oficial</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnCerrarModalRol}
              onPress={() => setModalRolVisible(false)}
            >
              <Text style={styles.btnCerrarModalRolTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Crear / Editar Instructor */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={instructorAEditar ? 'create-outline' : 'person-add-outline'}
                size={22}
                color="#dda15e"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.modalTitulo}>
                {instructorAEditar ? 'Editar Instructor' : 'Registrar Instructor'}
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Grado militar (Ej: Tte. Inf. / Sgto. 1ro.)"
              placeholderTextColor="#6c757d"
              value={grado}
              onChangeText={setGrado}
            />
            <TextInput
              style={styles.input}
              placeholder="Apellidos"
              placeholderTextColor="#6c757d"
              autoCapitalize="characters"
              value={apellidos}
              onChangeText={setApellidos}
            />
            <TextInput
              style={styles.input}
              placeholder="Nombres"
              placeholderTextColor="#6c757d"
              autoCapitalize="characters"
              value={nombres}
              onChangeText={setNombres}
            />
            <TextInput
              style={styles.input}
              placeholder="Cédula de Identidad (CI)"
              placeholderTextColor="#6c757d"
              keyboardType="numeric"
              value={ci}
              onChangeText={setCi}
            />

            <View style={styles.modalAcciones}>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnCancelar]}
                onPress={() => {
                  setModalVisible(false);
                  setInstructorAEditar(null);
                }}
              >
                <Text style={styles.btnTxtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnGuardar]}
                onPress={guardarInstructor}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#fefae0" />
                ) : (
                  <Text style={styles.btnTxtGuardar}>
                    {instructorAEditar ? 'Actualizar' : 'Guardar'}
                  </Text>
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
  headerCentrado: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  topBarAdmin: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  btnVolverLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2217',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  txtVolverLogin: { fontSize: 11, fontWeight: '700', color: '#dda15e' },
  btnArchivarGestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3e1f1d',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  txtArchivarGestion: { fontSize: 10, fontWeight: '700', color: '#fca5a5' },
  btnCandadoAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1c2217',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  btnCandadoActivo: { backgroundColor: '#283618', borderColor: '#dda15e' },
  txtCandado: { fontSize: 11, fontWeight: '700', color: '#a3b18a' },
  circuloIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#283618',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#dda15e',
  },
  titulo: { fontSize: 20, fontWeight: '900', color: '#fefae0', letterSpacing: 1.5, textAlign: 'center' },
  subtitulo: { fontSize: 12, color: '#a3b18a', textAlign: 'center', marginTop: 3, maxWidth: 280 },
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
  nombre: { fontSize: 14, fontWeight: '700', color: '#fefae0' },
  ci: { fontSize: 11, color: '#a3b18a', marginTop: 2 },
  accionesCard: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnAccionMini: { padding: 6, borderRadius: 6 },
  btnEditar: { backgroundColor: '#60492c' },
  btnTrash: { backgroundColor: '#3e1f1d' },
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
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1c2217',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  modalContentSmall: {
    backgroundColor: '#1c2217',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1.5,
    borderColor: '#dda15e',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: '#fefae0' },
  modalTituloSmall: { fontSize: 16, fontWeight: '800', color: '#dda15e' },
  modalSubAdmin: { fontSize: 12, color: '#a3b18a', marginBottom: 14 },
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
  modalRolCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1c2217',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#dda15e',
  },
  modalHeaderRol: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  modalTituloRol: { fontSize: 17, fontWeight: '900', color: '#fefae0' },
  modalSubtituloRol: { fontSize: 13, color: '#a3b18a', marginBottom: 16 },
  btnOpcionRol: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  btnOpcionSeccion: {
    backgroundColor: '#283618',
    borderColor: '#dda15e',
  },
  btnOpcionComando: {
    backgroundColor: '#222b1a',
    borderColor: '#414833',
  },
  tituloOpcion: { fontSize: 14, fontWeight: '800', color: '#fefae0' },
  descOpcion: { fontSize: 11, color: '#a3b18a', marginTop: 2 },
  btnCerrarModalRol: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  btnCerrarModalRolTxt: { fontSize: 13, fontWeight: '700', color: '#dda15e' },
});