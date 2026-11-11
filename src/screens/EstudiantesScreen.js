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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

export default function EstudiantesScreen({ route }) {
  const { carrera, carreraInicial, rol } = route.params || {};
  const codigoCarrera = carrera?.codigo || carreraInicial;
  const nombreCarrera =
    carrera?.nombre ||
    (typeof carrera === 'string' ? carrera : null) ||
    carreraInicial ||
    'Compañía CFOR';

  const esComando = !codigoCarrera || codigoCarrera === 'TODAS' || rol === 'COMANDO';
  const anioActual = new Date().getFullYear();

  const [estudiantes, setEstudiantes] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // Modal Crear / Editar
  const [modalRegistroVisible, setModalRegistroVisible] = useState(false);
  const [estudianteAEditar, setEstudianteAEditar] = useState(null);
  const [ci, setCi] = useState('');
  const [codigoSaga, setCodigoSaga] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nombres, setNombres] = useState('');
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(
    esComando ? 'ING_COMERCIAL' : codigoCarrera
  );
  const [guardando, setGuardando] = useState(false);

  // Modal Kardex
  const [modalKardexVisible, setModalKardexVisible] = useState(false);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
  const [historialDetalle, setHistorialDetalle] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useFocusEffect(
    useCallback(() => {
      cargarEstudiantesYHistorial();
    }, [codigoCarrera])
  );

  const cargarEstudiantesYHistorial = async () => {
    try {
      setCargando(true);

      // Traer estudiantes de la gestión activa
      const { data: estData, error: estError } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('activo', true)
        .eq('gestion', anioActual)
        .order('apellidos', { ascending: true });

      if (estError) throw estError;

      const filtrados = (estData || []).filter((e) => {
        if (esComando) return true;
        const carreraEst = (e.carrera || e.carrera_codigo || '').toUpperCase().trim();
        const carreraFiltro = (codigoCarrera || '').toUpperCase().trim();
        return (
          carreraEst === carreraFiltro ||
          carreraEst.replace(/\s+/g, '_') === carreraFiltro ||
          carreraFiltro.includes(carreraEst)
        );
      });

      setEstudiantes(filtrados);

      // Acumulado de asistencias
      const { data: asisData, error: asisError } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado');

      if (asisError) throw asisError;

      const mapaStats = {};
      (asisData || []).forEach((reg) => {
        if (!mapaStats[reg.estudiante_id]) {
          mapaStats[reg.estudiante_id] = { faltas: 0, permisos: 0, bajas: 0, presentes: 0 };
        }
        if (reg.estado === 'FALTA') mapaStats[reg.estudiante_id].faltas++;
        else if (reg.estado === 'PERMISO') mapaStats[reg.estudiante_id].permisos++;
        else if (reg.estado === 'BAJA_MEDICA') mapaStats[reg.estudiante_id].bajas++;
        else if (reg.estado === 'PRESENTE') mapaStats[reg.estudiante_id].presentes++;
      });

      setEstadisticas(mapaStats);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
    }
  };

  const abrirCrear = () => {
    setEstudianteAEditar(null);
    setCi('');
    setCodigoSaga('');
    setApellidos('');
    setNombres('');
    setCarreraSeleccionada(esComando ? 'ING_COMERCIAL' : codigoCarrera);
    setModalRegistroVisible(true);
  };

  const abrirEditar = (item) => {
    setEstudianteAEditar(item);
    setCi(item.ci || '');
    setCodigoSaga(item.codigo_saga || '');
    setApellidos(item.apellidos || '');
    setNombres(item.nombres || '');
    setCarreraSeleccionada(item.carrera || item.carrera_codigo || (esComando ? 'ING_COMERCIAL' : codigoCarrera));
    setModalRegistroVisible(true);
  };

  const guardarEstudiante = async () => {
    const carreraDestino = esComando ? carreraSeleccionada : codigoCarrera;

    if (!ci.trim() || !apellidos.trim() || !nombres.trim()) {
      Alert.alert('Atención', 'Complete CI, Apellidos y Nombres');
      return;
    }

    setGuardando(true);
    try {
      if (estudianteAEditar) {
        const { error } = await supabase
          .from('estudiantes')
          .update({
            ci: ci.trim(),
            codigo_saga: codigoSaga.trim().toUpperCase(),
            apellidos: apellidos.trim().toUpperCase(),
            nombres: nombres.trim().toUpperCase(),
            carrera: carreraDestino,
            carrera_codigo: carreraDestino,
          })
          .eq('id', estudianteAEditar.id);

        if (error) throw error;
        Alert.alert('Éxito', 'Datos del estudiante actualizados.');
      } else {
        const { error } = await supabase.from('estudiantes').insert([
          {
            ci: ci.trim(),
            codigo_saga: codigoSaga.trim().toUpperCase(),
            apellidos: apellidos.trim().toUpperCase(),
            nombres: nombres.trim().toUpperCase(),
            carrera: carreraDestino,
            carrera_codigo: carreraDestino,
            seccion: '1ra Seccion',
            activo: true,
            gestion: anioActual,
            anio_ingreso: anioActual,
          },
        ]);

        if (error) throw error;
        Alert.alert('Éxito', 'Estudiante registrado correctamente.');
      }

      setModalRegistroVisible(false);
      setEstudianteAEditar(null);
      cargarEstudiantesYHistorial();
    } catch (err) {
      Alert.alert('Error al guardar', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarEstudiante = (id, nombreCompleto) => {
    Alert.alert('Confirmar Baja', `¿Dar de baja a ${nombreCompleto}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dar de baja',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('estudiantes')
            .update({ activo: false })
            .eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else cargarEstudiantesYHistorial();
        },
      },
    ]);
  };

  const abrirKardex = async (estudiante) => {
    setEstudianteSeleccionado(estudiante);
    setModalKardexVisible(true);
    setCargandoDetalle(true);

    try {
      const { data, error } = await supabase
        .from('asistencias')
        .select(`
          id,
          estado,
          sesiones (
            id,
            fecha,
            observaciones
          )
        `)
        .eq('estudiante_id', estudiante.id)
        .neq('estado', 'PRESENTE')
        .order('id', { ascending: false });

      if (error) throw error;
      setHistorialDetalle(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const modificarInasistencia = (itemAsistencia) => {
    if (!esComando) return;

    const fecha = itemAsistencia.sesiones?.fecha || 'Fecha';

    Alert.alert(
      'Justificar Inasistencia',
      `Fecha: ${fecha}\nEstado actual: ${itemAsistencia.estado}\n\nSeleccione la resolución para este cadete:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Conceder Permiso',
          onPress: () => actualizarEstadoAsistencia(itemAsistencia.id, 'PERMISO'),
        },
        {
          text: 'Baja Médica',
          onPress: () => actualizarEstadoAsistencia(itemAsistencia.id, 'BAJA_MEDICA'),
        },
        {
          text: 'Justificar (Presente)',
          onPress: () => actualizarEstadoAsistencia(itemAsistencia.id, 'PRESENTE'),
        },
      ]
    );
  };

  const actualizarEstadoAsistencia = async (asistenciaId, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('asistencias')
        .update({ estado: nuevoEstado })
        .eq('id', asistenciaId);

      if (error) throw error;

      Alert.alert('Inasistencia Actualizada', `Se ha aplicado el estado ${nuevoEstado}.`);

      if (estudianteSeleccionado) {
        abrirKardex(estudianteSeleccionado);
      }
      cargarEstudiantesYHistorial();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const estudiantesFiltrados = estudiantes.filter((e) => {
    const termino = busqueda.toLowerCase();
    const ciVal = e.ci ? e.ci.toLowerCase() : '';
    const sagaVal = e.codigo_saga ? e.codigo_saga.toLowerCase() : '';
    return (
      e.apellidos.toLowerCase().includes(termino) ||
      e.nombres.toLowerCase().includes(termino) ||
      ciVal.includes(termino) ||
      sagaVal.includes(termino)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabecera Fija */}
      <View style={styles.headerCarrera}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitulo} numberOfLines={1}>
            EFECTIVOS: {nombreCarrera.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.headerSub}>
            Gestión {anioActual} • Registrados: <Text style={styles.bold}>{estudiantes.length}</Text>
          </Text>
        </View>

        <TouchableOpacity style={styles.btnNuevo} onPress={abrirCrear}>
          <Ionicons name="person-add" size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.btnNuevoTxt}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View style={styles.buscadorContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.buscadorInput}
          placeholder="Buscar por apellido, CI o código SAGA..."
          placeholderTextColor="#64748b"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      {cargando ? (
        <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={estudiantesFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.vacioTxt}>No hay estudiantes registrados en la gestión actual.</Text>
          }
          renderItem={({ item, index }) => {
            const stats = estadisticas[item.id] || { faltas: 0, permisos: 0, bajas: 0, presentes: 0 };
            const inhabilitado = stats.faltas > 5;

            return (
              <TouchableOpacity
                style={[styles.card, inhabilitado && styles.cardInhabilitado]}
                activeOpacity={0.7}
                onPress={() => abrirKardex(item)}
              >
                <Text style={styles.indice}>#{index + 1}</Text>

                <View style={styles.infoCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.nombre} numberOfLines={1}>
                      {item.apellidos}, {item.nombres}
                    </Text>
                    {inhabilitado && (
                      <View style={styles.badgeInhabilitado}>
                        <Text style={styles.badgeInhabilitadoTxt}>INHABILITADO</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.ci}>
                    CI: {item.ci} {item.codigo_saga ? `• SAGA: ${item.codigo_saga}` : ''}
                    {esComando && item.carrera ? ` • ${item.carrera.replace(/_/g, ' ')}` : ''}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Text style={[styles.miniStat, inhabilitado && { color: '#ef4444', fontWeight: '800' }]}>
                      Faltas: {stats.faltas}
                    </Text>
                    <Text style={styles.miniStat}>Permisos: {stats.permisos}</Text>
                    <Text style={styles.miniStat}>Bajas: {stats.bajas}</Text>
                  </View>
                </View>

                <View style={styles.accionesFila}>
                  <TouchableOpacity
                    onPress={() => abrirEditar(item)}
                    style={[styles.btnMiniAccion, { backgroundColor: '#0284c7' }]}
                  >
                    <Ionicons name="pencil-outline" size={15} color="#ffffff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => eliminarEstudiante(item.id, `${item.apellidos}, ${item.nombres}`)}
                    style={[styles.btnMiniAccion, { backgroundColor: '#334155' }]}
                  >
                    <Ionicons name="trash-outline" size={15} color="#f87171" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal Kardex */}
      <Modal visible={modalKardexVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.kardexCard}>
            <View style={styles.kardexHeader}>
              <Ionicons name="document-text-outline" size={24} color="#38bdf8" style={{ marginRight: 8 }} />
              <Text style={styles.kardexTitulo}>Kardex de Asistencia</Text>
            </View>

            {estudianteSeleccionado && (
              <View>
                <Text style={styles.kardexNombre}>
                  {estudianteSeleccionado.apellidos}, {estudianteSeleccionado.nombres}
                </Text>
                <Text style={styles.kardexSub}>
                  CI: {estudianteSeleccionado.ci} {estudianteSeleccionado.codigo_saga ? `| SAGA: ${estudianteSeleccionado.codigo_saga}` : ''}
                </Text>
                <Text style={styles.kardexCarrera}>
                  Carrera: {estudianteSeleccionado.carrera?.replace(/_/g, ' ') || 'No asignada'}
                </Text>

                {(() => {
                  const s = estadisticas[estudianteSeleccionado.id] || { faltas: 0, permisos: 0, bajas: 0, presentes: 0 };
                  const inh = s.faltas > 5;
                  return (
                    <View style={[styles.dictamenBox, inh ? styles.dictamenInhabilitado : styles.dictamenHabilitado]}>
                      <Ionicons
                        name={inh ? 'alert-circle' : 'checkmark-circle'}
                        size={20}
                        color={inh ? '#ef4444' : '#16a34a'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.dictamenTxt, inh ? { color: '#ef4444' } : { color: '#16a34a' }]}>
                        {inh ? 'INHABILITADO POR INASISTENCIA (>5 FALTAS)' : 'ESTADO: REGULAR / HABILITADO'}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.kardexGrid}>
                  <View style={styles.kardexItem}>
                    <Text style={[styles.kardexNum, { color: '#16a34a' }]}>
                      {estadisticas[estudianteSeleccionado.id]?.presentes || 0}
                    </Text>
                    <Text style={styles.kardexLbl}>Presentes</Text>
                  </View>
                  <View style={styles.kardexItem}>
                    <Text
                      style={[
                        styles.kardexNum,
                        (estadisticas[estudianteSeleccionado.id]?.faltas || 0) > 5 ? { color: '#ef4444' } : { color: '#f87171' },
                      ]}
                    >
                      {estadisticas[estudianteSeleccionado.id]?.faltas || 0}
                    </Text>
                    <Text style={styles.kardexLbl}>Faltas</Text>
                  </View>
                  <View style={styles.kardexItem}>
                    <Text style={[styles.kardexNum, { color: '#f59e0b' }]}>
                      {estadisticas[estudianteSeleccionado.id]?.permisos || 0}
                    </Text>
                    <Text style={styles.kardexLbl}>Permisos</Text>
                  </View>
                  <View style={styles.kardexItem}>
                    <Text style={[styles.kardexNum, { color: '#38bdf8' }]}>
                      {estadisticas[estudianteSeleccionado.id]?.bajas || 0}
                    </Text>
                    <Text style={styles.kardexLbl}>Bajas</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.kardexSeccionFechas}>Detalle de Inasistencias:</Text>
                  {esComando && (
                    <Text style={{ fontSize: 10, color: '#38bdf8', fontWeight: '700' }}>
                      Toque para justificar
                    </Text>
                  )}
                </View>

                {cargandoDetalle ? (
                  <ActivityIndicator size="small" color="#38bdf8" style={{ marginVertical: 10 }} />
                ) : historialDetalle.length === 0 ? (
                  <Text style={styles.sinNovedadesTxt}>Sin faltas ni permisos registrados.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 150, marginBottom: 14 }}>
                    {historialDetalle.map((item, idx) => {
                      const fecha = item.sesiones?.fecha || 'Fecha no registrada';
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.filaHistorialFecha}
                          activeOpacity={esComando ? 0.7 : 1}
                          onPress={() => modificarInasistencia(item)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons
                              name={
                                item.estado === 'FALTA'
                                  ? 'close-circle'
                                  : item.estado === 'PERMISO'
                                  ? 'alert-circle'
                                  : 'medkit'
                              }
                              size={16}
                              color={
                                item.estado === 'FALTA'
                                  ? '#ef4444'
                                  : item.estado === 'PERMISO'
                                  ? '#f59e0b'
                                  : '#38bdf8'
                              }
                            />
                            <Text style={styles.txtHistorialFecha}>Sábado: {fecha}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              style={[
                                styles.tagHistorialEstado,
                                item.estado === 'FALTA' && styles.tagFal,
                                item.estado === 'PERMISO' && styles.tagPer,
                                item.estado === 'BAJA_MEDICA' && styles.tagMed,
                              ]}
                            >
                              {item.estado === 'BAJA_MEDICA' ? 'BAJA' : item.estado}
                            </Text>
                            {esComando && (
                              <Ionicons name="pencil" size={12} color="#38bdf8" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={styles.btnCerrarKardex}
                  onPress={() => setModalKardexVisible(false)}
                >
                  <Text style={styles.btnCerrarKardexTxt}>Cerrar Ficha</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Crear / Editar */}
      <Modal visible={modalRegistroVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>
              {estudianteAEditar ? 'Editar Estudiante' : `Registrar en ${esComando ? carreraSeleccionada.replace(/_/g, ' ') : nombreCarrera.replace(/_/g, ' ')}`}
            </Text>

            {esComando && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.lblSelector}>Asignar Carrera:</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {[
                    { id: 'ING_COMERCIAL', label: 'Comercial' },
                    { id: 'CIENCIAS_BASICAS', label: 'Básicas' },
                    { id: 'TECNOLOGICO', label: 'Tecnológico' },
                  ].map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chipCarrera,
                        carreraSeleccionada === c.id && styles.chipCarreraActivo,
                      ]}
                      onPress={() => setCarreraSeleccionada(c.id)}
                    >
                      <Text
                        style={[
                          styles.chipCarreraTxt,
                          carreraSeleccionada === c.id && styles.chipCarreraTxtActivo,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Cédula de Identidad (CI)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={ci}
              onChangeText={setCi}
            />
            <TextInput
              style={styles.input}
              placeholder="Código SAGA (Opcional)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={codigoSaga}
              onChangeText={setCodigoSaga}
            />
            <TextInput
              style={styles.input}
              placeholder="Apellidos"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={apellidos}
              onChangeText={setApellidos}
            />
            <TextInput
              style={styles.input}
              placeholder="Nombres"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={nombres}
              onChangeText={setNombres}
            />

            <View style={styles.modalAcciones}>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnCancelar]}
                onPress={() => {
                  setModalRegistroVisible(false);
                  setEstudianteAEditar(null);
                }}
              >
                <Text style={styles.btnTxtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAccion, styles.btnGuardar]}
                onPress={guardarEstudiante}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnTxtGuardar}>
                    {estudianteAEditar ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerCarrera: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  headerTitulo: { fontSize: 14, fontWeight: '900', color: '#38bdf8' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  bold: { color: '#f8fafc', fontWeight: '800' },
  btnNuevo: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnNuevoTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  buscadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buscadorInput: { flex: 1, fontSize: 13, color: '#f8fafc', padding: 0 },
  vacioTxt: { textAlign: 'center', marginTop: 40, color: '#64748b' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardInhabilitado: {
    borderColor: '#ef4444',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  indice: { width: 30, fontSize: 13, fontWeight: '800', color: '#94a3b8' },
  infoCol: { flex: 1, marginRight: 8 },
  nombre: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  ci: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  miniStat: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  badgeInhabilitado: {
    backgroundColor: '#450a0a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  badgeInhabilitadoTxt: { color: '#f87171', fontSize: 9, fontWeight: '900' },
  accionesFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnMiniAccion: { padding: 6, borderRadius: 6 },
  kardexCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kardexHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kardexTitulo: { fontSize: 16, fontWeight: '900', color: '#f8fafc' },
  kardexNombre: { fontSize: 15, fontWeight: '800', color: '#f8fafc' },
  kardexSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  kardexCarrera: { fontSize: 12, color: '#38bdf8', fontWeight: '700', marginTop: 2, marginBottom: 12 },
  dictamenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
  },
  dictamenInhabilitado: { backgroundColor: '#450a0a', borderColor: '#ef4444' },
  dictamenHabilitado: { backgroundColor: '#052e16', borderColor: '#16a34a' },
  dictamenTxt: { fontSize: 11, fontWeight: '800', flex: 1 },
  kardexGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  kardexItem: { alignItems: 'center' },
  kardexNum: { fontSize: 18, fontWeight: '900' },
  kardexLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  kardexSeccionFechas: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sinNovedadesTxt: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  filaHistorialFecha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  txtHistorialFecha: { fontSize: 12, fontWeight: '700', color: '#f8fafc' },
  tagHistorialEstado: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagFal: { backgroundColor: '#450a0a', color: '#f87171' },
  tagPer: { backgroundColor: '#451a03', color: '#fbbf24' },
  tagMed: { backgroundColor: '#082f49', color: '#38bdf8' },
  btnCerrarKardex: {
    backgroundColor: '#0284c7',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCerrarKardexTxt: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
  lblSelector: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipCarrera: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipCarreraActivo: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipCarreraTxt: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  chipCarreraTxtActivo: { color: '#ffffff' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 11,
    marginBottom: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  modalAcciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btnAccion: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  btnCancelar: { backgroundColor: '#e2e8f0' },
  btnGuardar: { backgroundColor: '#16a34a' },
  btnTxtCancelar: { fontWeight: '700', fontSize: 13, color: '#475569' },
  btnTxtGuardar: { fontWeight: '800', fontSize: 13, color: '#ffffff' },
});