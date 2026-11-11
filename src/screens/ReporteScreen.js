import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

export default function ReporteScreen({ route }) {
  const { instructor } = route.params || {};
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [reporteCarreras, setReporteCarreras] = useState([]);
  const [novedadesLista, setNovedadesLista] = useState([]);
  const [mostrarDesglose, setMostrarDesglose] = useState(false);

  // Estados para historial de fechas y auditoría
  const [modalHistorial, setModalHistorial] = useState(false);
  const [listaFechas, setListaFechas] = useState([]);

  // Fecha exacta en tiempo real para Bolivia (America/La_Paz, YYYY-MM-DD)
  const getFechaBolivia = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const [fechaActiva, setFechaActiva] = useState(getFechaBolivia());

  const [granTotal, setGranTotal] = useState({
    efectivo: 0,
    permiso: 0,
    bajaMedica: 0,
    falta: 0,
    noForman: 0,
    forman: 0,
    total: 0,
  });

  const primerApellido = instructor?.apellidos
    ? instructor.apellidos.trim().split(' ')[0]
    : '';

  useEffect(() => {
    cargarCentralizador(fechaActiva);

    const canal = supabase
      .channel('cambios-asistencia-reporte')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencias' }, () => {
        cargarCentralizador(fechaActiva);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => {
        cargarCentralizador(fechaActiva);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [fechaActiva]);

  const cargarCentralizador = async (fechaConsultada, sesionIdForzada = null) => {
    try {
      setCargando(true);
      let sesionData = null;

      if (sesionIdForzada) {
        const { data } = await supabase
          .from('sesiones')
          .select('*')
          .eq('id', sesionIdForzada)
          .single();
        sesionData = data;
      } else {
        const { data: sesionAbierta } = await supabase
          .from('sesiones')
          .select('*')
          .eq('fecha', fechaConsultada)
          .eq('cerrada', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        sesionData = sesionAbierta;

        if (!sesionData) {
          const { data: sesionReciente } = await supabase
            .from('sesiones')
            .select('*')
            .eq('fecha', fechaConsultada)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          sesionData = sesionReciente;
        }
      }

      if (!sesionData) {
        setSesion(null);
        setReporteCarreras([]);
        setNovedadesLista([]);
        setGranTotal({
          efectivo: 0,
          permiso: 0,
          bajaMedica: 0,
          falta: 0,
          noForman: 0,
          forman: 0,
          total: 0,
        });
        setCargando(false);
        return;
      }
      setSesion(sesionData);

      // Si la sesión está congelada y tiene su snapshot JSON
      if (sesionData.cerrada && sesionData.resumen_parte) {
        const snap = sesionData.resumen_parte;
        setGranTotal(snap.totales || {});
        setNovedadesLista(snap.novedades || []);
        setReporteCarreras(snap.carreras || []);
        setCargando(false);
        return;
      }

      // Procesamiento en vivo para sesión abierta
      const { data: carrerasData } = await supabase
        .from('carreras')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      const { data: estudiantesData } = await supabase
        .from('estudiantes')
        .select('id, apellidos, nombres, ci, codigo_saga, carrera, carrera_codigo')
        .eq('activo', true);

      const { data: asistenciasData } = await supabase
        .from('asistencias')
        .select('estudiante_id, estado')
        .eq('sesion_id', sesionData.id);

      const mapaMarcas = {};
      asistenciasData?.forEach((a) => {
        mapaMarcas[a.estudiante_id] = a.estado;
      });

      let gEfectivo = 0, gPermiso = 0, gBaja = 0, gFalta = 0, gNoForman = 0, gForman = 0;
      const listaNovedades = [];

      const consolidado = (carrerasData || []).map((car) => {
        const alumnos = (estudiantesData || []).filter(
          (e) => e.carrera === car.codigo || e.carrera_codigo === car.codigo
        );

        let per = 0, med = 0, fal = 0, pres = 0;

        alumnos.forEach((e) => {
          const estado = mapaMarcas[e.id] || 'PRESENTE';
          if (estado === 'FALTA') {
            fal++;
            listaNovedades.push({ ...e, novedad: 'FALTA', carreraNombre: car.nombre });
          } else if (estado === 'PERMISO') {
            per++;
            listaNovedades.push({ ...e, novedad: 'PERMISO', carreraNombre: car.nombre });
          } else if (estado === 'BAJA_MEDICA') {
            med++;
            listaNovedades.push({ ...e, novedad: 'BAJA MÉDICA', carreraNombre: car.nombre });
          } else if (estado === 'PRESENTE') {
            pres++;
          }
        });

        const noForman = per + med + fal;
        const forman = pres;
        const total = forman + noForman;

        gEfectivo += alumnos.length;
        gPermiso += per;
        gBaja += med;
        gFalta += fal;
        gNoForman += noForman;
        gForman += forman;

        return {
          nombre: car.nombre,
          efectivo: alumnos.length,
          permiso: per,
          bajaMedica: med,
          falta: fal,
          noForman,
          forman,
          total,
        };
      });

      setReporteCarreras(consolidado);
      setNovedadesLista(listaNovedades);
      setGranTotal({
        efectivo: gEfectivo,
        permiso: gPermiso,
        bajaMedica: gBaja,
        falta: gFalta,
        noForman: gNoForman,
        forman: gForman,
        total: gForman + gNoForman,
      });

    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const rectificarAtraso = (itemNovedad) => {
    if (sesion?.cerrada) {
      Alert.alert('Parte Cerrado', 'Este parte ya está congelado oficialmente y no admite modificaciones.');
      return;
    }

    Alert.alert(
      'Incorporación por Atraso',
      `¿El cadete ${itemNovedad.apellidos}, ${itemNovedad.nombres} (${itemNovedad.carreraNombre}) se presentó a la formación?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar Presente',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('asistencias')
                .update({ estado: 'PRESENTE' })
                .eq('sesion_id', sesion.id)
                .eq('estudiante_id', itemNovedad.id);

              if (error) throw error;
              cargarCentralizador(fechaActiva);
            } catch (err) {
              Alert.alert('Error al rectificar', err.message);
            }
          },
        },
      ]
    );
  };

  const culminarYGuardarParteOficial = async () => {
    if (!sesion) return;

    Alert.alert(
      'Culminación Oficial de Formación',
      '¿Desea congelar y sellar el parte de hoy? Se guardará el consolidado final con las novedades vigentes y se cerrará la sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar y Guardar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCargando(true);
              const respNombre = instructor ? `${instructor.grado} ${primerApellido}` : 'Comando CFOR';
              
              const snapshotParte = {
                totales: granTotal,
                novedades: novedadesLista.map((n) => ({
                  id: n.id,
                  apellidos: n.apellidos,
                  nombres: n.nombres,
                  carreraNombre: n.carreraNombre,
                  ci: n.ci,
                  novedad: n.novedad,
                })),
                carreras: reporteCarreras,
              };

              const { error } = await supabase
                .from('sesiones')
                .update({
                  cerrada: true,
                  cerrada_por: respNombre,
                  hora_cierre: new Date().toISOString(),
                  resumen_parte: snapshotParte,
                })
                .eq('id', sesion.id);

              if (error) throw error;
              
              Alert.alert('Parte Culminado', 'El parte ha sido archivado exitosamente.');
              await cargarCentralizador(fechaActiva);
              compartirCentralizadoWhatsApp();
            } catch (err) {
              Alert.alert('Error al culminar', err.message);
            } finally {
              setCargando(false);
            }
          },
        },
      ]
    );
  };

  const abrirHistorial = async () => {
    try {
      const { data, error } = await supabase
        .from('sesiones')
        .select('id, fecha, cerrada, cerrada_por, created_at, hora_cierre')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListaFechas(data || []);
      setModalHistorial(true);
    } catch (e) {
      Alert.alert('Error al cargar historial', e.message);
    }
  };

  const compartirCentralizadoWhatsApp = async () => {
    const alinearFila = (concepto, cantidad) => `${concepto.padEnd(16, '.')}: ${cantidad}`;
    const responsable = sesion?.cerrada_por || (instructor ? `${instructor.grado} ${primerApellido}` : 'Comando CFOR');

    let mensaje = 
`📋 *PARTE COMPAÑÍA CFOR*
🗓 *Fecha:* ${fechaActiva}

\`\`\`
${alinearFila('• Efectivo', granTotal.efectivo)}
${alinearFila('• Permiso', granTotal.permiso)}
${alinearFila('• Baja Médica', granTotal.bajaMedica)}
${alinearFila('• Falta', granTotal.falta)}
------------------------
${alinearFila('• No Forman', granTotal.noForman)}
${alinearFila('• Forman', granTotal.forman)}
${alinearFila('• Total', granTotal.total)}
\`\`\`
------------------------`;

    if (novedadesLista.length > 0) {
      mensaje += `\n*RELACIÓN NOMINAL DE NOVEDADES:*\n`;
      const faltas = novedadesLista.filter((n) => n.novedad === 'FALTA');
      const permisos = novedadesLista.filter((n) => n.novedad === 'PERMISO');
      const bajas = novedadesLista.filter((n) => n.novedad === 'BAJA MÉDICA');

      if (faltas.length > 0) {
        mensaje += `\n❌ *FALTAS (${faltas.length}):*\n`;
        faltas.forEach((f, idx) => {
          mensaje += `${idx + 1}. ${f.apellidos}, ${f.nombres} (${f.carreraNombre})\n`;
        });
      }
      if (permisos.length > 0) {
        mensaje += `\n⚠️ *PERMISOS (${permisos.length}):*\n`;
        permisos.forEach((p, idx) => {
          mensaje += `${idx + 1}. ${p.apellidos}, ${p.nombres} (${p.carreraNombre})\n`;
        });
      }
      if (bajas.length > 0) {
        mensaje += `\n🏥 *BAJAS MÉDICAS (${bajas.length}):*\n`;
        bajas.forEach((b, idx) => {
          mensaje += `${idx + 1}. ${b.apellidos}, ${b.nombres} (${b.carreraNombre})\n`;
        });
      }
      mensaje += `------------------------\n`;
    } else {
      mensaje += `\n*Sin novedades que reportar (100% de efectividad).*\n------------------------\n`;
    }

    mensaje += `Resp: ${responsable}`;

    try {
      await Share.share({ message: mensaje });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#141810" />

      {/* Franja Camuflada MultiCam Superior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1.2 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.6 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 1.1 }]} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
        {/* Barra de Fecha e Historial */}
        <View style={styles.barraFechaHeader}>
          <View>
            <Text style={styles.fechaActivaTxt}>Sábado: {fechaActiva}</Text>
            <Text style={styles.estadoSesionTxt}>
              {sesion?.cerrada ? '🔒 CONGELADO / CERRADO' : '🟢 FORMACIÓN EN CURSO'}
            </Text>
          </View>

          <TouchableOpacity style={styles.btnHistorial} onPress={abrirHistorial}>
            <Ionicons name="calendar-outline" size={16} color="#dda15e" style={{ marginRight: 4 }} />
            <Text style={styles.btnHistorialTxt}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* Botón WhatsApp */}
        <TouchableOpacity style={styles.btnWhatsapp} onPress={compartirCentralizadoWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#fefae0" style={{ marginRight: 8 }} />
          <Text style={styles.btnWhatsappTxt}>Enviar Parte General Completo</Text>
        </TouchableOpacity>

        {cargando ? (
          <ActivityIndicator size="large" color="#dda15e" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Tarjeta Consolidado General */}
            <View style={styles.cardGranTotal}>
              <View style={styles.headerBadge}>
                <Text style={styles.cardTitulo}>PARTE GENERAL CFOR</Text>
                <View style={[styles.badgeEnVivo, sesion?.cerrada && { backgroundColor: '#222b1a', borderColor: '#414833' }]}>
                  <View style={[styles.puntoVerde, sesion?.cerrada && { backgroundColor: '#a3b18a' }]} />
                  <Text style={[styles.txtEnVivo, sesion?.cerrada && { color: '#a3b18a' }]}>
                    {sesion?.cerrada ? 'Cerrado' : 'En vivo'}
                  </Text>
                </View>
              </View>

              <View style={styles.fila}><Text style={styles.lbl}>• Efectivo Total</Text><Text style={styles.val}>{granTotal.efectivo}</Text></View>
              <View style={styles.fila}><Text style={styles.lbl}>• Permiso Total</Text><Text style={styles.val}>{granTotal.permiso}</Text></View>
              <View style={styles.fila}><Text style={styles.lbl}>• Baja Médica Total</Text><Text style={styles.val}>{granTotal.bajaMedica}</Text></View>
              <View style={styles.fila}><Text style={styles.lbl}>• Falta Total</Text><Text style={[styles.val, { color: '#f87171' }]}>{granTotal.falta}</Text></View>
              
              <View style={styles.separador} />

              <View style={styles.fila}><Text style={styles.lblBold}>• No Forman Total</Text><Text style={styles.valBold}>{granTotal.noForman}</Text></View>
              <View style={styles.fila}><Text style={styles.lblBold}>• Forman Total</Text><Text style={[styles.valBold, { color: '#dda15e' }]}>{granTotal.forman}</Text></View>
              <View style={styles.fila}><Text style={styles.lblBold}>• Total General</Text><Text style={styles.valBold}>{granTotal.total}</Text></View>
            </View>

            {/* Botón Culminar y Congelar */}
            {!sesion?.cerrada && sesion && (
              <TouchableOpacity style={styles.btnCerrarSesion} onPress={culminarYGuardarParteOficial}>
                <Ionicons name="lock-closed" size={16} color="#fefae0" style={{ marginRight: 6 }} />
                <Text style={styles.btnCerrarSesionTxt}>Culminar y Congelar Parte Oficial</Text>
              </TouchableOpacity>
            )}

            {/* Novedades con Rectificación */}
            {novedadesLista.length > 0 && (
              <View style={styles.cardNovedades}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={styles.novedadesTitulo}>Novedades del Personal ({novedadesLista.length})</Text>
                  {!sesion?.cerrada && (
                    <Text style={{ fontSize: 11, color: '#dda15e', fontWeight: '700' }}>Toque para justificar atraso</Text>
                  )}
                </View>

                {novedadesLista.map((n, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.itemNovedad}
                    activeOpacity={sesion?.cerrada ? 1 : 0.7}
                    onPress={() => rectificarAtraso(n)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.novNombre}>{n.apellidos}, {n.nombres}</Text>
                      <Text style={styles.novSub}>{n.carreraNombre} • CI: {n.ci}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.tagBadge,
                          n.novedad === 'FALTA' && styles.tagFal,
                          n.novedad === 'PERMISO' && styles.tagPer,
                          n.novedad === 'BAJA MÉDICA' && styles.tagMed,
                        ]}
                      >
                        <Text style={styles.tagTxt}>{n.novedad}</Text>
                      </View>
                      {!sesion?.cerrada && (
                        <Ionicons name="create-outline" size={16} color="#dda15e" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Acordeón de Desglose por Carrera */}
            <TouchableOpacity
              style={styles.btnColapsar}
              onPress={() => setMostrarDesglose(!mostrarDesglose)}
            >
              <Ionicons
                name={mostrarDesglose ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
                size={18}
                color="#dda15e"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.btnColapsarTxt}>
                {mostrarDesglose ? 'Minimizar detalle por carreras' : 'Ver desglose numérico por carrera'}
              </Text>
            </TouchableOpacity>

            {mostrarDesglose && (
              <View style={{ marginTop: 8 }}>
                {reporteCarreras.map((c, i) => (
                  <View key={i} style={styles.cardFormato}>
                    <Text style={styles.subTituloCarrera}>Parte de "{c.nombre}"</Text>
                    
                    <View style={styles.fila}><Text style={styles.lbl}>• Efectivo</Text><Text style={styles.val}>{c.efectivo}</Text></View>
                    <View style={styles.fila}><Text style={styles.lbl}>• Permiso</Text><Text style={styles.val}>{c.permiso}</Text></View>
                    <View style={styles.fila}><Text style={styles.lbl}>• Baja Médica</Text><Text style={styles.val}>{c.bajaMedica}</Text></View>
                    <View style={styles.fila}><Text style={styles.lbl}>• Falta</Text><Text style={[styles.val, { color: '#f87171' }]}>{c.falta}</Text></View>
                    
                    <View style={styles.separador} />

                    <View style={styles.fila}><Text style={styles.lblBold}>• No Forman</Text><Text style={styles.valBold}>{c.noForman}</Text></View>
                    <View style={styles.fila}><Text style={styles.lblBold}>• Forman</Text><Text style={[styles.valBold, { color: '#dda15e' }]}>{c.forman}</Text></View>
                    <View style={styles.fila}><Text style={styles.lblBold}>• Total</Text><Text style={styles.valBold}>{c.total}</Text></View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Modal Selector de Historial */}
        <Modal visible={modalHistorial} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitulo}>Historial de Formaciones</Text>
              <Text style={styles.modalSub}>Seleccione una formación para auditar o revisar:</Text>

              <ScrollView style={{ maxHeight: 280, marginVertical: 10 }}>
                {listaFechas.map((item, idx) => {
                  const hora = item.created_at
                    ? new Date(item.created_at).toLocaleTimeString('es-BO', {
                        timeZone: 'America/La_Paz',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={[
                        styles.itemFecha,
                        sesion?.id === item.id && styles.itemFechaActiva,
                      ]}
                      onPress={() => {
                        setFechaActiva(item.fecha);
                        setModalHistorial(false);
                        cargarCentralizador(item.fecha, item.id);
                      }}
                    >
                      <View>
                        <Text style={styles.fechaItemTxt}>
                          {item.fecha} {hora ? `(${hora})` : ''}
                        </Text>
                        <Text style={styles.fechaItemSub}>
                          {item.cerrada ? `Cerrado por: ${item.cerrada_por || 'Comando'}` : '🟢 En curso'}
                        </Text>
                      </View>
                      <Ionicons
                        name={item.cerrada ? 'lock-closed' : 'radio-button-on'}
                        size={16}
                        color={item.cerrada ? '#f87171' : '#dda15e'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.btnCerrarModal}
                onPress={() => setModalHistorial(false)}
              >
                <Text style={styles.btnCerrarModalTxt}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>

      {/* Franja Camuflada MultiCam Inferior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 0.9 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.7 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1.3 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#141810' },
  container: { flex: 1, backgroundColor: '#141810' },
  camoStripeContainer: {
    height: 6,
    flexDirection: 'row',
    width: '100%',
  },
  camoBlock: { height: '100%' },
  barraFechaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c2217',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  fechaActivaTxt: { fontSize: 14, fontWeight: '800', color: '#fefae0' },
  estadoSesionTxt: { fontSize: 11, fontWeight: '700', color: '#dda15e', marginTop: 2 },
  btnHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#141810',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dda15e',
  },
  btnHistorialTxt: { color: '#dda15e', fontSize: 12, fontWeight: '700' },
  btnWhatsapp: {
    backgroundColor: '#606c38',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dda15e',
    elevation: 3,
  },
  btnWhatsappTxt: { color: '#fefae0', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  btnCerrarSesion: {
    backgroundColor: '#3e1f1d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  btnCerrarSesionTxt: { color: '#fca5a5', fontSize: 13, fontWeight: '800' },
  cardGranTotal: {
    backgroundColor: '#1c2217',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#dda15e',
    marginBottom: 12,
  },
  headerBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitulo: { fontSize: 16, fontWeight: '900', color: '#dda15e', textDecorationLine: 'underline' },
  badgeEnVivo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#283618',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#606c38',
  },
  puntoVerde: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dda15e', marginRight: 5 },
  txtEnVivo: { color: '#dda15e', fontSize: 11, fontWeight: '700' },
  cardNovedades: {
    backgroundColor: '#1c2217',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  novedadesTitulo: { fontSize: 14, fontWeight: '800', color: '#fefae0' },
  itemNovedad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#414833',
  },
  novNombre: { fontSize: 13, fontWeight: '700', color: '#fefae0' },
  novSub: { fontSize: 11, color: '#a3b18a', marginTop: 2 },
  tagBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  tagFal: { backgroundColor: '#7f1d1d' },
  tagPer: { backgroundColor: '#b45309' },
  tagMed: { backgroundColor: '#60492c' },
  tagTxt: { color: '#fefae0', fontSize: 10, fontWeight: '800' },
  cardFormato: {
    backgroundColor: '#1c2217',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  subTituloCarrera: { fontSize: 14, fontWeight: '800', color: '#fefae0', marginBottom: 8, textDecorationLine: 'underline' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lbl: { fontSize: 13, color: '#a3b18a' },
  val: { fontSize: 13, fontWeight: '700', color: '#fefae0' },
  separador: { height: 1, backgroundColor: '#414833', marginVertical: 6 },
  lblBold: { fontSize: 13, fontWeight: '800', color: '#dda15e' },
  valBold: { fontSize: 13, fontWeight: '800', color: '#fefae0' },
  btnColapsar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1c2217',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#414833',
  },
  btnColapsarTxt: { color: '#dda15e', fontSize: 12, fontWeight: '700' },
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
  modalTitulo: { fontSize: 16, fontWeight: '800', color: '#fefae0' },
  modalSub: { fontSize: 12, color: '#a3b18a', marginTop: 4, marginBottom: 8 },
  itemFecha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#141810',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#414833',
  },
  itemFechaActiva: {
    borderColor: '#dda15e',
  },
  fechaItemTxt: { fontSize: 14, fontWeight: '700', color: '#fefae0' },
  fechaItemSub: { fontSize: 11, color: '#a3b18a', marginTop: 2 },
  btnCerrarModal: {
    backgroundColor: '#414833',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnCerrarModalTxt: { color: '#fefae0', fontWeight: '700', fontSize: 13 },
});