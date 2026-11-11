import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const BOTONES_ESTADO = [
  { id: 'PRESENTE', label: 'P', color: '#283618', activeColor: '#606c38', textColor: '#fefae0' },
  { id: 'FALTA', label: 'F', color: '#7f1d1d', activeColor: '#dc2626', textColor: '#fefae0' },
  { id: 'PERMISO', label: 'PER', color: '#b45309', activeColor: '#d97706', textColor: '#fefae0' },
  { id: 'BAJA_MEDICA', label: 'MED', color: '#60492c', activeColor: '#dda15e', textColor: '#141810' },
];

export default function AsistenciaScreen({ route, navigation }) {
  const { instructor, carrera, carreraInicial } = route.params || {};

  const codigoCarrera = carrera?.codigo || carreraInicial;
  const nombreCarreraReal =
    carrera?.nombre ||
    (typeof carrera === 'string' ? carrera : null) ||
    carreraInicial ||
    'Carrera Asignada';

  const primerApellido = instructor?.apellidos
    ? instructor.apellidos.trim().split(' ')[0]
    : '';

  const [estudiantes, setEstudiantes] = useState([]);
  const [marcas, setMarcas] = useState({});
  const [sesion, setSesion] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalParteVisible, setModalParteVisible] = useState(false);
  const [parteTransmitido, setParteTransmitido] = useState(false);

  // Fecha exacta en tiempo real para Bolivia (America/La_Paz, YYYY-MM-DD)
  const getFechaBolivia = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const fechaHoy = getFechaBolivia();

  useFocusEffect(
    useCallback(() => {
      inicializarPantalla();
    }, [])
  );

  const inicializarPantalla = async () => {
    try {
      setCargando(true);

      // 1. Buscar si hay una sesión ABIERTA en curso hoy
      let { data: sesionAbierta } = await supabase
        .from('sesiones')
        .select('*')
        .eq('fecha', fechaHoy)
        .eq('cerrada', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let sesionData = sesionAbierta;

      // Si no existe ninguna sesión abierta hoy
      if (!sesionData) {
        const { data: nuevaSesion, error: insertError } = await supabase
          .from('sesiones')
          .insert([{ 
            fecha: fechaHoy, 
            observaciones: 'Formación CFOR', 
            cerrada: false,
            carreras_entregadas: []
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        sesionData = nuevaSesion;
      }

      setSesion(sesionData);

      // Verificar si ESTA carrera ya fue entregada en la sesión actual
      const yaEntregada = (sesionData.carreras_entregadas || []).includes(codigoCarrera);
      setParteTransmitido(yaEntregada);

      // 2. Cargar todos los estudiantes activos de la carrera
      const { data: todosEstudiantes, error: estError } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('activo', true)
        .order('apellidos', { ascending: true });

      if (estError) throw estError;

      const estFiltrados = (todosEstudiantes || []).filter((e) => {
        if (!codigoCarrera || codigoCarrera === 'TODAS') return true;
        const carreraEst = (e.carrera || e.carrera_codigo || '').toUpperCase().trim();
        const carreraFiltro = (codigoCarrera || '').toUpperCase().trim();

        return (
          carreraEst === carreraFiltro ||
          carreraEst.replace(/\s+/g, '_') === carreraFiltro ||
          carreraFiltro.includes(carreraEst)
        );
      });

      setEstudiantes(estFiltrados);

      // 3. Cargar las marcas actuales registradas en esta sesión
      const { data: asisData, error: asisError } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado')
        .eq('sesion_id', sesionData.id);

      if (asisError) throw asisError;

      const mapaMarcas = {};
      asisData?.forEach((reg) => {
        mapaMarcas[reg.estudiante_id] = reg.estado;
      });
      setMarcas(mapaMarcas);

    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setCargando(false);
    }
  };

  const asignarEstado = async (estudianteId, nuevoEstado) => {
    if (parteTransmitido) {
      Alert.alert(
        'Parte Sellado',
        'El parte de esta sección ya fue transmitido. Todo cadete atrasado debe incorporarse directamente con el Comandante de Compañía.'
      );
      return;
    }

    setMarcas((prev) => ({ ...prev, [estudianteId]: nuevoEstado }));

    try {
      const { error } = await supabase.from('asistencias').upsert(
        {
          sesion_id: sesion.id,
          estudiante_id: estudianteId,
          estado: nuevoEstado,
          instructor_id: instructor?.id || null,
        },
        { onConflict: 'sesion_id,estudiante_id' }
      );
      if (error) throw error;
    } catch (err) {
      Alert.alert('Error al guardar', err.message);
      inicializarPantalla();
    }
  };

  const marcarTodosPresentes = async () => {
    if (parteTransmitido) return;
    if (!sesion || estudiantes.length === 0) return;

    const nuevasMarcas = { ...marcas };
    const registrosUpsert = estudiantes.map((e) => {
      nuevasMarcas[e.id] = 'PRESENTE';
      return {
        sesion_id: sesion.id,
        estudiante_id: e.id,
        estado: 'PRESENTE',
        instructor_id: instructor?.id || null,
      };
    });

    setMarcas(nuevasMarcas);

    try {
      const { error } = await supabase
        .from('asistencias')
        .upsert(registrosUpsert, { onConflict: 'sesion_id,estudiante_id' });
      if (error) throw error;
    } catch (err) {
      Alert.alert('Error masivo', err.message);
      inicializarPantalla();
    }
  };

  const reiniciarPaseActual = () => {
    if (parteTransmitido) return;

    Alert.alert(
      'Nuevo Control',
      '¿Desea limpiar las marcas de esta carrera para tomar una nueva lista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar Todo',
          style: 'destructive',
          onPress: async () => {
            setMarcas({});
            const idsEstudiantes = estudiantes.map((e) => e.id);
            await supabase
              .from('asistencias')
              .delete()
              .eq('sesion_id', sesion.id)
              .in('estudiante_id', idsEstudiantes);
          },
        },
      ]
    );
  };

  const totales = {
    total: estudiantes.length,
    presentes: estudiantes.filter((e) => (marcas[e.id] || 'PRESENTE') === 'PRESENTE').length,
    faltas: estudiantes.filter((e) => marcas[e.id] === 'FALTA').length,
    permisos: estudiantes.filter((e) => marcas[e.id] === 'PERMISO').length,
    bajas: estudiantes.filter((e) => marcas[e.id] === 'BAJA_MEDICA').length,
  };

  const noFormanTotal = totales.permisos + totales.bajas + totales.faltas;
  const formanTotal = totales.presentes;
  const totalBalance = formanTotal + noFormanTotal;

  const confirmarYEnviarParte = () => {
    setModalParteVisible(true);
  };

  const enviarAlCentralizador = async () => {
    setModalParteVisible(false);
    setParteTransmitido(true);

    try {
      const carrerasActuales = sesion?.carreras_entregadas || [];
      if (!carrerasActuales.includes(codigoCarrera)) {
        const nuevasEntregadas = [...carrerasActuales, codigoCarrera];
        await supabase
          .from('sesiones')
          .update({ carreras_entregadas: nuevasEntregadas })
          .eq('id', sesion.id);

        setSesion((prev) => ({ ...prev, carreras_entregadas: nuevasEntregadas }));
      }

      Alert.alert(
        'Parte Entregado',
        `El parte de ${nombreCarreraReal.replace(/_/g, ' ')} ha sido transmitido al Comando Central.\n\nTodo cadete atrasado debe incorporarse directamente con el Comandante de Compañía.`,
        [{ text: 'Entendido' }]
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'No se pudo sellar la entrega en la base de datos.');
    }
  };

  const estudiantesFiltrados = estudiantes.filter((e) => {
    const termino = busqueda.toLowerCase();
    const ci = e.ci ? e.ci.toLowerCase() : '';
    const saga = e.codigo_saga ? e.codigo_saga.toLowerCase() : '';
    return (
      e.apellidos.toLowerCase().includes(termino) ||
      e.nombres.toLowerCase().includes(termino) ||
      ci.includes(termino) ||
      saga.includes(termino)
    );
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#141810" />

      {/* Franja Camuflada MultiCam Superior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1.2 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.6 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 1.1 }]} />
      </View>

      {/* Cabecera Fija */}
      <View style={styles.bannerCarrera}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.tituloCarrera} numberOfLines={1}>
            {nombreCarreraReal.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.subCarrera} numberOfLines={1}>
            {instructor ? `${instructor.grado} ${primerApellido}` : 'Instructor'} • {fechaHoy}
          </Text>
        </View>

        <View style={styles.accionesHeader}>
          {parteTransmitido ? (
            <View style={styles.badgeParteEntregado}>
              <Ionicons name="lock-closed" size={14} color="#fefae0" style={{ marginRight: 4 }} />
              <Text style={styles.btnVerParteTxt}>Parte Entregado</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.btnReiniciar} 
                onPress={reiniciarPaseActual}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={16} color="#dda15e" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.btnTodosPres} 
                onPress={marcarTodosPresentes}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done-circle" size={16} color="#fefae0" style={{ marginRight: 4 }} />
                <Text style={styles.btnTodosPresTxt}>Presentes</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.btnVerParte} 
                onPress={confirmarYEnviarParte}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={14} color="#141810" style={{ marginRight: 4 }} />
                <Text style={styles.btnVerParteTxtAction}>Enviar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Indicador de Efectivo Total */}
      <View style={styles.efectivoSoloContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="people" size={16} color="#dda15e" />
          <Text style={styles.efectivoSoloLabel}>EFECTIVO TOTAL REGISTRADO</Text>
        </View>
        <Text style={styles.efectivoSoloNum}>{totales.total}</Text>
      </View>

      {/* Buscador Rápido */}
      <View style={styles.buscadorContainer}>
        <Ionicons name="search" size={18} color="#a3b18a" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.buscadorInput}
          placeholder="Buscar por apellido, CI o SAGA..."
          placeholderTextColor="#6c757d"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color="#dda15e" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista con Botonera Directa */}
      {cargando ? (
        <ActivityIndicator size="large" color="#dda15e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={estudiantesFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 30 }}
          ListEmptyComponent={
            <Text style={styles.vacioTxt}>No se encontraron estudiantes para este bloque.</Text>
          }
          renderItem={({ item, index }) => {
            const estadoActual = marcas[item.id] || 'PRESENTE';

            return (
              <View style={styles.cardCompacta}>
                <Text style={styles.indice}>#{index + 1}</Text>

                <View style={styles.infoCol}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {item.apellidos}, {item.nombres}
                  </Text>
                  <Text style={styles.ci}>
                    CI: {item.ci} {item.codigo_saga ? `• SAGA: ${item.codigo_saga}` : ''}
                  </Text>
                </View>

                {/* Botonera de Novedades */}
                <View style={styles.botoneraNovedades}>
                  {BOTONES_ESTADO.map((btn) => {
                    const seleccionado = estadoActual === btn.id;
                    return (
                      <TouchableOpacity
                        key={btn.id}
                        activeOpacity={0.7}
                        disabled={parteTransmitido}
                        onPress={() => asignarEstado(item.id, btn.id)}
                        style={[
                          styles.btnMiniEstado,
                          seleccionado
                            ? { backgroundColor: btn.activeColor, borderColor: '#dda15e' }
                            : { backgroundColor: '#141810', borderColor: '#414833' },
                          parteTransmitido && { opacity: 0.5 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.btnMiniEstadoTxt,
                            seleccionado ? { color: btn.textColor } : { color: '#a3b18a' },
                          ]}
                        >
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal Tabular Encolumnado */}
      <Modal visible={modalParteVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalParteCard}>
            <View style={styles.modalParteHeader}>
              <Ionicons name="document-text-outline" size={20} color="#dda15e" style={{ marginRight: 6 }} />
              <Text style={styles.modalParteTitulo} numberOfLines={1}>
                Parte: {nombreCarreraReal.replace(/_/g, ' ')}
              </Text>
            </View>

            <View style={styles.tablaParte}>
              <View style={styles.filaParte}>
                <Text style={styles.colConcepto}>• Efectivo</Text>
                <Text style={styles.colCantidad}>{totales.total}</Text>
              </View>
              <View style={styles.filaParte}>
                <Text style={styles.colConcepto}>• Permiso</Text>
                <Text style={styles.colCantidad}>{totales.permisos}</Text>
              </View>
              <View style={styles.filaParte}>
                <Text style={styles.colConcepto}>• Baja Médica</Text>
                <Text style={styles.colCantidad}>{totales.bajas}</Text>
              </View>
              <View style={styles.filaParte}>
                <Text style={styles.colConcepto}>• Falta</Text>
                <Text style={[styles.colCantidad, totales.faltas > 0 && { color: '#f87171' }]}>
                  {totales.faltas}
                </Text>
              </View>

              <View style={styles.lineaDivisoria} />

              <View style={styles.filaParte}>
                <Text style={styles.colConceptoBold}>• No Forman</Text>
                <Text style={styles.colCantidadBold}>{noFormanTotal}</Text>
              </View>
              <View style={styles.filaParte}>
                <Text style={styles.colConceptoBold}>• Forman</Text>
                <Text style={[styles.colCantidadBold, { color: '#4ade80' }]}>{formanTotal}</Text>
              </View>
              <View style={styles.filaParte}>
                <Text style={styles.colConceptoBold}>• Total</Text>
                <Text style={styles.colCantidadBold}>{totalBalance}</Text>
              </View>

              <View style={styles.lineaDivisoria} />

              <Text style={styles.respParte}>
                Resp: {instructor ? `${instructor.grado} ${primerApellido}` : 'Instructor'}
              </Text>
            </View>

            <View style={styles.accionesModalParte}>
              <TouchableOpacity
                style={styles.btnModalVolver}
                onPress={() => setModalParteVisible(false)}
              >
                <Text style={styles.txtModalVolver}>VOLVER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnModalAceptar}
                onPress={enviarAlCentralizador}
              >
                <Text style={styles.txtModalAceptar}>TRANSMITIR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  safeArea: { flex: 1, backgroundColor: '#141810' },
  camoStripeContainer: {
    height: 6,
    flexDirection: 'row',
    width: '100%',
  },
  camoBlock: { height: '100%' },
  bannerCarrera: {
    backgroundColor: '#1c2217',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#414833',
  },
  tituloCarrera: { fontSize: 15, fontWeight: '900', color: '#dda15e', letterSpacing: 0.8 },
  subCarrera: { fontSize: 12, color: '#a3b18a', marginTop: 2 },
  accionesHeader: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btnReiniciar: {
    backgroundColor: '#141810',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  btnTodosPres: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#283618',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#414833',
  },
  btnTodosPresTxt: { color: '#fefae0', fontSize: 12, fontWeight: '800' },
  btnVerParte: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dda15e',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnVerParteTxtAction: { color: '#141810', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  badgeParteEntregado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#283618',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dda15e',
  },
  btnVerParteTxt: { color: '#dda15e', fontSize: 12, fontWeight: '800' },
  efectivoSoloContainer: {
    backgroundColor: '#1c2217',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  efectivoSoloLabel: { fontSize: 11, fontWeight: '800', color: '#a3b18a', letterSpacing: 0.8 },
  efectivoSoloNum: { fontSize: 18, fontWeight: '900', color: '#fefae0' },
  buscadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2217',
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  buscadorInput: { flex: 1, fontSize: 13, color: '#fefae0', padding: 0 },
  vacioTxt: { textAlign: 'center', marginTop: 40, color: '#a3b18a' },
  cardCompacta: {
    backgroundColor: '#1c2217',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  indice: { width: 28, fontSize: 12, fontWeight: '800', color: '#dda15e' },
  infoCol: { flex: 1, marginRight: 8 },
  nombre: { fontSize: 13, fontWeight: '700', color: '#fefae0' },
  ci: { fontSize: 11, color: '#a3b18a', marginTop: 1 },
  botoneraNovedades: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnMiniEstado: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnMiniEstadoTxt: {
    fontSize: 10,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalParteCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1c2217',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderColor: '#dda15e',
    elevation: 8,
  },
  modalParteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalParteTitulo: { fontSize: 16, fontWeight: '900', color: '#fefae0', flex: 1 },
  tablaParte: { width: '100%' },
  filaParte: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  colConcepto: { fontSize: 14, color: '#a3b18a', fontWeight: '500' },
  colCantidad: { fontSize: 14, color: '#fefae0', fontWeight: '700', textAlign: 'right', minWidth: 30 },
  colConceptoBold: { fontSize: 14, color: '#dda15e', fontWeight: '800' },
  colCantidadBold: { fontSize: 14, color: '#fefae0', fontWeight: '800', textAlign: 'right', minWidth: 30 },
  lineaDivisoria: { height: 1, backgroundColor: '#414833', marginVertical: 8 },
  respParte: { fontSize: 12, color: '#a3b18a', fontWeight: '600', marginTop: 2, marginBottom: 8 },
  accionesModalParte: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 10 },
  btnModalVolver: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#141810',
    borderWidth: 1,
    borderColor: '#414833',
  },
  txtModalVolver: { color: '#a3b18a', fontSize: 13, fontWeight: '800' },
  btnModalAceptar: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#606c38',
    borderWidth: 1,
    borderColor: '#dda15e',
  },
  txtModalAceptar: { color: '#fefae0', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
});